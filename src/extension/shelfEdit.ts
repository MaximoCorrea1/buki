/**
 * Taking a book off the shelf, and putting it back.
 *
 * Removal has existed since the detail sheet did, but only there — two clicks behind a
 * cover, which is why Maximo asked for *"some delete features, remove books from the
 * shelfs"* while looking at a shelf that already had one. Bringing it onto the tile makes
 * it a one-click destructive action, and that is what makes undo compulsory rather than
 * polish: this popup has no confirm dialog and should not grow one.
 *
 * WHAT UNDO CANNOT RESTORE, said out loud rather than hidden: the book comes back with a
 * NEW id, because `add` issues one. Nothing user-facing keys off it — the shelf is drawn
 * from the record, and `bookIdentity` matches on title and author — but a bookmark to the
 * old id would not survive.
 *
 * THE RECOGNITION IS RESTORED TOO, as of 2026-08-17. `removeBook` flags the attempt as a
 * wrong match on the way out, and for a while nothing cleared it on the way back in, so a
 * remove-then-undo left the kept rate one worse than the truth. `restoreOf` carries the
 * old id so the worker can call `markRestored`, which clears the flag AND relinks the
 * event to the new id.
 *
 * The relink is the half that mattered more, and it is invisible in the number: without
 * it the event went on naming a book that was no longer on the shelf, so if you later
 * removed that book because it really was wrong, `markWrong` would match nothing and the
 * log would have quietly lost the ability to score that catch at all.
 */
import type { Book } from '../recognizer/types';
import type { Intent, SavedBook, SavedSource } from './storage';

export interface RestoreArgs {
  book: Book;
  intent: Intent;
  source?: SavedSource;
  shot?: string;
  /**
   * The id this book HAD, not the id it will get. Deliberately not called `id`: `add`
   * issues a new one, so a key called `id` here would be a lie. This one means "the save
   * about to happen undoes the removal of that id", and it is the only thing that tells
   * the worker an undo apart from a fresh save.
   */
  restoreOf: string;
}

/**
 * The arguments that put a removed book back exactly where it was.
 *
 * Spreading conditionally rather than assigning `undefined`: `add` writes the record it is
 * handed, and an explicit `shot: undefined` is a key with a hole in it that `identityOf`
 * then has to reason about.
 */
export function restoreArgs(saved: SavedBook): RestoreArgs {
  return {
    book: saved.book,
    // The pile it was IN, never a default. Undoing a mistake must not cost you the
    // shelving you had already done.
    intent: saved.intent,
    // Unconditional: every call of this function IS an undo, so there is always an id
    // whose removal is being reversed.
    restoreOf: saved.id,
    ...(saved.source ? { source: saved.source } : {}),
    // A book the catalogue holds no art for is drawn from this. Losing it on undo turns
    // the book into a generated board — a different-looking book, silently.
    ...(saved.shot ? { shot: saved.shot } : {}),
  };
}
