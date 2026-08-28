/**
 * The extension's half of being Pro: hold a licence key, trade it for a session, and know
 * the difference between "renew this" and "still licensed".
 *
 * **The licence key never leaves this module's caller for a vision call.** It is exchanged
 * for a short-lived signed session token, and the token is what every later request
 * carries. That is what keeps a stolen `chrome.storage.local` from being a stolen
 * subscription for longer than a day, and it is why `src/server/token.ts` exists.
 */
/**
 * ⚠ `GRACE_MS` ONLY, AND ONLY AS A FALLBACK. `TOKEN_TTL_MS` came through here too until
 * 2026-08-28, and it was imported for one reason: to be RE-EXPORTED. Nothing imported the
 * re-export. So the server's token lifetime was compiled into every shipped bundle to
 * satisfy no caller at all. `OPENWORK.md` item 51, AC-5.
 *
 * The lifetime now arrives in the exchange response (`expiresIn`, `graceMs`), which is the
 * only way a number the SERVER owns can change without waiting on Chrome's update schedule.
 * This constant survives as the last value we knew, for a session stored before the field
 * existed — `licenseImports.test.ts` proves nothing else crosses this line.
 */
import { GRACE_MS } from '../server/token';
import { worthRetrying } from '../shared/retry';

/** A session as the extension stores it: the bearer token and when it stops being fresh. */
export interface Session {
  token: string;
  /**
   * When this stops being fresh, **on the CLIENT'S clock**.
   *
   * AC-12. It used to be the server's timestamp stored verbatim and then compared against
   * `Date.now()`, with no skew tolerance — so a machine running a few minutes fast treated a
   * live session as dead, and one running slow rode a session the proxy had stopped
   * honouring. The server now sends a DURATION and this is that duration added to the
   * client's own clock, which makes skew structurally irrelevant rather than tolerated.
   */
  expiresAt: number;
  /**
   * How long past expiry the proxy will still honour this token, **as the server said on
   * the day it was issued**.
   *
   * AC-5. `GRACE_MS` was imported from `src/server/token` and COMPILED INTO THE BUNDLE, so
   * changing it server-side left every shipped install disagreeing with the proxy — and a
   * published extension updates on Chrome's schedule, not ours. Optional because sessions
   * written before this field existed are still on disk; absent means fall back to the
   * compiled number, which is the last value we knew.
   */
  graceMs?: number;
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
  // THE SERVER'S NUMBER FIRST, the compiled one only as a last-known fallback. AC-5: with
  // the constant alone, a proxy that shortened its grace went on being contradicted by
  // every install already out there. The fallback is not decoration - sessions stored
  // before this field existed have none, and treating that as zero would sign every
  // existing subscriber out the moment they updated.
  return now < session.expiresAt + (session.graceMs ?? GRACE_MS);
}

/**
 * How long the exchange may take before the catch behind it gives up. `OPENWORK.md` 49, R-1.
 *
 * Between `openLibrary`'s 6s and `llmVision`'s 12s, and it is a ceiling rather than an
 * expectation: this is one small POST to our own edge, which then asks Polar. When the catch
 * actually WAITS for it — see `canCatchOnHeldSession`, which is the uncommon case — this is
 * the most it can add.
 */
export const EXCHANGE_TIMEOUT_MS = 8_000;

/**
 * May this catch go ahead on the session it already holds, while the renewal runs behind it?
 *
 * THE SECOND HALF OF R-1. Bounding the exchange stops it hanging for ever; it still puts the
 * licence server in front of every catch that renews, and it does not need to be there.
 * `needsRenewal` fires EARLY on purpose, so the ordinary case is a session the proxy would
 * still honour for another `GRACE_MS`. A catch holding one of those can start now.
 *
 * This is `isLicensed` asked at the call site's own question, and it exists as its own name
 * because `background.ts` cannot be imported by a test: a decision written inline there is a
 * decision no test can reach. Same reason `ensureTray`, `activateKey` and `grantedHosts` are
 * modules.
 *
 * FALSE means the catch must wait — a first pairing, or a session so old even the grace has
 * run out. There is no usable token then, so going ahead means a 401 and a wall in front of
 * somebody who has paid.
 */
export function canCatchOnHeldSession(session: Session | null, now: number): boolean {
  return isLicensed(session, now);
}

/** A body that is actually a session, rather than anything a 200 might carry. */
/**
 * A span of milliseconds, or nothing.
 *
 * EXPORTED, and used by `proState.ts` for the stored copy of the same field. It was written
 * twice, and a MUTATION PROVED THE DIFFERENCE MATTERED: `Number.isFinite` is unreachable
 * from the wire, because `JSON.stringify(Infinity)` is `null` — so the mutation removing it
 * survived here and was meaningless. It is NOT unreachable from `chrome.storage.local`,
 * which is structured-clone and user-editable, and an Infinity grace there is a session that
 * never expires.
 *
 * One rule in one place rather than two that agree today. `shared/retry.ts` exists because
 * two copies of one rule had drifted, and the copy in `proState` was the same setup.
 */
export const duration = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;

function sessionFrom(body: unknown, now: number): Session | null {
  if (!body || typeof body !== 'object') return null;
  const { token, expiresAt, expiresIn, graceMs } = body as Record<string, unknown>;
  if (typeof token !== 'string' || token === '') return null;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null;

  // THE DURATION WINS WHEN THERE IS ONE, anchored to OUR clock. AC-12: the absolute
  // timestamp is the server's, and comparing it to `Date.now()` made every skewed machine
  // wrong in one direction or the other. `expiresAt` stays as the fallback so a proxy that
  // has not been redeployed yet still works - the fix must not itself sign anybody out.
  const local = duration(expiresIn);
  return {
    token,
    expiresAt: local === undefined ? expiresAt : now + local,
    ...(duration(graceMs) === undefined ? {} : { graceMs: duration(graceMs)! }),
  };
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
          // A CEILING, because this runs during a catch. `OPENWORK.md` item 49, R-1.
          //
          // `background.ts` awaits this before the catch's own `AbortController` exists, so
          // nothing could stop it — and it had no timeout of its own while `llmVision` sets
          // 12s and `openLibrary` sets 6s. A `/api/license` that accepted the connection and
          // never answered pinned the catch open with no ceiling and no way out, under a
          // card reading "Reading the cover…" in somebody else's page.
          //
          // NOT the catch's signal, deliberately. Aborting an exchange that Polar has
          // already ACTIVATED loses the activation id we never got back, and the next
          // renewal spends another of five permanent slots — ADV-8's cost, arriving through
          // a cancel button. A ceiling bounds the wait; the signal would trade a hang for a
          // slot.
          signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
          // In the BODY, never the URL: a query string lands in server logs, browser
          // history and every proxy in between, and this is a bearer credential.
          // The activation id is OMITTED rather than sent empty on a first pairing: the
          // server branches on its presence, and `{ activationId: '' }` would read as a
          // renewal and validate an activation that does not exist yet.
          body: JSON.stringify(activationId ? { key, activationId } : { key }),
        });
      } catch (err) {
        // A timeout is not the network being down, and saying "still offline?" to somebody
        // whose connection is fine sends them to fix the wrong thing. `docs/brand.md`: an
        // error names what failed. Both are RETRYABLE — a slow endpoint is our outage, and
        // classifying it as definitive would sign a paying subscriber out for it, which is
        // the shape item 39 was filed for.
        const timedOut = (err as { name?: string })?.name === 'TimeoutError';
        return {
          ok: false,
          retryable: true,
          message: timedOut
            ? `Buki's licence check took too long (over ${EXCHANGE_TIMEOUT_MS / 1000}s).`
            : 'Could not reach Buki. Still offline?',
        };
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

        // A 403 THAT IS ABOUT US IS NOT A VERDICT ON THE LICENCE, and two 403s from this
        // endpoint mean opposite things. `code: 'licence'` is Polar's answer about this key
        // — revoked, wrong, limit reached — and the session should go. `code: 'origin'` is
        // OUR Origin check refusing the caller, which on launch day means
        // `BUKI_EXTENSION_ID` is not the shipped id.
        //
        // Read as the first, the second erases a paying customer's session on EVERY
        // renewal, while `/api/vision` keeps serving token-bearing requests because it skips
        // the Origin check when a token is present. **So nobody finds out for eight days**,
        // by which time every subscriber has been signed out by a status that was never
        // about them. Item 39 could not close that from either half; this field is what
        // closes it, and it could not have been added after publication.
        //
        // An UNCODED 403 stays final, which is the safe direction: believing the status can
        // only ever cost one re-exchange, where the reverse would keep a dead licence alive.
        if ((body as { code?: unknown })?.code === 'origin') {
          // The whole diagnostic surface. There is no telemetry in this product by design,
          // so a service-worker log line is the only thing that will ever say this out loud.
          console.error(
            '[Buki] the licence server does not recognise this extension. ' +
              'BUKI_EXTENSION_ID is almost certainly not the published id — see OPENWORK item 37. ' +
              'Keeping the session; it rides the grace window until this is fixed.',
          );
          return { ok: false, retryable: true, ...(message ? { message } : {}) };
        }
        // A BAD MINUTE PASSES; AN ANSWER ABOUT THIS KEY DOES NOT. Only the second should
        // make the caller throw its session away.
        //
        // This read `res.status >= 500`, which missed the two statuses that pass most
        // often. Our OWN `keyCap` answers 429 — `CHECKS_PER_KEY_PER_DAY = 40`, reachable by
        // a customer with five installs on a bad network day — with the words "Try again
        // tomorrow", and the caller treated that as final and erased the token. The server
        // would have honoured it on grace for another seven days.
        //
        // `worthRetrying` is the same rule `llmVision.ts` uses, imported rather than
        // restated, because these two had already drifted once.
        return {
          ok: false,
          retryable: worthRetrying(res.status),
          ...(message ? { message } : {}),
        };
      }

      const session = sessionFrom(body, deps.now());
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

/**
 * ⚠ THIS USED TO RE-EXPORT `TOKEN_TTL_MS` AND `GRACE_MS`, *"so callers do not each import
 * from `src/server/` to know one number"* — and **no caller ever did.** A convenience for
 * nobody, which is also how the server's lifetime ended up compiled into the client.
 * Removed with AC-5; `licenseImports.test.ts` is what keeps it removed.
 */
