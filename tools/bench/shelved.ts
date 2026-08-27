/**
 * PERF-7 baseline and re-measure. OPENWORK item 50.
 *
 * `shelvedAmong` is O(candidates x shelf) with both identity keys recomputed per
 * comparison, on the catch's RESPONSE path - the moment the card is waiting to say which
 * books the shelf already holds. The review measured 2000 books = 40,000 calls = 179ms.
 *
 * Run the SAME way before and after: same shapes, same counts, same RUNS.
 */
import { sameBook } from '../../src/extension/bookIdentity';
import { shelvedAmong } from '../../src/extension/shelvedAmong';
import type { Book } from '../../src/recognizer/types';

const RUNS = 20;

const book = (i: number): Book => ({
  title: `Title Number ${i} Of The Series`,
  author: `Surname${i % 400} Given`,
  ...(i % 3 === 0 ? { isbn: `97800000${String(i).padStart(5, '0')}` } : {}),
});

function bench(shelfSize: number, candidates: number): void {
  const shelf = Array.from({ length: shelfSize }, (_, i) => ({
    book: book(i),
    intent: 'next' as const,
  }));
  // Half hit, half miss: a real catch is mostly new books with one or two already held.
  const asked = Array.from({ length: candidates }, (_, i) =>
    i % 2 === 0 ? book(i * 7) : book(shelfSize + i),
  );

  let hits = 0;
  const t0 = performance.now();
  for (let r = 0; r < RUNS; r++) {
    for (const c of asked) {
      if (shelf.find((s) => sameBook(s.book, c))) hits++;
    }
  }
  const slow = (performance.now() - t0) / RUNS;

  let fastHits = 0;
  const t1 = performance.now();
  for (let r = 0; r < RUNS; r++) fastHits = shelvedAmong(shelf as never, asked).length;
  const fast = (performance.now() - t1) / RUNS;

  console.log(
    `shelf=${String(shelfSize).padStart(4)}  scan ${slow.toFixed(2)}ms (${hits / RUNS} hits)  ->  index ${fast.toFixed(2)}ms (${fastHits} hits)  ${(slow / fast).toFixed(1)}x`,
  );
}

for (const size of [119, 500, 2000]) bench(size, 20);
