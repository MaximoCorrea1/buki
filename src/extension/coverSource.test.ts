import { describe, it, expect } from 'vitest';
import { coverSources, coversToKeep, shotFor } from './coverSource';
import type { SavedBook } from './storage';

const saved = (extra: Partial<SavedBook> & { coverUrl?: string }): SavedBook => ({
  id: '1',
  intent: 'now',
  savedAt: 1,
  book: {
    title: 'Dune',
    author: 'Frank Herbert',
    ...(extra.coverUrl ? { coverUrl: extra.coverUrl } : {}),
  },
  ...(extra.shot ? { shot: extra.shot } : {}),
});

const SHOT = 'https://pbs.twimg.com/media/abc?format=jpg&name=medium';
const ART = 'https://covers.openlibrary.org/b/id/12345-M.jpg';

describe('coverSources', () => {
  it('shows the book’s own cover before the picture it was caught from', () => {
    // REVERSED 2026-08-16, and the reason it used to be the other way round had expired.
    //
    // The picture came first because "the catalogue's art is whatever edition its
    // relevance index ranked first, and it measurably is not always the book in the
    // photo": on 2026-08-06 the top three hits for "Dune Frank Herbert" were Children of
    // Dune, God Emperor and Heretics.
    //
    // But that was the MATCH being wrong, and `rank` plus `strayWords` was written
    // precisely to fix it. `coverUrl` is not a fresh relevance search - it belongs to the
    // record that WON that ranking. So the old objection now argues for a bug that has
    // been closed, while the cost of the old order was reported directly: books arriving
    // on the shelf wearing the photograph instead of their cover.
    //
    // The photograph is still kept and still used when the catalogue has no art.
    expect(coverSources(saved({ shot: SHOT, coverUrl: ART }))).toEqual([ART, SHOT]);
  });

  it('falls back to catalogue art for a book saved before pictures were kept', () => {
    expect(coverSources(saved({ coverUrl: ART }))).toEqual([ART]);
  });

  it('offers the picture alone when the catalogue had nothing', () => {
    expect(coverSources(saved({ shot: SHOT }))).toEqual([SHOT]);
  });

  it('offers nothing when there is neither, so the board gets drawn', () => {
    expect(coverSources(saved({}))).toEqual([]);
  });

  it('drops anything that is not http, so no src can execute', () => {
    // Everything here is browser-supplied today. This is the guard for the day an
    // import or a paste path exists, because by then this code will not be re-read.
    expect(coverSources(saved({ shot: 'javascript:alert(1)', coverUrl: ART }))).toEqual([ART]);
    expect(coverSources(saved({ shot: 'data:image/png;base64,AAAA' }))).toEqual([]);
  });
});

/**
 * `coverSources` prefers the picture over the catalogue's art on one stated ground: "the
 * picture cannot be the wrong book, because it IS the book that was read."
 *
 * That is true of a photograph holding ONE book and false of a photograph holding five.
 * The catch kept one picture and wrote it to every book it found, so a stack of five
 * arrived on the shelf as five copies of the same photograph. Reported 2026-08-16: "it
 * saves them but not with their respective covers, but with the tweet image."
 *
 * This is the invariant, made explicit and enforced at the point of the write rather than
 * repaired at the point of the read: a `shot` is only ever stored when it depicts exactly
 * the book it is stored on.
 */
describe('shotFor', () => {
  it('keeps the picture when the catch found exactly one book', () => {
    expect(shotFor(SHOT, 1, 1)).toBe(SHOT);
  });

  it('keeps the picture for every book of a one-photograph catch', () => {
    // CHANGED 2026-08-27, and the ORIGINAL objection has expired rather than been
    // ignored. C-9 refused this because "five books share one photograph, so the
    // photograph is not a cover for any of them" - and the harm it named was real:
    // five books arrived on the shelf *wearing the photograph INSTEAD OF their own
    // covers*.
    //
    // That harm was fixed on 08-16, in `coverSources`, by putting `coverUrl` first.
    // A stored photograph can no longer displace catalogue art, so the only case
    // where it is ever drawn is the case where there IS no art - and there the
    // choice is not photograph-vs-cover, it is photograph-vs-a-board-Buki-drew.
    //
    // Founder's rule, 2026-08-27: *"when we find no cover book, we use the original
    // image."* A photograph that demonstrably contains this book beats a drawn board.
    expect(shotFor(SHOT, 5, 1)).toBe(SHOT);
    expect(shotFor(SHOT, 2, 1)).toBe(SHOT);
  });

  it('drops it when the post held several pictures, because nothing says WHICH one holds this book', () => {
    // THE OTHER HALF OF C-9, AND IT DOES NOT EXPIRE. `content.ts` opens the card with
    // `tweet.imageUrls[0]` and `VisionGuess` is `{title, author}` - no image index - so
    // for a four-picture post the stored URL is a one-in-four guess at a photograph
    // that may not contain this book at all.
    //
    // That is a different claim from the one above. "Several books, one picture" still
    // means the picture holds the book. "One book, several pictures" means it might
    // hold a different book entirely, and a cover that shows the wrong book is the lie
    // the whole feature exists to avoid.
    expect(shotFor(SHOT, 1, 4)).toBeUndefined();
    expect(shotFor(SHOT, 3, 2)).toBeUndefined();
  });

  it('drops it when the catch found nothing, so no orphan picture is stored', () => {
    expect(shotFor(SHOT, 0, 1)).toBeUndefined();
  });

  it('has nothing to keep when the catch had no picture', () => {
    // A retailer-link catch reads no image at all, so it covered no picture either.
    expect(shotFor(undefined, 1, 0)).toBeUndefined();
  });

  it('leaves the http check to coverSources, which is the one place it lives', () => {
    // Deliberately NOT re-validating the scheme here: two places deciding what a usable
    // picture is, is how they come to disagree.
    expect(shotFor('javascript:alert(1)', 1, 1)).toBe('javascript:alert(1)');
  });
});

describe('coverSources, unchanged', () => {
  it('still drops anything that is not http', () => {
    // Everything here is browser-supplied today. This is the guard for the day an
    // import or a paste path exists, because by then this code will not be re-read.
    expect(coverSources(saved({ shot: 'javascript:alert(1)', coverUrl: ART }))).toEqual([ART]);
    expect(coverSources(saved({ shot: 'data:image/png;base64,AAAA' }))).toEqual([]);
  });
});

/**
 * C-9. `OPENWORK.md` item 47. The guard counted BOOKS and never counted PICTURES.
 *
 * `content.ts` opens the card with `tweet.imageUrls[0]` — photograph ONE, whatever the post
 * holds — so a four-photo post that yields a single book stored photograph one as that
 * book's cover, even when the book was read from photograph three. The invariant this
 * module exists to enforce is *the picture cannot be the wrong book, because it IS the book
 * that was read*, and one-of-four breaks it exactly as five-books-one-photo did.
 */
describe('shotFor counts pictures as well as books', () => {
  const PIC = 'https://pbs.twimg.com/media/one.jpg';

  it('stores the picture when one photograph yielded one book', () => {
    expect(shotFor(PIC, 1, 1)).toBe(PIC);
  });

  it('stores NOTHING when one book came out of a post holding four pictures', () => {
    // The card shows photograph one. The book may have been read from photograph three,
    // and nothing here can tell which — so the honest answer is no stored cover, and the
    // shelf falls back to the catalogue's cover or the drawn board.
    expect(shotFor(PIC, 1, 4)).toBeUndefined();
  });

  it('now stores it when one picture yielded five books, because that half of C-9 expired', () => {
    // WHAT THE ORIGINAL RULE SAID: "a stack of five reached the shelf as five copies of
    // the same photograph AND EACH BOOK'S REAL COVER WAS NEVER USED." Read the second
    // clause: the harm was the photograph WINNING over catalogue art.
    //
    // `coverSources` stopped that on 08-16 by ordering `[coverUrl, shot]`. A book with
    // art now shows its art whatever is stored beside it, so refusing to store the
    // photograph buys nothing that the ordering does not already buy - it only empties
    // the fallback for the books that have NO art, which is the exact case the founder's
    // rule is about.
    //
    // The `pictures` half of C-9 is untouched and still refuses, one test above. That is
    // the half whose premise is still true.
    expect(shotFor(PIC, 5, 1)).toBe(PIC);
  });

  it('stores nothing when the catch covered no picture at all', () => {
    expect(shotFor(undefined, 1, 1)).toBeUndefined();
    expect(shotFor(PIC, 1, 0)).toBeUndefined();
  });
});

/**
 * C-8. `OPENWORK.md` item 47. The prune ran INSIDE the undo window.
 *
 * `popup.remove()` does `removeBook` then `refresh()` then `offerUndo()`, and `refresh()`
 * is what prunes. So the cover was dropped before the reader had even been offered the
 * way back, and pressing Undo restored the book to a drawn board while its picture was
 * refetched over a redirect chain measured at 1-4 seconds.
 *
 * Not data loss, which is why it is last in the item. It is the undo failing to undo the
 * part the reader can see.
 */
describe('coversToKeep', () => {
  const saved = (over: Partial<SavedBook> = {}): SavedBook => ({
    id: 'a',
    book: { title: 'Dune', author: 'Frank Herbert', coverUrl: 'https://c.test/dune.jpg' },
    intent: 'next',
    savedAt: 1,
    ...over,
  });

  it('keeps both pictures of every book on the shelf', () => {
    // Both, because pruning on coverUrl alone deletes every caught photograph.
    const shelf = [saved({ shot: 'https://p.test/shot.jpg' })];
    expect(coversToKeep(shelf, undefined).sort()).toEqual([
      'https://c.test/dune.jpg',
      'https://p.test/shot.jpg',
    ]);
  });

  it('keeps the pictures of a book an undo could still bring back', () => {
    // The book is already OFF the shelf by the time this runs — that is the whole point.
    const gone = saved({ id: 'b', shot: 'https://p.test/gone.jpg' });
    expect(coversToKeep([], gone).sort()).toEqual([
      'https://c.test/dune.jpg',
      'https://p.test/gone.jpg',
    ]);
  });

  it('drops nothing on the floor when a book has no picture at all', () => {
    const bare = saved({ book: { title: 'Dune', author: 'Frank Herbert' } });
    expect(coversToKeep([bare], undefined)).toEqual([]);
  });

  it('does not double-count a book that is both on the shelf and pending', () => {
    const one = saved({ shot: 'https://p.test/shot.jpg' });
    expect(coversToKeep([one], one).sort()).toEqual([
      'https://c.test/dune.jpg',
      'https://p.test/shot.jpg',
    ]);
  });
});
