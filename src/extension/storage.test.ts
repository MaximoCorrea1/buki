import { describe, it, expect } from 'vitest';
import { createLibrary, matchesFilter, identityOf, type StorageArea } from './storage';

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

function makeLibrary() {
  let clock = 1000;
  let seq = 0;
  const lib = createLibrary({
    storage: fakeStorage(),
    now: () => (clock += 1000),
    newId: () => `id-${++seq}`,
  });
  return lib;
}

describe('identityOf', () => {
  it('treats the same ISBN as the same book whatever it is called', () => {
    const a = identityOf({ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' });
    const b = identityOf({ title: 'DUNE (1965)', author: 'F. Herbert', isbn: '9780441013593' });

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
