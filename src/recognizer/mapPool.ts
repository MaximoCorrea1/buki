/**
 * Run `work` over `items` with at most `limit` in flight, keeping input order.
 *
 * WHY THIS EXISTS, 2026-08-27. `recognizeBook` grounded its guesses with a bare
 * `Promise.all`, and `MAX_BOOKS` is 20. A photograph of nineteen books therefore opened
 * **nineteen simultaneous requests to openlibrary.org from one IP**, which came back
 * `HTTP 429`. The rate-limited address then stopped answering at all: sixteen consecutive
 * `did not answer within 6s` in the log, which is `TOLERANCE` of 3 exceeded six times over,
 * so the breaker opened and stayed open for its full `COOLDOWN_MS` of two minutes. Every
 * catch in that window came back `unverified`, with no `cover_i`, so the shelf drew a cloth
 * instead of the real cover.
 *
 * The bug looked like "covers are not loading". It was a burst that read as abuse.
 *
 * The `Promise.all` was not careless: its comment records that it replaced four SEQUENTIAL
 * round trips, and that was a real fix. It just had no ceiling, and the ceiling is the part
 * that matters once one picture can hold twenty books.
 *
 * Deliberately not in `src/shared/`: the recognizer is the only caller, and
 * `OPENWORK.md` K-1 already tracks one edge against the module graph without adding a
 * second on speculation.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;

  // A shared cursor rather than pre-sliced chunks: chunking makes every worker wait for
  // the slowest member of its own chunk, and one 6s timeout would then hold three fast
  // lookups hostage. With a cursor, a worker that finishes takes the next item at once.
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await work(items[i]!, i);
    }
  };

  // At least one, never more than there is work to do. A limit of 0 must not mean "no
  // workers", which would hang the catch for ever, and must not mean "unbounded", which
  // is the bug this file exists to prevent.
  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));

  return out;
}
