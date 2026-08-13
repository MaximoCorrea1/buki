import type { Intent, SavedBook } from './storage';

/**
 * The shelf as a CSV Goodreads and StoryGraph will both import.
 *
 * Goodreads closed its write API in 2020, so a file is the only route into either, and
 * StoryGraph reads Goodreads' format. One file therefore serves both, and there is no
 * second exporter to write.
 *
 * Free for everyone, deliberately. `docs/pricing.md` says the paid tier gates one thing
 * only and that the shelf is never gated; taking your own books out is the clearest case
 * of that promise, so this module knows nothing about entitlements.
 */

/**
 * Goodreads has three exclusive shelves and Buki has four piles, so three of ours collapse.
 *
 * Now, Next and Someday are a PRIORITY, not a reading state: the shelf spec says "priority
 * inside a pile is the problem Now/Next/Someday already solves". Mapping Now to
 * `currently-reading` would announce that you are actively reading everything you meant to
 * read next. The `Bookshelves` tag below is what stops the collapse losing the ordering.
 */
const SHELF: Record<Intent, string> = {
  now: 'to-read',
  next: 'to-read',
  someday: 'to-read',
  read: 'read',
};

const HEADER = ['Title', 'Author', 'ISBN', 'Exclusive Shelf', 'Bookshelves', 'Date Added', 'My Review'];

/** RFC 4180. Titles routinely carry commas, and the ISBN below carries quotes. */
function field(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Local date parts, so the file says the day the reader would say. */
function parts(at: number): [string, string, string] {
  const d = new Date(at);
  return [
    String(d.getFullYear()),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ];
}

/**
 * An ISBN in the form Goodreads uses in its OWN export.
 *
 * A bare 13 digit number opened in Excel becomes 9.78145E+12, and somebody who opens the
 * file to look at it before importing then uploads a column of corrupted ISBNs. Since this
 * is exactly what Goodreads emits, both importers demonstrably read it.
 *
 * Note this reasoning does NOT extend to a UTF-8 BOM, which would protect accented author
 * names in Excel the same way but risks the importer reading the first column as
 * "﻿Title" and failing to find Title at all. The primary path is upload, not Excel,
 * so the wrapper is worth it and the BOM is not.
 */
const isbnCell = (isbn?: string): string => (isbn ? `="${isbn}"` : '');

/** The post that sold you. Empty when there is none, never an invented sentence. */
const reviewCell = (saved: SavedBook): string =>
  saved.source ? `Caught from ${saved.source.url}` : '';

/** The whole shelf, in shelf order, newest first. */
export function toGoodreadsCsv(books: SavedBook[]): string {
  const rows = books.map((saved) => {
    const [y, m, d] = parts(saved.savedAt);
    return [
      saved.book.title,
      saved.book.author,
      isbnCell(saved.book.isbn),
      SHELF[saved.intent],
      `buki-${saved.intent}`,
      `${y}/${m}/${d}`,
      reviewCell(saved),
    ]
      .map(field)
      .join(',');
  });
  return [HEADER.join(','), ...rows].join('\n');
}

export function shelfFilename(at: number): string {
  return `buki-shelf-${parts(at).join('-')}.csv`;
}
