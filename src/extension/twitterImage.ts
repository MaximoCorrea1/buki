/**
 * Twitter's media URLs: which picture, and how big.
 *
 * The same photo is served at several sizes under one path, so the path is the identity
 * and the query string is only the rendition. Both facts below follow from that.
 */

/**
 * The same photo, once.
 *
 * A media id is the path; the query string is only which rendition of it. The DOM around
 * one post can hold several renditions of one picture, and the scraper takes them all -
 * so a single-photo post could spend its whole four-image budget on four copies of that
 * photo, each of which the provider downloads before it can begin reading. `postKey`
 * already treats the path as the media's identity; this applies the same rule to what is
 * actually sent.
 *
 * Order is preserved: the first attachment is the likeliest to hold the book, and
 * MAX_IMAGES slices from the front.
 */
export function distinctMedia(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    let id: string;
    try {
      id = new URL(url).pathname;
    } catch {
      id = url; // not a URL we can reason about; it is only equal to itself
    }
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * The rendition to actually read.
 *
 * The feed renders `name=small` (~680px), which is the URL both flows pick up, and
 * downscaling to 680 is what destroys cover typography - the thing being read.
 *
 * This asked for `large` (~2048px) while the picture was sent to the model as a URL, so
 * the size cost us nothing: the provider did the downloading. It is downloaded HERE now
 * and shrunk to one 768px tile before being sent, so `large` means paying for four times
 * the pixels in order to throw three of them away, on a home connection, once per catch.
 * `medium` (~1200px) is the smallest variant comfortably above what the shrink needs.
 */
export function bestQuality(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'pbs.twimg.com') return url;
    parsed.searchParams.set('name', 'medium');
    return parsed.toString();
  } catch {
    return url; // not a URL we can reason about; send it as-is
  }
}

/**
 * The host that actually serves X's post images, checked as a HOST.
 *
 * `content.ts` filtered scraped images with `src.includes('twimg.com/media')` — a substring
 * match — while `bestQuality`, twelve lines above this, already did the correct thing with
 * `parsed.hostname !== 'pbs.twimg.com'`. The two disagreed, and the one on the path where a
 * hostile page chooses the string was the wrong one.
 *
 * `https://attacker.example/twimg.com/media/x.png` passed that filter. It was then sent to
 * the model on Buki's key and, on the `.buki-intent` path, PERSISTED as the book's `shot` —
 * which `cover.ts:49` fetches from the extension origin on every popup open, for ever. A
 * beacon the reader's own shelf keeps alive.
 *
 * The `/media/` narrowing is kept exactly as the substring filter had it. An avatar or a
 * link-card thumbnail is not a book cover, and widening the path while fixing the host
 * would be a second change wearing the first one's justification.
 */
export function isTweetMedia(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'pbs.twimg.com' &&
      parsed.pathname.startsWith('/media/')
    );
  } catch {
    return false; // not a URL we can reason about, so not one we will send
  }
}

/**
 * Only the pictures X really served, in the order they arrived.
 *
 * Asked TWICE on purpose — once in `content.ts` where the DOM is read, and again in
 * `background.ts` where the worker receives that list over `chrome.runtime.sendMessage`. A
 * filter applied only on the far side of a trust boundary is a filter the attacker is
 * standing next to: the sending script runs in a page Buki does not control.
 *
 * The CONTEXT-MENU flow is deliberately not filtered by this. There the URL comes from
 * Chrome's own `info.srcUrl`, which reports what the user actually right-clicked, and
 * catching a book from any image on any site is the product.
 *
 * Order is preserved because the first attachment is the likeliest to hold the book, and
 * `MAX_IMAGES` slices from the front.
 */
export function keepTweetMedia(urls: string[]): string[] {
  return urls.filter(isTweetMedia);
}
