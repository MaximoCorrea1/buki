import { describe, it, expect } from 'vitest';
import { coverSources, shotFor } from './coverSource';
import type { SavedBook } from './storage';

const saved = (extra: Partial<SavedBook> & { coverUrl?: string }): SavedBook => ({
  id: '1',
  intent: 'now',
  savedAt: 1,
  book: { title: 'Dune', author: 'Frank Herbert', coverUrl: extra.coverUrl },
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
    expect(shotFor(SHOT, 1)).toBe(SHOT);
  });

  it('drops it when the catch found several, so each book keeps its own cover', () => {
    // The bug, stated as a test: five books share one photograph, so the photograph is
    // not a cover for any of them and coverSources falls through to the catalogue art.
    expect(shotFor(SHOT, 5)).toBeUndefined();
    expect(shotFor(SHOT, 2)).toBeUndefined();
  });

  it('drops it when the catch found nothing, so no orphan picture is stored', () => {
    expect(shotFor(SHOT, 0)).toBeUndefined();
  });

  it('has nothing to keep when the catch had no picture', () => {
    // A retailer-link catch reads no image at all.
    expect(shotFor(undefined, 1)).toBeUndefined();
  });

  it('leaves the http check to coverSources, which is the one place it lives', () => {
    // Deliberately NOT re-validating the scheme here: two places deciding what a usable
    // picture is, is how they come to disagree.
    expect(shotFor('javascript:alert(1)', 1)).toBe('javascript:alert(1)');
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
