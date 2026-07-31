import type { Book, RecognitionResult, Tweet } from '../recognizer/types';
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

/** background -> content script */
export type ContentRequest =
  /**
   * `sticky` marks an in-progress stage: it stays until the next update replaces it.
   *
   * `job` is which catch this is about. Progress belongs to a book, not to the page - two
   * covers read at once each keep their own pill, and one finishing must not dismiss the
   * pill the other is still using. Omitted means a standalone message owned by nobody.
   */
  | { type: 'toast'; text: string; sticky?: boolean; job?: string }
  /** "which tweet holds this image?" - so a save records the tweet, not the feed URL */
  | { type: 'tweetContextFor'; srcUrl: string }
  /** "Are you there?" - asked before a silent auto-save, which needs somewhere to report. */
  | { type: 'ping' }
  /**
   * "I recognized something, but not confidently enough to decide for you." The panel
   * anchors to the image that was right-clicked, so it appears at the thing being
   * pointed at. Answered with `{ shown }` - the background must know whether anyone
   * took ownership of the outcome.
   */
  | {
      type: 'pick';
      candidates: Book[];
      srcUrl: string;
      permalink: string | null;
      draft: AttemptDraft;
    };

/** content script / popup / options -> background */
export type BackgroundRequest =
  /** `job` names this catch, so the page can call it off while it is still running. */
  | { type: 'recognize'; tweet: Tweet; job: string }
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
  | { type: 'saveBook'; book: Book; intent: Intent; source?: SavedSource }
  /** Removes AND flags the recognition, so the popup needs one round trip, not two. */
  | { type: 'removeBook'; savedId: string }
  | { type: 'logEvent'; event: PendingEvent }
  | { type: 'clearLog' };

export type BackgroundResponse =
  | { ok: true; result: RecognitionResult; draft: AttemptDraft }
  /**
   * `needsSetup` means opening settings is the fix and retrying never will be - a
   * missing key, a retired model, a revoked credential. `error` is then already phrased
   * for the user, provider explanation included.
   */
  | { ok: false; needsSetup: boolean; error: string };

/** Answer to a shelf write. `saved` is present for saveBook, absent for removeBook. */
export type ShelfResponse = { ok: true; saved?: SavedBook } | { ok: false; error: string };
