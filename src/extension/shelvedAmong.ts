import type { Book } from '../recognizer/types';
import { bookKey, sameBook } from './bookIdentity';
import type { Intent, SavedBook } from './storage';

/**
 * Which of these books the shelf already holds, and in which pile.
 *
 * EXTRACTED FROM `background.ts` ON 2026-08-27, and the testability is the first reason
 * rather than the speed. That file registers `chrome.contextMenus` and `chrome.runtime`
 * listeners at module scope, so no test can import it at all — the same argument that moved
 * `ensureTray`, `activateKey`, `grantedHosts` and `saveBook` out. `OPENWORK.md` item 50,
 * PERF-7.
 *
 * The speed is the second reason, and it only bites at a shelf nobody has yet. Measured on
 * this machine, 20 candidates against the old `shelf.find` per candidate:
 *
 *     119 books    5.26ms      (a realistic shelf today)
 *     500 books   15.65ms
 *     2000 books  57.66ms
 *
 * That is on the catch's RESPONSE path — the moment the card is waiting to say which books
 * are already held — and it is `O(candidates x shelf)` with both identity keys recomputed
 * on every comparison. Once the function is out here, `O(candidates)` is no harder to write
 * than `O(candidates x shelf)`, so it is written that way.
 *
 * ⚠ **A PLAIN `Map` LOOKUP WOULD BE WRONG, and that is the whole difficulty.** `sameBook` is
 * NOT key equality: a matching ISBN counts even when two records spell the title
 * differently, and two differing subtitles on the SAME main title are two volumes of a
 * series rather than one book (item 47, C-5). That relation is not transitive, so it cannot
 * be a key. The index therefore NARROWS the search and `sameBook` still decides:
 *
 *   - `byIsbn` answers the ISBN half directly, since an exact ISBN match is unconditional.
 *   - `byKey` buckets the shelf by the coarse `bookKey`, and the subtitle rule is applied
 *     inside the bucket by `sameBook` itself.
 *
 * The result is byte-identical to the old scan, which is what `shelvedAmong.test.ts` proves
 * against a naive implementation over generated data rather than by inspection.
 */
export interface Shelved {
  /** The work key the page compares against. See `identityOf`. */
  identity: string;
  intent: Intent;
}

export function shelvedAmong(
  shelf: readonly SavedBook[],
  candidates: readonly Book[],
): Shelved[] {
  if (!shelf.length || !candidates.length) return [];

  // Indexes hold the shelf POSITION rather than the record, so the earliest match wins
  // exactly as `shelf.find` did. Two records can only both match a candidate if the shelf
  // holds a duplicate, which `library.add` prevents — but "in practice never" is not a
  // reason to return a different answer when it happens.
  const byIsbn = new Map<string, number>();
  const byKey = new Map<string, number[]>();

  shelf.forEach((saved, i) => {
    const { isbn } = saved.book;
    if (isbn && !byIsbn.has(isbn)) byIsbn.set(isbn, i);
    const key = bookKey(saved.book);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(i);
    else byKey.set(key, [i]);
  });

  const out: Shelved[] = [];
  for (const book of candidates) {
    const viaIsbn = book.isbn ? byIsbn.get(book.isbn) : undefined;
    // `sameBook` still decides inside the bucket, because the coarse key cannot express
    // the subtitle rule. The bucket is in shelf order, so `find` returns the earliest.
    const viaKey = (byKey.get(bookKey(book)) ?? []).find((i) =>
      sameBook((shelf[i] as SavedBook).book, book),
    );

    const at = Math.min(viaIsbn ?? Infinity, viaKey ?? Infinity);
    if (at === Infinity) continue;
    out.push({ identity: bookKey(book), intent: (shelf[at] as SavedBook).intent });
  }
  return out;
}
