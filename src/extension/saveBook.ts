/**
 * Putting a book on the shelf, as a function of a message.
 *
 * `background.ts` is a shell that binds the live dependencies and calls this.
 *
 * WHY IT IS A SEPARATE MODULE, which is a decision worth not re-litigating. The worker
 * registers `chrome.contextMenus` and `chrome.runtime` listeners at module scope, so
 * importing it from a test throws before any test runs. Its entire message-dispatch surface
 * was therefore guarded by `?raw` source text — and a reviewer proved what that cannot see:
 * `expect(background).toContain('markRestored')` passed with the whole relink block wrapped
 * in `if (false && ...)`, and passed with the arguments REVERSED, while all 533 tests stayed
 * green. Both arguments are strings, so TypeScript had nothing to say either.
 *
 * The shape is `(request, env) => response`, which is what `src/server/licenseHandler.ts`
 * and `visionHandler.ts` already use: every decision in a function that takes its
 * dependencies, and a thin adapter that supplies the live ones. That is what makes the call
 * spy-able instead of string-matchable, and it is the pattern the NEXT message type should
 * follow rather than inheriting the blind spot.
 */
import type { BackgroundRequest, ShelfResponse } from './messages';
import type { Intent, SavedBook, SavedSource } from './storage';
import type { Book } from '../recognizer/types';

/** The one message this handles, narrowed from the worker's whole request union. */
export type SaveBookRequest = Extract<BackgroundRequest, { type: 'saveBook' }>;

export interface SaveBookDeps {
  /** `library.add`. Issues a NEW id even on an undo, which is why the relink below exists. */
  add: (book: Book, intent: Intent, source?: SavedSource, shot?: string) => Promise<SavedBook>;
  /**
   * Fire-and-forget BY CONTRACT. A cover that fails to cache must never fail a save: the
   * book is the product and the picture is an optimisation. The live binding voids the
   * promise, so nothing here can reject.
   */
  rememberCover: (url: string | undefined) => void;
  /** `log.markRestored(previousId, savedId)`. Argument ORDER is the whole risk. */
  markRestored: (previousId: string, savedId: string) => Promise<void>;
}

export async function handleSaveBook(
  msg: SaveBookRequest,
  deps: SaveBookDeps,
): Promise<ShelfResponse> {
  let saved: SavedBook;
  try {
    saved = await deps.add(msg.book, msg.intent, msg.source, msg.shot);
  } catch (err) {
    // Nothing else runs. There is no new id to relink to, and calling `markRestored` here
    // would point the event at nothing and lose the link it still has.
    console.error('[Buki] save failed', err);
    return { ok: false, error: String(err) };
  }

  // Both. The catalogue's art is what the shelf draws first as of 2026-08-16; the picture
  // is kept anyway, because it is what a book gets when OpenLibrary holds no art, and
  // because keeping the bytes means the shelf survives the post being deleted — which is
  // the whole point of having caught it.
  deps.rememberCover(saved.shot);
  deps.rememberCover(msg.book.coverUrl);

  // AN UNDO, not a fresh save. `removeBook` flagged this attempt as a wrong match on the way
  // out; putting the book back has to put the recognition back too, and relink the event to
  // the id `add` just issued. Without the relink the event names a book that is not on the
  // shelf, so a later genuine removal flags nothing and that catch can never be scored
  // again. A rate one too low is visible; an event that can never be scored is not.
  //
  // AWAITED, not fire-and-forget, and the distinction cost a review to see. A failed relink
  // must not fail the undo the user can see — that is what the `catch` is for — but "must
  // not fail" is not "must not be awaited". The popup holds its OWN read-only log instance
  // and there is no `chrome.storage.onChanged` listener anywhere, so a stale read after Undo
  // does not self-correct; it sits there until something unrelated refreshes.
  //
  // The failure is permanent and never retried. That is deliberate and registered as an
  // accepted risk in `OPENWORK.md` §6, not an oversight.
  if (msg.restoreOf) {
    await deps
      .markRestored(msg.restoreOf, saved.id)
      .catch((err: unknown) => console.error('[Buki] could not restore the match', err));
  }

  return { ok: true, saved };
}
