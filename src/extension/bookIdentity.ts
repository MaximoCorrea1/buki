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

const tidy = (s: string): string =>
  s
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(ARTICLES, '');

/**
 * A title split at the first colon.
 *
 * A subtitle is what one catalogue writes and another leaves out: "Sapiens" and
 * "Sapiens: A Brief History of Humankind" are the same book. **But a subtitle is ALSO how a
 * series names its volumes**, and dropping it made "The Lord of the Rings: The Two Towers"
 * and "The Lord of the Rings: The Return of the King" the same key — so saving the second
 * OVERWROTE the first, and a differing ISBN could not veto because the ISBN check can only
 * ADD a match. `OPENWORK.md` item 47, C-5.
 */
function titleParts(title: string): { main: string; sub: string } {
  const folded = fold(title);
  const cut = folded.indexOf(':');
  return {
    main: tidy(cut < 0 ? folded : folded.slice(0, cut)),
    sub: cut < 0 ? '' : tidy(folded.slice(cut + 1)),
  };
}

function normTitle(title: string): string {
  return titleParts(title).main;
}

/**
 * The surname: the last word of the FIRST author named, whichever order they were given in.
 *
 * Catalogues disagree on order ("Ursula K. Le Guin" / "Le Guin, Ursula K."), on how many
 * authors to list, and on whether to spell out first names ("Abelson, Sussman" /
 * "Harold Abelson, Gerald Jay Sussman"). One comma settles all three at once: everything
 * before the first comma is either the whole of a single name or the surname of the first
 * of several, and the last word of that is the surname either way.
 *
 * IT USED TO TAKE THE LONGEST TOKEN AFTER SORTING, and that put one author on the shelf
 * twice. "Gabriel García Márquez" and "G. García Márquez" fold to token sets whose longest
 * members tie at seven letters — `gabriel` and `marquez` — so the tie resolved
 * alphabetically to `gabriel` for the full name and to `marquez` for the initialled one.
 * Two keys, one author. `OPENWORK.md` item 47, C-6.
 *
 * Still deliberately forgiving. Two books can only collide if they share a title AND a
 * surname, and the cost of being wrong that way is lower than the cost of the duplicate.
 */
function normAuthor(author: string): string {
  const first = fold(author).split(',')[0] ?? '';
  const words = first
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words[words.length - 1] ?? '';
}

export function bookKey(book: Book): string {
  return `${normTitle(book.title)}|${normAuthor(book.author)}`;
}

/**
 * Are these two records the same book?
 *
 * ⚠ **THIS IS NOT `bookKey` EQUALITY, AND IT CANNOT BE.** The subtitle rule is not
 * transitive: "Sapiens" matches "Sapiens: A Brief History" and matches "Sapiens: An
 * Illustrated History", while those two do NOT match each other. No single string key can
 * express that, because a key implies an equivalence relation and this is not one.
 *
 * So the two live at different resolutions on purpose:
 *
 * - **`bookKey` stays coarse** (main title + surname). It is a Map KEY — `content.ts:721`
 *   and `manualAdd.ts:67` both build a `Map` from it to answer *"is this one already on the
 *   shelf?"* — and a Map needs an equivalence relation. Making it subtitle-exact would
 *   bring back the duplicate the split was written to stop.
 * - **`sameBook` is exact**, and it is what `library.add` uses to decide whether a save
 *   OVERWRITES an existing record. That is where the data loss was.
 *
 * **The residual imprecision, named rather than hidden:** a shelf holding *The Two Towers*
 * may badge *The Return of the King* as already held, because that badge is a Map lookup.
 * It is a wrong label on a screen and it is recoverable in one press. It is not a book
 * being overwritten on disk, which is what this fix was for.
 */
export function sameBook(a: Book, b: Book): boolean {
  // An ISBN is direct evidence of the edition, so it outranks anything the titles say.
  if (a.isbn && b.isbn && a.isbn === b.isbn) return true;
  if (bookKey(a) !== bookKey(b)) return false;

  // Same main title, same surname. If BOTH name a subtitle and the subtitles differ, these
  // are two volumes of one series rather than two catalogues disagreeing about one book.
  const subA = titleParts(a.title).sub;
  const subB = titleParts(b.title).sub;
  return !(subA && subB && subA !== subB);
}
