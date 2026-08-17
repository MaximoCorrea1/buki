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
  store: Pick<CoverDeps['store'], 'match'> | null;
  fetch: (url: string) => Promise<Response>;
};

/** base64 without spreading the array: a cover is tens of thousands of bytes. */
function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
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

    return `data:${blob.type};base64,${base64(new Uint8Array(await blob.arrayBuffer()))}`;
  } catch {
    // A cover is the decoration on a decision. It must never take the decision down with
    // it: OpenLibrary answered nothing at all for over 20s on 2026-08-04.
    return null;
  }
}
