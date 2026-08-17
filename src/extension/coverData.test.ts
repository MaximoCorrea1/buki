import { describe, it, expect } from 'vitest';
import { coverDataUrl } from './coverData';

/**
 * WHY A COVER HAS TO ARRIVE AS BYTES RATHER THAN AS A URL.
 *
 * The catch tray draws inside somebody else's page, so its `<img>` is governed by THAT
 * page's Content-Security-Policy. Measured in Chrome 151 on 2026-08-17, under a policy of
 * `img-src 'self' data:`:
 *
 *   https://covers.openlibrary.org/...  BLOCKED
 *   data:image/...                      LOADED
 *   blob:...                            BLOCKED
 *
 * So every cover on every strict site — X included — failed to load, the `error` handler
 * removed the image, and the reader saw the cloth colour underneath. That is exactly the
 * report: *"when it finds books, it doesnt show their cover, only shows a color"*.
 *
 * The extension's own service worker has no such policy: it fetches under the host
 * permissions in the manifest, which already include covers.openlibrary.org. So the
 * background reads the bytes and hands the content script a `data:` URL.
 */

const blobOf = (bytes: number[], type: string): Blob => new Blob([new Uint8Array(bytes)], { type });

/** A GIF header is enough: nothing here decodes the image, it only moves the bytes. */
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

describe('handing a cover to a page that will not fetch one', () => {
  it('returns nothing when there is no cover to fetch', async () => {
    expect(await coverDataUrl(undefined, { store: null, fetch: async () => new Response() })).toBeNull();
  });

  it('turns the cached bytes into a data: URL that keeps the image type', async () => {
    const store = { match: async () => new Response(blobOf(GIF, 'image/gif')) };
    const url = await coverDataUrl('https://covers.openlibrary.org/b/id/1-M.jpg', {
      store,
      fetch: async () => {
        throw new Error('the cache had it; the network must not be touched');
      },
    });
    expect(url).toBe('data:image/gif;base64,R0lGODlh');
  });

  it('fetches when the cache is empty, because a first catch has nothing cached yet', async () => {
    const store = { match: async () => undefined };
    const url = await coverDataUrl('https://covers.openlibrary.org/b/id/1-M.jpg', {
      store,
      fetch: async () => new Response(blobOf(GIF, 'image/gif')),
    });
    expect(url).toBe('data:image/gif;base64,R0lGODlh');
  });

  it('gives the card its cloth back rather than throwing when the cover cannot be had', async () => {
    // OpenLibrary answered nothing at all for over 20s on 2026-08-04. A cover is the
    // decoration on a decision; it must never be able to take the decision down with it.
    const url = await coverDataUrl('https://covers.openlibrary.org/b/id/1-M.jpg', {
      store: { match: async () => undefined },
      fetch: async () => {
        throw new Error('network is down');
      },
    });
    expect(url).toBeNull();
  });

  it('refuses a response that is not an image, so a proxy error page cannot be drawn', async () => {
    const url = await coverDataUrl('https://covers.openlibrary.org/b/id/1-M.jpg', {
      store: { match: async () => undefined },
      fetch: async () => new Response('<html>404</html>', { headers: { 'content-type': 'text/html' } }),
    });
    expect(url).toBeNull();
  });
});
