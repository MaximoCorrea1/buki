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
 * old id would not survive, and `removeBook` also flags the recognition as wrong on the
 * way out. That flag is not cleared on the way back in, so a remove-then-undo leaves the
 * kept rate one worse than it should be. It is one attempt in a rolling 200 and correcting
 * it needs an unflag path through the log; that is a real todo, not an oversight.
 */
import type { Book } from '../recognizer/types';
import type { Intent, SavedBook, SavedSource } from './storage';

export interface RestoreArgs {
  book: Book;
  intent: Intent;
  source?: SavedSource;
  shot?: string;
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
    ...(saved.source ? { source: saved.source } : {}),
    // A book the catalogue holds no art for is drawn from this. Losing it on undo turns
    // the book into a generated board — a different-looking book, silently.
    ...(saved.shot ? { shot: saved.shot } : {}),
  };
}
