/**
 * A book cover, as bytes the catch tray is allowed to draw.
 *
 * THE PROBLEM THIS SOLVES. The tray renders inside somebody else's page, so its `<img>`
 * obeys THAT page's Content-Security-Policy — not ours. Measured in Chrome 151 on
 * 2026-08-17 against `img-src 'self' data:`:
 *
 *   https://covers.openlibrary.org/...   BLOCKED
 *   data:image/...                       LOADED
 *   blob:...                             BLOCKED
 *
 * So on every strict site the cover failed, `coverThumb`'s error handler removed the
 * image, and the reader saw the cloth colour: *"it doesnt show their cover, only shows a
 * color"*. `blob:` is no escape either — it inherits the page's origin and needs its own
 * `img-src` entry.
 *
 * The service worker has no page CSP. It fetches under the manifest's host permissions,
 * which already list `covers.openlibrary.org`, and hands back a `data:` URL. That is not
 * unconditional — a page whose policy omits `data:` still falls through to the cloth — but
 * it turns "never works off our own pages" into "works unless the page forbids data URLs".
 */
import type { CoverDeps } from './coverCache';

/** Big enough for a cover, small enough that a wrong URL cannot fill storage. */
const MAX_BYTES = 512 * 1024;

type Deps = {
  /**
   * `put` as well as `match`, since 2026-08-27. `OPENWORK.md` item 50, PERF-2.
   *
   * This read the store and never wrote to it, so **every cover it fetched itself was a
   * cache miss by construction** and the next ask fetched it again. The tray asks on every
   * card repaint and a card repaints on every save, so filing twenty books one at a time
   * measured 420 `coverBytes` messages and about 10MB of cross-process payload.
   *
   * `warmCovers` fills the store for the covers a CATCH found, which is why that was only
   * half of it: anything it did not warm went to the network every single time.
   */
  store: Pick<CoverDeps['store'], 'match' | 'put'> | null;
  fetch: (url: string) => Promise<Response>;
};

/** base64 without spreading the array: a cover is tens of thousands of bytes. */
function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
}

/**
 * Store what we had to go to the network for, and let nothing about that fail the read.
 *
 * OUTSIDE the caller's `try`, in its own, because a store that throws SYNCHRONOUSLY — an
 * older record with no `put`, a Cache API that refuses — would otherwise be caught by the
 * read's catch and turn a cover that arrived perfectly into `null`. That happened on the
 * first version of this and a test caught it: **a decorative side effect must not be able
 * to change the answer.**
 *
 * Fire-and-forget: this runs in the worker, where an escaping rejection is logged as an
 * error on a catch that otherwise worked. A cover that fails to cache is a cover fetched
 * again, which is exactly the state before any of this existed.
 */
function keep(url: string, blob: Blob, store: Deps['store']): void {
  try {
    void store
      ?.put(url, new Response(blob, { headers: { 'content-type': blob.type } }))
      .catch(() => undefined);
  } catch {
    // Nothing. See above.
  }
}

export async function coverDataUrl(url: string | undefined, deps: Deps): Promise<string | null> {
  if (!url) return null;
  try {
    // The cache first: the popup already fills it, so a book seen once costs nothing.
    const hit = await deps.store?.match(url);
    const res = hit ?? (await deps.fetch(url));
    const blob = await res.blob();

    // A proxy error page is a 200 with HTML in it. Drawing that as an image gives a broken
    // glyph, which reads as the extension being broken rather than as a missing cover.
    if (!blob.type.startsWith('image/')) return null;
    if (blob.size === 0 || blob.size > MAX_BYTES) return null;

    const dataUrl = `data:${blob.type};base64,${base64(new Uint8Array(await blob.arrayBuffer()))}`;
    // KEPT, and only after the blob passed the checks above and the answer already exists.
    // Caching earlier would store an error page as if it were art, turning one bad minute
    // at the CDN into a book with no cover until the cache is pruned.
    if (!hit) keep(url, blob, deps.store);
    return dataUrl;
  } catch {
    // A cover is the decoration on a decision. It must never take the decision down with
    // it: OpenLibrary answered nothing at all for over 20s on 2026-08-04.
    return null;
  }
}
