import { describe, it, expect } from 'vitest';
import { shelvedAmong } from './shelvedAmong';
import { bookKey, sameBook } from './bookIdentity';
import type { Book } from '../recognizer/types';
import type { Intent, SavedBook } from './storage';

/**
 * PERF-7. `OPENWORK.md` item 50.
 *
 * The old implementation was one line inside `background.ts` — `shelf.find((s) =>
 * sameBook(s.book, c))` per candidate — and no test could reach it, because that file
 * registers listeners at module scope.
 *
 * **THE INDEX MUST NOT CHANGE THE ANSWER, and that is the only thing worth guarding.**
 * `sameBook` is not key equality: an ISBN match is unconditional, and two differing
 * subtitles on the same main title are two volumes rather than one book. A `Map` keyed on
 * `bookKey` alone would quietly merge a series. So the assertions below are against a NAIVE
 * implementation over generated data, not against hand-written expectations — a hand-written
 * expectation is a second chance to make the same mistake twice.
 */

const INTENTS: Intent[] = ['now', 'next', 'someday', 'read'];

const saved = (book: Book, i: number): SavedBook => ({
  id: `id-${i}`,
  book,
  intent: INTENTS[i % INTENTS.length] as Intent,
  savedAt: 1000 + i,
});

/** What the line in `background.ts` did, kept as the oracle. */
function naive(shelf: readonly SavedBook[], candidates: readonly Book[]) {
  return candidates.flatMap((c) => {
    const held = shelf.find((s) => sameBook(s.book, c));
    return held ? [{ identity: bookKey(c), intent: held.intent }] : [];
  });
}

describe('shelvedAmong agrees with the scan it replaced', () => {
  it('finds a book the shelf holds, and names its pile', () => {
    const shelf = [saved({ title: 'Dune', author: 'Frank Herbert' }, 0)];
    expect(shelvedAmong(shelf, [{ title: 'Dune', author: 'Frank Herbert' }])).toEqual([
      { identity: bookKey({ title: 'Dune', author: 'Frank Herbert' }), intent: 'now' },
    ]);
  });

  it('says nothing about a book the shelf does not hold', () => {
    const shelf = [saved({ title: 'Dune', author: 'Frank Herbert' }, 0)];
    expect(shelvedAmong(shelf, [{ title: 'Ulysses', author: 'James Joyce' }])).toEqual([]);
  });

  it('matches on ISBN even when the titles are written differently', () => {
    // The half a plain key lookup cannot do.
    const shelf = [saved({ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' }, 1)];
    const asked: Book = { title: 'Dune: 40th Anniversary', author: 'Herbert, Frank', isbn: '9780441013593' };
    expect(shelvedAmong(shelf, [asked])).toEqual(naive(shelf, [asked]));
    expect(shelvedAmong(shelf, [asked])).toHaveLength(1);
  });

  it('does NOT merge two volumes of a series, which a key lookup would', () => {
    // Item 47's C-5, arriving through the index. Both reduce to the same `bookKey`.
    const tolkien = 'J. R. R. Tolkien';
    const shelf = [saved({ title: 'The Lord of the Rings: The Two Towers', author: tolkien }, 0)];
    const asked: Book = { title: 'The Lord of the Rings: The Return of the King', author: tolkien };
    expect(shelvedAmong(shelf, [asked])).toEqual([]);
    expect(shelvedAmong(shelf, [asked])).toEqual(naive(shelf, [asked]));
  });

  it('STILL merges a subtitle one catalogue omits', () => {
    const shelf = [saved({ title: 'Sapiens', author: 'Yuval Noah Harari' }, 2)];
    const asked: Book = { title: 'Sapiens: A Brief History', author: 'Yuval Noah Harari' };
    expect(shelvedAmong(shelf, [asked])).toEqual(naive(shelf, [asked]));
    expect(shelvedAmong(shelf, [asked])).toHaveLength(1);
  });

  it('takes the EARLIEST shelf record when a duplicate somehow exists', () => {
    // `library.add` prevents duplicates, so this should never happen — but "in practice
    // never" is not a reason to answer differently from the scan when it does.
    const dune: Book = { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' };
    const shelf = [saved(dune, 0), saved(dune, 1)];
    expect(shelvedAmong(shelf, [dune])).toEqual(naive(shelf, [dune]));
    expect(shelvedAmong(shelf, [dune])[0]?.intent).toBe('now');
  });

  it('prefers the earlier record when the ISBN and the key point at different ones', () => {
    // The two indexes can disagree about WHICH record matched. `shelf.find` had one answer
    // and the index has to give the same one.
    const byKeyFirst = saved({ title: 'Dune', author: 'Frank Herbert' }, 0);
    const byIsbnSecond = saved({ title: 'Duna', author: 'Herbert', isbn: '9780441013593' }, 1);
    const shelf = [byKeyFirst, byIsbnSecond];
    const asked: Book = { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' };
    expect(shelvedAmong(shelf, [asked])).toEqual(naive(shelf, [asked]));
  });

  it('matches when the ISBN is the ONLY thing the two records share', () => {
    // THE FIXTURE EVERY TEST ABOVE WAS MISSING. In all of them the candidate and the shelf
    // record share a `bookKey`, so the key half alone answers and dropping the ISBN half
    // changed nothing — the mutation survived. Here the titles and authors disagree
    // completely and the ISBN is the whole match, which is exactly the case a plain key
    // lookup cannot do and the reason `byIsbn` exists.
    const shelf = [saved({ title: 'Duna', author: 'Herbert', isbn: '9780441013593' }, 0)];
    const asked: Book = { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' };
    expect(shelvedAmong(shelf, [asked])).toEqual(naive(shelf, [asked]));
    expect(shelvedAmong(shelf, [asked])).toHaveLength(1);
  });

  it('returns the CANDIDATE’s identity, not the shelf record’s', () => {
    // `content.ts` looks the answer up by `identityOf(book)` where `book` is the candidate
    // it is drawing. Returning the shelf's key looks identical in every test where the two
    // agree — which was all of them — and silently marks nothing as held when they differ.
    const shelf = [saved({ title: 'Duna', author: 'Herbert', isbn: '9780441013593' }, 0)];
    const asked: Book = { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' };
    expect(shelvedAmong(shelf, [asked])[0]?.identity).toBe(bookKey(asked));
    expect(shelvedAmong(shelf, [asked])[0]?.identity).not.toBe(bookKey(shelf[0]!.book));
  });

  it('keeps the EARLIEST record in the ISBN index when the shelf holds two', () => {
    // `byIsbn` is written with `!has`, so the first wins. Overwriting looked harmless in
    // every fixture where the key half answered first, and that mutation survived too.
    const shelf = [
      saved({ title: 'Duna', author: 'Herbert', isbn: '9780441013593' }, 0),
      saved({ title: 'Duno', author: 'Herbert', isbn: '9780441013593' }, 3),
    ];
    const asked: Book = { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' };
    expect(shelvedAmong(shelf, [asked])).toEqual(naive(shelf, [asked]));
    expect(shelvedAmong(shelf, [asked])[0]?.intent).toBe('now');
  });

  it('is empty for an empty shelf and for no candidates', () => {
    expect(shelvedAmong([], [{ title: 'Dune', author: 'Frank Herbert' }])).toEqual([]);
    expect(shelvedAmong([saved({ title: 'Dune', author: 'Frank Herbert' }, 0)], [])).toEqual([]);
  });

  it('agrees with the scan over a generated shelf, which is the real guard', () => {
    // Deterministic rather than random: a property test that cannot be re-run with the
    // same input is a test that reports a failure nobody can reproduce.
    const book = (i: number): Book => ({
      title: i % 5 === 0 ? `Series ${i % 7}: Volume ${i}` : `Title ${i}`,
      author: `Surname${i % 11} Given`,
      ...(i % 3 === 0 ? { isbn: `97800000${String(i).padStart(5, '0')}` } : {}),
    });

    const shelf = Array.from({ length: 200 }, (_, i) => saved(book(i), i));
    // A mix of held books, near-misses on the same series, and books nobody has.
    const candidates: Book[] = [
      ...Array.from({ length: 40 }, (_, i) => book(i * 5)),
      ...Array.from({ length: 20 }, (_, i) => book(1000 + i)),
    // `as Book` DELIBERATELY, and this is the finding rather than a workaround.
    // `exactOptionalPropertyTypes` now forbids WRITING this shape in TypeScript - which is
    // the whole point of the flag - and says NOTHING about the same shape arriving at
    // runtime from `JSON.parse`, from `chrome.storage.local`, or from any untyped caller.
    // So the runtime guard stays, and its test has to keep building the value production
    // code can no longer build. Item 53, TS-7.
      ...Array.from({ length: 10 }, (_, i) => ({ ...book(i), isbn: undefined }) as unknown as Book),
    ];

    const fast = shelvedAmong(shelf, candidates);
    const slow = naive(shelf, candidates);
    // Guard the vacuous pass: two empty arrays agree perfectly and prove nothing.
    expect(slow.length, 'the fixture matched nothing; this test proves nothing').toBeGreaterThan(20);
    expect(fast).toEqual(slow);
  });
});
