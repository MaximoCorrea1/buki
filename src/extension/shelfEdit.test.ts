import { describe, it, expect } from 'vitest';
import { restoreArgs } from './shelfEdit';
import background from './background.ts?raw';
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

  it('is actually used by the worker to put the recognition back', () => {
    // THE POINT OF THE WHOLE THING, and the link no unit test can reach: `background.ts`
    // registers chrome listeners at module scope, so importing it throws before any test
    // runs. Read as source instead, the way contentChrome.test.ts reads the tray's CSS.
    //
    // This guard exists because of a dated failure. On 2026-08-17 `needsRenewal` was
    // written, tested and left with NO CALLER, and a Pro session would have expired on a
    // paying subscriber with nothing red anywhere. `markRestored` is the same shape of
    // thing: correct, tested, and worth nothing until the worker calls it.
    expect(background).toContain('markRestored');
    expect(background).toContain('restoreOf');
  });

  it('omits what was never there rather than sending undefined', () => {
    // `add` writes the record it is handed. An explicit `shot: undefined` is a key with a
    // hole in it, and `identityOf` has to reason about the difference.
    const bare = restoreArgs(saved({ source: undefined, shot: undefined }));
    expect('source' in bare).toBe(false);
    expect('shot' in bare).toBe(false);
  });
});
