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

/**
 * The picture to STORE as this book's cover, given the catch it came out of.
 *
 * The rule above rests on one sentence: *the picture cannot be the wrong book, because it
 * IS the book that was read.* That is true of a photograph holding one book and false of
 * a photograph holding five, and nothing enforced the difference. A catch kept one
 * picture and wrote it to every book it found, so a stack of five reached the shelf as
 * five copies of the same photograph and each book's real cover was never used.
 *
 * So the invariant is enforced at the WRITE rather than repaired at the read: a `shot` is
 * only stored when it depicts exactly the book it is stored on. Fixing it in
 * `coverSources` instead was the wrong place twice over - that function is handed one
 * `SavedBook` and cannot know how many books shared its picture, and the shelf would have
 * gone on holding data that says something untrue about itself.
 *
 * The books from a multi-book catch keep their `source` either way, so the post that sold
 * you survives. It is the *cover* that stops being a lie.
 */
export function shotFor(image: string | undefined, books: number): string | undefined {
  // The scheme check lives in `coverSources` and only there: two places deciding what a
  // usable picture is, is how they come to disagree.
  return books === 1 ? image : undefined;
}
