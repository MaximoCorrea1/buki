import { describe, it, expect } from 'vitest';
import { sign, verify, TOKEN_TTL_MS, GRACE_MS } from './token';

const SECRET = 'test-secret-not-the-real-one';
const NOW = Date.UTC(2026, 7, 9, 12, 0, 0);
const CLAIM = { licenseKeyId: 'lk_1', activationId: 'act_1' };

describe('sign and verify', () => {
  it('round-trips a claim', async () => {
    const token = await sign(CLAIM, SECRET, NOW);
    expect(await verify(token, SECRET, NOW)).toEqual({
      state: 'valid',
      claim: { ...CLAIM, exp: NOW + TOKEN_TTL_MS },
    });
  });

  it('refuses a token signed with a different secret', async () => {
    const token = await sign(CLAIM, SECRET, NOW);
    expect(await verify(token, 'someone-elses-secret', NOW)).toEqual({ state: 'bad' });
  });

  it('refuses a token whose payload was edited', async () => {
    // The whole point. Without this, anybody mints themselves a licence.
    const token = await sign(CLAIM, SECRET, NOW);
    const [payload, mac] = token.split('.');
    const forged = `${btoa(JSON.stringify({ ...CLAIM, exp: NOW + 1e12 }))}.${mac}`;
    expect(forged).not.toBe(`${payload}.${mac}`);
    expect(await verify(forged, SECRET, NOW)).toEqual({ state: 'bad' });
  });

  it('refuses rubbish', async () => {
    expect(await verify('', SECRET, NOW)).toEqual({ state: 'bad' });
    expect(await verify('no-dot', SECRET, NOW)).toEqual({ state: 'bad' });
    expect(await verify('a.b', SECRET, NOW)).toEqual({ state: 'bad' });
  });

  it('reports an expired token as expired, not as bad', async () => {
    // The difference matters: expired but correctly signed is PROOF we validated this
    // licence within the last day, which is what makes the grace window safe.
    const token = await sign(CLAIM, SECRET, NOW);
    const later = NOW + TOKEN_TTL_MS + 1000;
    expect(await verify(token, SECRET, later)).toMatchObject({ state: 'expired' });
  });

  it('still calls a token inside the grace window expired rather than bad', async () => {
    const token = await sign(CLAIM, SECRET, NOW);
    const within = NOW + TOKEN_TTL_MS + GRACE_MS - 1000;
    expect(await verify(token, SECRET, within)).toMatchObject({ state: 'expired' });
  });

  it('calls a token past the grace window dead', async () => {
    const token = await sign(CLAIM, SECRET, NOW);
    const past = NOW + TOKEN_TTL_MS + GRACE_MS + 1000;
    expect(await verify(token, SECRET, past)).toEqual({ state: 'dead' });
  });
});

describe('the token survives being carried around', () => {
  // The payload half was standard base64 while only the MAC was URL-safe. Standard
  // base64 can contain + and /, and a bare + in a query string decodes as a space, so
  // the token would corrupt silently and only for certain byte alignments.
  const AWKWARD = { licenseKeyId: 'lk_>>>???~~~', activationId: 'act_>>>???~~~' };

  it('contains no character that a URL would change', async () => {
    const token = await sign(AWKWARD, SECRET, NOW);
    expect(token).not.toMatch(/[+/=]/);
  });

  it('round-trips through a query string unharmed', async () => {
    // The failure this prevents: URLSearchParams turns a + into a space on the way out.
    const token = await sign(AWKWARD, SECRET, NOW);
    const carried = new URLSearchParams(`t=${token}`).get('t');
    expect(await verify(carried ?? '', SECRET, NOW)).toMatchObject({ state: 'valid' });
  });

  it('signs a claim carrying characters outside Latin-1 without throwing', async () => {
    // btoa throws on any code point above 255. Polar ids are ASCII today, but a server
    // that 500s on one unexpected character is a licence nobody can activate.
    const wide = { licenseKeyId: 'lk_\u00e9\u4e2d\u6587', activationId: 'act_1' };
    const token = await sign(wide, SECRET, NOW);
    expect(await verify(token, SECRET, NOW)).toMatchObject({ state: 'valid', claim: wide });
  });
});
