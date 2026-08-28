import type { Book, RecognitionResult, RecognitionSource, Tweet } from '../recognizer/types';
import type { AttemptDraft, PendingEvent } from './recognitionLog';
import type { Intent, SavedBook, SavedSource } from './storage';

/**
 * The message contracts between the extension's contexts, in one place.
 *
 * These were once untyped object literals duplicated across files:
 * `chrome.runtime.sendMessage` defaults its response to `any`, so a renamed field
 * compiled clean on both sides and broke only at runtime - reported as a misleading
 * "OCR failed".
 */

/** What the content script can tell us about the tweet around an image. */
export interface TweetContext {
  permalink: string | null;
  text: string;
  links: string[];
}

/**
 * A candidate the shelf already holds, and WHICH pile it is in.
 *
 * This used to be a bare identity string, so the picker could only say "on your shelf".
 * Naming the pile is what makes the marker actionable: the card offers a move rather
 * than a save, and the button that would change nothing is visibly the one to skip.
 */
export interface Shelved {
  /** See `identityOf` - the work, not the edition. */
  identity: string;
  intent: Intent;
}

/**
 * background -> content script.
 *
 * Every one of these drives the catch tray, which is the extension's only in-page
 * surface. There used to be three - a toast, a progress pill and a picker panel - and a
 * catch moved between them as it progressed, which is why a found book arrived somewhere
 * other than where it had been loading.
 */
export type ContentRequest =
  /**
   * A catch has started. `job` names the POST, so pressing one post repeatedly is one
   * card and one lookup rather than a stack of duplicates. `image` is the picture being
   * read - a column of identical "Reading the cover…" cards says nothing about which
   * catch is which.
   */
  | { type: 'catchOpen'; job: string; text: string; image?: string }
  /**
   * It came back. Answered with `{ shown }`: the worker must know whether anyone took
   * ownership of the outcome, because a book resolving into a tab with no content script
   * is a book that is silently lost.
   *
   * `tweet` rides along so the card's "Try the post's words" can re-ask without the
   * worker having to remember anything - an MV3 worker is torn down between clicks, so
   * state held there is state that disappears mid-catch.
   */
  | {
      type: 'catchResolve';
      job: string;
      candidates: Book[];
      source: RecognitionSource;
      alreadySaved: Shelved[];
      draft: AttemptDraft;
      permalink: string | null;
      tweet: Tweet;
    }
  | { type: 'catchFail'; job: string; text: string }
  /**
   * The ten free cover readings are spent, and this catch is the one that met the wall.
   * Separate from `catchFail` on purpose: a failure is something that went wrong and a
   * wall is an answer, so the card says something different and never self-dismisses.
   */
  | { type: 'catchWall'; job: string }
  /** "which tweet holds this image?" - so a save records the tweet, not the feed URL */
  | { type: 'tweetContextFor'; srcUrl: string }
  /**
   * "is there already a tray on this tab?" Answered `{ ok: true }`.
   *
   * The worker injects the content script on demand now that a catch can start anywhere,
   * and X already has one from the manifest. Injecting twice would give that tab two
   * trays listening to the same messages, so the worker asks first. An unanswered ping
   * is the normal negative: `tellTab` swallows the "no receiving end" error and returns
   * undefined.
   */
  | { type: 'ping' };

/** content script / popup / options -> background */
export type BackgroundRequest =
  /**
   * `job` names this catch - the post it is about - so the page can call it off while it
   * is still running, and so two presses on one post are one catch.
   *
   * `fromText` asks for the post's own words to be grounded. It is off by default because
   * as a silent fallback it produced shelf entries that were never in the picture, with
   * nothing on screen to say so - it is now something the card offers after the cover
   * came back with nothing.
   */
  | { type: 'recognize'; tweet: Tweet; job: string; fromText?: boolean }
  /**
   * Stop a lookup the user no longer wants. The fetches live in the worker, so this is a
   * message rather than a local abort. An unknown or already-finished job is ignored - a
   * cancel arriving late is normal, not an error.
   */
  | { type: 'cancelRecognize'; job: string }
  /**
   * The background is the ONLY writer of both `savedBooks` and `recognitionLog`.
   *
   * `createLibrary`'s queue only serializes writes made through one instance, and there
   * was an instance per context - so a popup delete could interleave with a content
   * script save and drop a book, which is the exact data loss the queue was built to
   * prevent. Other contexts now ask the worker to write; they still read directly.
   */
  /**
   * `shot` is the picture this book was read from, and it becomes the cover on the
   * shelf. Additive: a record saved before this simply has none and falls back to the
   * catalogue's art. `savedBooks` keeps its name and its shape.
   */
  /**
   * `restoreOf` is present only on an UNDO, and it carries the id the book had before it
   * was removed. Without it a restore is byte-identical to a fresh save, so the worker
   * cannot tell that it needs to put the recognition back: `removeBook` flags the attempt
   * as a wrong match on the way out, and nothing cleared it on the way back in.
   */
  | {
      type: 'saveBook';
      book: Book;
      intent: Intent;
      source?: SavedSource;
      shot?: string;
      restoreOf?: string;
    }
  /**
   * Search the catalogue by title, for a book being added by hand rather than caught.
   *
   * It goes through the worker for the same reason every shelf write does: the worker
   * owns the one OpenLibrary client and the one `catalogue` breaker. A client built in
   * the popup would fetch the same host with no breaker in front of it, so a catalogue
   * outage would trip recognition and leave this path hammering a host already down.
   *
   * `seq` is the popup`s own request counter and comes back untouched. There is no
   * cancel message: a search is one cheap fetch, so the only hazard worth closing is a
   * slow answer painting over a faster newer one.
   */
  | { type: 'searchBooks'; query: string; seq: number }
  /** Removes AND flags the recognition, so the popup needs one round trip, not two. */
  | { type: 'removeBook'; savedId: string }
  /**
   * Fetch a cover in the WORKER and hand back a data: URL.
   *
   * The catch tray cannot load one itself: it draws inside somebody else's page, so its
   * <img> obeys that page's CSP, and a cross-origin cover is blocked on every strict site.
   * Measured 2026-08-17. See coverData.ts.
   */
  | { type: 'coverBytes'; url: string }
  /**
   * Open one of Buki's own pages from a content script. The tray cannot call
   * `chrome.runtime.openOptionsPage` or `chrome.tabs.create` itself - those are worker
   * APIs - and `window.open` from inside somebody else's page is both blockable by their
   * popup policy and indistinguishable from that page opening a tab.
   */
  | { type: 'openPage'; page: 'options' | 'pricing' }
  | { type: 'logEvent'; event: PendingEvent }
  | { type: 'clearLog' };

export type BackgroundResponse =
  /**
   * `alreadySaved` says which candidates the shelf has and where. The worker owns the
   * shelf, so it answers this in the same round trip rather than making the page read
   * storage for itself.
   */
  | { ok: true; result: RecognitionResult; draft: AttemptDraft; alreadySaved: Shelved[] }
  /**
   * `needsSetup` means opening settings is the fix and retrying never will be - a
   * missing key, a retired model, a revoked credential. `error` is then already phrased
   * for the user, provider explanation included.
   */
  /**
   * `wall` means the ten free cover readings are spent. It is NOT a failure and NOT a
   * setup problem: the caller draws the offer, and must not draw an apology or open the
   * options page. Kept beside `needsSetup` rather than folded into it precisely because
   * the two lead to opposite screens.
   */
  | { ok: false; needsSetup: boolean; error: string; wall?: boolean };

/** Answer to a catalogue search. `seq` is echoed so the popup can drop a stale one. */
export type SearchResponse =
  | { ok: true; seq: number; books: Book[] }
  | { ok: false; seq: number; error: string };

/** Answer to a shelf write. `saved` is present for saveBook, absent for removeBook. */
export type ShelfResponse = { ok: true; saved?: SavedBook } | { ok: false; error: string };

/**
 * WHICH ANSWER GOES WITH WHICH ASK.
 *
 * TS-3. `OPENWORK.md` item 53. The request unions and the response types both existed, and
 * **nothing connected them.** `chrome.runtime.sendMessage` defaults its response to `any`,
 * so five of eight background variants and all six content variants had no declared answer
 * at all — a renamed field compiled clean on BOTH sides and broke only at runtime. This
 * file's own header records that happening once already, surfacing as a misleading
 * "OCR failed".
 *
 * ⚠ **KEYED BY `BackgroundRequest['type']`, AND THAT IS THE ENTIRE MECHANISM.** A ninth
 * variant added to the union without an answer declared here is a COMPILE ERROR on this
 * object, not a silent `any` at the call site. Nothing has to remember to update it —
 * `tsc` refuses to build until it is.
 *
 * `void` is a real answer and means *"nothing comes back"*: `openPage` and `cancelRecognize`
 * are told, not asked. Writing `void` says that was decided rather than forgotten.
 */
export interface BackgroundReplies {
  recognize: BackgroundResponse;
  cancelRecognize: void;
  saveBook: ShelfResponse;
  searchBooks: SearchResponse;
  removeBook: ShelfResponse;
  coverBytes: CoverResponse;
  openPage: void;
  logEvent: { ok: true };
  clearLog: { ok: boolean };
}

/** Answer to `coverBytes`. `null` is a real answer: the card draws its cloth instead. */
export type CoverResponse = { ok: true; dataUrl: string | null };

/**
 * background → content. Every one of these is TOLD, not asked, except `ping`.
 *
 * `ping` is how `ensureTray` learns whether a tab already has the content script, so its
 * answer is the whole point of sending it.
 */
export interface ContentReplies {
  catchOpen: void;
  /** The answer arriving. Told, not asked - the card repaints itself from it. */
  catchResolve: void;
  catchFail: void;
  catchWall: void;
  tweetContextFor: TweetContext | null;
  ping: { ok: true };
}

/**
 * The compile-time completeness proof, and it costs nothing at runtime.
 *
 * These two lines are what make the maps above binding. Each asserts that the map's keys are
 * EXACTLY the union's `type` values — so a variant with no reply fails here, and a reply for
 * a variant that no longer exists fails here too. Both directions, which is the shape
 * `OPENWORK.md` §5 calls for whenever a guard claims coverage.
 */
export type BackgroundRepliesAreComplete =
  BackgroundRequest['type'] extends keyof BackgroundReplies
    ? keyof BackgroundReplies extends BackgroundRequest['type']
      ? true
      : never
    : never;
export type ContentRepliesAreComplete =
  ContentRequest['type'] extends keyof ContentReplies
    ? keyof ContentReplies extends ContentRequest['type']
      ? true
      : never
    : never;

/** `true` only when both maps are exact. A `never` here is a message with no contract. */
export const MESSAGE_CONTRACT_COMPLETE: BackgroundRepliesAreComplete &
  ContentRepliesAreComplete = true;

/**
 * The answer to one ask, by name.
 *
 * Callers use this instead of letting `sendMessage` hand them `any`:
 *
 *     const res = (await chrome.runtime.sendMessage(msg)) as ReplyTo<'saveBook'>;
 */
export type ReplyTo<T extends keyof BackgroundReplies> = BackgroundReplies[T];
export type ContentReplyTo<T extends keyof ContentReplies> = ContentReplies[T];

/**
 * Say out loud that every case was handled.
 *
 * TS-4. Neither receiver had one, so a ninth variant added to a union was a **silent
 * no-op**: the message was sent, no branch matched, nothing answered, and nothing anywhere
 * said so. The sender's `await` resolves to `undefined` and the feature is simply missing.
 *
 * Call it after the last branch. It takes `never`, so it only compiles when TypeScript can
 * prove there is nothing left — which is a build failure at the exact moment somebody adds
 * a variant and forgets the receiver.
 */
export function unhandled(msg: never): void {
  console.error('[Buki] unhandled message', msg);
}
