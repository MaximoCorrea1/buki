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
 * IS the book that was read.* C-9 (`OPENWORK.md` item 47) found two ways that sentence
 * could be false and refused both. **One of them is still false. The other stopped being
 * false on 2026-08-16, and this function went on refusing it for eleven days.**
 *
 * **STILL REFUSED - several PICTURES.** `content.ts` opens the card with
 * `tweet.imageUrls[0]`, photograph ONE whatever the post holds, and `VisionGuess` is
 * `{title, author}` with no image index - so a four-picture post yielding one book would
 * store photograph one even when the book was read from photograph three. That is a
 * one-in-four guess at a picture that may show a completely different book, and a cover
 * showing the wrong book is the exact lie this product exists to not tell.
 *
 * **NO LONGER REFUSED - several BOOKS.** The harm C-9 recorded was precise: five books
 * arrived on the shelf *"as five copies of the same photograph AND EACH BOOK'S REAL COVER
 * WAS NEVER USED."* The photograph was BEATING catalogue art. That was fixed on 08-16 in
 * `coverSources`, by ordering `[coverUrl, shot]` - a stored photograph can no longer
 * displace art, so the only moment it is ever drawn is the moment there is none.
 *
 * And in that moment the choice is not photograph-versus-cover. It is
 * photograph-versus-a-board-Buki-drew, and a photograph that demonstrably contains this
 * book wins. Founder, 2026-08-27: *"when we find no cover book, we use the original
 * image."*
 *
 * **What that trades away, stated rather than discovered later:** several artless books
 * from one photograph now show the same tile. They are not wrong - each was read out of
 * that picture - but a face-out shelf repeats itself where the drawn boards, hashed per
 * book, did not. `OPENWORK.md` item 60.
 *
 * The books from a multi-book catch keep their `source` either way, so the post that sold
 * you survives.
 */
export function shotFor(
  image: string | undefined,
  books: number,
  pictures: number,
): string | undefined {
  // `books >= 1` rather than dropping the count entirely: a catch that found nothing has
  // no book to store a picture ON, and returning one would leave an orphan URL in the
  // cache that `coversToKeep` can never justify keeping.
  //
  // The scheme check lives in `coverSources` and only there: two places deciding what a
  // usable picture is, is how they come to disagree.
  return books >= 1 && pictures === 1 ? image : undefined;
}

/**
 * Every picture that must survive a prune: the shelf, plus anything an undo could bring
 * back.
 *
 * WHY THE SECOND ARGUMENT EXISTS. `popup.remove()` runs `removeBook`, then `refresh()`,
 * then `offerUndo()` — and `refresh()` is what prunes. So the cover was dropped BEFORE the
 * reader had even been offered the way back, and pressing Undo restored the book to a drawn
 * board while its picture was refetched over a redirect chain measured at 1-4 seconds.
 * The undo failed to undo the part the reader can actually see. `OPENWORK.md` item 47, C-8.
 *
 * A book that is both on the shelf and pending is not double-counted, because `pruneCovers`
 * builds a Set from this anyway — but returning duplicates would still be this function
 * saying something untrue about itself.
 */
export function coversToKeep(
  shelf: readonly SavedBook[],
  pending: SavedBook | undefined,
): string[] {
  const wanted = new Set<string>();
  for (const saved of [...shelf, ...(pending ? [pending] : [])]) {
    // Both pictures per book. Pruning on `coverUrl` alone deletes every caught photograph
    // on the next open, which turns the cache from a speed-up into a liability.
    for (const url of [saved.book.coverUrl, saved.shot]) {
      if (url) wanted.add(url);
    }
  }
  return [...wanted];
}
