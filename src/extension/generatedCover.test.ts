import { describe, it, expect } from 'vitest';
import { BINDING, RAMP, DEVICE_SIZE, bindingFor, deviceFor, titleStep } from './generatedCover';
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
