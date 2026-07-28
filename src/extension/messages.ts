import type { Book, Tweet } from '../recognizer/types';

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
  | { type: 'tweetContextFor'; srcUrl: string };

/** content script -> background */
export type BackgroundRequest = { type: 'recognize'; tweet: Tweet };

export type BackgroundResponse =
  | { ok: true; candidates: Book[] }
  | { ok: false; needsKey: boolean; error: string };
