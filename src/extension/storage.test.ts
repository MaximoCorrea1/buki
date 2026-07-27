import { describe, it, expect } from 'vitest';
import { createLibrary, type StorageArea } from './storage';

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

describe('createLibrary', () => {
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
});
