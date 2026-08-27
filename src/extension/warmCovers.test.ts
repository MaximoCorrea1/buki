import { describe, it, expect } from 'vitest';
import { warmCovers, COVERS_AT_ONCE } from './warmCovers';
import type { Book } from '../recognizer/types';
import backgroundSrc from './background.ts?raw';

const book = (title: string, coverUrl?: string): Book =>
  coverUrl ? { title, author: 'A', coverUrl } : { title, author: 'A' };

/** Records what was asked for, and the high-water mark of how many ran at once. */
const spy = () => {
  const asked: string[] = [];
  let live = 0;
  let peak = 0;
  let release: (() => void) | undefined;
  return {
    asked,
    peak: () => peak,
    /** Nothing resolves until `finish()` is called, so timing is under the test's control. */
    hold: () =>
      new Promise<void>((r) => {
        release = r;
      }),
    finish: () => release?.(),
    remember: async (url: string) => {
      asked.push(url);
      live += 1;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 3));
      live -= 1;
    },
  };
};

describe('warming the cover cache before the tray asks for it', () => {
  it('asks for every cover the catch found', async () => {
    const s = spy();
    warmCovers([book('Dune', 'https://c/1.jpg'), book('Range', 'https://c/2.jpg')], s.remember);
    await new Promise((r) => setTimeout(r, 30));
    expect(s.asked.sort()).toEqual(['https://c/1.jpg', 'https://c/2.jpg']);
  });

  it('RETURNS IMMEDIATELY and never makes the card wait', () => {
    // The whole point. The card must render the moment the answer arrives; the cover
    // catches up. If this ever awaits, the fix becomes a regression: the tray would sit
    // blank until every cover had been fetched.
    const s = spy();
    const out = warmCovers([book('Dune', 'https://c/1.jpg')], () => s.hold());
    expect(out).toBeUndefined();
    expect(s.asked).toEqual([]); // nothing has resolved, and we are already back
    s.finish();
  });

  it('skips a book with no cover art', () => {
    const s = spy();
    warmCovers([book('No Art'), book('Dune', 'https://c/1.jpg')], s.remember);
    expect(s.asked.length).toBeLessThanOrEqual(1);
  });

  it('asks once for a cover two books share', async () => {
    // OpenLibrary hands the same cover id to different editions often enough to matter,
    // and asking twice is one wasted request per duplicate on a twenty-book catch.
    const s = spy();
    warmCovers([book('A', 'https://c/same.jpg'), book('B', 'https://c/same.jpg')], s.remember);
    await new Promise((r) => setTimeout(r, 30));
    expect(s.asked).toEqual(['https://c/same.jpg']);
  });

  it('never opens more than COVERS_AT_ONCE fetches at once', async () => {
    // The SAME lesson as the 429 of 2026-08-27, one host over. Nineteen books means
    // nineteen covers, and covers.openlibrary.org is the same service that rate limited
    // us for opening nineteen search connections.
    const s = spy();
    const many = Array.from({ length: 19 }, (_, i) => book(`B${i}`, `https://c/${i}.jpg`));
    warmCovers(many, s.remember);
    await new Promise((r) => setTimeout(r, 200));
    expect(s.asked).toHaveLength(19);
    expect(s.peak()).toBeLessThanOrEqual(COVERS_AT_ONCE);
    expect(COVERS_AT_ONCE).toBeLessThanOrEqual(6);
  });

  it('swallows a failure rather than leaving an unhandled rejection', async () => {
    // This is fire-and-forget from a service worker. An escaping rejection there is an
    // unhandled promise in the worker's global scope, which Chrome logs as an error on a
    // catch that otherwise succeeded.
    const seen: unknown[] = [];
    const onUnhandled = (e: PromiseRejectionEvent): void => void seen.push(e.reason);
    globalThis.addEventListener?.('unhandledrejection', onUnhandled as EventListener);

    warmCovers([book('Dune', 'https://c/1.jpg')], async () => {
      throw new Error('covers.openlibrary.org said 429');
    });
    await new Promise((r) => setTimeout(r, 30));

    globalThis.removeEventListener?.('unhandledrejection', onUnhandled as EventListener);
    expect(seen).toEqual([]);
  });

  it('keeps fetching the rest after one cover fails', async () => {
    // WHAT THE UNHANDLED-REJECTION TEST COULD NOT SEE, and it took two attempts to state
    // properly. Removing the inner try/catch leaves that test green, because the outer
    // `.catch` on the pool swallows the rejection either way.
    //
    // The real difference is that an uncaught throw ENDS THAT POOL WORKER: it never takes
    // another URL. Scattered failures are survivable, because the surviving workers drain
    // the cursor between them, which is why a first version of this test with two failures
    // also passed. The tail is only stranded when EVERY worker dies, and the four workers
    // take items 0..3 before any of them awaits. So: fail exactly the first COVERS_AT_ONCE,
    // and everything after them must still be fetched.
    const asked: string[] = [];
    const urls = Array.from({ length: 8 }, (_, i) => `https://c/${i}.jpg`);
    warmCovers(
      urls.map((u, i) => book(`B${i}`, u)),
      async (url) => {
        asked.push(url);
        const n = Number(/\/(\d+)\.jpg$/.exec(url)?.[1]);
        if (n < COVERS_AT_ONCE) throw new Error('covers.openlibrary.org said 404');
      },
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(asked.sort()).toEqual([...urls].sort());
  });

  it('does nothing at all when the catch found nothing', () => {
    const s = spy();
    expect(() => warmCovers([], s.remember)).not.toThrow();
    expect(s.asked).toEqual([]);
  });
});

describe('the worker actually warms them, and never waits', () => {
  // `background.ts` registers listeners at module scope and cannot be imported by a test
  // (OPENWORK item 55). These read its source, and they are written as ABSENCE proofs
  // where it matters, because a presence check over raw source is satisfied by a comment.
  it('calls warmCovers with the candidates the catch actually found', () => {
    expect(backgroundSrc).toMatch(/warmCovers\(result\.candidates,/);
  });

  it('NEVER awaits it, anywhere', () => {
    // The invariant that makes this a fix rather than a regression. `await warmCovers(...)`
    // would hold the card back until every cover had been fetched, turning a fill-in into
    // a blank tray. Absence, not presence: there must be no awaited call at all.
    expect(backgroundSrc).not.toMatch(/await\s+warmCovers/);
    expect(backgroundSrc).not.toMatch(/return\s+warmCovers/);
  });
});
