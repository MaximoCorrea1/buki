/**
 * WHICH of a work's ISBNs the shelf keeps.
 *
 * OpenLibrary's search returns a WORK, and a work lists the ISBNs of every edition it
 * knows: hardback, paperback, ebook, and every translation. `openLibrary.ts` took entry
 * ZERO out of that array, and the array is in no order anybody promised.
 *
 * MEASURED 2026-09-01, on a book off the founder's own shelf. *The Nvidia Way* by Tae Kim:
 *
 *     [0] 9787521770162   978-7 -> CHINA      <- the one the app stored
 *     [1] 1324086718      English
 *     [2] 1324086726      English
 *     [3] 9781324086710   English
 *     [4] 7521770161      the same Chinese edition, as an ISBN-10
 *     [5] 9781324086727   English
 *
 * THAT IS NOT A COSMETIC PICK. `book.isbn` drives five things, and two of them are the
 * money:
 *
 *   buyLink.ts:38    bookshop.org/a/<affiliate>/<isbn> is built from it VERBATIM, and
 *                    Bookshop is a US and UK retailer. A Chinese ISBN is a dead link on
 *                    the one surface that earns.
 *   buyLink.ts:31    the Amazon search term
 *   goodreadsCsv.ts  what the reader exports and keeps
 *   bookIdentity.ts  `sameBook` returns true on an ISBN match, so it is a dedup key
 *   cloth.ts         the shelf colour is hashed from it
 *
 * THE RULE, and it is a heuristic rather than a law, so it is written down rather than
 * inferred: prefer an ISBN-13 in an English registration group, because that is the market
 * every Buy link in this product points at. Bookshop is US and UK; the Amazon default is
 * amazon.com. An ISBN that names an edition those shops do not stock is not more neutral,
 * it is just wrong somewhere else.
 *
 * It degrades in the right direction. A book with no English edition keeps its own ISBN-13
 * - a Spanish novel stays Spanish - because the preference is a preference and not a
 * filter.
 *
 * SHAPE IS VALIDATED HERE TOO. `goodreadsCsv.ts` already says it: openlibrary.org is a wiki
 * anyone may edit, and that file writes a spreadsheet FORMULA. Validating at the source is
 * defence in depth and is NOT a reason to relax the guard downstream - two layers, because
 * the day one of them is refactored is the day the other one matters.
 */

/** ISBN-13, digits only. The 979 prefix is real and current, so it is not just 978. */
const ISBN_13 = /^97[89][0-9]{10}$/;

/** ISBN-10. The last character may be X, which is the check digit for ten. */
const ISBN_10 = /^[0-9]{9}[0-9X]$/;

/**
 * Registration groups 0 and 1 are the English language area. As an ISBN-13 they appear as
 * 978-0 and 978-1; 979-8 is the newer English-market range that Amazon's own imprints use.
 */
const ENGLISH_13 = /^(9780|9781|9798)/;
const ENGLISH_10 = /^[01]/;

const clean = (raw: string): string => raw.replace(/[\s-]/g, '').toUpperCase();

/**
 * @param isbns every ISBN the catalogue listed for this work, in its own order
 * @returns the one to keep, or undefined if none of them is an ISBN at all
 */
export function pickIsbn(isbns: readonly string[] | undefined): string | undefined {
  if (!isbns?.length) return undefined;

  const valid: string[] = [];
  for (const raw of isbns) {
    if (typeof raw !== 'string') continue;
    const candidate = clean(raw);
    if (ISBN_13.test(candidate) || ISBN_10.test(candidate)) valid.push(candidate);
  }
  if (!valid.length) return undefined;

  // MARKET BEFORE FORMAT, and the order was the other way round until a mutation survived.
  // The tiers read English-13, any-13, English-10 - so a Spanish ISBN-13 beat an English
  // ISBN-10 and the Bookshop link went to an edition it does not stock. That contradicts
  // the paragraph above, which argues from the market and not from the format, and nothing
  // in the suite noticed because no test case held both.
  //
  // FIRST MATCH IN THE CALLER'S OWN ORDER at every tier, never a sort. A sort would have to
  // invent a total order over editions nobody asked for, and the shelf colour and the dedup
  // key both hang off this answer - so the same input has to give the same output forever.
  return (
    valid.find((i) => ISBN_13.test(i) && ENGLISH_13.test(i)) ??
    valid.find((i) => ISBN_10.test(i) && ENGLISH_10.test(i)) ??
    valid.find((i) => ISBN_13.test(i)) ??
    valid[0]
  );
}
