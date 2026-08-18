import { describe, it, expect, vi } from 'vitest';
import { needsRenewal, isLicensed, createLicense } from './license';
import { GRACE_MS } from '../server/token';

const NOW = Date.UTC(2026, 7, 9, 12, 0, 0);
const ENDPOINT = 'https://buki.test/api/license';

/**
 * TWO DIFFERENT QUESTIONS, and collapsing them into one bills a paying customer for our
 * outage. "Should I renew this?" is about the token's 24 hour life. "Am I still licensed?"
 * is about that life PLUS the seven day grace the proxy honours, because a correctly
 * signed expired token is proof the licence was real yesterday.
 */

describe('needsRenewal', () => {
  it('is true with no session at all', () => {
    expect(needsRenewal(null, NOW)).toBe(true);
  });

  it('is false well before expiry', () => {
    expect(needsRenewal({ token: 't', expiresAt: NOW + 3_600_000 }, NOW)).toBe(false);
  });

  it('is true once expired', () => {
    expect(needsRenewal({ token: 't', expiresAt: NOW - 1 }, NOW)).toBe(true);
  });

  it('renews early rather than at the last second', () => {
    // A token that expires mid-catch turns one catch into two round trips and a retry.
    expect(needsRenewal({ token: 't', expiresAt: NOW + 60_000 }, NOW)).toBe(true);
  });
});

describe('isLicensed', () => {
  it('is false with no session at all', () => {
    expect(isLicensed(null, NOW)).toBe(false);
  });

  it('is true inside the token life', () => {
    expect(isLicensed({ token: 't', expiresAt: NOW + 3_600_000 }, NOW)).toBe(true);
  });

  it('STAYS TRUE past expiry, for as long as the server would still serve it', () => {
    // The whole point. Polar is unreachable, the daily renewal fails, and the token we
    // hold is hours stale. The proxy honours it on grace. If this returned false the
    // extension would decide it is not Pro, fall through to the trial cap, and show the
    // paywall to a subscriber for a request the server was going to answer.
    expect(isLicensed({ token: 't', expiresAt: NOW - 3_600_000 }, NOW)).toBe(true);
  });

  it('gives up once the server would give up too', () => {
    expect(isLicensed({ token: 't', expiresAt: NOW - GRACE_MS - 1000 }, NOW)).toBe(false);
  });
});

describe('createLicense', () => {
  const ok = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status });

  it('exchanges a key for a session', async () => {
    const fetch = vi.fn(async () => ok({ token: 'tok', expiresAt: NOW + 86_400_000 }));
    const license = createLicense({ fetch, endpoint: ENDPOINT, now: () => NOW });
    // Still `toEqual` rather than a loosened matcher: the exchange's whole shape is the
    // contract. `activationId` is '' here because this fixture's response carries none,
    // which is the pre-Polar-activation case and must not read as a real activation.
    expect(await license.exchange('KEY-1')).toEqual({
      ok: true,
      session: { token: 'tok', expiresAt: NOW + 86_400_000 },
      activationId: '',
    });
  });

  it("passes the server's own refusal through, because it says what is wrong", async () => {
    // "Activation limit reached" tells the customer to deactivate another machine.
    // "Something went wrong" tells them to email us.
    const fetch = vi.fn(async () => ok({ error: 'Activation limit reached' }, 403));
    const license = createLicense({ fetch, endpoint: ENDPOINT, now: () => NOW });
    expect(await license.exchange('KEY-1')).toEqual({
      ok: false,
      retryable: false,
      message: 'Activation limit reached',
    });
  });

  it('calls an outage retryable, so the caller keeps the token it has', async () => {
    const fetch = vi.fn(async () => ok({}, 503));
    const license = createLicense({ fetch, endpoint: ENDPOINT, now: () => NOW });
    expect(await license.exchange('KEY-1')).toMatchObject({ ok: false, retryable: true });
  });

  it('calls a network failure retryable rather than throwing at the caller', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const license = createLicense({ fetch, endpoint: ENDPOINT, now: () => NOW });
    expect(await license.exchange('KEY-1')).toMatchObject({ ok: false, retryable: true });
  });

  it('refuses a 200 that is not a session, rather than storing undefined as a token', async () => {
    // A proxy error page, a redirect to a login, a body that changed shape: all arrive as
    // 200 with something that is not a session. Storing it would make `isLicensed` true
    // and every catch fail at the server with no way for the user to see why.
    const fetch = vi.fn(async () => ok({ hello: 'world' }));
    const license = createLicense({ fetch, endpoint: ENDPOINT, now: () => NOW });
    expect(await license.exchange('KEY-1')).toMatchObject({ ok: false, retryable: false });
  });

  it('sends the key in the body, never in the URL', async () => {
    // A query string lands in server logs, browser history and any proxy in between. A
    // licence key is a bearer credential.
    const fetch = vi.fn(async () => ok({ token: 'tok', expiresAt: NOW + 1000 }));
    const license = createLicense({ fetch, endpoint: ENDPOINT, now: () => NOW });
    await license.exchange('SECRET-KEY');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('SECRET-KEY');
    expect(String(init.body)).toContain('SECRET-KEY');
    expect(init.method).toBe('POST');
  });

  it('trims a key pasted with the whitespace an email client added', async () => {
    const fetch = vi.fn(async () => ok({ token: 'tok', expiresAt: NOW + 1000 }));
    const license = createLicense({ fetch, endpoint: ENDPOINT, now: () => NOW });
    await license.exchange('  KEY-1\n');
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).toContain('"KEY-1"');
  });

  it('does not call the server for an empty key', async () => {
    const fetch = vi.fn(async () => ok({}));
    const license = createLicense({ fetch, endpoint: ENDPOINT, now: () => NOW });
    expect(await license.exchange('   ')).toMatchObject({ ok: false, retryable: false });
    expect(fetch).not.toHaveBeenCalled();
  });
});

/**
 * ACTIVATE ONCE, VALIDATE FOREVER — the client's half.
 *
 * Polar's `activate` spends one of a key's five activation slots every time it is called,
 * and this module was the thing calling it, once a day, for ever. Carrying the
 * `activationId` back and forth is what lets the server validate instead.
 */
describe('exchange carries the activation id', () => {
  const ok = (body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  const session = { token: 'tok', expiresAt: NOW + 86_400_000 };

  it('sends no activation id the first time, so the server activates', async () => {
    const fetch = ok({ ...session, activationId: 'act_1' });
    const license = createLicense({ fetch, endpoint: ENDPOINT, now: () => NOW });

    await license.exchange('KEY-1');

    const body = String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(body).not.toContain('activationId');
  });

  it('returns the activation id so the caller can persist it', async () => {
    const fetch = ok({ ...session, activationId: 'act_1' });
    const license = createLicense({ fetch, endpoint: ENDPOINT, now: () => NOW });

    const result = await license.exchange('KEY-1');

    expect(result).toMatchObject({ ok: true, activationId: 'act_1' });
  });

  it('sends the activation id once it has one, so the server validates', async () => {
    const fetch = ok({ ...session, activationId: 'act_1' });
    const license = createLicense({ fetch, endpoint: ENDPOINT, now: () => NOW });

    await license.exchange('KEY-1', 'act_1');

    const body = String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(JSON.parse(body)).toMatchObject({ key: 'KEY-1', activationId: 'act_1' });
  });
});
