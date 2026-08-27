import type { Book } from '../recognizer/types';

/**
 * Two readings of the same book, folded into the better record.
 *
 * WHAT WENT WRONG. `OPENWORK.md` item 47, ADV-6, and it destroyed real data. `library.add`
 * defends `source` and `shot` on two consecutive lines — `source: source ?? previous?.source`
 * — and takes `book` WHOLESALE on the line above them. So re-catching a book you already
 * had replaced its record with whatever this reading happened to know.
 *
 * That is worst exactly when it is most likely. When OpenLibrary is down the recogniser
 * correctly emits a bare guess with no ISBN and no cover, because *"I could not ask"* is
 * not *"no"*. Saving it deleted both from disk: the Buy link fell back to a title search
 * and the cover fell back to a drawn board, while the tray said **"Moved · Dune → now"**.
 *
 * THE REVIEW'S ONE-LINE FIX IS RIGHT FOR THE CASE IT NAMES AND WRONG FOR THE COMMON ONE.
 * It prescribes `book: previous ? { ...previous.book, ...book } : book`. A spread keeps a
 * previous value only when the incoming key is ABSENT, and this repo produces both shapes:
 *
 *   `recognizer.ts:94`  `{ title, author }`                        — keys absent  ✓ spread works
 *   `openLibrary.toBook` `{ …, isbn: undefined, coverUrl: undefined }` — keys PRESENT ✗ spread wipes
 *
 * `toBook` always writes both keys: `isbn: (doc.isbn ?? [])[0]` and `coverUrl: doc.cover_i
 * ? … : undefined`. OpenLibrary records are patchy, so a doc that MATCHES but carries
 * neither is ordinary — and then the spread overwrites with `undefined` and the cover is
 * gone as if nothing had been guarded. **This is the distinction `exactOptionalPropertyTypes`
 * exists to make, and item 53's TS-7 is that flag still being off.**
 *
 * THE RULE, stated once so it cannot be argued per field: **a re-catch never makes the
 * record worse.** Take the new value when the new reading actually has one; otherwise keep
 * what was already known. "Actually has one" means present and non-empty, because
 * `toBook` writes `title: doc.title ?? ''` and an empty title is not a correction.
 *
 * Field by field rather than a loop, deliberately: a fifth field on `Book` should not
 * inherit a policy nobody chose for it.
 */

/** Present, and not the empty string. `undefined` and `''` are both "this reading does not know". */
const known = (value: string | undefined): value is string => typeof value === 'string' && value !== '';

export function mergeBook(previous: Book | undefined, incoming: Book): Book {
  if (!previous) return incoming;

  const isbn = known(incoming.isbn) ? incoming.isbn : previous.isbn;
  const coverUrl = known(incoming.coverUrl) ? incoming.coverUrl : previous.coverUrl;

  // Built by conditional spread rather than by assigning `undefined`, so the merged record
  // has no key holding undefined. `chrome.storage.local` serialises through structured
  // clone, which DROPS undefined values, so a record that emitted them would differ from
  // the one that comes back out — the same in-memory-versus-stored gap that let the
  // original `activationId` bug flow perfectly through 550 tests and never once in
  // production. See OPENWORK item 27.
  return {
    title: known(incoming.title) ? incoming.title : previous.title,
    author: known(incoming.author) ? incoming.author : previous.author,
    ...(known(isbn) ? { isbn } : {}),
    ...(known(coverUrl) ? { coverUrl } : {}),
  };
}
