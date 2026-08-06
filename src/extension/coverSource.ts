import type { SavedBook } from './storage';

/**
 * Which pictures may stand in for a book's cover, best first.
 *
 * The picture the catch was READ FROM comes before the catalogue's art. That looks
 * backwards until you see where catalogue art comes from: OpenLibrary's relevance index,
 * whose top hit is not reliably the book you photographed. Measured on 2026-08-06, the
 * first three results for "Dune Frank Herbert" were Children of Dune, God Emperor of Dune
 * and Heretics of Dune. Art for the wrong edition is worse than no art, because it is
 * wrong silently. The photo cannot be the wrong book: it IS the book that was read.
 *
 * It is also what the product is about. The shelf is the books you saw and lost, so the
 * thing you saw is the truer object to keep.
 */
export function coverSources(saved: SavedBook): string[] {
  return [saved.shot, saved.book.coverUrl]
    .filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url));
}
