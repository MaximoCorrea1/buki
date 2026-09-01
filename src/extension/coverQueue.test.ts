import { describe, it, expect } from 'vitest';
import { createCoverQueue } from './coverQueue';

const later = <T,>(value: T, ms = 0): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

describe('createCoverQueue', () => {
  it('asks for each cover once, however many times the shelf repaints', async () => {
    // THE BUG THIS EXISTS FOR. `paint()` runs on every KEYSTROKE in the search box and
    // begins with `app.replaceChildren()`, so every book's cover is requested again from
    // scratch. A cover already held is cheap - `cover.ts` memoises the object URL - but one
    // that MISSED goes back to the network every single keystroke.
    let calls = 0;
    const queue = createCoverQueue(4, async (url) => {
      calls++;
      return later(`blob-for-${url}`);
    });

    const url = 'https://covers.openlibrary.org/b/id/1-M.jpg';
    await Promise.all([queue.get(url), queue.get(url), queue.get(url)]);
    await queue.get(url);

    expect(calls).toBe(1);
  });

  it('does not go back for one that already came up empty', async () => {
    // A book with no catalogue art is the COMMON case, not the exceptional one. Retrying it
    // on every repaint spends a request to learn the same thing.
    let calls = 0;
    const queue = createCoverQueue(4, async () => {
      calls++;
      return null;
    });

    expect(await queue.get('https://example.test/none.jpg')).toBeNull();
    expect(await queue.get('https://example.test/none.jpg')).toBeNull();

    expect(calls).toBe(1);
  });

  it('holds the line at the limit, because this is the host that answered 429', async () => {
    // Nineteen concurrent requests to openlibrary.org earned an HTTP 429 on 2026-08-27 and
    // took the catalogue down for two minutes. `warmCovers` and `mapPool` are both bounded
    // at 4 for that reason. The SHELF had no ceiling at all: a forty-book pile opened forty.
    let live = 0;
    let peak = 0;
    const queue = createCoverQueue(4, async (url) => {
      live++;
      peak = Math.max(peak, live);
      await later(null, 5);
      live--;
      return `blob-${url}`;
    });

    await Promise.all(Array.from({ length: 20 }, (_, i) => queue.get(`https://x.test/${i}.jpg`)));

    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });

  it('keeps serving the rest when one cover throws', async () => {
    // A picture must never be able to fail the shelf - the same rule the recognition log
    // follows. One dead URL among forty cannot be allowed to strand the other thirty-nine.
    const queue = createCoverQueue(2, async (url) => {
      if (url.includes('bad')) throw new Error('network');
      return `blob-${url}`;
    });

    const [bad, good] = await Promise.all([
      queue.get('https://x.test/bad.jpg'),
      queue.get('https://x.test/good.jpg'),
    ]);

    expect(bad).toBeNull();
    expect(good).toBe('blob-https://x.test/good.jpg');
  });

  it('a thrown cover is remembered as empty, not retried forever', async () => {
    let calls = 0;
    const queue = createCoverQueue(2, async () => {
      calls++;
      throw new Error('network');
    });

    await queue.get('https://x.test/bad.jpg');
    await queue.get('https://x.test/bad.jpg');

    expect(calls).toBe(1);
  });

  it('serves them in the order the shelf asked, not newest first', async () => {
    // The code says shift rather than pop and gives a reason: the shelf reads top to
    // bottom, so a queue draining newest-first would fill the BOTTOM of the pile while the
    // books actually on screen waited. That claim was unguarded until this line existed.
    const seen: string[] = [];
    const queue = createCoverQueue(1, async (url) => {
      seen.push(url);
      await later(null, 1);
      return `blob-${url}`;
    });

    await Promise.all(['a', 'b', 'c', 'd'].map((n) => queue.get(`https://x.test/${n}.jpg`)));

    expect(seen).toEqual([
      'https://x.test/a.jpg',
      'https://x.test/b.jpg',
      'https://x.test/c.jpg',
      'https://x.test/d.jpg',
    ]);
  });

  it('runs the queued ones rather than dropping them at the ceiling', async () => {
    // The ceiling must DELAY, never DISCARD. A shelf that silently drew boards for book
    // five onward would look exactly like OpenLibrary being down.
    const seen: string[] = [];
    const queue = createCoverQueue(2, async (url) => {
      seen.push(url);
      await later(null, 1);
      return `blob-${url}`;
    });

    const urls = Array.from({ length: 7 }, (_, i) => `https://x.test/${i}.jpg`);
    const out = await Promise.all(urls.map((u) => queue.get(u)));

    expect(seen).toHaveLength(7);
    expect(out.every((b) => typeof b === 'string')).toBe(true);
  });
});
