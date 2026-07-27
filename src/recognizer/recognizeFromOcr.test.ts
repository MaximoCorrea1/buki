import { describe, it, expect } from 'vitest';
import { recognizeFromOcrText, MAX_QUERIES } from './recognizeFromOcr';
import type { BooksDb } from './types';

/** A BooksDb that only resolves the exact titles given, recording every query tried. */
function fakeBooks(known: Record<string, { title: string; author: string }>) {
  const queriesTried: string[] = [];
  const books: BooksDb = {
    async lookupByIsbn() {
      return null;
    },
    async search({ title }) {
      queriesTried.push(title);
      const hit = known[title];
      return hit ? [hit] : [];
    },
  };
  return { books, queriesTried };
}

describe('recognizeFromOcrText', () => {
  it('skips a garbage line that resolves to nothing and grounds a later real one', async () => {
    // The garbage line comes FIRST, so the loop must actually skip it to pass.
    const { books, queriesTried } = fakeBooks({
      'Structure and Interpretation of Computer Programs': {
        title: 'Structure and Interpretation of Computer Programs',
        author: 'Abelson, Sussman',
      },
    });
    const ocr = 'Second Eton Tm iT\nStructure and Interpretation of Computer Programs';

    const result = await recognizeFromOcrText(ocr, books);

    expect(result[0]?.author).toBe('Abelson, Sussman');
    expect(queriesTried[0]).toBe('Second Eton Tm iT'); // proves the miss was tried first
    expect(queriesTried).toHaveLength(2);
  });

  it('returns nothing when no line grounds', async () => {
    const { books } = fakeBooks({});
    expect(await recognizeFromOcrText('qqqq\nwwww\neeee', books)).toEqual([]);
  });

  it('rejects a match that shares no words with the query (fuzzy false positive)', async () => {
    // OpenLibrary fuzzy-matches almost anything; a meme captioned "HOME" must not
    // silently auto-save an unrelated book.
    const { books } = fakeBooks({ HOME: { title: 'The Wings of the Dove', author: 'Henry James' } });

    expect(await recognizeFromOcrText('HOME', books)).toEqual([]);
  });

  it('caps how many queries a dense-text image can fire', async () => {
    const { books, queriesTried } = fakeBooks({});
    const dense = Array.from({ length: 60 }, (_, i) => `line number ${i} of noise`).join('\n');

    await recognizeFromOcrText(dense, books);

    expect(queriesTried.length).toBeLessThanOrEqual(MAX_QUERIES);
  });

  it('sends one query for a single-line cover (dedups the whole-text fallback)', async () => {
    const { books, queriesTried } = fakeBooks({});
    await recognizeFromOcrText('Clean Code', books);
    expect(queriesTried).toEqual(['Clean Code']);
  });
});
