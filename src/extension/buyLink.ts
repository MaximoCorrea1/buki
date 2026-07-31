import type { Book } from '../recognizer/types';

export type Store = 'amazon' | 'bookshop';

export interface Affiliate {
  amazonTag: string;
  bookshopId: string;
}

/**
 * Buki's own affiliate identifiers. Public by nature - they ship in the bundle, as
 * every affiliate link on the web does.
 *
 * Both may be empty, and the links still work without them. That matters: a buy link
 * that only functions once an affiliate account exists cannot be tested before it ships.
 */
export const AFFILIATE: Affiliate = {
  amazonTag: '',
  bookshopId: '',
};

/**
 * A link to buy a book you have already decided to save. It never suggests, ranks or
 * pushes - it appears beside a book you chose, and nowhere else.
 *
 * Amazon is searched rather than linked directly: OpenLibrary returns ISBN-13 as often as
 * ISBN-10, and only ISBN-10 doubles as an ASIN, so a `/dp/` link built from an ISBN-13 is
 * a 404. A search on the ISBN finds the book either way.
 */
export function buyLink(book: Book, store: Store, affiliate: Affiliate = AFFILIATE): string | null {
  const query = book.isbn || [book.title, book.author].filter(Boolean).join(' ').trim();
  if (!query) return null;

  if (store === 'bookshop') {
    // The /a/ path is what attributes the sale; without an id there is nothing to
    // attribute, so send the reader to the search they wanted anyway.
    return affiliate.bookshopId && book.isbn
      ? `https://bookshop.org/a/${affiliate.bookshopId}/${encodeURIComponent(book.isbn)}`
      : `https://bookshop.org/search?keywords=${encodeURIComponent(query)}`;
  }

  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', query);
  if (affiliate.amazonTag) url.searchParams.set('tag', affiliate.amazonTag);
  return url.toString();
}
