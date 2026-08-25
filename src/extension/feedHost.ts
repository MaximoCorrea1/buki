/**
 * Where the feed scanner is allowed to arm.
 *
 * The manifest scopes `content_scripts` to X, and that is only half of how `content.js`
 * reaches a page. The other half is `ensureTray` → `background.ts`, which injects it into
 * ANY tab on a right-click — the catch-anywhere flow, working as designed.
 *
 * What was not designed is what happened after the injection. The script observed
 * `document.body` with `{ childList: true, subtree: true }` and ran `setInterval(scan, 2000)`
 * for the lifetime of the tab, **with no `clearInterval` anywhere in the file**. Off X that
 * is provably zero-yield work, for ever, on every page a catch ever touched. On a page that
 * wants it, it is a permanently armed scanner waiting for forged
 * `article[data-testid="tweet"]` markup — the first link in the chain the 2026-08-24 threat
 * model found.
 *
 * **The tray does not depend on this and catch-anywhere is unchanged.** The card is
 * message-driven: the worker tells the content script to open one. Only the injection of
 * Save buttons into a feed is gated, and off X there was never a feed to inject them into.
 *
 * This also closes the gap `docs/store/permissions.md:55-60` had against its own answer,
 * which told a reviewer the script "injects the same result card" while the bundle polled
 * the DOM every two seconds for ever.
 */

/**
 * X's own hosts, matched on the label boundary.
 *
 * `(^|\.)` is what makes this a hostname check rather than a spelling check: it anchors to
 * the start or to a dot, so `x.com` and `mobile.x.com` match while `x.com.evil.test` and
 * `notx.com` do not. That is the same distinction `isTweetMedia` had wrong for a year in
 * `content.ts`, which is why it is written once here and asserted with the near-misses
 * rather than the hits.
 *
 * Deliberately wider than `manifest.json`'s `content_scripts.matches`, which name the two
 * apex hosts. A match pattern of `https://x.com/*` does not cover `www.x.com`, and the feed
 * has lived on `mobile.` and `www.` within living memory. Widening to X's own subdomains
 * costs nothing: they are hosts we already trust with the content script.
 */
const FEED_HOST = /(^|\.)(x|twitter)\.com$/;

/** Should the feed scanner arm on this page? */
export function isFeedHost(hostname: string): boolean {
  return FEED_HOST.test(hostname.toLowerCase());
}
