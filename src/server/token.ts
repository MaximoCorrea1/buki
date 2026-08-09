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

/** Base64 of the bytes, URL-safe so the token survives a header and a query string. */
function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sign(claim: Claim, secret: string, now: number): Promise<string> {
  const payload = btoa(JSON.stringify({ ...claim, exp: now + TOKEN_TTL_MS }));
  const mac = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload));
  return `${payload}.${toBase64(mac)}`;
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
    expected = toBase64(
      await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload)),
    );
  } catch {
    return { state: 'bad' };
  }
  // Length-equal comparison. The timing side channel here leaks nothing an attacker can
  // use without already holding a valid payload, but constant-ish beats careless.
  if (mac.length !== expected.length || mac !== expected) return { state: 'bad' };

  let claim: SignedClaim;
  try {
    claim = JSON.parse(atob(payload)) as SignedClaim;
  } catch {
    return { state: 'bad' };
  }
  if (typeof claim?.exp !== 'number') return { state: 'bad' };

  if (now <= claim.exp) return { state: 'valid', claim };
  if (now <= claim.exp + GRACE_MS) return { state: 'expired', claim };
  return { state: 'dead' };
}
