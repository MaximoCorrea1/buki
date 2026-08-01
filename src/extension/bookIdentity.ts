import type { Book } from '../recognizer/types';

/**
 * What makes two books the same book.
 *
 * Identity used to be "the ISBN if there is one, otherwise title+author". That files two
 * editions of Dune as two books - and files an ISBN-carrying result and an ISBN-less one
 * as two books even when they are letter-for-letter identical. Both happen constantly,
 * because the retailer-link path and the cover path resolve different editions of the
 * same work. It is how a book already on the shelf got saved a second time.
 *
 * So identity is the WORK, not the edition: normalized title plus author surname. A
 * matching ISBN is an ADDITIONAL way to be the same book, never the only way.
 */
const ARTICLES = /^(the|a|an|el|la|los|las|un|una|le|les|der|die|das)\s+/;
const COMBINING = /[̀-ͯ]/g;

/** Lowercase and strip accents, so Cortázar and Cortazar are one author. */
function fold(s: string): string {
  return s.normalize('NFD').replace(COMBINING, '').toLowerCase();
}

function normTitle(title: string): string {
  // A subtitle is what one catalogue writes and another leaves out: "Sapiens" and
  // "Sapiens: A Brief History of Humankind" are the same book.
  const main = fold(title).split(':')[0] ?? '';
  return main
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(ARTICLES, '');
}

/**
 * The surname, as the longest word in whatever the catalogue called this person.
 *
 * Catalogues disagree on order ("Ursula K. Le Guin" / "Le Guin, Ursula K."), on how many
 * authors to list, and on whether to spell out first names ("Abelson, Sussman" /
 * "Harold Abelson, Gerald Jay Sussman"). Sorting first makes order irrelevant, and taking
 * the longest token gets the surname without needing to know which field it came from.
 *
 * This is deliberately forgiving. Two books can only collide if they share a title AND a
 * surname, which in practice means they are the same book - and the cost of being wrong
 * that way is much lower than the cost of the duplicate it exists to prevent.
 */
function normAuthor(author: string): string {
  const words = fold(author)
    .replace(/[^\p{L}\p{N} ,]+/gu, ' ')
    .split(/[\s,]+/)
    .filter(Boolean)
    .sort(); // ties resolve to the alphabetically first, so both spellings agree
  if (!words.length) return '';
  return words.reduce((a, b) => (b.length > a.length ? b : a));
}

export function bookKey(book: Book): string {
  return `${normTitle(book.title)}|${normAuthor(book.author)}`;
}

export function sameBook(a: Book, b: Book): boolean {
  if (a.isbn && b.isbn && a.isbn === b.isbn) return true;
  return bookKey(a) === bookKey(b);
}
