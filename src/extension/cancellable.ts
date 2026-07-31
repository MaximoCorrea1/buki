import type { FetchLike } from '../recognizer/types';

/**
 * Make every request a client sends also obey a job's signal.
 *
 * The fetches live in the background worker, so calling off a lookup is a message from the
 * page rather than a local abort. The obvious implementation - threading an `AbortSignal`
 * through `BooksDb.search` and `VisionClient.guessBook` - would change two interfaces and
 * every implementation and fake of them. Wrapping the `fetch` they are constructed with
 * gets the same reach for one function, and neither interface moves.
 *
 * The client's own signal is combined with the job's, never replaced:
 * `createOpenLibraryClient` and `createLlmVision` each set an `AbortSignal.timeout`, and
 * that is the only thing stopping a hung request from pinning a catch open forever.
 */
export function withSignal(base: FetchLike, signal: AbortSignal): FetchLike {
  return (url, init) => {
    const own = init?.signal;
    return base(url, {
      ...init,
      signal: own ? AbortSignal.any([own, signal]) : signal,
    });
  };
}
