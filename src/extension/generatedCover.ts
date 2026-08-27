import type { Book } from '../recognizer/types';
import { CLOTH, hashOf } from './cloth';

/**
 * A cover for a book that has none.
 *
 * OpenLibrary has no art for a large share of books, and on 2026-08-04 it answered
 * nothing at all for hours. A face-out shelf where a third of the covers are missing
 * looks broken, so Buki draws the rest. The bar is that it reads as an artifact rather
 * than as a placeholder: if it reads as a placeholder, face-out is worse than the list
 * it replaced, because a list never pretended there was cover art.
 *
 * The answer is not to fake art. It is to draw what a book with no dust jacket actually
 * looks like: dyed cloth boards, two stamped rules, and the title. Nothing here is
 * pretending to be a photograph, so nothing here can look like a photograph that failed.
 *
 * `deviceFor` draws the book its mark and `weaveOf` repeats that mark into the cloth.
 * They are one hash at two scales rather than two ideas: the mark on its own, tried at
 * two sizes on the board, read as an audio equaliser and was cut.
 */

/**
 * The boards. One per cloth, same index, deliberately deep.
 *
 * Real bookcloth is dyed, not printed: oxblood, tobacco, forest, indigo, aubergine. The
 * bright CLOTH values are a highlighter by comparison, and the arithmetic agrees - cream
 * type on bright marigold is 1.9:1 and unreadable, while the same cream on tobacco is
 * 11.2:1. So the bright cloth keeps its job on spine edges and rows, and the board gets
 * the deep value of the same dye. Two solid values of one colour, which is not a blend.
 */
export const BINDING = ['#4a1414', '#4a3208', '#0c4033', '#1b2570', '#3a1550'];

/** Blank first: the ramp is read as an amount of ink, and index 0 has to be none. */
export const RAMP = [' ', '░', '▒', '▓', '█'];

/** Odd, so the device has a middle cell to be dense at. */
export const DEVICE_SIZE = 7;

export function bindingFor(book: Book): string {
  return BINDING[hashOf(book) % CLOTH.length] ?? BINDING[0]!;
}

/** xorshift32. Deterministic and seedable, which `Math.random` is not. */
function rolls(seed: number, count: number): number[] {
  let x = seed || 1; // 0 is xorshift's fixed point and would draw one glyph forever
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out.push(x);
  }
  return out;
}

/**
 * How the rolled field becomes ink. Tuned by looking at it at 118px, not derived.
 * SPREAD sets how much of the ramp a device uses, LIFT how inky it is overall, and
 * FALLOFF how fast it dissolves past the middle ring.
 */
const SPREAD = 1;
const LIFT = 1.6;
const FALLOFF = 1.3;

/**
 * The device: a small stamped emblem, hashed from the book and never changing.
 *
 * Three rules turn a hashed grid into something that looks drawn rather than corrupted,
 * and all three had to be there. The first version had only the last two and, rendered,
 * it read as a dead channel.
 *
 * It is BLURRED. A cell's ink is the average of its neighbourhood, not its own roll, so
 * ink arrives in contiguous areas. Rolling every cell independently is white noise, and
 * white noise is what a broken image looks like - the one thing this must never be.
 *
 * It MIRRORS left to right, which is why GitHub's identicons read as creatures rather
 * than as static. Symmetry is the cheapest signal of intent there is.
 *
 * And it is DENSER IN THE MIDDLE, so every device is a solid core that dissolves at its
 * edge. That gives the set a family resemblance, one species with a specimen per book,
 * while the rolls keep any two books apart.
 */
export function deviceFor(book: Book): string[] {
  const half = Math.ceil(DEVICE_SIZE / 2);
  const mid = (DEVICE_SIZE - 1) / 2;
  const draw = rolls(hashOf(book), DEVICE_SIZE * half);

  // The mirror happens here, in the field, so the blur below inherits it: the right half
  // is the left half read backwards.
  const field = Array.from({ length: DEVICE_SIZE }, (_, row) =>
    Array.from({ length: DEVICE_SIZE }, (_, col) => {
      const source = Math.min(col, DEVICE_SIZE - 1 - col);
      return (draw[row * half + source] ?? 0) % RAMP.length;
    }),
  );

  // Clamped at the border rather than wrapped, so an edge cell is pulled outward by its
  // own value. Wrapping would tie the top of the mark to the bottom of it.
  const clamp = (n: number, hi: number) => Math.max(0, Math.min(hi, n));
  const at = (row: number, col: number) =>
    field[clamp(row, DEVICE_SIZE - 1)]![clamp(col, DEVICE_SIZE - 1)]!;

  return field.map((line, row) =>
    line
      .map((_, col) => {
        let sum = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) sum += at(row + dr, col + dc);
        }
        const ring = Math.max(Math.abs(row - mid), Math.abs(col - mid));
        // The innermost ring pays no falloff, so the core is an area and not a peak.
        const level = (sum / 9) * SPREAD + LIFT - Math.max(0, ring - 1) * FALLOFF;
        return RAMP[clamp(Math.round(level), RAMP.length - 1)];
      })
      .join(''),
  );
}

/**
 * How big the title is set. Three sizes rather than a fit.
 *
 * Scaling type continuously to fill the space is what makes a generated cover read as
 * output: every book gets a different size, so no two covers share a system. Three steps
 * a person chose read as three templates a publisher owns.
 */
export type TitleStep = 'large' | 'medium' | 'small';

export function titleStep(title: string): TitleStep {
  const words = title.trim().split(/\s+/);
  const total = title.trim().length;
  // A line breaks between words, so the widest word is a constraint of its own. Counting
  // only the title set "Neuromancer" at the largest step and rendered it clipped at the
  // edge of its own cover.
  const widest = words.reduce((n, word) => Math.max(n, word.length), 0);

  if (total <= 12 && widest <= 9) return 'large';
  if (total <= 28 && widest <= 12) return 'medium';
  return 'small';
}

/**
 * How far alternate tile rows shift. Coprime with DEVICE_SIZE, so the offset never lands
 * back on the seam it exists to hide.
 */
const HALF_DROP = 3;

/**
 * The board's cloth: the book's own tile, repeated to fill it.
 *
 * Lines of text rather than cells, for two reasons. This is texture, so a mono font's
 * advance width does not matter the way it does for the mark. And a board covered in
 * cells is six hundred DOM nodes per book, which on a shelf of twenty is twelve thousand.
 *
 * Alternate tile rows shift sideways. Stacked square, the seams line up into vertical
 * corduroy, which is plainly visible at 118px; a half-drop is how a real textile repeat
 * hides that same seam.
 */
/**
 * Woven cloth, remembered. `OPENWORK.md` item 50, PERF-5.
 *
 * `weaveOf` is pure and deterministic in `(book, cols, rows)`, and the popup rebuilds the
 * whole shelf on every keystroke — so a shelf of drawn covers re-wove itself, character by
 * character, once per letter typed. Measured on this machine, per keystroke:
 *
 *     119 books    3.11ms
 *     500 books   11.18ms
 *     2000 books  44.33ms
 *
 * Bounded by the shelf and by the popup's own lifetime, which is a few seconds: the popup
 * is torn down when it closes and this goes with it. That is the reason there is no
 * eviction here and why adding one would be complexity buying nothing.
 */
const woven = new Map<string, string[]>();

export function weaveOf(book: Book, cols: number, rows: number): string[] {
  // Title and author are what `deviceFor` reads, so they are the whole of the identity.
  // NOT `bookKey`: that normalises, and two books it calls the same would then share one
  // cloth — the exact defect `clothFor` had when it derived colour from a normalised name.
  //
  // `\u0000` as the separator, written as an ESCAPE rather than as the byte. A space would
  // collide: `{title:'A B', author:'C'}` and `{title:'A', author:'B C'}` produce the same
  // key and one book would wear the other's cloth. A NUL cannot appear in either field.
  //
  // It was briefly a literal control byte here, invisible in the source and in every diff,
  // which is the same class of corruption OPENWORK §5 records for the `0x08` that shipped
  // into a doc. The behaviour was right and the spelling was not.
  const key = `${book.title}\u0000${book.author}\u0000${cols}x${rows}`;
  // A COPY, not the cached array. Handing every caller the same mutable array to save 36
  // string references would trade a measured millisecond for an aliasing bug nobody would
  // find: one caller sorting or splicing its cloth would silently reweave every other
  // book's. The copy is O(rows) against a weave that is O(rows x cols), and re-measuring
  // showed it costs nothing worth naming.
  const held = woven.get(key);
  if (held) return held.slice();

  const made = build(book, cols, rows);
  woven.set(key, made);
  return made.slice();
}

function build(book: Book, cols: number, rows: number): string[] {
  const tile = deviceFor(book);
  return Array.from({ length: rows }, (_, row) => {
    const shift = Math.floor(row / DEVICE_SIZE) % 2 ? HALF_DROP : 0;
    const source = tile[row % DEVICE_SIZE]!;
    let line = '';
    for (let col = 0; col < cols; col++) line += source[(col + shift) % DEVICE_SIZE];
    return line;
  });
}
