import type { Book } from '../recognizer/types';
import { identityOf, type Intent, type SavedBook } from './storage';

/**
 * Every decision behind adding a book by hand, with no DOM and no chrome APIs in it.
 *
 * IT IS A SEPARATE MODULE BECAUSE `popup.ts` CANNOT BE IMPORTED BY A TEST (`OPENWORK.md`
 * item 55, findings M-5 and M-6). Logic put there would be untestable at birth, which is
 * the exact failure item 43 was filed about: the arithmetic was extracted, the ORDER was
 * left behind, and a mutation walked straight past it with the suite green.
 *
 * Spec: `docs/superpowers/specs/2026-08-26-manual-add-design.md`.
 */

/**
 * Below this, a query is noise rather than a search.
 *
 * OpenLibrary answers `a` with thousands of rows that mean nothing, and a request per
 * keystroke is a request per keystroke against the SAME breaker recognition depends on.
 * Three is the shortest prefix that narrows anything.
 */
export const MIN_QUERY = 3;

export function shouldSearch(raw: string): boolean {
  return raw.trim().length >= MIN_QUERY;
}

/**
 * A catalogue search is one cheap fetch, so there is no cancel message: the only hazard
 * worth closing is a slow answer landing after a faster newer one and painting the wrong
 * rows. The popup counts its requests and keeps only the answer still carrying the newest
 * number.
 *
 * `cancelRecognize` exists on the other path because a recognition is long and bills
 * money. This one is neither, and a cancel message here would be machinery for nothing.
 *
 * EQUALITY, NEVER `>=`. A seq above the newest means the counter was reset while a
 * request was in flight, and the safe read of a number that cannot exist is "not mine".
 */
export function isCurrent(seq: number, newest: number): boolean {
  return seq === newest;
}

/** A catalogue result, paired with where the shelf already keeps it. */
export interface Candidate {
  book: Book;
  /** The pile it is already in, or `null` when the shelf does not hold it. */
  held: Intent | null;
}

/**
 * NO MESSAGE AND NO ROUND TRIP. `paint()` already reads the whole shelf to draw the
 * boards, so the popup holds it in memory and matching against it is a map lookup.
 *
 * The catch tray answers `alreadySaved` for the same question, but that field exists
 * because a CONTENT SCRIPT cannot read storage. The popup can, and borrowing the name
 * would have invented a round trip this design does not need.
 *
 * Keyed on `identityOf`, which is `bookKey` and normalises, because a result differing
 * from a shelved book only in case is the same book. Matching on the raw title is how a
 * duplicate reaches the shelf, and that is item 47's bug.
 */
export function candidatesFor(
  books: readonly Book[],
  shelf: readonly SavedBook[],
): Candidate[] {
  const held = new Map(shelf.map((saved) => [identityOf(saved.book), saved.intent]));
  return books.map((book) => ({ book, held: held.get(identityOf(book)) ?? null }));
}

/**
 * The exact message a pick sends, and the exact SHAPE it has to keep.
 *
 * This looks too thin to earn a function until you read what its test asserts: the
 * COMPLEMENT. A hand-added book carries no `source` and no `shot`, because there is no
 * post and no photograph. The next person here will reasonably think filling `source`
 * with the active tab's URL is helpful; it would print somebody's own popup as *the post
 * that sold you* on the one surface whose entire job is saying where a book came from.
 */
export function saveRequest(
  book: Book,
  intent: Intent,
): { type: 'saveBook'; book: Book; intent: Intent } {
  return { type: 'saveBook', book, intent };
}
