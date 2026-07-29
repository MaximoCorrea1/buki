import type { Book, RecognitionResult, Tweet } from '../recognizer/types';
import type { AttemptDraft, PendingEvent } from './recognitionLog';

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
  /** `sticky` marks an in-progress stage: it stays until the next update replaces it. */
  | { type: 'toast'; text: string; sticky?: boolean }
  /** "which tweet holds this image?" - so a save records the tweet, not the feed URL */
  | { type: 'tweetContextFor'; srcUrl: string }
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
  | { type: 'recognize'; tweet: Tweet }
  /** The background is the log's only writer; everyone else hands it finished events. */
  | { type: 'logEvent'; event: PendingEvent }
  | { type: 'markWrong'; savedId: string }
  | { type: 'clearLog' };

export type BackgroundResponse =
  | { ok: true; result: RecognitionResult; draft: AttemptDraft }
  /**
   * `needsSetup` means opening settings is the fix and retrying never will be - a
   * missing key, a retired model, a revoked credential. `error` is then already phrased
   * for the user, provider explanation included.
   */
  | { ok: false; needsSetup: boolean; error: string };
