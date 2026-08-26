import type { BooksDb } from '../recognizer/types';
import type { BackgroundRequest, SearchResponse } from './messages';
import { MIN_QUERY } from './manualAdd';

export type SearchBooksRequest = Extract<BackgroundRequest, { type: 'searchBooks' }>;

/**
 * The worker's side of adding a book by hand.
 *
 * IT HAS ITS OWN MODULE BECAUSE `background.ts` SAYS SO, at the listener:
 *
 *   *"Keep this adapter thin, and give the next message type its own handler rather than
 *    inlining one here."*
 *
 * The reason is on record beside it. An inline `saveBook` once satisfied a `?raw` guard
 * with the call sitting in dead code AND with its arguments reversed, because a guard that
 * greps source cannot see control flow. A handler a test can import is a handler a test
 * can actually check.
 *
 * `books` is a FACTORY rather than an instance so the caller owns the fetch and the
 * breaker, and the test owns neither. The worker passes one built the same way
 * recognition builds its own, sharing the `catalogue` breaker on purpose: a catalogue that
 * is failing should back both paths off together, not have this one hammering a host that
 * recognition has already given up on.
 */
export async function handleSearchBooks(
  msg: SearchBooksRequest,
  books: () => BooksDb,
): Promise<SearchResponse> {
  const title = msg.query.trim();

  // Guarded on BOTH sides. The popup will not send a short query; the worker is reachable
  // by anything that can post it a message, and answering an empty result costs nothing
  // while a one-character search costs the shared breaker a real request.
  if (title.length < MIN_QUERY) return { ok: true, seq: msg.seq, books: [] };

  try {
    return { ok: true, seq: msg.seq, books: await books().search({ title }) };
  } catch (err) {
    // The catalogue's own words, never a phrase invented here. docs/brand.md, Voice:
    // "OpenLibrary did not answer within 6s" tells somebody whether to try again, and
    // "something went wrong" does not.
    return { ok: false, seq: msg.seq, error: err instanceof Error ? err.message : String(err) };
  }
}
