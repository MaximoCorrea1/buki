import type { Book } from '../recognizer/types';
import type { Intent, SavedBook, SavedSource } from './storage';

/**
 * The shelf, read defensively out of storage.
 *
 * TS-2. `OPENWORK.md` item 53. This used to be one line:
 *
 *     return Array.isArray(raw) ? (raw as SavedBook[]) : [];
 *
 * **`Array.isArray` is the only check, and a cast checks nothing at runtime.** Whatever
 * `chrome.storage.local` held became the shelf — a store that is user-editable, shared with
 * every other key the extension owns, and outlives four versions of a schema.
 *
 * **The harm the review named is not a crash.** A corrupt `intent` exports the literal
 * string `undefined` into Goodreads' *Exclusive Shelf* column, in a file the reader imports
 * into an account they keep. The bad value leaves the product.
 *
 * ⚠ **DROP, DO NOT THROW, and that is the decision this module turns on.** A reader with one
 * damaged row should lose that row and nothing else. Refusing to parse would turn one bad
 * record into *"you have no books"* — and the shelf IS the product, so that is by far the
 * worse failure. Same direction `keyCap`'s eviction takes: when the bookkeeping is wrong,
 * fail towards the customer.
 *
 * **Optional fields are stripped rather than fatal**, for the same reason one step down: a
 * junk `isbn` is not a reason to lose a book somebody saved. And they are OMITTED rather
 * than written as `undefined`, which is the runtime half of the rule
 * `exactOptionalPropertyTypes` now enforces at compile time (TS-7).
 */

const INTENTS: readonly string[] = ['now', 'next', 'someday', 'read'];
const KINDS: readonly string[] = ['tweet', 'page'];

const text = (v: unknown): v is string => typeof v === 'string' && v !== '';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A book, or nothing. Title AND author, because a shelf row with neither is not a book. */
function book(raw: unknown): Book | null {
  if (!object(raw)) return null;
  if (!text(raw['title']) || typeof raw['author'] !== 'string') return null;

  const isbn = raw['isbn'];
  const coverUrl = raw['coverUrl'];
  return {
    title: raw['title'],
    author: raw['author'],
    ...(text(isbn) ? { isbn } : {}),
    // http(s) ONLY, the same rule `coverSources` applies at the read. A stored `javascript:`
    // has no way in today, and this is what keeps it that way if one is already on disk.
    ...(text(coverUrl) && /^https?:\/\//i.test(coverUrl) ? { coverUrl } : {}),
  };
}

/**
 * Where a book was caught, or nothing.
 *
 * The scheme check is here as well as in `permalink.ts`, and that is deliberate rather than
 * duplication: TM-10 stopped a `javascript:` URL being WRITTEN, and a shelf saved before
 * that fix can still be holding one. One guard covers new writes, this one covers the disk.
 */
function source(raw: unknown): SavedSource | null {
  if (!object(raw)) return null;
  const url = raw['url'];
  const kind = raw['kind'];
  if (!text(url) || !/^https?:\/\//i.test(url)) return null;
  if (typeof kind !== 'string' || !KINDS.includes(kind)) return null;
  return { url, kind: kind as SavedSource['kind'] };
}

/** One row, or nothing. `null` means drop this record and keep the others. */
function record(raw: unknown): SavedBook | null {
  if (!object(raw)) return null;

  const id = raw['id'];
  const intent = raw['intent'];
  const savedAt = raw['savedAt'];
  const theBook = book(raw['book']);

  // THE FOUR THAT ARE FATAL, because a row missing any of them is not a saved book: there
  // is nothing to show, nothing to file it under, and nothing to delete it by.
  if (!text(id) || !theBook || !num(savedAt)) return null;
  if (typeof intent !== 'string' || !INTENTS.includes(intent)) return null;

  const theSource = source(raw['source']);
  const shot = raw['shot'];

  return {
    id,
    book: theBook,
    intent: intent as Intent,
    savedAt,
    ...(theSource ? { source: theSource } : {}),
    ...(text(shot) && /^https?:\/\//i.test(shot) ? { shot } : {}),
    ...(typeof raw['moved'] === 'boolean' ? { moved: raw['moved'] } : {}),
  };
}

/** Every row storage holds that is really a saved book, in order. */
export function readShelf(raw: unknown): SavedBook[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(record).filter((s): s is SavedBook => s !== null);
}
