import { describe, it, expect } from 'vitest';
import { createLibrary, matchesFilter, identityOf, type StorageArea } from './storage';
import type { Book } from '../recognizer/types';

function fakeStorage(): StorageArea {
  const store: Record<string, unknown> = {};
  return {
    async get(key) {
      return { [key]: store[key] };
    },
    async set(items) {
      Object.assign(store, items);
    },
  };
}

function makeLibrary(storage: StorageArea = fakeStorage()) {
  let clock = 1000;
  let seq = 0;
  const lib = createLibrary({
    storage,
    now: () => (clock += 1000),
    newId: () => `id-${++seq}`,
  });
  return lib;
}

/**
 * TS-2, AT THE WIRING. `OPENWORK.md` item 53.
 *
 * ⚠ **`storedShelf.test.ts` covers `readShelf` and could not see this.** A mutation that put
 * the bare cast back in `read()` — the finding, restored verbatim — **survived the whole
 * suite**, because every test above hands `createLibrary` well-formed data and the validator
 * was tested only in isolation. **A module that is tested and not CONNECTED under test is a
 * module you can unplug for free.**
 */
describe('the shelf survives what storage actually holds', () => {
  const seeded = (rows: unknown): StorageArea => {
    const store: Record<string, unknown> = { savedBooks: rows };
    return {
      async get(key) {
        return { [key]: store[key] };
      },
      async set(items) {
        Object.assign(store, items);
      },
    };
  };

  it('drops a row whose intent is not a real pile', async () => {
    // The named harm: a corrupt `intent` exports the literal "undefined" into Goodreads'
    // Exclusive Shelf column, in a file the reader imports into an account they keep.
    const lib = makeLibrary(
      seeded([
        { id: 'a', book: { title: 'Dune', author: 'Herbert' }, intent: 'now', savedAt: 1 },
        { id: 'b', book: { title: 'Emma', author: 'Austen' }, intent: undefined, savedAt: 2 },
      ]),
    );

    expect((await lib.list()).map((s) => s.id)).toEqual(['a']);
  });

  it('answers an empty shelf for storage that is not a list at all', async () => {
    expect(await makeLibrary(seeded('books')).list()).toEqual([]);
  });

  it('keeps the good rows, so one bad record is not "you have no books"', async () => {
    const lib = makeLibrary(
      seeded([
        { id: 'a', book: { title: 'Dune', author: 'Herbert' }, intent: 'now', savedAt: 1 },
        'nonsense',
        { id: 'c', book: { title: 'Emma', author: 'Austen' }, intent: 'read', savedAt: 3 },
      ]),
    );

    expect((await lib.list()).map((s) => s.id)).toEqual(['a', 'c']);
  });
});

describe('identityOf', () => {
  it('identifies the WORK, so two editions of it share one identity', () => {
    // Reversed on purpose. This used to assert that the same ISBN produced the same key,
    // because identity WAS the ISBN when one existed - which is exactly what filed two
    // editions of a book as two books. Identity is now the work; ISBN equality is a
    // separate, additional way to match, and lives in sameBook (see bookIdentity.test.ts).
    const a = identityOf({ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' });
    const b = identityOf({ title: 'Dune', author: 'Frank Herbert', isbn: '9780340960196' });

    expect(a).toBe(b);
  });

  it('falls back to title and author when there is no ISBN', () => {
    const a = identityOf({ title: 'Dune', author: 'Frank Herbert' });
    const b = identityOf({ title: '  dune ', author: 'FRANK HERBERT' });

    expect(a).toBe(b);
  });

  it('keeps two different books apart', () => {
    const a = identityOf({ title: 'Dune', author: 'Frank Herbert' });
    const b = identityOf({ title: 'Ubik', author: 'Philip K. Dick' });

    expect(a).not.toBe(b);
  });
});

describe('createLibrary', () => {
  it('reports that a re-saved book was moved rather than added', async () => {
    // The shelf has always deduped, so a repeat save was never a duplicate - but it said
    // "Saved" when it meant "Moved", which reads as though nothing was already there.
    const lib = makeLibrary();
    const book = { title: 'Dune', author: 'Frank Herbert' };
    await lib.add(book, 'someday');

    const again = await lib.add(book, 'now');

    expect(again.moved).toBe(true);
    expect(await lib.list()).toHaveLength(1);
  });

  it('does not claim a brand new book was moved', async () => {
    const lib = makeLibrary();

    const saved = await lib.add({ title: 'Ubik', author: 'Philip K. Dick' }, 'now');

    expect(saved.moved).toBe(false);
  });

  it('saves a book with its intent + source, and lists newest first', async () => {
    const lib = makeLibrary();

    await lib.add({ title: 'Dune', author: 'Frank Herbert' }, 'now', {
      url: 'https://x.com/a/status/1',
      kind: 'tweet',
    });
    await lib.add({ title: 'SICP', author: 'Abelson' }, 'someday');

    const all = await lib.list();

    expect(all.map((s) => s.book.title)).toEqual(['SICP', 'Dune']); // newest first
    expect(all[1]?.intent).toBe('now');
    expect(all[1]?.source?.url).toBe('https://x.com/a/status/1');
    expect(all[1]?.source?.kind).toBe('tweet');
  });

  it('keeps both books when two saves overlap (no lost update)', async () => {
    const lib = makeLibrary();

    // The reproduced P0: unserialized read-modify-write dropped one of these.
    await Promise.all([
      lib.add({ title: 'Book A', author: 'A' }, 'now'),
      lib.add({ title: 'Book B', author: 'B' }, 'next'),
    ]);

    const titles = (await lib.list()).map((s) => s.book.title).sort();
    expect(titles).toEqual(['Book A', 'Book B']);
  });

  it('removes a saved book by id so a wrong auto-save is recoverable', async () => {
    const lib = makeLibrary();
    const saved = await lib.add({ title: 'Wrong Book', author: 'Nobody' }, 'someday');
    await lib.add({ title: 'Keeper', author: 'Someone' }, 'now');

    await lib.remove(saved.id);

    expect((await lib.list()).map((s) => s.book.title)).toEqual(['Keeper']);
  });

  it('does not store the same book twice', async () => {
    const lib = makeLibrary();
    const book = { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' };

    await lib.add(book, 'someday');
    await lib.add(book, 'now');

    const all = await lib.list();
    expect(all).toHaveLength(1);
    expect(all[0]?.intent).toBe('now'); // re-saving updates the intent
  });

  it('moves a book to finished without disturbing anything else', async () => {
    const lib = makeLibrary();
    const book = { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' };
    await lib.add(book, 'now');
    await lib.add({ title: 'SICP', author: 'Abelson' }, 'next');

    // Re-adding an identical book updates it in place, which is how finishing works -
    // the shelf keeps one entry per book, and its intent is what changes.
    await lib.add(book, 'read');

    const all = await lib.list();
    expect(all).toHaveLength(2);
    expect(all.find((s) => s.book.title === 'Dune')?.intent).toBe('read');
    expect(all.find((s) => s.book.title === 'SICP')?.intent).toBe('next');
  });
});

describe('matchesFilter', () => {
  const saved = {
    id: 'a',
    book: { title: 'Signals and Systems', author: 'Alan V. Oppenheim' },
    intent: 'now' as const,
    savedAt: 1,
  };

  it('matches on the title regardless of case', () => {
    expect(matchesFilter(saved, 'signals')).toBe(true);
  });

  it('matches on the author too - you remember the writer as often as the title', () => {
    expect(matchesFilter(saved, 'oppenheim')).toBe(true);
  });

  it('rejects what is on neither', () => {
    expect(matchesFilter(saved, 'dune')).toBe(false);
  });

  it('keeps everything when nothing is typed', () => {
    expect(matchesFilter(saved, '')).toBe(true);
  });
});

describe('what survives a book changing pile', () => {
  /**
   * THE MUTATION THAT SURVIVED 620/620 GREEN. Removing
   *
   *     source: source ?? previous?.source,
   *     shot: shot ?? previous?.shot,
   *
   * left the whole suite passing, and the consequence is that **every book loses its cover
   * the first time it changes pile.** Moving Someday to Now goes through `add()` and carries
   * no picture, so without the carry the shot is overwritten with `undefined` and the shelf
   * falls back to a drawn board — silently, on the one surface the product is named for.
   *
   * The existing tests set `source` on the way IN and read it back. None of them moved a
   * book afterwards, which is the only moment the carry does anything.
   */
  const book = { title: 'Dune', author: 'Frank Herbert' };
  const source = { kind: 'tweet' as const, url: 'https://x.com/a/status/1' };
  const shot = 'https://pbs.twimg.com/media/COVER';

  it('keeps the cover when the book moves pile', async () => {
    const lib = makeLibrary();
    await lib.add(book, 'someday', source, shot);
    // The move. `add()` again with a new intent and NOTHING else, which is exactly what
    // the shelf sends.
    const moved = await lib.add(book, 'now');

    expect(moved.moved, 'this was not treated as a move at all').toBe(true);
    expect(moved.shot, 'the cover was dropped on the way between piles').toBe(shot);
    expect(moved.source?.url, 'the post that sold you on it was dropped').toBe(source.url);
  });

  it('keeps them across a second move too, not just the first', async () => {
    const lib = makeLibrary();
    await lib.add(book, 'someday', source, shot);
    await lib.add(book, 'now');
    const again = await lib.add(book, 'read');

    expect(again.shot).toBe(shot);
    expect(again.source?.url).toBe(source.url);
  });

  it('still lets a NEW picture replace the old one', async () => {
    // The carry is a fallback, not a lock. Re-catching a book from a better photograph has
    // to be able to improve the record.
    const lib = makeLibrary();
    await lib.add(book, 'someday', source, shot);
    const recaught = await lib.add(book, 'someday', source, 'https://pbs.twimg.com/media/BETTER');

    expect(recaught.shot).toBe('https://pbs.twimg.com/media/BETTER');
  });

  it('leaves a book that never had a cover without one', async () => {
    const lib = makeLibrary();
    await lib.add(book, 'someday');
    const moved = await lib.add(book, 'now');
    expect(moved.shot).toBeUndefined();
  });
});

/**
 * ADV-6. `OPENWORK.md` item 47, and it is the same shape as the block above with one more
 * line missing.
 *
 * `add()` defended `source` and `shot` and took `book` WHOLESALE on the line above them, so
 * re-catching a book you already had replaced its record with whatever this reading knew.
 * That is worst exactly when it is most likely: when OpenLibrary is down the recogniser
 * correctly emits a bare guess with no ISBN and no cover, and saving it deleted both from
 * disk while the tray said "Moved · Dune → now".
 *
 * The tests above pass a book that never had an ISBN or a cover, so none of them could see
 * this. That is the same blind spot the block above records, one field to the left.
 */
describe('what survives re-catching a book you already have', () => {
  const rich = {
    title: 'Dune',
    author: 'Frank Herbert',
    isbn: '9780441013593',
    coverUrl: 'https://covers.openlibrary.org/b/id/1-M.jpg',
  };

  it('keeps the ISBN and the cover when the catalogue could not be asked', async () => {
    const lib = makeLibrary();
    await lib.add(rich, 'next');
    // The bare guess `recognizer.ts:94` emits when the catalogue answered nothing.
    const again = await lib.add({ title: 'Dune', author: 'Frank Herbert' }, 'now');

    expect(again.moved, 'this was not treated as a re-catch at all').toBe(true);
    expect(again.book.isbn, 'the ISBN was destroyed, so Buy falls back to a title search').toBe(
      rich.isbn,
    );
    expect(again.book.coverUrl, 'the cover was destroyed, so the shelf draws a board').toBe(
      rich.coverUrl,
    );
  });

  it('keeps them when the new reading carries the KEYS but with undefined in them', async () => {
    // The case a spread cannot fix, and the common one. `openLibrary.toBook` always writes
    // both keys, so a sparse-but-matching doc arrives as `{ isbn: undefined, coverUrl:
    // undefined }` and `{ ...previous.book, ...book }` overwrites with undefined.
    const lib = makeLibrary();
    await lib.add(rich, 'next');
    // `as Book` DELIBERATELY, and this is the finding rather than a workaround.
    // `exactOptionalPropertyTypes` now forbids WRITING this shape in TypeScript - which is
    // the whole point of the flag - and says NOTHING about the same shape arriving at
    // runtime from `JSON.parse`, from `chrome.storage.local`, or from any untyped caller.
    // So the runtime guard stays, and its test has to keep building the value production
    // code can no longer build. Item 53, TS-7.
    const again = await lib.add(
      { title: 'Dune', author: 'Frank Herbert', isbn: undefined, coverUrl: undefined } as unknown as Book,
      'now',
    );
    expect(again.book.isbn).toBe(rich.isbn);
    expect(again.book.coverUrl).toBe(rich.coverUrl);
  });

  it('TAKES the ISBN and cover when the new reading has them and the old did not', async () => {
    // The other direction, which is the whole reason somebody re-catches a book saved
    // during an outage. A merge that only ever kept the old value would be just as wrong.
    const lib = makeLibrary();
    await lib.add({ title: 'Dune', author: 'Frank Herbert' }, 'next');
    const again = await lib.add(rich, 'now');
    expect(again.book.isbn).toBe(rich.isbn);
    expect(again.book.coverUrl).toBe(rich.coverUrl);
  });

  it('stores a record with no key holding undefined', async () => {
    // Structured clone drops undefined values, so a record that emitted them would differ
    // from the one that comes back out of storage. Item 27's bug, in miniature.
    // The RE-catch, not the first save: a first save has no previous record, so `mergeBook`
    // returns the reading unchanged and the assertion would never reach the merged object.
    const lib = makeLibrary();
    await lib.add({ title: 'Dune', author: 'Frank Herbert' }, 'next');
    const saved = await lib.add({ title: 'Dune', author: 'Frank Herbert' }, 'now');
    expect(Object.keys(saved.book).sort()).toEqual(['author', 'title']);
  });
});
