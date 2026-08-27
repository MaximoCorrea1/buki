/**
 * PERF-5 baseline and re-measure. OPENWORK item 50.
 *
 * Every keystroke rebuilds the whole shelf DOM, and every DRAWN cover in it calls `weaveOf`
 * to produce 36 rows of 26 characters. The review measured 119 books at 5.12ms, 500 at
 * 15.98ms, 2000 at 58.80ms - per keystroke.
 *
 * Same shapes, same counts, same RUNS before and after.
 */
import { weaveOf } from '../../src/extension/generatedCover';
import type { Book } from '../../src/recognizer/types';

const WEAVE_COLS = 26;
const WEAVE_ROWS = 36;
const RUNS = 20;

const book = (i: number): Book => ({
  title: `Title Number ${i} Of The Series`,
  author: `Surname${i % 400} Given`,
});

function bench(shelfSize: number): void {
  const shelf = Array.from({ length: shelfSize }, (_, i) => book(i));
  let chars = 0;
  const t0 = performance.now();
  for (let r = 0; r < RUNS; r++) {
    for (const b of shelf) chars += weaveOf(b, WEAVE_COLS, WEAVE_ROWS).length;
  }
  const ms = (performance.now() - t0) / RUNS;
  console.log(`shelf=${String(shelfSize).padStart(4)}  ${ms.toFixed(2)}ms per keystroke  rows=${chars / RUNS}`);
}

for (const size of [119, 500, 2000]) bench(size);
