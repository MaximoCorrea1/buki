import { matchesFilter, type Intent, type SavedBook } from './storage';

/**
 * What the popup shows, decided without a DOM.
 *
 * The tests here run in node with no document, which is the constraint that put this
 * file on its own - and it is the right seam anyway. Which books are in a pile, in what
 * order, and grouped how, is logic and gets tested. Turning that into elements is
 * popup.ts's job, and is judged by looking at it.
 */

/** In the order they appear in the control: what you are doing, then what you have done. */
export const PILES: Intent[] = ['now', 'next', 'someday', 'read'];

/**
 * Short, because these are places you stand in rather than sentences about a book. The
 * old headings ("Reading now", "Up next") were captions on a list; a segment is a
 * destination and reads better as one word.
 */
export const PILE_LABEL: Record<Intent, string> = {
  now: 'Now',
  next: 'Next',
  someday: 'Someday',
  read: 'Read',
};

/** Every pile, including the empty ones: the control draws all four regardless. */
export function countByPile(shelf: SavedBook[]): Record<Intent, number> {
  const counts: Record<Intent, number> = { now: 0, next: 0, someday: 0, read: 0 };
  for (const saved of shelf) counts[saved.intent]++;
  return counts;
}

/**
 * One pile, newest catch first.
 *
 * `filter` copies before `sort` mutates, which matters more than it looks: the shelf is
 * module state in the popup and is painted from on every keystroke, so sorting it in
 * place would reorder the world out from under the next paint.
 */
export function booksIn(shelf: SavedBook[], pile: Intent): SavedBook[] {
  return shelf.filter((s) => s.intent === pile).sort((a, b) => b.savedAt - a.savedAt);
}

/** A pile, broken into the rows that rest on a board. */
export function shelvesOf<T>(books: T[], per: number): T[][] {
  const shelves: T[][] = [];
  for (let i = 0; i < books.length; i += per) shelves.push(books.slice(i, i + per));
  return shelves;
}

export interface Hit {
  saved: SavedBook;
  pile: Intent;
}

/**
 * Every pile at once, because finding a book is a different job from browsing a pile and
 * should not require remembering which one you filed it in.
 *
 * An empty query is NOT "everything": it means the user is not searching, and the caller
 * shows the pile they are standing in instead.
 */
export function searchAll(shelf: SavedBook[], query: string): Hit[] {
  if (!query.trim()) return [];
  return shelf
    .filter((saved) => matchesFilter(saved, query))
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((saved) => ({ saved, pile: saved.intent }));
}

/**
 * Spelled out rather than taken from `toLocaleString`, so a test does not depend on which
 * locale data the runtime happened to ship with.
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export interface Finished {
  saved: SavedBook;
  month: string;
}

/**
 * Read is not a fifth pile of books you are not going to open. It is the one view that
 * can show something the others cannot: when. So a finished book carries its month, and
 * that is the whole answer to "finished is a dumping ground" - it stops being a pile and
 * becomes a receipt.
 *
 * The date is `savedAt`, which a move to `read` rewrites to now. That is a quirk
 * elsewhere and exactly right here: the moment you filed it as read IS when you finished
 * it.
 */
export function finishedBooks(shelf: SavedBook[]): Finished[] {
  return booksIn(shelf, 'read').map((saved) => {
    const when = new Date(saved.savedAt);
    return { saved, month: `${MONTHS[when.getMonth()]} ${when.getFullYear()}` };
  });
}

/** `7 books, 2026`, or `7 books since 2025` when they do not share a year. */
export function finishedHead(shelf: SavedBook[]): string {
  const done = booksIn(shelf, 'read');
  if (!done.length) return '';
  const years = done.map((saved) => new Date(saved.savedAt).getFullYear());
  const count = `${done.length} book${done.length === 1 ? '' : 's'}`;
  const earliest = Math.min(...years);
  return earliest === Math.max(...years) ? `${count}, ${earliest}` : `${count} since ${earliest}`;
}
