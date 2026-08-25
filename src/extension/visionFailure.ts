/**
 * A cover read failed. WHAT DOES THE READER DO ABOUT IT?
 *
 * `background.ts` answered this with one predicate:
 *
 *     const needsSetup = (err) => err instanceof NoKeyError || (err instanceof VisionHttpError && err.permanent);
 *
 * and `permanent` is `status < 500 && status !== 429 && status !== 408`. So **401 and 402
 * both told the reader their setup was broken**, and both statements are false.
 *
 * **AC-3.** A 401 means the session token is no longer one this server will honour — a
 * rotated `BUKI_TOKEN_SECRET`, a bumped `TOKEN_VERSION`, a revoked licence. `policy.ts:51`
 * and `visionHandler.ts:63` BOTH document what the client should do about it, in prose, and
 * `grep 401 src/extension/` found two comments and zero handlers. There is nothing in
 * settings to fix, and the one action that helps — exchange the licence key again — was
 * never taken. **It is the only lever that makes a `BUKI_TOKEN_SECRET` rotation survivable**,
 * and it is what makes item 40's revocation list HEAL a client rather than merely refuse it.
 *
 * **AC-7.** A 402 is the trial kill switch, `BUKI_TRIAL_CLOSED=1`, one of only three
 * pre-launch incident levers. Telling every trial user their setup is broken the moment it
 * is flipped means **the switch cannot be used**, which is the same as not having it.
 *
 * THE PROXY PATH HAS NO SETUP TO FIX, and stating that plainly is what makes this simple. A
 * keyless reader configured nothing: they installed the extension. So on our own endpoint,
 * NOTHING is a setup problem — a 400 or a 404 from `/api/vision` is our bug, not their
 * settings. Only the own-key path can produce a failure a person can act on, and there it
 * produces them all: a retired model, a revoked key, a bad endpoint.
 *
 * Pure, and separate from `background.ts`, because that file registers listeners at module
 * scope and no test can import it — which is finding M-5 and the reason `saveBook.ts`,
 * `ensureTray.ts` and `activateKey.ts` all live outside it.
 */
import { VisionHttpError } from '../recognizer/llmVision';

/**
 * No key, and a provider that needs one.
 *
 * MOVED HERE FROM `background.ts` on 2026-08-25 so that the whole classification lives in
 * one importable place. It is thrown by the worker's lazy vision client and swallowed until
 * the end of a catch, because a post carrying a retailer link resolves for free.
 */
export class NoKeyError extends Error {}

export type VisionFailure =
  /** Opening settings genuinely fixes it. The ONLY case that should ever say so. */
  | { act: 'setup'; message: string }
  /** The session is no longer honoured. Forget it; the next catch exchanges the licence. */
  | { act: 'session'; message: string }
  /** We paused the free trial. Nothing is wrong with the reader or their machine. */
  | { act: 'closed'; message: string }
  /** Our server refused us. Also not the reader's problem, and also not fixable by them. */
  | { act: 'ours'; message: string }
  /** A bad minute. It passes on its own. */
  | { act: 'transient'; message: string };

/** Not a status any provider sends — `llmVision` raises it itself when a request hangs. */
const TIMEOUT = 408;

/**
 * What to do about a failed cover read.
 *
 * `ownKey` is the whole context this needs. With the reader's own credential we are talking
 * to THEIR provider with THEIR key and THEIR model, so a permanent failure is theirs to fix
 * and the provider's own words are the most useful thing we can show them. Without one we
 * are talking to our own proxy, and there is nothing of theirs involved.
 */
export function readVisionFailure(err: unknown, ctx: { ownKey: boolean }): VisionFailure {
  if (err instanceof NoKeyError) {
    return { act: 'setup', message: 'Add a recognition key in Buki settings to read covers.' };
  }

  if (!(err instanceof VisionHttpError)) {
    // A network failure, a bug, an aborted catch. Nothing here is a diagnosis, so the card
    // must not offer one — and `String(err)` is what the worker has always shown.
    return { act: 'transient', message: String(err) };
  }

  // 429, 408 and every 5xx clear on their own, whoever we were talking to. The provider's
  // own words come through because they often name the wait.
  if (err.status >= 500 || err.status === 429 || err.status === TIMEOUT) {
    return { act: 'transient', message: err.message };
  }

  if (ctx.ownKey) {
    // A retired model answers 404 forever and the extension used to say "try again in a
    // moment" — advice that could never work. Google names the exact model it could not
    // find, which turns a guessing game into a one-line fix, so the message is theirs.
    return { act: 'setup', message: `Recognition needs setting up: ${err.message}` };
  }

  // From here down we are on Buki's own proxy, where the reader configured nothing.
  if (err.status === 401) {
    return {
      act: 'session',
      message: 'Buki needs to check your licence again. Try that catch once more.',
    };
  }

  if (err.status === 402) {
    return {
      act: 'closed',
      // Names what still works, because most of the product does. Shop-link catches and
      // the whole shelf are untouched by the switch, and so is anyone with their own key.
      message: 'Buki has paused free cover reading. Shop links and your shelf still work.',
    };
  }

  // 400, 403, 404, 413 from our own endpoint: our bug, our deploy, our extension id. Saying
  // "check your settings" to somebody with no settings is the false statement this module
  // exists to stop.
  return {
    act: 'ours',
    message: 'Buki could not read that cover. Nothing is wrong on your side — try again soon.',
  };
}

/** Would opening settings fix this? The one question the card's wording turns on. */
export const needsSetup = (failure: VisionFailure): boolean => failure.act === 'setup';
