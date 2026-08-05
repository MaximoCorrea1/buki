import type { Book } from '../recognizer/types';

/**
 * Bookcloth. A shelf looks like a shelf because the bindings differ, so each book keeps
 * its own colour rather than being colour-coded by status - the grouping already says
 * which pile it's in.
 */
export const CLOTH = ['#ff5a47', '#ffae12', '#22b584', '#6274ff', '#b45ce0'];

/**
 * Same book, same cloth, forever - derived from the book, not from insertion order.
 *
 * djb2, but the choice of hash is not the point and never was. An earlier comment
 * claimed the naive *31 variant "bunched real titles onto the same two colours"; that
 * was never measured, and on a sample of eight real titles it is false (see
 * cloth.test.ts). The actual defect was that this function existed TWICE, with a
 * different hash in each file, so a book was one colour in the in-page picker and
 * another on the shelf. One definition is the requirement; which hash is arbitrary.
 */
export function clothFor(book: Book): string {
  const key = book.isbn ?? `${book.title}|${book.author}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  return CLOTH[hash % CLOTH.length] ?? CLOTH[0]!;
}
