/**
 * The extension's half of being Pro: hold a licence key, trade it for a session, and know
 * the difference between "renew this" and "still licensed".
 *
 * **The licence key never leaves this module's caller for a vision call.** It is exchanged
 * for a short-lived signed session token, and the token is what every later request
 * carries. That is what keeps a stolen `chrome.storage.local` from being a stolen
 * subscription for longer than a day, and it is why `src/server/token.ts` exists.
 */
import { GRACE_MS, TOKEN_TTL_MS } from '../server/token';

/** A session as the extension stores it: the bearer token and when it stops being fresh. */
export interface Session {
  token: string;
  expiresAt: number;
}

export type Exchange =
  /**
   * `activationId` is Polar's id for THIS install. Persist it: sending it back on the next
   * exchange is what makes the server validate rather than activate, and activating spends
   * one of the key's five slots every single time.
   */
  | { ok: true; session: Session; activationId: string }
  | { ok: false; retryable: boolean; message?: string };

export interface LicenseDeps {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  endpoint: string;
  now: () => number;
}

/**
 * Renew this far before it actually expires.
 *
 * A token that dies mid-catch turns one recognition into two round trips and a retry, on
 * the one code path where the user is already waiting. Five minutes is comfortably longer
 * than a slow vision call and far shorter than the 24 hour life, so it costs nothing.
 */
const RENEW_EARLY_MS = 5 * 60 * 1000;

/**
 * Should this session be exchanged again?
 *
 * About the token's own life ONLY. Do not use it to decide whether somebody is a
 * subscriber - see `isLicensed`, and see the field note on `Standing.pro` in
 * `entitlement.ts` for what happens when the two are confused.
 */
export function needsRenewal(session: Session | null, now: number): boolean {
  if (!session) return true;
  return session.expiresAt - RENEW_EARLY_MS <= now;
}

/**
 * Would the server still serve this?
 *
 * The proxy honours a correctly signed token for `GRACE_MS` past its expiry, because a
 * token we signed yesterday is proof the licence was real yesterday, and Polar being down
 * is our problem rather than the customer's. So the extension must answer the same
 * question the same way: anything narrower shows the paywall to a paying subscriber for a
 * request the server was going to answer.
 */
export function isLicensed(session: Session | null, now: number): boolean {
  if (!session) return false;
  return now < session.expiresAt + GRACE_MS;
}

/** A body that is actually a session, rather than anything a 200 might carry. */
function sessionFrom(body: unknown): Session | null {
  if (!body || typeof body !== 'object') return null;
  const { token, expiresAt } = body as Record<string, unknown>;
  if (typeof token !== 'string' || token === '') return null;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null;
  return { token, expiresAt };
}

export function createLicense(deps: LicenseDeps): {
  exchange: (key: string, activationId?: string) => Promise<Exchange>;
} {
  return {
    async exchange(rawKey: string, activationId?: string): Promise<Exchange> {
      // Keys arrive pasted out of an email, which is where the trailing newline comes
      // from. Trimming here rather than at every call site.
      const key = rawKey.trim();
      if (!key) return { ok: false, retryable: false, message: 'Enter your licence key.' };

      let res: Response;
      try {
        res = await deps.fetch(deps.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // In the BODY, never the URL: a query string lands in server logs, browser
          // history and every proxy in between, and this is a bearer credential.
          // The activation id is OMITTED rather than sent empty on a first pairing: the
          // server branches on its presence, and `{ activationId: '' }` would read as a
          // renewal and validate an activation that does not exist yet.
          body: JSON.stringify(activationId ? { key, activationId } : { key }),
        });
      } catch {
        // Offline, DNS, a captive portal. The caller must keep whatever session it has.
        return { ok: false, retryable: true, message: 'Could not reach Buki. Still offline?' };
      }

      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!res.ok) {
        const message =
          typeof (body as { error?: unknown })?.error === 'string'
            ? ((body as { error: string }).error)
            : undefined;
        // 5xx is ours and will pass; 4xx is about this key and will not. Only the second
        // should make the caller throw the key away.
        return { ok: false, retryable: res.status >= 500, ...(message ? { message } : {}) };
      }

      const session = sessionFrom(body);
      if (!session) {
        // A 200 that is not a session: a proxy error page, a login redirect, a changed
        // shape. Storing it would make isLicensed() true and every catch fail at the
        // server with nothing on screen explaining why.
        return {
          ok: false,
          retryable: false,
          message: 'Buki got an unexpected answer. Try again, or write to us.',
        };
      }
      // Falls back to what we already had: a validate response echoes the activation, but
      // if it ever does not, forgetting the id would silently activate again next time and
      // spend another slot.
      const back = (body as { activationId?: unknown })?.activationId;
      return {
        ok: true,
        session,
        activationId: typeof back === 'string' && back ? back : (activationId ?? ''),
      };
    },
  };
}

/** Re-exported so callers do not each import from `src/server/` to know one number. */
export { TOKEN_TTL_MS, GRACE_MS };
