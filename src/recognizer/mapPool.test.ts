import { describe, it, expect } from 'vitest';
import { mapPool } from './mapPool';

/** Runs `work` and records the high-water mark of how many ran at once. */
const watched = () => {
  let live = 0;
  let peak = 0;
  return {
    peak: () => peak,
    work: async <T>(value: T, ms = 0): Promise<T> => {
      live += 1;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, ms));
      live -= 1;
      return value;
    },
  };
};

describe('a bounded pool over the catalogue', () => {
  it('never runs more than the limit at once', async () => {
    // THE WHOLE POINT. `Promise.all` over 19 guesses opened 19 sockets to openlibrary.org
    // at once and earned an HTTP 429 on 2026-08-27, which then tripped the breaker for two
    // minutes. A regression to Promise.all makes this number 19 again.
    const w = watched();
    const items = Array.from({ length: 19 }, (_, i) => i);
    const out = await mapPool(items, 4, (n) => w.work(n, 5));
    expect(w.peak()).toBeLessThanOrEqual(4);
    // AND every one of them ran. Bounding the pool must not silently drop the tail:
    // a mutation that stopped after the first batch of four left this file green until
    // this line existed, because the other completeness tests use two and three items.
    expect(out).toEqual(items);
  });

  it('keeps the input order regardless of which finished first', async () => {
    // The caller pairs each result with its guess by position. Returning them in
    // completion order would attach every book to the wrong reading.
    const out = await mapPool([30, 10, 20], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(out).toEqual([30, 10, 20]);
  });

  it('passes the index alongside the item', async () => {
    const seen = await mapPool(['a', 'b', 'c'], 2, async (item, i) => `${i}:${item}`);
    expect(seen).toEqual(['0:a', '1:b', '2:c']);
  });

  it('runs everything even when there are fewer items than the limit', async () => {
    const w = watched();
    const out = await mapPool([1, 2], 8, (n) => w.work(n, 1));
    expect(out).toEqual([1, 2]);
    expect(w.peak()).toBeLessThanOrEqual(2);
  });

  it('returns an empty array for an empty list, without hanging', async () => {
    expect(await mapPool([], 4, async () => 'never')).toEqual([]);
  });

  it('still bounds the pool when the limit is nonsense', async () => {
    // A zero or negative limit must not mean "no workers", which would hang the catch
    // for ever, and must not mean "unbounded", which is the bug this file exists for.
    const w = watched();
    await mapPool(Array.from({ length: 6 }, (_, i) => i), 0, (n) => w.work(n, 2));
    expect(w.peak()).toBe(1);
    expect(await mapPool([1, 2, 3], -5, async (n) => n)).toEqual([1, 2, 3]);
  });

  it('lets a rejection out rather than swallowing it', async () => {
    // The caller wraps each unit in `attempt`, which turns a failure into null. The pool
    // must not quietly add a SECOND layer of that: a helper that hides errors is how a
    // catalogue outage becomes invisible.
    await expect(
      mapPool([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('OpenLibrary request failed (HTTP 429)');
        return n;
      }),
    ).rejects.toThrow('429');
  });
});
