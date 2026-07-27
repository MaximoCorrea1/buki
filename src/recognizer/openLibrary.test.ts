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

  it('resolves an ISBN to a single book via an isbn: query', async () => {
    let calledUrl = '';
    const fetch: FetchLike = async (url) => {
      calledUrl = url;
      return {
        async json() {
          return docResponse;
        },
      };
    };
    const client = createOpenLibraryClient({ fetch });

    const book = await client.lookupByIsbn('9780441013593');

    expect(book?.title).toBe('Dune');
    expect(calledUrl).toContain('isbn:9780441013593');
  });
});
