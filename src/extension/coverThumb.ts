import { shotFor } from './coverSource';

/**
 * What the catch tray's thumbnail shows, and WHEN.
 *
 * THE MEASUREMENT THIS EXISTS FOR. A catalogue cover is not a picture you fetch; it is a
 * 302 into a second 302 into an `ia######.us.archive.org` node that extracts the JPEG out
 * of a ZIP on demand. Re-derived 2026-09-01, live, sequential:
 *
 *     993ms / 2140ms / 2318ms cold, median 2140ms
 *     the REPEAT is not faster - 2342ms - so there is no edge cache to warm
 *
 * `warmCovers` was written for this same complaint on 2026-08-27 and starts the fetch the
 * moment grounding returns, one message round trip before the tray asks. Against 2.1
 * seconds that head start is worth about two percent. **The cover cannot be made to arrive
 * with the book, so something else has to be there instead.**
 *
 * THE ONE THING AVAILABLE AT ZERO COST is the photograph the catch was read from. The host
 * page has already downloaded and decoded it - it is on screen behind the tray - so it
 * needs no worker, no CSP exemption and no network. It lands in the same paint as the
 * title. Founder, 2026-09-01: *"is there a way to make it faster or at the same time?"*
 * At the same time, by not asking OpenLibrary for the first frame.
 *
 * SO THE THUMB HAS TWO SLOTS, not a fallback chain:
 *
 *   instant   the photograph, drawn with the card
 *   upgrade   the catalogue cover, swapped in when it arrives about two seconds later
 *
 * That is deliberately NOT `coverSources`' shape. There the question is which picture a
 * book KEEPS, and the answer has been `[coverUrl, shot]` since 2026-08-16 because the
 * catalogue art belongs to the record that won the ranking. Here the question is what to
 * draw in the two seconds before that art exists, and the honest answer is the picture we
 * read the book out of. Both end in the same place; only the order in TIME differs.
 *
 * WHEN THERE IS NO CATALOGUE ART, `upgrade` is absent and the photograph simply stays.
 * That is the founder's standing rule, given twice: *"when we find no cover book, we use
 * the original image"* (2026-08-27) and *"instead of showing a color ... use the original
 * image as fallback"* (2026-09-01). Today that case renders as a flat cloth colour.
 *
 * WHEN THERE IS NEITHER, both are absent and the caller draws a board. An empty plan is
 * the instruction to draw, not an error.
 */
export interface ThumbPlan {
  /** Already in the host page. Set it directly; it costs nothing and it is there now. */
  instant?: string;
  /** Cross-origin under the host's CSP, so the worker fetches it. Arrives later, or not. */
  upgrade?: string;
}

/**
 * The scheme check lives in `coverSources` and here, and nowhere else. Two places deciding
 * what a usable picture is, is how they come to disagree - the same sentence `shotFor`
 * carries, for the same reason.
 */
const usable = (url: string | undefined): url is string =>
  typeof url === 'string' && /^https?:\/\//i.test(url);

/**
 * @param book      the book as grounding returned it; `coverUrl` is absent for a large
 *                  share of real books, which is the case this whole module is about
 * @param image     the post's first picture, as `content.ts` opens the card with
 * @param books     how many books this catch found
 * @param pictures  how many pictures the post held
 */
export function thumbPlan(
  book: { coverUrl?: string },
  image: string | undefined,
  books: number,
  pictures: number,
): ThumbPlan {
  // shotFor, not a second copy of its rule. It already refuses the several-PICTURES case -
  // a four-picture post yielding one book would show picture one even when the book was
  // read from picture three - and that refusal is C-9's surviving half. Storing and
  // SHOWING must agree, or the tray promises a cover the shelf will not keep.
  const shot = shotFor(image, books, pictures);

  // AND THEN ONE STEP STRICTER, which is a real difference and not an oversight.
  //
  // `shotFor` answers what a book KEEPS. There, several books sharing one photograph is
  // the trade the founder accepted on 2026-08-27, because a stored photograph is only ever
  // drawn when there is no art at all - so the repetition is rare, and item 60 tracks it.
  //
  // This answers what the tray draws in the first frame, where the trade is worse. The tray
  // ALREADY gives every book a distinct cloth colour, so three books out of one photograph
  // would go from three different colours to three IDENTICAL thumbnails, in the one moment
  // the reader is deciding which of the three to keep. That is item 60's cost arriving two
  // seconds early and buying nothing.
  //
  // So the instant frame is for the case it actually helps, which is also the common one:
  // ONE book out of ONE picture - a photograph of a cover. Every book still upgrades to its
  // own catalogue art, which is what tells the three rows apart anyway.
  const instant = books === 1 ? shot : undefined;

  return {
    ...(usable(instant) ? { instant } : {}),
    ...(usable(book.coverUrl) ? { upgrade: book.coverUrl } : {}),
  };
}
