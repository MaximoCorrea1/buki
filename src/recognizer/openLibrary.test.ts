import { describe, it, expect } from 'vitest';
import { createOpenLibraryClient } from './openLibrary';
import type { FetchLike } from './types';

const docResponse = {
  docs: [{ title: 'Dune', author_name: ['Frank Herbert'], cover_i: 12345, isbn: ['9780441013593'] }],
};

describe('createOpenLibraryClient', () => {
  it('maps an OpenLibrary search doc into our Book shape', async () => {
    const fetch: FetchLike = async () => ({
      async json() {
        return docResponse;
      },
    });
    const client = createOpenLibraryClient({ fetch });

    const books = await client.search({ title: 'Dune' });

    expect(books[0]).toEqual({
      title: 'Dune',
      author: 'Frank Herbert',
      isbn: '9780441013593',
      coverUrl: 'https://covers.openlibrary.org/b/id/12345-M.jpg',
    });
  });

  it('names the author from the search itself, so the multi-book path has NO follow-up', async () => {
    /**
     * THE N+1 THAT IS NOT ONE, pinned so it stops being re-raised.
     *
     * `OPENWORK.md` and two handoffs carried *"`authorName()` is an N+1: one extra
     * OpenLibrary request per book to turn an author key into a name. A 20-book photo
     * means 20 follow-ups."* Traced against the call graph, that is false in the part that
     * matters:
     *
     *   groundText  ->  search()          asks for `author_name` in FIELDS. One request.
     *   retailer link -> lookupByIsbn()   reads an EDITION record, which names authors by
     *                                     key only, so it pays one follow-up. For ONE book,
     *                                     from a single `if (isbn)` branch, never a loop.
     *
     * So a twenty-book photo costs twenty searches and zero follow-ups. The follow-up
     * exists on the cheapest path in the product, the one that skips vision entirely.
     *
     * AND IT MUST NOT BE "FIXED" BY MOVING THE ISBN LOOKUP BACK TO `search.json?q=isbn:`.
     * That was tried and measured: on 2026-08-04 the search index timed out on every query
     * for over 20s while `/isbn/<isbn>.json` answered in about two. The comment above the
     * next test is the record of it.
     */
    const seen: string[] = [];
    const fetch: FetchLike = async (url) => {
      seen.push(url);
      return {
        async json() {
          return docResponse;
        },
      };
    };

    const books = await createOpenLibraryClient({ fetch }).search({ title: 'Dune' });

    expect(books[0]?.author).toBe('Frank Herbert');
    expect(seen).toHaveLength(1);
    expect(seen.filter((url) => url.includes('/authors/'))).toEqual([]);
    // The field is what makes the single request enough. Drop it from FIELDS and the
    // author arrives empty, which is the mutation this assertion exists to catch.
    expect(seen[0]).toContain('author_name');
  });

  // The ISBN lookup used to go through `search.json?q=isbn:...`. Resolving an EXACT key
  // through a full-text relevance index was always the weaker choice, and on 2026-08-04
  // it became a broken one: the search index timed out on every query for over 20s while
  // /isbn/<isbn>.json answered in about two seconds. These assertions are reversed on
  // purpose - the edition record is now the source.

  /** The edition record: authors by key only, covers by id, both ISBN forms. */
  const edition = {
    title: 'Dune',
    authors: [{ key: '/authors/OL79034A' }],
    covers: [14565843, 284314],
    isbn_13: ['9780441013593'],
    isbn_10: ['0441013597'],
  };

  /** Answer each URL from a map, so a test can say what the second request returns. */
  const fetchFrom = (routes: Record<string, unknown>, seen: string[] = []): FetchLike =>
    async (url) => {
      seen.push(url);
      const hit = Object.entries(routes).find(([fragment]) => url.includes(fragment));
      if (!hit) throw new Error(`unexpected request: ${url}`);
      return {
        async json() {
          return hit[1];
        },
      };
    };

  it('resolves an ISBN through the edition record, not the search index', async () => {
    const seen: string[] = [];
    const client = createOpenLibraryClient({
      fetch: fetchFrom({ '/isbn/': edition, '/authors/': { name: 'Frank Herbert' } }, seen),
    });

    const book = await client.lookupByIsbn('9780441013593');

    expect(book).toEqual({
      title: 'Dune',
      author: 'Frank Herbert',
      isbn: '9780441013593',
      coverUrl: 'https://covers.openlibrary.org/b/id/14565843-M.jpg',
    });
    expect(seen[0]).toBe('https://openlibrary.org/isbn/9780441013593.json');
    expect(seen.some((u) => u.includes('search.json'))).toBe(false);
  });

  it('still returns the book when the author record cannot be read', async () => {
    // An edition names its authors by key, so the name costs a second request. A book
    // with nobody named is still a book worth offering - losing the whole catch because
    // the second request failed would be the mandatory-grounding mistake again, smaller.
    const client = createOpenLibraryClient({
      fetch: async (url) => {
        if (url.includes('/authors/')) throw new Error('OpenLibrary did not answer within 6s.');
        return { async json() { return edition; } };
      },
    });

    const book = await client.lookupByIsbn('9780441013593');

    expect(book?.title).toBe('Dune');
    expect(book?.author).toBe('');
  });

  it('returns nothing for an ISBN OpenLibrary does not hold', async () => {
    const client = createOpenLibraryClient({
      fetch: async () => ({ ok: false, status: 404, async json() { return {}; } }),
    });

    expect(await client.lookupByIsbn('9780000000000')).toBeNull();
  });
});
