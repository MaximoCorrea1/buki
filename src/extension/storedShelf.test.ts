import { describe, it, expect } from 'vitest';
import { readShelf } from './storedShelf';

/**
 * TS-2. `OPENWORK.md` item 53.
 *
 *     return Array.isArray(raw) ? (raw as SavedBook[]) : [];
 *
 * **`Array.isArray` is the only check, and a cast checks nothing at runtime.** So whatever
 * `chrome.storage.local` holds becomes the shelf — and that store is user-editable, shared
 * with every other key the extension owns, and survives across versions of a schema that has
 * changed four times.
 *
 * **The harm the review named is not a crash.** A corrupt `intent` exports the literal string
 * `undefined` into Goodreads' *Exclusive Shelf* column — a file the reader then imports into
 * an account they keep. The bad value leaves the product.
 *
 * **DROPPED, NOT THROWN, and that is the load-bearing decision.** A reader whose storage has
 * one damaged row should lose that row, not the shelf. Refusing to parse would turn one bad
 * record into "you have no books", which is the worse failure by a wide margin — the same
 * direction `keyCap`'s eviction takes, and for the same reason.
 */

const good = {
  id: 'a1',
  book: { title: 'Dune', author: 'Frank Herbert' },
  intent: 'now',
  savedAt: 1,
};

describe('reading the shelf out of storage', () => {
  it('keeps a well-formed record', () => {
    expect(readShelf([good])).toEqual([good]);
  });

  it('keeps the optional fields when they are the right shape', () => {
    const full = {
      ...good,
      book: { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593', coverUrl: 'https://c/d.jpg' },
      source: { url: 'https://x.com/a/status/1', kind: 'tweet' },
      shot: 'https://pbs.twimg.com/media/a.jpg',
      moved: true,
    };
    expect(readShelf([full])).toEqual([full]);
  });

  it('answers an empty shelf for anything that is not an array', () => {
    for (const raw of [null, undefined, {}, 'books', 42, true]) {
      expect(readShelf(raw), String(raw)).toEqual([]);
    }
  });

  /** THE FINDING. Every one of these used to reach the shelf, and Goodreads. */
  it('drops a record whose intent is not a real pile', () => {
    for (const intent of [undefined, null, '', 'later', 42, {}]) {
      expect(readShelf([{ ...good, intent }]), String(intent)).toEqual([]);
    }
  });

  it('drops a record with no usable title or author', () => {
    for (const book of [
      undefined,
      null,
      'Dune',
      {},
      { title: 'Dune' },
      { author: 'Frank Herbert' },
      { title: '', author: 'Frank Herbert' },
      { title: 42, author: 'Frank Herbert' },
      { title: 'Dune', author: 42 },
    ]) {
      expect(readShelf([{ ...good, book }]), JSON.stringify(book)).toEqual([]);
    }
  });

  it('drops a record with no id or no timestamp', () => {
    expect(readShelf([{ ...good, id: undefined }])).toEqual([]);
    expect(readShelf([{ ...good, id: '' }])).toEqual([]);
    expect(readShelf([{ ...good, savedAt: 'yesterday' }])).toEqual([]);
    expect(readShelf([{ ...good, savedAt: Number.NaN }])).toEqual([]);
  });

  it('drops ONE bad record and keeps the rest, rather than losing the shelf', () => {
    // The decision that matters. A reader with one damaged row loses that row; refusing to
    // parse would turn one bad record into "you have no books", and a shelf is the product.
    const shelf = readShelf([good, { ...good, id: 'a2', intent: 'nonsense' }, { ...good, id: 'a3' }]);

    expect(shelf.map((s) => s.id)).toEqual(['a1', 'a3']);
  });

  it('strips a field that is the wrong shape instead of dropping the whole book', () => {
    // `isbn`, `coverUrl`, `source`, `shot` and `moved` are all optional. A junk value in one
    // of them is not a reason to lose a book the reader saved - it is a reason to forget
    // that one field.
    const [kept] = readShelf([
      { ...good, book: { ...good.book, isbn: 42, coverUrl: {} }, source: 'not an object', shot: 7, moved: 'yes' },
    ]);

    expect(kept?.book.title).toBe('Dune');
    expect(kept).not.toHaveProperty('shot');
    expect(kept).not.toHaveProperty('source');
    expect(kept?.book).not.toHaveProperty('isbn');
    expect(kept?.book).not.toHaveProperty('coverUrl');
  });

  it('OMITS optional fields rather than writing them as undefined', () => {
    // `exactOptionalPropertyTypes` is on (TS-7), and this is the runtime half of the same
    // rule: a key present and holding undefined is not the same as an absent key, and
    // `identityOf` has to reason about the difference.
    const [kept] = readShelf([good]);

    expect('shot' in (kept ?? {})).toBe(false);
    expect('source' in (kept ?? {})).toBe(false);
    expect('isbn' in (kept?.book ?? {})).toBe(false);
  });

  it('refuses a source whose url is not http, so a stored javascript: cannot come back', () => {
    // TM-10 stopped these being WRITTEN. This stops one already on disk being READ - a
    // shelf saved before that fix can still hold one.
    const [kept] = readShelf([
      { ...good, source: { url: 'javascript:alert(1)', kind: 'tweet' } },
    ]);

    expect(kept).not.toHaveProperty('source');
  });

  it('refuses a source whose kind is invented', () => {
    const [kept] = readShelf([
      { ...good, source: { url: 'https://x.com/a/status/1', kind: 'evil' } },
    ]);

    expect(kept).not.toHaveProperty('source');
  });
});
