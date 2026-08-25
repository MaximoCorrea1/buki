import { describe, it, expect } from 'vitest';
import { sign, verify, TOKEN_TTL_MS, TOKEN_VERSION, GRACE_MS, type Claim } from './token';

const SECRET = 'test-secret-not-the-real-one';
const NOW = Date.UTC(2026, 7, 9, 12, 0, 0);
const CLAIM = { licenseKeyId: 'lk_1', activationId: 'act_1' };

describe('sign and verify', () => {
  it('round-trips a claim', async () => {
    // `v` is asserted here rather than only in its own block, because this is the fixture
    // every other test copies. `OPENWORK.md` §5 records the cost of a round-trip test whose
    // fixture is narrower than the thing it round-trips: `activationId` flowed perfectly in
    // all 550 tests and never once in production, because no fixture carried it.
    const token = await sign(CLAIM, SECRET, NOW);
    expect(await verify(token, SECRET, NOW)).toEqual({
      state: 'valid',
      claim: { ...CLAIM, exp: NOW + TOKEN_TTL_MS, v: TOKEN_VERSION },
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

/**
 * A CLAIM WITHOUT A LICENCE IS NOT A CLAIM, and `verify` used to say it was.
 *
 * `verify` checked only `typeof claim.exp === 'number'`, so a token whose payload lacked
 * `licenseKeyId` came back `{ state: 'valid', claim: { licenseKeyId: undefined } }`. The
 * 2026-08-24 review filed that as AC-4 and called it right: **a shape migration fails OPEN
 * and SILENTLY in both directions.**
 *
 * It became load-bearing on 2026-08-25, when `proCap` started keying a rate limit on that
 * exact field. A cap keyed on `undefined` is not a cap on anybody.
 *
 * Every token this repo has ever minted carries the field — `sign` takes a `Claim` that
 * requires it — and there are no tokens in the wild, so requiring it costs nothing today
 * and is unavailable the day after launch.
 */
describe('the claim has to be a claim', () => {
  it('refuses a token carrying no licence id', async () => {
    const token = await sign({ activationId: 'act_1' } as unknown as Claim, SECRET, NOW);
    expect((await verify(token, SECRET, NOW)).state).toBe('bad');
  });

  it('refuses a token whose licence id is empty', async () => {
    const token = await sign({ licenseKeyId: '', activationId: 'act_1' }, SECRET, NOW);
    expect((await verify(token, SECRET, NOW)).state).toBe('bad');
  });

  it('still accepts a real one, expired ones included', async () => {
    const token = await sign({ licenseKeyId: 'lk_1', activationId: 'act_1' }, SECRET, NOW);
    expect((await verify(token, SECRET, NOW)).state).toBe('valid');
    // The grace window runs on exactly this evidence, so tightening the shape check must
    // not narrow what counts as evidence.
    expect((await verify(token, SECRET, NOW + TOKEN_TTL_MS + 1000)).state).toBe('expired');
  });
});

/**
 * A TOKEN FROM A DIFFERENT VERSION OF THIS SERVER, correctly signed.
 *
 * The review's AC-4: **there is no version marker anywhere** — no `/v1/`, no header, no `v`
 * in the payload — and `verify` checked only `typeof claim.exp === 'number'`. So a shape
 * migration fails OPEN and SILENTLY in both directions: an old server hands a new token a
 * `valid` verdict with fields it does not understand, and a new server does the same with an
 * old one.
 *
 * The claim-shape half was closed on 2026-08-25 with item 40, because `proCap` started
 * keying a rate limit on `licenseKeyId`. This is the version half.
 *
 * **It costs nothing today and is impossible after launch.** There are no tokens in the
 * wild; the day there are, adding a required field to the payload signs every one of them
 * out at once. That is item 44's whole argument.
 */

const enc = new TextEncoder();

const b64url = (bytes: Uint8Array): string => {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Mint a token the way another version of this server would: correctly signed, other shape. */
async function signAsAnotherVersion(payload: object, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return `${body}.${b64url(new Uint8Array(mac))}`;
}

describe('the token carries its own version', () => {
  const exp = NOW + TOKEN_TTL_MS;

  it('signs the current version into every token', async () => {
    const token = await sign(CLAIM, SECRET, NOW);
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(token.split('.')[0]!.replace(/-/g, '+').replace(/_/g, '/')),
          (ch) => ch.charCodeAt(0),
        ),
      ),
    ) as { v?: unknown };
    expect(payload.v).toBe(TOKEN_VERSION);
  });

  it('refuses a correctly signed token from an OLDER server', async () => {
    // Exactly what this repo minted until 2026-08-25: no `v` at all. Correct signature,
    // correct claim, and it must not be honoured, or the version marker means nothing.
    const old = await signAsAnotherVersion({ ...CLAIM, exp }, SECRET);
    expect((await verify(old, SECRET, NOW)).state).toBe('bad');
  });

  it('refuses a correctly signed token from a NEWER server', async () => {
    // The other direction, which is the half that usually gets forgotten. A token whose
    // shape this code does not understand must not be read as though it did.
    const future = await signAsAnotherVersion({ ...CLAIM, exp, v: TOKEN_VERSION + 1 }, SECRET);
    expect((await verify(future, SECRET, NOW)).state).toBe('bad');
  });

  it('refuses a version that is not a number at all', async () => {
    const odd = await signAsAnotherVersion({ ...CLAIM, exp, v: '1' }, SECRET);
    expect((await verify(odd, SECRET, NOW)).state).toBe('bad');
  });

  it('a rejected version reads as `bad`, which is the 401 the client can act on', async () => {
    // NOT `dead`. `policy.ts` turns `bad` into 401, and 401 is the one status that tells
    // the extension to exchange its licence key again — which is exactly the right move
    // for a token minted by a server that no longer exists.
    const old = await signAsAnotherVersion({ ...CLAIM, exp }, SECRET);
    expect(await verify(old, SECRET, NOW)).toEqual({ state: 'bad' });
  });
});
