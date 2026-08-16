import type { SavedBook } from './storage';

/**
 * Which pictures may stand in for a book's cover, best first.
 *
 * **The book's own cover comes first, then the picture the catch was read from.**
 *
 * REVERSED 2026-08-16, and the reason it used to be the other way round had expired.
 * The picture led because "the catalogue's art is whatever edition its relevance index
 * ranked first, and it measurably is not always the book in the photo" - measured, the
 * first three results for "Dune Frank Herbert" on 2026-08-06 were Children of Dune, God
 * Emperor of Dune and Heretics of Dune.
 *
 * That was the MATCH being wrong, and `rank` plus `strayWords` in `groundText.ts` was
 * written precisely to fix it. `coverUrl` is not a fresh relevance search: it belongs to
 * the record that WON that ranking. So the old objection now argues against a bug that
 * has been closed, while the cost of the old order was reported from real use - books
 * arriving on the shelf wearing the photograph instead of their cover.
 *
 * The photograph is still kept and still used, and it is what a book gets whenever
 * OpenLibrary holds no art. What changed is which one leads.
 *
 * This is a READ-time rule, so it re-covers every book already on the shelf. That is the
 * intended effect: a shelf whose covers were wrong yesterday should not stay wrong.
 */
export function coverSources(saved: SavedBook): string[] {
  return [saved.book.coverUrl, saved.shot]
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
