import type { Book } from '../recognizer/types';
import { mapPool } from '../recognizer/mapPool';

/**
 * Fetch the covers a catch just found, before anything asks for them.
 *
 * THE LAG THIS REMOVES. Maximo, 2026-08-27: *"it happens that it first shows the title and
 * the toast and after a second or so it shows the cover."* Exactly right, and structural
 * rather than slow: the tray draws inside somebody else's page, so its `<img>` obeys THAT
 * page's CSP and a cross-origin cover is blocked on every strict site. The worker fetches
 * the bytes instead and hands back a `data:` URL - see `coverData.ts` - which means the
 * request could not begin until the card was already on screen asking for it.
 *
 * So the fetch is moved EARLIER rather than made faster. The worker knows the cover URLs
 * the moment grounding returns, one message round trip and a render before the tray asks.
 * `rememberCover` puts them in the Cache API store and `coverDataUrl` already reads that
 * store before the network, so by the time `coverBytes` arrives it is usually a hit.
 *
 * IT MUST NOT BE AWAITED. The card renders when the answer arrives; the cover catches up.
 * Awaiting here would turn a fill-in into a blank tray, which is strictly worse than the
 * thing being fixed. That is why this returns `void` and why a test asserts it.
 *
 * BOUNDED, for the reason today already taught us. Nineteen books means nineteen covers,
 * and covers.openlibrary.org is the same service that answered nineteen concurrent search
 * connections with HTTP 429 this morning. Fixing that bug and then opening the same burst
 * one hostname over would be a poor use of the lesson.
 */
export const COVERS_AT_ONCE = 4;

export function warmCovers(
  books: readonly Book[],
  remember: (url: string) => Promise<void>,
): void {
  // Distinct, because OpenLibrary hands the same cover id to different editions often
  // enough to matter, and a duplicate is a wasted request on every catch that has one.
  const urls = [...new Set(books.map((b) => b.coverUrl).filter((u): u is string => !!u))];
  if (!urls.length) return;

  // Every failure dies here. This is fire-and-forget from a service worker, where an
  // escaping rejection is an unhandled promise in the global scope: Chrome logs it as an
  // error on a catch that otherwise worked perfectly. A cover that does not arrive is
  // already a designed state - the card falls back to its cloth.
  void mapPool(urls, COVERS_AT_ONCE, async (url) => {
    try {
      await remember(url);
    } catch {
      // Deliberately silent. `rememberCover` already logs what it could not keep.
    }
  }).catch(() => undefined);
}
