/**
 * The session token, which is the whole reason this design needs no database.
 *
 * A licence is checked with Polar once, then exchanged for one of these. It carries who it
 * is for and when it dies, signed so it cannot be edited. The server stores nothing: the
 * token IS the state.
 *
 * Three things fall out of that, all free. Polar is called once a day rather than once per
 * catch, so recognition never waits on a licensing round trip. A Polar outage becomes
 * invisible, because a correctly signed but expired token is itself proof that this licence
 * validated recently, which is what the grace window trades on. And there is nothing to
 * migrate, back up or leak.
 */

/** A day. Long enough that Polar is barely called, short enough that a cancellation
 *  takes effect the same day. */
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** How long past expiry a token may still buy service when Polar cannot be reached.
 *  A week: an outage longer than that is not an outage. */
export const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export interface Claim {
  licenseKeyId: string;
  activationId: string;
}

export interface SignedClaim extends Claim {
  exp: number;
}

export type Verdict =
  | { state: 'valid'; claim: SignedClaim }
  | { state: 'expired'; claim: SignedClaim }
  | { state: 'dead' }
  | { state: 'bad' };

const encoder = new TextEncoder();

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

const decoder = new TextDecoder();

/**
 * URL-safe base64, on BOTH halves of the token.
 *
 * The payload used to be plain `btoa`, so it could contain `+` and `/` while only the MAC
 * was URL-safe. That round-trips fine in an `Authorization` header, which is why it passed
 * every test, but a bare `+` in a query string decodes as a space. It only happens on
 * certain byte alignments, so it would have surfaced as a rare corruption nobody could
 * reproduce.
 *
 * Built from bytes with a loop rather than `String.fromCharCode(...spread)`: the MAC is
 * always 32 bytes, but the payload is not bounded, and a spread of an arbitrary-length
 * array is how you find an engine's argument limit in production.
 */
function toBase64Url(bytes: Uint8Array): string {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}

/**
 * Equal, without telling the caller HOW equal.
 *
 * Native string comparison short-circuits at the first differing byte, which is the
 * textbook side channel for forging a MAC one byte at a time. The payload is not secret
 * and never was: an attacker submits whatever claim they like, and the whole point of the
 * attack is to discover a matching signature without ever having seen a valid one. The
 * length check up front is safe because the expected length is a fixed constant, 43
 * characters of unpadded base64url, independent of the secret.
 */
function equalInConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let differences = 0;
  for (let i = 0; i < a.length; i++) differences |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return differences === 0;
}

export async function sign(claim: Claim, secret: string, now: number): Promise<string> {
  // Encoded through TextEncoder rather than handed to btoa directly: btoa throws on any
  // code point above 255, and a server that 500s on one unexpected character in an id is
  // a licence nobody can activate.
  const payload = toBase64Url(encoder.encode(JSON.stringify({ ...claim, exp: now + TOKEN_TTL_MS })));
  const mac = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(mac))}`;
}

/**
 * Signature first, always. An expired token is only meaningful evidence if we know we
 * wrote it, so reading the payload before checking the MAC would hand anybody a licence.
 */
export async function verify(token: string, secret: string, now: number): Promise<Verdict> {
  const cut = token.lastIndexOf('.');
  if (cut <= 0) return { state: 'bad' };
  const payload = token.slice(0, cut);
  const mac = token.slice(cut + 1);

  let expected: string;
  try {
    expected = toBase64Url(
      new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload))),
    );
  } catch {
    return { state: 'bad' };
  }
  if (!equalInConstantTime(mac, expected)) return { state: 'bad' };

  let claim: SignedClaim;
  try {
    claim = JSON.parse(decoder.decode(fromBase64Url(payload))) as SignedClaim;
  } catch {
    return { state: 'bad' };
  }
  // THE SHAPE, not just the expiry. This checked only `exp`, so a payload without
  // `licenseKeyId` came back `valid` with the field `undefined` — the review's AC-4, and it
  // fails OPEN in both directions of a shape migration.
  //
  // It stopped being theoretical on 2026-08-25: `proCap` keys a per-licence rate limit on
  // exactly this field, and a cap keyed on `undefined` is a cap on nobody. Every token this
  // repo mints carries it (`sign` takes a `Claim` that requires it) and none are in the
  // wild, so requiring it costs nothing today and cannot be added the day after launch.
  if (typeof claim?.exp !== 'number') return { state: 'bad' };
  if (typeof claim.licenseKeyId !== 'string' || claim.licenseKeyId === '') {
    return { state: 'bad' };
  }

  if (now <= claim.exp) return { state: 'valid', claim };
  if (now <= claim.exp + GRACE_MS) return { state: 'expired', claim };
  return { state: 'dead' };
}
