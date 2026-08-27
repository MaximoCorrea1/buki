import type { Book } from '../recognizer/types';
import { createWriteQueue } from './writeQueue';
import { bookKey, sameBook } from './bookIdentity';
import { mergeBook } from './mergeBook';

/**
 * What you mean to do about a book. `read` is an end state rather than an intention, but
 * it lives in the same field because a book is only ever in one of these piles.
 */
export type Intent = 'now' | 'next' | 'someday' | 'read';

/** Where a book was caught. Not always a tweet - the right-click flow works on any page. */
export interface SavedSource {
  url: string;
  kind: 'tweet' | 'page';
}

export interface SavedBook {
  id: string;
  book: Book;
  intent: Intent;
  source?: SavedSource;
  /**
   * The picture this book was caught from, and the shelf's fallback cover when the
   * catalogue holds no art for the book. See coverSource.ts.
   *
   * Stored ONLY when the catch found exactly one book: a photograph of five books is not
   * a cover for any of them, and writing it to all five is how a stack once arrived on
   * the shelf as five copies of the same picture. See `shotFor`.
   *
   * Not on `Book`, because it is not a property of the book: it is a property of THIS
   * catch. Two people catching Dune from two posts hold the same book and different
   * pictures, and the recognizer must not have to know about either.
   */
  shot?: string;
  savedAt: number;
  /**
   * True when this replaced a book already on the shelf rather than adding one. Not
   * persisted state so much as a receipt for the write, so the toast can say "Moved"
   * where it used to say "Saved" about a book you already had.
   */
  moved?: boolean;
}

/** Minimal shape of chrome.storage.local we depend on, so this tests without Chrome. */
export interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

const KEY = 'savedBooks';

/**
 * Identity for dedup, and for the picker's "already on your shelf" marker.
 *
 * This used to be "the ISBN if there is one, else title+author", which filed two editions
 * of one book - and an ISBN-carrying result next to an ISBN-less one - as two separate
 * books. See `bookIdentity.ts`: identity is now the WORK, and a matching ISBN is an extra
 * way to be the same rather than the only one.
 *
 * Kept under this name because other modules already import it.
 */
export const identityOf = bookKey;

/**
 * The user's own reading list. Owns the data; export/sync is layered on later.
 *
 * Every write goes through `queue`. add() and remove() are read-modify-write cycles
 * against one storage key, so two overlapping calls would otherwise both read the same
 * base list and the last write would silently drop the other's book - reproduced as
 * real data loss in review. Do NOT write to KEY outside this module.
 */
export function createLibrary(deps: {
  storage: StorageArea;
  now: () => number;
  newId: () => string;
}) {
  const serialize = createWriteQueue();

  async function read(): Promise<SavedBook[]> {
    const got = await deps.storage.get(KEY);
    const raw = got[KEY];
    return Array.isArray(raw) ? (raw as SavedBook[]) : [];
  }

  return {
    async add(book: Book, intent: Intent, source?: SavedSource, shot?: string): Promise<SavedBook> {
      return serialize(async () => {
        const existing = await read();
        // sameBook, not a key comparison: a matching ISBN counts even when the titles are
        // written differently, and a matching work counts even when the ISBNs differ.
        const previous = existing.find((s) => sameBook(s.book, book));

        // Re-saving a book you already have updates it in place rather than
        // stacking duplicates (easy to do when a save gives no visible feedback).
        const saved: SavedBook = {
          id: previous?.id ?? deps.newId(),
          // Merged, not replaced. This line took the reading WHOLESALE while the two below
          // it defended `source` and `shot`, so re-catching a book destroyed whatever this
          // reading did not happen to know — worst exactly when it is most likely, because
          // a catalogue outage produces a bare guess with no ISBN and no cover and saving
          // it deleted both from disk. `OPENWORK.md` item 47, ADV-6.
          //
          // NOT `{ ...previous.book, ...book }`, which is what the review prescribed: a
          // spread keeps a previous value only when the incoming KEY IS ABSENT, and
          // `openLibrary.toBook` always writes `isbn` and `coverUrl` even when they are
          // undefined. See `mergeBook.ts`.
          book: mergeBook(previous?.book, book),
          intent,
          source: source ?? previous?.source,
          // Keep the picture across a move. Moving Someday to Now goes through add(),
          // and it carries no picture, so without this the cover would vanish the first
          // time a book changed pile.
          shot: shot ?? previous?.shot,
          savedAt: deps.now(),
          moved: Boolean(previous),
        };
        const rest = existing.filter((s) => s.id !== saved.id);
        await deps.storage.set({ [KEY]: [saved, ...rest] });
        return saved;
      });
    },

    /** Remove one book. The escape hatch that makes a wrong auto-save recoverable. */
    async remove(id: string): Promise<void> {
      return serialize(async () => {
        const existing = await read();
        await deps.storage.set({ [KEY]: existing.filter((s) => s.id !== id) });
      });
    },

    async list(): Promise<SavedBook[]> {
      return read();
    },
  };
}

/**
 * Does this book answer to what was typed? Title or author, case-insensitive - you
 * remember who wrote something as often as what it was called.
 *
 * Here rather than in the popup so it can be tested: `popup.ts` renders on import.
 */
export function matchesFilter(saved: SavedBook, needle: string): boolean {
  const trimmed = needle.trim().toLowerCase();
  if (!trimmed) return true;
  return `${saved.book.title} ${saved.book.author}`.toLowerCase().includes(trimmed);
}
