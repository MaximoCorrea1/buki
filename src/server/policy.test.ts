import { describe, it, expect } from 'vitest';
import { fromExtension, decideAccess } from './policy';
import { sign, TOKEN_TTL_MS, GRACE_MS } from './token';

const ID = 'abcdefghijklmnopabcdefghijklmnop';
const SECRET = 'test-secret';
const NOW = Date.UTC(2026, 7, 9, 12, 0, 0);

describe('fromExtension', () => {
  it('accepts our own extension', () => {
    expect(fromExtension(`chrome-extension://${ID}`, ID)).toBe(true);
  });

  it('rejects another extension', () => {
    expect(fromExtension('chrome-extension://someoneelsesextensionidhere00', ID)).toBe(false);
  });

  it('rejects a website and a missing origin', () => {
    expect(fromExtension('https://example.com', ID)).toBe(false);
    expect(fromExtension(null, ID)).toBe(false);
  });
});

describe('decideAccess', () => {
  const opts = { secret: SECRET, extensionId: ID, now: NOW };

  it('treats no token from our extension as a trial request', async () => {
    expect(await decideAccess(null, `chrome-extension://${ID}`, opts)).toEqual({
      kind: 'trial',
    });
  });

  it('refuses a trial request that did not come from our extension', async () => {
    // curl can forge this header. The defence is proportional: a catch costs a hundredth
    // of a cent, so this is a speed bump plus the rate caps, not a wall.
    expect(await decideAccess(null, 'https://example.com', opts)).toEqual({
      kind: 'refused',
      status: 403,
    });
  });

  it('lets a valid token straight through', async () => {
    const token = await sign({ licenseKeyId: 'lk', activationId: 'a' }, SECRET, NOW);
    expect(await decideAccess(token, null, opts)).toMatchObject({ kind: 'pro', grace: false });
  });

  it('serves an expired token on grace, and says so', async () => {
    const token = await sign({ licenseKeyId: 'lk', activationId: 'a' }, SECRET, NOW);
    const later = NOW + TOKEN_TTL_MS + 1000;
    expect(await decideAccess(token, null, { ...opts, now: later })).toMatchObject({
      kind: 'pro',
      grace: true,
    });
  });

  it('refuses a token past the grace window', async () => {
    const token = await sign({ licenseKeyId: 'lk', activationId: 'a' }, SECRET, NOW);
    const past = NOW + TOKEN_TTL_MS + GRACE_MS + 1000;
    expect(await decideAccess(token, null, { ...opts, now: past })).toEqual({
      kind: 'refused',
      status: 401,
    });
  });

  it('refuses a forged token with 401, not 403', async () => {
    // 401 tells the extension to re-exchange its licence key. 403 tells it to stop.
    expect(await decideAccess('rubbish.token', null, opts)).toEqual({
      kind: 'refused',
      status: 401,
    });
  });

  it('does not require the origin header when a token is present', async () => {
    // A licensed request proves itself with the signature. Requiring both would break
    // any future non-extension client for no security gain.
    const token = await sign({ licenseKeyId: 'lk', activationId: 'a' }, SECRET, NOW);
    expect((await decideAccess(token, 'https://example.com', opts)).kind).toBe('pro');
  });
});

describe('a broken credential is not the same as no credential', () => {
  const opts = { secret: SECRET, extensionId: ID, now: NOW };

  it('refuses an empty token rather than quietly demoting it to trial', async () => {
    // `Authorization: Bearer ` with nothing after it means the extension HAD a session and
    // it is now broken, not that it never had one. Treating that as a trial request
    // silently spends a paying customer's free catches and never sends the 401 that would
    // make them re-exchange the licence and heal.
    expect(await decideAccess('', `chrome-extension://${ID}`, opts)).toEqual({
      kind: 'refused',
      status: 401,
    });
  });

  it('refuses a whitespace-only token the same way', async () => {
    expect(await decideAccess('   ', `chrome-extension://${ID}`, opts)).toEqual({
      kind: 'refused',
      status: 401,
    });
  });

  it('still treats a genuinely absent header as a trial request', async () => {
    // The distinction that makes the trial work at all: no header is the normal, correct
    // state for somebody who has never paid.
    expect(await decideAccess(null, `chrome-extension://${ID}`, opts)).toEqual({ kind: 'trial' });
  });
});
