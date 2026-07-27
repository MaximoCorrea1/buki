/**
 * The message contracts between the extension's contexts, in one place.
 *
 * These used to be untyped object literals duplicated in background.ts and
 * offscreen.ts: `chrome.runtime.sendMessage` defaults its response to `any`, so a
 * renamed field compiled clean on both sides and only broke at runtime - reported as
 * a misleading "OCR failed".
 */

/** background -> offscreen */
export type OffscreenRequest =
  | { target: 'offscreen'; type: 'ping' }
  | { target: 'offscreen'; type: 'ocr'; srcUrl: string };

export type OffscreenResponse =
  | { ok: true; text: string }
  | { ok: true; ready: true }
  | { ok: false; error: string };

/** background -> content script */
export type ContentRequest =
  | { type: 'toast'; text: string }
  /** "which tweet contains this image?" - so a save records the tweet, not the feed URL */
  | { type: 'resolvePermalink'; srcUrl: string };

export type ContentResponse = { permalink: string | null };

export function isOffscreenRequest(msg: unknown): msg is OffscreenRequest {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { target?: unknown }).target === 'offscreen'
  );
}
