import type { Book } from '../recognizer/types';
import { createWriteQueue } from './writeQueue';

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
 * Identity for dedup: ISBN when we have one, else normalized title+author.
 *
 * Exported because "is this already mine?" is asked outside this module too - the picker
 * marks a candidate the shelf already holds, so you are not offered a book you own as
 * though it were new.
 */
export function identityOf(book: Book): string {
  if (book.isbn) return `isbn:${book.isbn}`;
  return `ta:${book.title.trim().toLowerCase()}|${book.author.trim().toLowerCase()}`;
}

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
    async add(book: Book, intent: Intent, source?: SavedSource): Promise<SavedBook> {
      return serialize(async () => {
        const existing = await read();
        const identity = identityOf(book);
        const previous = existing.find((s) => identityOf(s.book) === identity);

        // Re-saving a book you already have updates it in place rather than
        // stacking duplicates (easy to do when a save gives no visible feedback).
        const saved: SavedBook = {
          id: previous?.id ?? deps.newId(),
          book,
          intent,
          source: source ?? previous?.source,
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
