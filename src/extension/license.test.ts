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

/**
 * THE CLIENT HALF OF THE SAME BUG, and without it the server half is half a fix.
 *
 * `retryable: res.status >= 500` misses 429 and 408. Our own `keyCap` answers 429
 * (`CHECKS_PER_KEY_PER_DAY = 40`) with the words "Try again tomorrow" — advice that only
 * works if the caller keeps the session it has. It did not: `proState.ts` wrote
 * `session: null`, the token was erased, and the next catch travelled unauthenticated to a
 * server that would have honoured it for another seven days on grace.
 *
 * The rule now comes from `src/shared/retry.ts`, which `llmVision.ts` uses too, so the two
 * clients cannot drift apart again.
 */
describe('what makes the caller keep its session', () => {
  const refusing = (status: number) => ({
    fetch: vi.fn(async () => new Response(JSON.stringify({ error: 'nope' }), { status })),
    endpoint: 'https://get-buki.vercel.app/api/license',
    now: () => 1_000,
  });

  it('keeps the session through OUR OWN rate limit', async () => {
    const license = createLicense(refusing(429));
    expect(await license.exchange('KEY-1')).toMatchObject({ ok: false, retryable: true });
  });

  it('keeps the session through a timeout', async () => {
    const license = createLicense(refusing(408));
    expect(await license.exchange('KEY-1')).toMatchObject({ ok: false, retryable: true });
  });

  it('keeps the session through every server-side failure', async () => {
    for (const status of [500, 502, 503, 504]) {
      const license = createLicense(refusing(status));
      expect(await license.exchange('KEY-1'), `${status}`).toMatchObject({ retryable: true });
    }
  });

  it('gives the session up when Polar has actually answered', async () => {
    // Revoked, refunded, wrong key. This is what lets the options page say what is wrong,
    // and it must keep working — a fix that made everything retryable would leave a
    // cancelled subscriber looking Pro for ever.
    for (const status of [400, 401, 403, 404, 422]) {
      const license = createLicense(refusing(status));
      expect(await license.exchange('KEY-1'), `${status}`).toMatchObject({ retryable: false });
    }
  });
});

/**
 * A 403 THAT IS ABOUT US MUST NOT COST THE CUSTOMER THEIR SESSION.
 *
 * Two 403s from `/api/license` mean opposite things, and until 2026-08-25 the client could
 * not tell them apart:
 *
 *   code: 'licence'   Polar refused this key. Revoked, wrong, activation limit reached.
 *                     An ANSWER. The session should go so the options page can say why.
 *   code: 'origin'    our Origin check refused the CALLER. On launch day that means
 *                     `BUKI_EXTENSION_ID` is not the shipped id — OUR misconfiguration,
 *                     nothing to do with anybody's subscription.
 *
 * With the second read as the first, every renewal 403s, `proState` writes `session: null`,
 * and the bearer token is erased — while `/api/vision` keeps serving token-bearing requests,
 * because it skips the Origin check when a token is present. **So the failure is invisible
 * until tokens age out, eight days later, by which time every subscriber has been signed
 * out by a status that was never about them.** That is item 39's trigger (c), which item 39
 * could not close from either half.
 */
describe('a misconfiguration on our side is not a verdict on the licence', () => {
  const answering = (status: number, body: object) => ({
    fetch: vi.fn(async () => new Response(JSON.stringify(body), { status })),
    endpoint: 'https://get-buki.vercel.app/api/license',
    now: () => 1_000,
  });

  it('KEEPS the session when the server does not recognise us', async () => {
    const license = createLicense(answering(403, { error: 'Not authorised', code: 'origin' }));
    expect(await license.exchange('KEY-1')).toMatchObject({ ok: false, retryable: true });
  });

  it('still gives it up when Polar has answered about the key', async () => {
    // The half that has to keep working. A revoked licence must clear the session, or the
    // options page can never say what is wrong and a cancelled subscriber looks Pro for ever.
    const license = createLicense(
      answering(403, { error: 'That licence is not active.', code: 'licence' }),
    );
    expect(await license.exchange('KEY-1')).toMatchObject({ ok: false, retryable: false });
  });

  it('treats an UNCODED 403 as final, the way it always did', async () => {
    // A server that has not been deployed yet, or any other 403 this client has not been
    // taught about. Unknown means "believe the status", which is the safe direction: it can
    // only ever cost one re-exchange, where the reverse would keep a dead licence alive.
    const license = createLicense(answering(403, { error: 'Not authorised' }));
    expect(await license.exchange('KEY-1')).toMatchObject({ ok: false, retryable: false });
  });

  it('says so in the console, because nothing else will', async () => {
    // There is no telemetry in this product by design, so a log line in the service worker
    // is the entire diagnostic surface. `launch.md` names the spend cap as the primary
    // alarm precisely because the client reports nothing.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const license = createLicense(answering(403, { error: 'Not authorised', code: 'origin' }));
      await license.exchange('KEY-1');
      expect(spy).toHaveBeenCalled();
      expect(String(spy.mock.calls[0]?.[0])).toMatch(/BUKI_EXTENSION_ID/);
    } finally {
      spy.mockRestore();
    }
  });

  it('passes the message through whatever the code says', async () => {
    const license = createLicense(
      answering(403, { error: 'Activation limit reached', code: 'licence' }),
    );
    expect(await license.exchange('KEY-1')).toMatchObject({ message: 'Activation limit reached' });
  });
});
