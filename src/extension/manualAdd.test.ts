import { describe, it, expect } from 'vitest';
import { MIN_QUERY, shouldSearch, isCurrent, candidatesFor, saveRequest } from './manualAdd';
import type { SavedBook } from './storage';

const shelved = (title: string, author: string, intent: SavedBook['intent']): SavedBook => ({
  id: `id-${title}`,
  book: { title, author },
  intent,
  savedAt: 0,
});

describe('when a typed query is worth a request', () => {
  it('needs three characters after trimming', () => {
    expect(MIN_QUERY).toBe(3);
    expect(shouldSearch('du')).toBe(false);
    expect(shouldSearch('dun')).toBe(true);
  });

  it('does not count whitespace toward the minimum', () => {
    // A field somebody tabbed into and left alone must not fire a request, and "  a  "
    // is that field rather than a query.
    expect(shouldSearch('   ')).toBe(false);
    expect(shouldSearch('  a  ')).toBe(false);
    expect(shouldSearch('  dune  ')).toBe(true);
  });

  it('refuses an empty string', () => {
    expect(shouldSearch('')).toBe(false);
  });
});

describe('which answer to paint when two are in flight', () => {
  it('keeps the newest and drops everything older', () => {
    expect(isCurrent(4, 4)).toBe(true);
    expect(isCurrent(3, 4)).toBe(false);
  });

  it('drops an answer from the FUTURE as well', () => {
    // Not paranoia about time travel: a seq above the newest means the counter was reset
    // while a request was in flight, and the safe read of a number that cannot exist is
    // "not mine". Equality, never `>=`.
    expect(isCurrent(9, 4)).toBe(false);
  });
});

describe('a result knows whether the shelf already holds it', () => {
  it('reports the pile a held book is in', () => {
    const rows = candidatesFor(
      [{ title: 'Dune', author: 'Frank Herbert' }],
      [shelved('Dune', 'Frank Herbert', 'next')],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.held).toBe('next');
  });

  it('reports null for a book the shelf does not hold', () => {
    const rows = candidatesFor(
      [{ title: 'Dune', author: 'Frank Herbert' }],
      [shelved('Range', 'David Epstein', 'now')],
    );
    expect(rows[0]!.held).toBeNull();
  });

  it('matches on IDENTITY, not on the title string', () => {
    // `identityOf` is `bookKey`, which normalises. A result differing only in case is the
    // SAME book, and reporting it as new is how a duplicate reaches the shelf. That is
    // item 47's bug (ADV-6) and this feature must not open a second door onto it.
    const rows = candidatesFor(
      [{ title: 'dune', author: 'frank herbert' }],
      [shelved('Dune', 'Frank Herbert', 'someday')],
    );
    expect(rows[0]!.held).toBe('someday');
  });

  it('keeps the order the catalogue returned', () => {
    const rows = candidatesFor(
      [
        { title: 'Dune', author: 'Frank Herbert' },
        { title: 'Range', author: 'David Epstein' },
      ],
      [],
    );
    expect(rows.map((r) => r.book.title)).toEqual(['Dune', 'Range']);
  });

  it('survives an empty shelf and an empty result set', () => {
    expect(candidatesFor([], [])).toEqual([]);
    expect(candidatesFor([], [shelved('Dune', 'Frank Herbert', 'now')])).toEqual([]);
  });
});

describe('what putting a hand-added book on a pile sends', () => {
  it('is the existing saveBook message, with the book and the pile', () => {
    const book = { title: 'Dune', author: 'Frank Herbert' };
    expect(saveRequest(book, 'next')).toEqual({ type: 'saveBook', book, intent: 'next' });
  });

  it('carries NO source, because there is no post behind it', () => {
    // `SavedSource` is `{url, kind}` and the detail sheet renders it as "the post that
    // sold you". A manual add has no post. Filling it with the popup's own URL, or the
    // active tab's, would put a lie on the one surface whose whole job is provenance.
    //
    // Asserted as the COMPLEMENT rather than as three absent keys: a future field added
    // to this message has to come here and be justified, rather than arriving silently.
    const sent = saveRequest({ title: 'Dune', author: 'Frank Herbert' }, 'now') as Record<
      string,
      unknown
    >;
    expect(Object.keys(sent).sort()).toEqual(['book', 'intent', 'type']);
    expect(sent.source).toBeUndefined();
  });

  it('carries no shot, so the shelf falls back to catalogue art or a cloth', () => {
    const sent = saveRequest({ title: 'Dune', author: 'Frank Herbert' }, 'someday');
    expect('shot' in sent).toBe(false);
  });
});
