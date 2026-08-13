import { describe, it, expect } from 'vitest';
import { toGoodreadsCsv, shelfFilename } from './goodreadsCsv';
import type { SavedBook } from './storage';

/** Local noon, so the date reads 2026/08/13 in every timezone the tests might run in. */
const AUG_13 = new Date(2026, 7, 13, 12, 0, 0).getTime();

const saved = (over: Partial<SavedBook> = {}): SavedBook => ({
  id: 'a',
  book: { title: 'Ficciones', author: 'Jorge Luis Borges' },
  intent: 'next',
  savedAt: AUG_13,
  ...over,
});

/** The data rows, without the header. */
const rows = (books: SavedBook[]): string[] => toGoodreadsCsv(books).split('\n').slice(1);

describe('toGoodreadsCsv', () => {
  it('leads with the header both importers key off', () => {
    expect(toGoodreadsCsv([]).split('\n')[0]).toBe(
      'Title,Author,ISBN,Exclusive Shelf,Bookshelves,Date Added,My Review',
    );
  });

  it('is the header alone when the shelf is empty', () => {
    expect(toGoodreadsCsv([]).split('\n')).toHaveLength(1);
  });

  it.each([
    ['now', 'to-read', 'buki-now'],
    ['next', 'to-read', 'buki-next'],
    ['someday', 'to-read', 'buki-someday'],
    ['read', 'read', 'buki-read'],
  ] as const)('files %s as %s, keeping the pile as a tag', (intent, shelf, tag) => {
    // Now, Next and Someday are a PRIORITY, not a reading state: the shelf spec says
    // "priority inside a pile is the problem Now/Next/Someday already solves". So none
    // of them is `currently-reading`, which would tell Goodreads you are actively
    // reading forty books. The tag is what stops the collapse losing the ordering.
    const [row] = rows([saved({ intent })]);
    expect(row).toContain(`,${shelf},${tag},`);
  });

  it('quotes a title containing a comma', () => {
    const [row] = rows([saved({ book: { title: 'Cosmos, and other essays', author: 'Sagan' } })]);
    expect(row).toContain('"Cosmos, and other essays"');
  });

  it('doubles a quote inside a title', () => {
    const [row] = rows([saved({ book: { title: 'The "Good" Parts', author: 'Crockford' } })]);
    expect(row).toContain('"The ""Good"" Parts"');
  });

  it('wraps an ISBN the way Goodreads wraps its own, so Excel cannot eat it', () => {
    // A bare 13 digit ISBN opened in Excel becomes 9.78145E+12, and re-saving before
    // importing corrupts the file silently. Goodreads' OWN export uses this form, so
    // both importers demonstrably read it.
    const [row] = rows([saved({ book: { title: 'DDIA', author: 'Kleppmann', isbn: '9781449373320' } })]);
    expect(row).toContain('"=""9781449373320"""');
  });

  it('leaves the ISBN empty rather than inventing one', () => {
    const [row] = rows([saved()]);
    expect(row).toBe('Ficciones,Jorge Luis Borges,,to-read,buki-next,2026/08/13,');
  });

  it('keeps the post that sold you, which is the thing no competitor stores', () => {
    const [row] = rows([
      saved({ source: { url: 'https://x.com/u/status/1', kind: 'tweet' } }),
    ]);
    expect(row).toContain('Caught from https://x.com/u/status/1');
  });

  it('writes nothing into My Review when there is no source', () => {
    // Never a fabricated string in a field meant for the reader's own words.
    expect(rows([saved()])[0]?.endsWith(',')).toBe(true);
  });

  it('dates in Goodreads’ own format, from when the book was caught', () => {
    expect(rows([saved()])[0]).toContain(',2026/08/13,');
  });

  it('keeps shelf order, newest first, rather than resorting', () => {
    const older = saved({ id: 'b', book: { title: 'Older', author: 'A' } });
    const newer = saved({ id: 'c', book: { title: 'Newer', author: 'B' } });
    expect(rows([newer, older]).map((r) => r.split(',')[0])).toEqual(['Newer', 'Older']);
  });
});

describe('shelfFilename', () => {
  it('names the file for the day it was taken', () => {
    expect(shelfFilename(AUG_13)).toBe('buki-shelf-2026-08-13.csv');
  });
});
