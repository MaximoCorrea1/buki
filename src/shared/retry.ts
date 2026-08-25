/**
 * WILL WAITING HELP? One answer, in one place, because there were two and they disagreed.
 *
 * `llmVision.ts` has had this right for months:
 *
 *     this.permanent = status < 500 && status !== 429 && status !== TIMEOUT_STATUS;
 *
 * `license.ts` had `retryable: res.status >= 500`, and that missing clause is the whole of
 * P0-2's client half. Our OWN `keyCap` answers 429 — `CHECKS_PER_KEY_PER_DAY = 40`, which a
 * customer can meet with five installs on a bad network day — with the words *"Try again
 * tomorrow"*, advice that only makes sense if the caller keeps what it has. It did not:
 * `proState.ts` wrote `session: null`, the bearer token was erased from disk, the next
 * catch travelled with no Authorization header, `policy.ts` classified it `trial`, and the
 * subscriber met the wall they had already paid to pass.
 *
 * **The token was not expired.** `verify` would have returned `expired` and `decideAccess`
 * would have served `{kind:'pro', grace:true}` for another seven days. The grace window —
 * the single mechanism built so that a third party's bad minute is not the customer's
 * problem — was defeated by destroying the evidence it runs on.
 *
 * IT LIVES IN `src/shared/` for a graph reason. `src/recognizer/` importing `src/extension/`
 * is already the one edge running against the dependency graph (finding K-1); both may
 * import from here without adding a second. Two copies of a rule is two rules, and these
 * two had already drifted.
 */

/** Not a status any provider sends — `llmVision` raises it itself when a request hangs. */
const TIMEOUT = 408;

/** Too many requests. Ours as often as theirs, which is the half that was missed. */
const THROTTLED = 429;

/**
 * Could this same request succeed later?
 *
 * TRUE for anything on the server's side of the line: an outage, a throttle, a hang. FALSE
 * for an answer ABOUT the request — revoked, refunded, wrong key, activation limit reached,
 * retired model. A retired model answers 404 for ever, and the extension used to tell
 * people to "try again in a moment": advice that could never work, on the one path where
 * the honest response is to send them to settings.
 *
 * A 2xx is false because nothing that succeeded needs asking again. Only failures reach
 * here today, and answering "no" to a success is the safe direction if one ever does.
 */
export function worthRetrying(status: number): boolean {
  return status >= 500 || status === THROTTLED || status === TIMEOUT;
}
