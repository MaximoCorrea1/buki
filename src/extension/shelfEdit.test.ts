import { describe, it, expect, vi } from 'vitest';
import { restoreArgs } from './shelfEdit';
import { handleSaveBook } from './saveBook';
import type { SavedBook } from './storage';

/**
 * Taking a book OFF the shelf, and putting it back.
 *
 * Removal already existed on 2026-08-17 but only inside a book's detail sheet, so it cost
 * two clicks and a discovery: *"we should have some delete features, remove books from the
 * shelfs"*. Reaching it from the shelf itself makes it a one-click destructive action, and
 * a one-click destructive action needs an undo — which is the part with a bug in it, not
 * the delete.
 */

const saved = (over: Partial<SavedBook> = {}): SavedBook => ({
  id: 'sb_1',
  book: { title: 'Ficciones', author: 'Jorge Luis Borges', coverUrl: 'https://c/1.jpg' },
  intent: 'next',
  source: { url: 'https://x.com/p/1', kind: 'tweet' },
  shot: 'https://pbs.twimg.com/1.jpg',
  savedAt: 1_700_000_000_000,
  ...over,
});

describe('putting a removed book back', () => {
  it('returns it to the pile it was in, not to a default', () => {
    // The failure this exists to stop: undo silently re-files everything into Someday,
    // so undoing a mistake costs you the shelving you had already done.
    expect(restoreArgs(saved({ intent: 'now' })).intent).toBe('now');
    expect(restoreArgs(saved({ intent: 'read' })).intent).toBe('read');
  });

  it('keeps the post it was caught from', () => {
    expect(restoreArgs(saved()).source).toEqual({ url: 'https://x.com/p/1', kind: 'tweet' });
  });

  it('keeps the picture it was caught from, which may be its only cover', () => {
    // A book OpenLibrary holds no art for is drawn from `shot`. Losing it on undo turns
    // the book into a generated board — a different-looking book, silently.
    expect(restoreArgs(saved()).shot).toBe('https://pbs.twimg.com/1.jpg');
  });

  it('carries no id, because the shelf issues a new one on the way back in', () => {
    expect(restoreArgs(saved())).not.toHaveProperty('id');
  });

  it('names the id it is restoring, which is a different thing from carrying one', () => {
    // `id` would mean "this book's id" and would be a lie, because `add` issues a new one.
    // `restoreOf` means "this save undoes the removal of that id", which is the only way
    // the worker can tell an undo apart from a fresh save: the message is otherwise
    // identical. The test above still holds and the two are not in tension.
    expect(restoreArgs(saved({ id: 'sb_9' })).restoreOf).toBe('sb_9');
  });

  it('is actually used by the worker to put the recognition back', async () => {
    // THE POINT OF THE WHOLE THING: the whole loop, from the button's arguments to the
    // relink, with no source-text guard anywhere in it.
    //
    // This assertion used to read `expect(background).toContain('markRestored')`, because
    // `background.ts` registers chrome listeners at module scope and cannot be imported.
    // A reviewer mutated the source and proved what that could not see: it passed with the
    // relink wrapped in `if (false && ...)` and passed with the ARGUMENTS REVERSED, which
    // relinks every undo backwards, while all 533 tests stayed green. Both arguments are
    // strings, so TypeScript was silent too.
    //
    // The decision now lives in `handleSaveBook`, so it can be called for real. That the
    // worker dispatches through it is asserted on the import line in `saveBook.test.ts`,
    // where absence in an import is the one thing a `?raw` guard proves cleanly.
    //
    // The dated failure this all guards against still stands: on 2026-08-17 `needsRenewal`
    // was written, tested and left with NO CALLER, and a Pro session would have expired on
    // a paying subscriber with nothing red anywhere. Correct and tested is worth nothing
    // until something calls it.
    const markRestored = vi.fn(async () => {});
    const removed = saved({ id: 'sb_9' });

    const res = await handleSaveBook(
      { type: 'saveBook', ...restoreArgs(removed) },
      {
        add: async () => saved({ id: 'sb_new' }),
        rememberCover: () => {},
        markRestored,
      },
    );

    expect(res).toEqual({ ok: true, saved: saved({ id: 'sb_new' }) });
    // The id it HAD, then the id it has now. Reversed, every undo relinks backwards.
    expect(markRestored).toHaveBeenCalledWith('sb_9', 'sb_new');
  });

  it('omits what was never there rather than sending undefined', () => {
    // `add` writes the record it is handed. An explicit `shot: undefined` is a key with a
    // hole in it, and `identityOf` has to reason about the difference.
    // `as Book` DELIBERATELY, and this is the finding rather than a workaround.
    // `exactOptionalPropertyTypes` now forbids WRITING this shape in TypeScript - which is
    // the whole point of the flag - and says NOTHING about the same shape arriving at
    // runtime from `JSON.parse`, from `chrome.storage.local`, or from any untyped caller.
    // So the runtime guard stays, and its test has to keep building the value production
    // code can no longer build. Item 53, TS-7.
    const bare = restoreArgs(
      saved({ source: undefined, shot: undefined } as unknown as Partial<SavedBook>),
    );
    expect('source' in bare).toBe(false);
    expect('shot' in bare).toBe(false);
  });
});
