import { describe, it, expect } from 'vitest';
import { coverSources } from './coverSource';
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
  it('shows the picture you caught before the catalogue art', () => {
    // The catalogue's art is whatever edition its relevance index ranked first, and it
    // measurably is not always the book in the photo: on 2026-08-06 the top three hits
    // for "Dune Frank Herbert" were Children of Dune, God Emperor and Heretics. The
    // picture cannot be the wrong book, because it IS the book that was read.
    expect(coverSources(saved({ shot: SHOT, coverUrl: ART }))).toEqual([SHOT, ART]);
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
