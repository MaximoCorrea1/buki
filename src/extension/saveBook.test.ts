import { describe, it, expect, vi } from 'vitest';
import { handleSaveBook } from './saveBook';
import background from './background.ts?raw';
import type { SavedBook } from './storage';

/**
 * WHY THIS FILE EXISTS AT ALL.
 *
 * The worker's save path used to be guarded by `expect(background).toContain('markRestored')`
 * in `shelfEdit.test.ts`, because `background.ts` registers `chrome.contextMenus` and
 * `chrome.runtime` listeners at module scope and therefore cannot be imported by a test.
 *
 * A reviewer MUTATED the source and re-ran the suite. That guard passed with the whole
 * relink block wrapped in `if (false && msg.restoreOf)` — dead code — and it passed with
 * the arguments REVERSED, `markRestored(saved.id, msg.restoreOf)`, which relinks every
 * undo backwards and permanently loses the ability to score that catch. All 533 tests
 * stayed green both times.
 *
 * A `?raw` source-text guard proves two identifiers appear in a file. It cannot see control
 * flow, and it cannot see argument order — and argument order is exactly where this one
 * breaks, because both arguments are strings so TypeScript has nothing to say either.
 *
 * The fix is not a better string match. It is to extract the decision into a function that
 * takes its dependencies, in the `(request, env) => response` shape `src/server/` already
 * uses, and then to SPY on the call. That is what this file does.
 */

const book = {
  title: 'Ficciones',
  author: 'Jorge Luis Borges',
  coverUrl: 'https://covers/olid.jpg',
};

const saved = (over: Partial<SavedBook> = {}): SavedBook => ({
  id: 'sb_new',
  book,
  intent: 'next',
  source: { url: 'https://x.com/p/1', kind: 'tweet' },
  shot: 'https://pbs.twimg.com/1.jpg',
  savedAt: 1_700_000_000_000,
  ...over,
});

const deps = (over: Record<string, unknown> = {}) => ({
  add: vi.fn(async () => saved()),
  rememberCover: vi.fn(),
  markRestored: vi.fn(async () => {}),
  ...over,
});

describe('the worker saving a book', () => {
  it('hands the shelf what the message carried, and answers with what came back', async () => {
    const d = deps();
    const res = await handleSaveBook(
      {
        type: 'saveBook',
        book,
        intent: 'now',
        source: { url: 'https://x.com/p/1', kind: 'tweet' },
        shot: 'https://pbs.twimg.com/1.jpg',
      },
      d,
    );

    expect(d.add).toHaveBeenCalledWith(
      book,
      'now',
      { url: 'https://x.com/p/1', kind: 'tweet' },
      'https://pbs.twimg.com/1.jpg',
    );
    expect(res).toEqual({ ok: true, saved: saved() });
  });

  it('keeps BOTH covers: the catalogue art and the picture it was caught from', async () => {
    // The shelf draws the catalogue's art first as of 2026-08-16, and the picture is kept
    // anyway — it is what a book gets when OpenLibrary holds no art, and keeping the bytes
    // is what makes the shelf survive the post being deleted.
    const d = deps();
    await handleSaveBook({ type: 'saveBook', book, intent: 'next' }, d);

    expect(d.rememberCover.mock.calls.flat()).toEqual([
      'https://pbs.twimg.com/1.jpg', // saved.shot
      'https://covers/olid.jpg', // book.coverUrl
    ]);
  });

  /**
   * THE ASSERTION THE `?raw` GUARD COULD NOT MAKE, and the reason this module exists.
   *
   * `markRestored(previousId, savedId)`. Both are strings, so reversing them typechecks,
   * passes every source-text guard, and relinks every undo backwards: the event stops
   * naming the book that is now on the shelf, so a later genuine removal scores nothing and
   * that catch can never be graded again. A rate one too low is visible; an event that can
   * never be scored is not.
   */
  it('relinks the recognition to the NEW id, in that order', async () => {
    const d = deps();
    await handleSaveBook({ type: 'saveBook', book, intent: 'next', restoreOf: 'sb_9' }, d);

    expect(d.markRestored).toHaveBeenCalledWith('sb_9', 'sb_new');
  });

  it('does not relink a save that is not an undo', async () => {
    // `restoreOf` is the ONLY thing that tells an undo apart from a fresh save; the message
    // is otherwise identical. Relinking a fresh save would flip a flag on somebody else's
    // event.
    const d = deps();
    await handleSaveBook({ type: 'saveBook', book, intent: 'next' }, d);

    expect(d.markRestored).not.toHaveBeenCalled();
  });

  /**
   * CHAINED, not fire-and-forget, and the distinction cost a review to see.
   *
   * The popup holds its OWN read-only log instance and there is no
   * `chrome.storage.onChanged` listener anywhere, so a stale read after Undo does not
   * self-correct — it sits there until something unrelated refreshes. Answering before the
   * relink lands is what makes that stale read possible.
   */
  it('answers only after the relink has landed', async () => {
    const order: string[] = [];
    const d = deps({
      markRestored: vi.fn(async () => {
        await Promise.resolve();
        order.push('relinked');
      }),
    });

    await handleSaveBook({ type: 'saveBook', book, intent: 'next', restoreOf: 'sb_9' }, d);
    order.push('answered');

    expect(order).toEqual(['relinked', 'answered']);
  });

  it('still answers ok when the relink fails, because the shelf write already succeeded', async () => {
    // Registered as an accepted risk in OPENWORK.md §6: the failure is permanent and never
    // retried, and that is deliberate. A failed relink must not fail the undo the user can
    // see — the book IS back on the shelf.
    const d = deps({
      markRestored: vi.fn(async () => {
        throw new Error('storage full');
      }),
    });

    const res = await handleSaveBook(
      { type: 'saveBook', book, intent: 'next', restoreOf: 'sb_9' },
      d,
    );

    expect(res).toEqual({ ok: true, saved: saved() });
  });

  it('answers not-ok when the shelf write itself fails', async () => {
    const d = deps({
      add: vi.fn(async () => {
        throw new Error('quota exceeded');
      }),
    });

    const res = await handleSaveBook({ type: 'saveBook', book, intent: 'next' }, d);

    expect(res).toEqual({ ok: false, error: 'Error: quota exceeded' });
    expect(d.markRestored).not.toHaveBeenCalled();
  });

  it('does not relink when the shelf write fails, even on an undo', async () => {
    // There is no new id to relink TO. Calling `markRestored` here would point the event at
    // nothing and lose the link it still has.
    const d = deps({
      add: vi.fn(async () => {
        throw new Error('quota exceeded');
      }),
    });

    await handleSaveBook({ type: 'saveBook', book, intent: 'next', restoreOf: 'sb_9' }, d);

    expect(d.markRestored).not.toHaveBeenCalled();
  });
});

/**
 * THE WIRING, asserted on the IMPORT LINE rather than on the call.
 *
 * Absence in an import statement is the one thing a `?raw` guard proves cleanly: imports
 * have no branches, and prose in a comment cannot satisfy it. If the save logic ever moved
 * back inline, the worker would have to stop importing this handler, and that is what fails
 * here.
 */
describe('the worker dispatches through the handler', () => {
  it('imports handleSaveBook rather than deciding inline', () => {
    expect(background).toMatch(/import\s*\{[^}]*handleSaveBook[^}]*\}\s*from\s*'\.\/saveBook'/);
  });
});
