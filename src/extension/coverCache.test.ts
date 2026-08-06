import { describe, it, expect } from 'vitest';
import { rememberCover, cachedCover, pruneCovers, type CoverStore } from './coverCache';

/** Stands in for the Cache API: hands back a fresh Response per match, as the real one does. */
function fakeStore() {
  const held = new Map<string, string>();
  const store: CoverStore = {
    async match(url) {
      const body = held.get(url);
      return body === undefined ? undefined : new Response(body);
    },
    async put(url, res) {
      held.set(url, await res.text());
    },
    async keys() {
      return [...held.keys()];
    },
    async delete(url) {
      return held.delete(url);
    },
  };
  return { store, held };
}

function counting(body = 'jpeg-bytes', status = 200) {
  let calls = 0;
  return {
    calls: () => calls,
    fetch: async (_url: string) => {
      calls++;
      return new Response(body, { status });
    },
  };
}

const URL_A = 'https://covers.openlibrary.org/b/id/8231856-M.jpg';
const URL_B = 'https://covers.openlibrary.org/b/id/240727-M.jpg';

describe('rememberCover', () => {
  it('keeps a cover it has not seen before', async () => {
    const { store, held } = fakeStore();
    const net = counting();

    await rememberCover(URL_A, { store, fetch: net.fetch });

    expect(held.get(URL_A)).toBe('jpeg-bytes');
  });

  it('does not go back to the network for one it already holds', async () => {
    // The whole point. A cover is a 3-hop redirect ending in a ZIP extraction on
    // archive.org, measured at 1-4 SECONDS every time, and its own Cache-Control is only
    // 3 hours - so the browser re-pays that cost forever. A cover never changes.
    const { store } = fakeStore();
    const net = counting();

    await rememberCover(URL_A, { store, fetch: net.fetch });
    await rememberCover(URL_A, { store, fetch: net.fetch });

    expect(net.calls()).toBe(1);
  });

  it('refuses to keep a failed response', async () => {
    // Caching a 404 would make a cover that is merely missing today missing forever.
    const { store, held } = fakeStore();
    const net = counting('not found', 404);

    await rememberCover(URL_A, { store, fetch: net.fetch });

    expect(held.has(URL_A)).toBe(false);
  });

  it('survives the network failing', async () => {
    // A save must never fail because of a picture. Same rule the recognition log follows.
    const { store } = fakeStore();
    const fetch = async (): Promise<Response> => {
      throw new Error('offline');
    };

    await expect(rememberCover(URL_A, { store, fetch })).resolves.toBeUndefined();
  });

  it('survives the cache itself failing', async () => {
    const store: CoverStore = {
      async match() {
        throw new Error('cache unavailable');
      },
      async put() {
        throw new Error('cache unavailable');
      },
      async keys() {
        return [];
      },
      async delete() {
        return false;
      },
    };

    await expect(rememberCover(URL_A, { store, fetch: counting().fetch })).resolves.toBeUndefined();
  });

  it('does nothing for a book with no cover', async () => {
    const { store } = fakeStore();
    const net = counting();

    await rememberCover(undefined, { store, fetch: net.fetch });

    expect(net.calls()).toBe(0);
  });
});

describe('cachedCover', () => {
  it('hands back the bytes it holds', async () => {
    const { store } = fakeStore();
    await rememberCover(URL_A, { store, fetch: counting().fetch });

    const blob = await cachedCover(URL_A, { store });

    expect(await blob?.text()).toBe('jpeg-bytes');
  });

  it('returns nothing for a cover it has never held', async () => {
    const { store } = fakeStore();

    expect(await cachedCover(URL_A, { store })).toBeNull();
  });

  it('returns nothing rather than throwing when there is no cover url', async () => {
    const { store } = fakeStore();

    expect(await cachedCover(undefined, { store })).toBeNull();
  });
});

describe('pruneCovers', () => {
  it('forgets covers for books no longer on the shelf', async () => {
    const { store, held } = fakeStore();
    const net = counting();
    await rememberCover(URL_A, { store, fetch: net.fetch });
    await rememberCover(URL_B, { store, fetch: net.fetch });

    const dropped = await pruneCovers([URL_A], { store });

    expect(dropped).toEqual([URL_B]);
    expect(held.has(URL_A)).toBe(true);
  });

  it('keeps everything when the whole shelf is still there', async () => {
    const { store } = fakeStore();
    const net = counting();
    await rememberCover(URL_A, { store, fetch: net.fetch });

    expect(await pruneCovers([URL_A], { store })).toEqual([]);
  });

  it('is not fooled into wiping the cache by books that have no cover', async () => {
    // `keep` comes straight off the shelf, where coverUrl is optional. Letting an
    // undefined through as "keep nothing" would clear every cover on the next repaint.
    const { store, held } = fakeStore();
    await rememberCover(URL_A, { store, fetch: counting().fetch });

    await pruneCovers([undefined, URL_A], { store });

    expect(held.has(URL_A)).toBe(true);
  });
});

describe('a cache that never answers', () => {
  it('gives up, so one hung lookup cannot leave the shelf blank forever', async () => {
    // Found by instrumenting the popup: every cover reported "no src yet" after ten
    // seconds, because applyCover awaits this before it assigns anything. A store that
    // THROWS was already handled; a store that never settles was not, and the difference
    // is a shelf of empty boxes with no way out of it.
    const store: CoverStore = {
      match: () => new Promise(() => {}), // never settles
      async put() {},
      async keys() {
        return [];
      },
      async delete() {
        return false;
      },
    };
    expect(await cachedCover(URL_A, { store }, 10)).toBeNull();
  });

  it('still prefers the cached bytes when the store answers in time', async () => {
    const { store } = fakeStore();
    await store.put(URL_A, new Response('jpeg-bytes'));
    const blob = await cachedCover(URL_A, { store }, 1_000);
    expect(await blob?.text()).toBe('jpeg-bytes');
  });
});
