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
    const store = {
      put: async () => undefined,
      match: async () => new Response(blobOf(GIF, 'image/gif')),
    };
    const url = await coverDataUrl('https://covers.openlibrary.org/b/id/1-M.jpg', {
      store,
      fetch: async () => {
        throw new Error('the cache had it; the network must not be touched');
      },
    });
    expect(url).toBe('data:image/gif;base64,R0lGODlh');
  });

  it('fetches when the cache is empty, because a first catch has nothing cached yet', async () => {
    const store = { put: async () => undefined, match: async () => undefined };
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
      store: { put: async () => undefined, match: async () => undefined },
      fetch: async () => {
        throw new Error('network is down');
      },
    });
    expect(url).toBeNull();
  });

  it('refuses a response that is not an image, so a proxy error page cannot be drawn', async () => {
    const url = await coverDataUrl('https://covers.openlibrary.org/b/id/1-M.jpg', {
      store: { put: async () => undefined, match: async () => undefined },
      fetch: async () => new Response('<html>404</html>', { headers: { 'content-type': 'text/html' } }),
    });
    expect(url).toBeNull();
  });
});

/**
 * PERF-2's FIRST HALF. `OPENWORK.md` item 50.
 *
 * `coverDataUrl` read `store.match` and never called `store.put`, so **every cover it
 * fetched itself was a cache miss by construction** and the next ask fetched it again. The
 * tray asks on every card repaint, and a card repaints on every save — so filing twenty
 * books one at a time was measured at 420 `coverBytes` messages and about 10MB of
 * cross-process payload.
 *
 * `warmCovers` fills the store for the covers a CATCH found, which is why this is only half
 * the finding: anything it did not warm — a candidate the pool dropped, a cover that
 * arrived after the warm, the popup's own shelf — went to the network every single time.
 */
describe('a cover fetched once is not fetched again', () => {
  function store() {
    const held = new Map<string, Response>();
    return {
      held,
      async match(url: string) {
        const hit = held.get(url);
        return hit ? hit.clone() : undefined;
      },
      async put(url: string, res: Response) {
        held.set(url, res.clone());
      },
    };
  }

  it('keeps what it had to go to the network for', async () => {
    const s = store();
    let fetches = 0;
    const fetch = async () => {
      fetches++;
      return new Response(blobOf(GIF, 'image/gif'), { status: 200 });
    };

    const first = await coverDataUrl('https://c.test/1.jpg', { store: s, fetch });
    expect(first, 'the first read failed, so this proves nothing').toBeTruthy();
    expect(fetches).toBe(1);

    const second = await coverDataUrl('https://c.test/1.jpg', { store: s, fetch });
    expect(second, 'the second read did not return the same picture').toBe(first);
    expect(fetches, 'the cover went to the network twice').toBe(1);
  });

  it('does not store a body it REFUSED, or the refusal becomes permanent', async () => {
    // A proxy error page is a 200 with HTML in it. Caching that would turn one bad minute
    // at the CDN into a book with no cover until the cache is pruned.
    const s = store();
    const fetch = async () => new Response(blobOf([0x3c], 'text/html'), { status: 200 });
    expect(await coverDataUrl('https://c.test/bad.jpg', { store: s, fetch })).toBeNull();
    expect(s.held.size, 'an error page was cached as a cover').toBe(0);
  });

  it('returns the cover even when the store throws SYNCHRONOUSLY on the way in', async () => {
    // `keep` sits in its own try for this: a store that throws rather than rejecting — an
    // older record with no `put`, a Cache API that refuses — would otherwise be caught by
    // the READ's catch and turn a cover that arrived perfectly into null. It did exactly
    // that on the first version, and this mutation survived until the test existed.
    const fetch = async () => new Response(blobOf(GIF, 'image/gif'), { status: 200 });
    const hostile = {
      match: async () => undefined,
      put: () => {
        throw new TypeError('this store cannot keep anything');
      },
    } as unknown as { match: () => Promise<undefined>; put: () => Promise<void> };

    expect(
      await coverDataUrl('https://c.test/1.jpg', { store: hostile, fetch }),
      'a store that could not keep the cover threw away the cover',
    ).toBe('data:image/gif;base64,R0lGODlh');
  });

  it('still works when there is no store at all', async () => {
    // `Deps.store` is nullable and the worker passes a real one; a null must not throw.
    const fetch = async () => new Response(blobOf(GIF, 'image/gif'), { status: 200 });
    expect(await coverDataUrl('https://c.test/1.jpg', { store: null, fetch })).toBeTruthy();
  });
});
