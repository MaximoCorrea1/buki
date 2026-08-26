import { describe, it, expect } from 'vitest';
import { handleSearchBooks } from './searchBooks';
import type { BooksDb } from '../recognizer/types';

const db = (books: { title: string; author: string }[]): BooksDb => ({
  lookupByIsbn: async () => null,
  search: async () => books,
});

const failing = (message: string): BooksDb => ({
  lookupByIsbn: async () => null,
  search: async () => {
    throw new Error(message);
  },
});

describe('the worker answers a catalogue search', () => {
  it('returns what the catalogue returned, with the sequence echoed', async () => {
    const answer = await handleSearchBooks({ type: 'searchBooks', query: 'dune', seq: 7 }, () =>
      db([{ title: 'Dune', author: 'Frank Herbert' }]),
    );
    expect(answer).toEqual({
      ok: true,
      seq: 7,
      books: [{ title: 'Dune', author: 'Frank Herbert' }],
    });
  });

  it('searches on the TRIMMED query', async () => {
    let asked: { title: string; author?: string } | undefined;
    await handleSearchBooks({ type: 'searchBooks', query: '  dune  ', seq: 1 }, () => ({
      lookupByIsbn: async () => null,
      search: async (q) => {
        asked = q;
        return [];
      },
    }));
    expect(asked).toEqual({ title: 'dune' });
  });

  it('refuses a query below the minimum WITHOUT touching the catalogue', async () => {
    // The popup guards this too. Guarding both sides matters because the worker is
    // reachable by anything that can post it a message, and a one-character query is a
    // request against the breaker recognition shares.
    let called = false;
    const answer = await handleSearchBooks({ type: 'searchBooks', query: 'd', seq: 2 }, () => {
      called = true;
      return db([]);
    });
    expect(called).toBe(false);
    expect(answer).toEqual({ ok: true, seq: 2, books: [] });
  });

  it('turns a thrown catalogue error into a refusal that keeps its sequence', async () => {
    const answer = await handleSearchBooks({ type: 'searchBooks', query: 'dune', seq: 3 }, () =>
      failing('OpenLibrary did not answer within 6s'),
    );
    expect(answer).toEqual({
      ok: false,
      seq: 3,
      error: 'OpenLibrary did not answer within 6s',
    });
  });

  it('quotes the catalogue rather than inventing a phrase for it', async () => {
    // docs/brand.md, Voice: "Errors do not apologise and are never vague. 'OpenLibrary did
    // not answer within 6s' beats 'something went wrong', because one of them tells you
    // whether to try again."
    const answer = await handleSearchBooks({ type: 'searchBooks', query: 'dune', seq: 5 }, () =>
      failing('the catalogue is unreachable'),
    );
    expect(answer).toMatchObject({ ok: false, error: 'the catalogue is unreachable' });
  });

  it('never lets a rejection escape to the listener', async () => {
    // The listener hands this straight to sendResponse. An escaping rejection there is an
    // unanswered message, which the popup sees as a sheet that never stops loading.
    await expect(
      handleSearchBooks({ type: 'searchBooks', query: 'dune', seq: 4 }, () => failing('boom')),
    ).resolves.toMatchObject({ ok: false });
  });
});
