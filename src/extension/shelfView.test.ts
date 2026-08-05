import { describe, it, expect } from 'vitest';
import {
  PILES,
  PILE_LABEL,
  countByPile,
  booksIn,
  shelvesOf,
  searchAll,
  finishedBooks,
  finishedHead,
} from './shelfView';
import type { SavedBook } from './storage';

const book = (id: string, intent: SavedBook['intent'], savedAt: number): SavedBook => ({
  id,
  intent,
  savedAt,
  book: { title: `Book ${id}`, author: 'A. Author' },
});

const SHELF: SavedBook[] = [
  book('1', 'now', 500),
  book('2', 'someday', 400),
  book('3', 'now', 900),
  book('4', 'read', 300),
  book('5', 'next', 200),
];

describe('PILES', () => {
  it('runs from what you are doing to what you have done', () => {
    expect(PILES).toEqual(['now', 'next', 'someday', 'read']);
  });

  it('labels every pile', () => {
    for (const pile of PILES) expect(PILE_LABEL[pile]).toBeTruthy();
  });
});

describe('countByPile', () => {
  it('counts each pile', () => {
    expect(countByPile(SHELF)).toEqual({ now: 2, next: 1, someday: 1, read: 1 });
  });

  it('reports zero rather than nothing for an empty shelf', () => {
    // The control renders every pile whether or not it has anything in it, so a missing
    // key here is a missing segment there.
    expect(countByPile([])).toEqual({ now: 0, next: 0, someday: 0, read: 0 });
  });
});

describe('booksIn', () => {
  it('returns only that pile, newest catch first', () => {
    expect(booksIn(SHELF, 'now').map((s) => s.id)).toEqual(['3', '1']);
  });

  it('leaves the caller its own array in the order it gave', () => {
    // `sort` mutates. The shelf is module state in the popup and is painted from on
    // every keystroke, so sorting it in place would reorder the world.
    const input = [...SHELF];
    booksIn(input, 'now');
    expect(input.map((s) => s.id)).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('shelvesOf', () => {
  it('breaks a pile into shelves of four', () => {
    expect(shelvesOf([1, 2, 3, 4, 5, 6], 4)).toEqual([
      [1, 2, 3, 4],
      [5, 6],
    ]);
  });

  it('gives an exact fit one shelf and no empty second one', () => {
    expect(shelvesOf([1, 2], 2)).toEqual([[1, 2]]);
  });

  it('has no shelves at all when there are no books', () => {
    expect(shelvesOf([], 4)).toEqual([]);
  });
});

describe('searchAll', () => {
  const named = (
    id: string,
    intent: SavedBook['intent'],
    title: string,
    author: string,
  ): SavedBook => ({ id, intent, savedAt: Number(id), book: { title, author } });

  const MIXED: SavedBook[] = [
    named('1', 'now', 'Dune', 'Frank Herbert'),
    named('2', 'read', 'Dune Messiah', 'Frank Herbert'),
    named('3', 'someday', 'Ubik', 'Philip K. Dick'),
  ];

  it('crosses every pile, so a book is found wherever it was filed', () => {
    expect(
      searchAll(MIXED, 'dune')
        .map((hit) => hit.saved.id)
        .sort(),
    ).toEqual(['1', '2']);
  });

  it('says which pile each hit is in, because that is the answer', () => {
    expect(searchAll(MIXED, 'ubik')[0]?.pile).toBe('someday');
  });

  it('matches the author too', () => {
    expect(searchAll(MIXED, 'philip')).toHaveLength(1);
  });

  it('returns nothing for an empty query rather than the whole shelf', () => {
    // An empty box means "not searching", and the caller shows the pile instead. Handing
    // back everything would render the whole shelf as one undifferentiated result page.
    expect(searchAll(MIXED, '   ')).toEqual([]);
  });

  it('orders hits newest first, like a pile', () => {
    expect(searchAll(MIXED, 'herbert').map((hit) => hit.saved.id)).toEqual(['2', '1']);
  });
});

describe('finished', () => {
  // Fixed instants, and mid-month, so the fixture does not drift with the calendar and
  // does not change month on a machine far enough west of UTC.
  const JUL_2026 = new Date(2026, 6, 14).getTime();
  const AUG_2026 = new Date(2026, 7, 15).getTime();
  const NOV_2025 = new Date(2025, 10, 20).getTime();

  const done = (id: string, at: number): SavedBook => ({
    id,
    intent: 'read',
    savedAt: at,
    book: { title: `Book ${id}`, author: 'A. Author' },
  });

  const READ: SavedBook[] = [
    done('jul', JUL_2026),
    done('aug', AUG_2026),
    done('nov', NOV_2025),
    { ...done('open', AUG_2026), intent: 'now' },
  ];

  it('takes only finished books, newest first', () => {
    expect(finishedBooks(READ).map((f) => f.saved.id)).toEqual(['aug', 'jul', 'nov']);
  });

  it('dates each one by the month it was finished', () => {
    expect(finishedBooks(READ)[0]?.month).toBe('Aug 2026');
  });

  it('heads the year when everything was finished in one', () => {
    expect(finishedHead([done('a', JUL_2026), done('b', AUG_2026)])).toBe('2 books, 2026');
  });

  it('heads a span when they were not', () => {
    expect(finishedHead(READ)).toBe('3 books since 2025');
  });

  it('counts one book as one book', () => {
    expect(finishedHead([done('a', AUG_2026)])).toBe('1 book, 2026');
  });

  it('says nothing at all about an empty Read', () => {
    expect(finishedHead([])).toBe('');
  });
});
