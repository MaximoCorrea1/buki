import { describe, it, expect } from 'vitest';
import {
  BINDING,
  RAMP,
  DEVICE_SIZE,
  bindingFor,
  deviceFor,
  titleStep,
  weaveOf,
} from './generatedCover';
import { CLOTH, clothFor } from './cloth';

const SHELF = [
  { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' },
  { title: 'Signals and Systems', author: 'Alan V. Oppenheim' },
  { title: 'Structure and Interpretation of Computer Programs', author: 'Abelson, Sussman' },
  { title: 'Ficciones', author: 'Jorge Luis Borges' },
  { title: 'The Dispossessed', author: 'Ursula K. Le Guin' },
  { title: 'Ubik', author: 'Philip K. Dick' },
  { title: 'Neuromancer', author: 'William Gibson' },
  { title: 'Clean Code', author: 'Robert C. Martin' },
  { title: 'Fun Home', author: 'Alison Bechdel' },
  { title: 'Labyrinths', author: 'Jorge Luis Borges' },
  { title: 'The Wings of the Dove', author: 'Henry James' },
  { title: 'Economics in One Lesson', author: 'Henry Hazlitt' },
];

/** How much ink a glyph is: its index in the ramp, 0 for blank. */
const ink = (glyph: string): number => RAMP.indexOf(glyph);

/** Chebyshev distance from the middle cell, so a ring is one value. */
const ringOf = (row: number, col: number): number => {
  const mid = (DEVICE_SIZE - 1) / 2;
  return Math.max(Math.abs(row - mid), Math.abs(col - mid));
};

function meanInk(grid: string[], want: (ring: number) => boolean): number {
  const cells: number[] = [];
  grid.forEach((line, row) =>
    [...line].forEach((glyph, col) => {
      if (want(ringOf(row, col))) cells.push(ink(glyph));
    }),
  );
  return cells.reduce((a, b) => a + b, 0) / cells.length;
}

describe('bindingFor', () => {
  it('pairs a book with the deep version of its own cloth', () => {
    // The board and the spine have to be the same book. Two independent hashes is
    // exactly how clothFor once shipped one colour in the picker and another on the
    // shelf, so this asserts the pairing rather than trusting it.
    for (const book of SHELF) {
      expect(bindingFor(book)).toBe(BINDING[CLOTH.indexOf(clothFor(book))]);
    }
  });

  it('only ever returns a colour from the binding palette', () => {
    expect(BINDING).toContain(bindingFor({ title: '', author: '' }));
  });
});

describe('deviceFor', () => {
  it('gives the same book the same device every time', () => {
    const book = { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' };
    expect(deviceFor(book)).toEqual(deviceFor(book));
  });

  it('keys on the ISBN, so a retitled edition keeps its mark', () => {
    const isbn = '9780441013593';
    expect(deviceFor({ title: 'Dune', author: 'Frank Herbert', isbn })).toEqual(
      deviceFor({ title: 'Dune (50th Anniversary)', author: 'F. Herbert', isbn }),
    );
  });

  it('draws a square of the stated size', () => {
    const grid = deviceFor(SHELF[0]!);
    expect(grid).toHaveLength(DEVICE_SIZE);
    for (const line of grid) expect([...line]).toHaveLength(DEVICE_SIZE);
  });

  it('draws only glyphs from the ramp', () => {
    for (const book of SHELF) {
      for (const line of deviceFor(book)) {
        for (const glyph of line) expect(RAMP).toContain(glyph);
      }
    }
  });

  it('mirrors left to right, so it reads as an emblem rather than as noise', () => {
    for (const book of SHELF) {
      for (const line of deviceFor(book)) {
        expect([...line].reverse().join('')).toBe(line);
      }
    }
  });

  it('is densest at the middle and dissolves at the edge', () => {
    // The reason a hashed grid can look designed at all. Uniform noise reads as a
    // failure to load; a dense core with a dissolving edge reads as a stamp.
    for (const book of SHELF) {
      const grid = deviceFor(book);
      expect(meanInk(grid, (ring) => ring <= 1)).toBeGreaterThan(
        meanInk(grid, (ring) => ring === DEVICE_SIZE - 4),
      );
    }
  });

  it('leaves no speck on its own, so the mark is a form and not static', () => {
    // The property a picture caught and the mean-ink test above did not. With every cell
    // rolled independently the middle IS denser on average, and it still renders as a
    // dead channel: the giveaway is isolated specks, which is what a broken image looks
    // like and the one thing a drawn cover must never be. A stamp may have a hard edge,
    // so this does not ask the shading to be gentle - only that ink arrives in areas.
    for (const book of SHELF) {
      const grid = deviceFor(book);
      const inked = (row: number, col: number) =>
        row >= 0 &&
        col >= 0 &&
        row < DEVICE_SIZE &&
        col < DEVICE_SIZE &&
        ink(grid[row]![col]!) > 0;

      for (let row = 0; row < DEVICE_SIZE; row++) {
        for (let col = 0; col < DEVICE_SIZE; col++) {
          if (!inked(row, col)) continue;
          const neighbours =
            +inked(row - 1, col) + +inked(row + 1, col) + +inked(row, col - 1) + +inked(row, col + 1);
          expect(`${book.title} @${row},${col}: ${neighbours}`).not.toMatch(/: 0$/);
        }
      }
    }
  });

  it('does not stamp every book with the same mark', () => {
    const marks = new Set(SHELF.map((book) => deviceFor(book).join('\n')));
    expect(marks.size).toBe(SHELF.length);
  });
});

describe('titleStep', () => {
  it('sets a short title large', () => {
    expect(titleStep('Dune')).toBe('large');
  });

  it('sets a middling title medium', () => {
    expect(titleStep('Signals and Systems')).toBe('medium');
  });

  it('sets a long title small', () => {
    expect(titleStep('Structure and Interpretation of Computer Programs')).toBe('small');
  });

  it('steps down for one long word, which has nowhere to wrap', () => {
    // "Neuromancer" is eleven characters, so counting the title got it the largest step
    // and it was rendered clipped at the edge of its own cover. A line breaks between
    // words, so the widest word is the constraint, not the total.
    expect(titleStep('Neuromancer')).not.toBe('large');
    expect(titleStep('Clean Code')).toBe('large');
  });

  it('steps rather than scales, so a cover is composed and not fitted', () => {
    // Three sizes a designer picked beat a continuous fit: fitting type to length is
    // what makes a generated cover read as output rather than as a cover.
    const steps = new Set(SHELF.map((book) => titleStep(book.title)));
    expect(steps.size).toBeLessThanOrEqual(3);
  });
});

describe('weaveOf', () => {
  const book = { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' };

  it('fills exactly the rows and columns asked for', () => {
    const cloth = weaveOf(book, 11, 4);
    expect(cloth).toHaveLength(4);
    for (const line of cloth) expect([...line]).toHaveLength(11);
  });

  it('repeats the book its own tile', () => {
    // The first tile-width of the first row IS the device's first row: the cloth and
    // the mark are the same hash seen at two scales, not two ideas.
    const tile = deviceFor(book);
    expect(weaveOf(book, DEVICE_SIZE, 1)[0]).toBe(tile[0]);
  });

  it('half-drops alternate tile rows, so the repeat is not corduroy', () => {
    // Stacked square, the seams line up into vertical ribbing - visible at 118px and
    // the reason this takes an offset at all.
    const tile = deviceFor(book);
    const cloth = weaveOf(book, DEVICE_SIZE, DEVICE_SIZE * 2);
    expect(cloth[DEVICE_SIZE]).not.toBe(tile[0]);
    // ...and it is the same row rotated, rather than a different row.
    expect([...cloth[DEVICE_SIZE]!].sort().join('')).toBe([...tile[0]!].sort().join(''));
  });

  it('draws only glyphs from the ramp', () => {
    for (const line of weaveOf(book, 24, 30)) {
      for (const glyph of line) expect(RAMP).toContain(glyph);
    }
  });
});

/**
 * PERF-5. `OPENWORK.md` item 50. The cloth is woven once per book, not once per keystroke.
 *
 * The popup rebuilds the whole shelf on every letter typed, and every drawn cover in it
 * wove 36 rows of 26 characters from scratch. Measured on this machine, per keystroke:
 * 119 books 3.11ms, 500 books 11.18ms, 2000 books 44.33ms. With the memo: 0.70ms, 1.20ms,
 * 5.88ms.
 *
 * A cache is only safe because the function is PURE and deterministic in its three
 * arguments. These are the ways that could stop being true.
 */
describe('the cloth is remembered, not rewoven', () => {
  const dune = { title: 'Dune', author: 'Frank Herbert' };

  it('gives the same book the same cloth every time', () => {
    expect(weaveOf(dune, 26, 36)).toEqual(weaveOf(dune, 26, 36));
  });

  it('still gives two different books DIFFERENT cloth', () => {
    // The failure a cache introduces: a key too coarse hands one book another's weave.
    // `clothFor` had exactly this defect when it derived colour from a normalised name.
    const other = { title: 'Ulysses', author: 'James Joyce' };
    expect(weaveOf(dune, 26, 36)).not.toEqual(weaveOf(other, 26, 36));
  });

  it('separates two books that share a title but not an author', () => {
    expect(weaveOf({ title: 'Ulysses', author: 'James Joyce' }, 26, 36)).not.toEqual(
      weaveOf({ title: 'Ulysses', author: 'Alfred Tennyson' }, 26, 36),
    );
  });

  it('keys on the DIMENSIONS as well, or a resize serves the old size', () => {
    expect(weaveOf(dune, 26, 36)).not.toEqual(weaveOf(dune, 26, 12));
    expect(weaveOf(dune, 26, 36)[0]).not.toBe(weaveOf(dune, 10, 36)[0]);
  });

  it('ACTUALLY caches, rather than recomputing and throwing the result away', () => {
    // THE ONE PROPERTY BEHAVIOUR CANNOT SHOW. Deleting the cache write leaves every other
    // test in this block passing, because a correct cache is invisible by construction —
    // that mutation survived until this test existed. The only thing that distinguishes a
    // live cache from a dead one is COST.
    //
    // Measured RELATIVELY and in the same run, so machine speed, CI load and JIT warmth all
    // cancel: N distinct books against N repeats of one book. The real ratio measured on
    // this machine is about 7.5x, so a threshold of 4x is a wide margin rather than a
    // coin flip — a timing assertion is only worth writing when the gap is an order of
    // magnitude and the comparison is against a number taken seconds earlier.
    const N = 300;
    const distinct = Array.from({ length: N }, (_, i) => ({
      title: `Distinct Title ${i}`,
      author: `Surname${i} Given`,
    }));
    const t0 = performance.now();
    for (const b of distinct) weaveOf(b, 26, 36);
    const cold = performance.now() - t0;

    const one = { title: 'Repeated Title', author: 'Repeated Author' };
    weaveOf(one, 26, 36); // prime, so the first call is not counted as a hit
    const t1 = performance.now();
    for (let i = 0; i < N; i++) weaveOf(one, 26, 36);
    const warm = performance.now() - t1;

    expect(cold, 'the cold loop was too fast to measure; raise N').toBeGreaterThan(0.5);
    expect(warm, `${N} repeats cost ${warm.toFixed(2)}ms against ${cold.toFixed(2)}ms cold`).toBeLessThan(
      cold / 4,
    );
  });

  it('hands out a COPY, so one caller cannot reweave every other book', () => {
    // The hazard a cache introduces that a fresh computation never had: returning the
    // stored array means any caller that sorts, splices or edits its cloth silently
    // rewrites what every later caller gets.
    const first = weaveOf(dune, 26, 36);
    first[0] = 'TAMPERED';
    expect(weaveOf(dune, 26, 36)[0], 'the cache handed out its own array').not.toBe('TAMPERED');
  });
});
