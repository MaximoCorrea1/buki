import { describe, it, expect } from 'vitest';
import { mergeBook } from './mergeBook';
import type { Book } from '../recognizer/types';

const DUNE: Book = {
  title: 'Dune',
  author: 'Frank Herbert',
  isbn: '9780441013593',
  coverUrl: 'https://covers.openlibrary.org/b/id/1-M.jpg',
};

describe('mergeBook', () => {
  it('is the new reading when there was nothing on the shelf', () => {
    expect(mergeBook(undefined, DUNE)).toEqual(DUNE);
  });

  it('KEEPS the ISBN and cover when the new reading has neither key', () => {
    // The bare guess. `recognizer.ts:94` emits `{ title, author }` with no `isbn` and no
    // `coverUrl` AT ALL when the catalogue could not be asked - which is the correct
    // behaviour, because "I could not ask" is not "no". Saving it must not delete what a
    // previous, answered catch already learned.
    const guess: Book = { title: 'Dune', author: 'Frank Herbert' };
    expect(mergeBook(DUNE, guess)).toEqual(DUNE);
  });

  it('KEEPS them when the new reading carries the keys but with undefined in them', () => {
    // THE CASE THE REVIEW'S ONE-LINE FIX MISSES, and it is the common one.
    // `openLibrary.toBook` always writes both keys: `isbn: (doc.isbn ?? [])[0]` and
    // `coverUrl: doc.cover_i ? ... : undefined`. So a doc that MATCHES but is sparse -
    // OpenLibrary records are patchy - produces `{ isbn: undefined, coverUrl: undefined }`
    // with the keys PRESENT. `{ ...previous.book, ...book }` overwrites with undefined and
    // the cover is gone, exactly as if nothing had been guarded at all.
    const sparse: Book = {
      title: 'Dune',
      author: 'Frank Herbert',
      isbn: undefined,
      coverUrl: undefined,
    };
    expect(mergeBook(DUNE, sparse)).toEqual(DUNE);
  });

  it('takes the new ISBN and cover when the new reading actually has them', () => {
    // The whole point of re-catching a book that was saved during an outage.
    const bare: Book = { title: 'Dune', author: 'Frank Herbert' };
    expect(mergeBook(bare, DUNE)).toEqual(DUNE);
  });

  it('prefers the newer value when BOTH readings have one', () => {
    const other: Book = { ...DUNE, isbn: '9780340960196', coverUrl: 'https://x.test/b.jpg' };
    expect(mergeBook(DUNE, other).isbn).toBe('9780340960196');
    expect(mergeBook(DUNE, other).coverUrl).toBe('https://x.test/b.jpg');
  });

  it('keeps the better TITLE rather than an empty one', () => {
    // `toBook` writes `title: doc.title ?? ''`. An empty title is not a correction, and a
    // re-catch must never make the record worse than it was.
    const empty: Book = { title: '', author: '', isbn: '9780441013593' };
    expect(mergeBook(DUNE, empty).title).toBe('Dune');
    expect(mergeBook(DUNE, empty).author).toBe('Frank Herbert');
  });

  it('does not resurrect a field the new reading deliberately blanked to empty string', () => {
    // An empty string and undefined are both "nothing" here, so both keep the old value.
    // Stated as its own case because the two arrive from different code paths and a fix
    // that handles only `undefined` would pass every test above.
    const blanked: Book = { title: 'Dune', author: 'Frank Herbert', coverUrl: '' };
    expect(mergeBook(DUNE, blanked).coverUrl).toBe(DUNE.coverUrl);
  });

  it('leaves no key holding undefined, so the merged record is storable as-is', () => {
    // `chrome.storage.local` serialises through structured clone, which drops undefined
    // values, so a record that round-trips loses those keys anyway. Emitting them here
    // would make the in-memory object and the stored one differ - the exact gap that let
    // the original `activationId` bug flow perfectly in 550 tests and never in production.
    //
    // THE FIRST VERSION OF THIS CALLED `mergeBook(undefined, bare)` AND PROVED NOTHING.
    // With no previous record the function returns `incoming` unchanged on its first line,
    // so the assertion never reached the object it was written to check: a mutation
    // emitting `isbn: undefined, coverUrl: undefined` from the merge SURVIVED. A test for a
    // merge has to exercise the merge.
    const bare: Book = { title: 'Dune', author: 'Frank Herbert' };
    const merged = mergeBook({ title: 'Dune', author: 'Frank Herbert' }, bare);
    expect(Object.keys(merged).sort()).toEqual(['author', 'title']);
  });

  it('does not mutate either input', () => {
    const previous = { ...DUNE };
    const incoming: Book = { title: 'Dune', author: 'Frank Herbert' };
    mergeBook(previous, incoming);
    expect(previous).toEqual(DUNE);
    expect(incoming).toEqual({ title: 'Dune', author: 'Frank Herbert' });
  });
});
