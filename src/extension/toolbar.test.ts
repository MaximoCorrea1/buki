import { describe, it, expect } from 'vitest';
import {
  sayStopped,
  RESTING_TITLE,
  STOPPED_MARK,
  STOPPED_MS,
  type ToolbarDeps,
} from './toolbar';

/**
 * The toolbar, recorded. `run` holds whatever was handed to `after`, so a test can decide
 * when the delay elapses instead of waiting six real seconds for it.
 */
function fakeToolbar() {
  const badge: { text: string; tabId?: number }[] = [];
  const grounds: { color: string; tabId?: number }[] = [];
  const stamps: { color: string; tabId?: number }[] = [];
  const titles: { title: string; tabId?: number }[] = [];
  let pending: { ms: number; run: () => void } | undefined;

  const deps: ToolbarDeps = {
    toolbar: {
      setBadgeText: async (v) => void badge.push(v),
      setBadgeBackgroundColor: async (v) => void grounds.push(v),
      setBadgeTextColor: async (v) => void stamps.push(v),
      setTitle: async (v) => void titles.push(v),
    },
    after: (ms, run) => {
      pending = { ms, run };
    },
  };
  return {
    deps,
    badge,
    grounds,
    stamps,
    titles,
    get pending() {
      return pending;
    },
    elapse: () => pending?.run(),
  };
}

describe('sayStopped', () => {
  it('marks the toolbar when a catch could not start', async () => {
    const bar = fakeToolbar();
    await sayStopped(7, 'Chrome closes this page to extensions.', bar.deps);
    expect(bar.badge).toEqual([{ text: STOPPED_MARK, tabId: 7 }]);
  });

  it('says WHY in the tooltip, because a mark on its own explains nothing', async () => {
    // brand.md: errors do not apologise and are never vague. A badge holds about four
    // characters, so the sentence lives in the one channel that can hold a sentence.
    const bar = fakeToolbar();
    await sayStopped(7, 'Chrome closes this page to extensions.', bar.deps);
    expect(bar.titles).toEqual([
      { title: 'Chrome closes this page to extensions.', tabId: 7 },
    ]);
  });

  it('draws a book board, not a bright cloth', async () => {
    // The pair is measured, not chosen: cream on the coral cloth is 3.09:1, and cream on
    // the oxblood binding is 14.2:1. brand.md keeps bindings for exactly this reason.
    const bar = fakeToolbar();
    await sayStopped(7, 'why', bar.deps);
    expect(bar.grounds).toEqual([{ color: '#4A1414', tabId: 7 }]);
    expect(bar.stamps).toEqual([{ color: '#FAF7F2', tabId: 7 }]);
  });

  it('takes the mark back off, so it does not outlive the catch', async () => {
    const bar = fakeToolbar();
    await sayStopped(7, 'why', bar.deps);
    expect(bar.pending?.ms).toBe(STOPPED_MS);

    bar.elapse();
    expect(bar.badge.at(-1)).toEqual({ text: '', tabId: 7 });
    expect(bar.titles.at(-1)).toEqual({ title: RESTING_TITLE, tabId: 7 });
  });

  it('scopes everything to the tab it happened on', async () => {
    // A tab-scoped mark dies with the tab. That is the backstop for an MV3 worker that
    // gets torn down before its own timer fires and never takes the mark off itself.
    const bar = fakeToolbar();
    await sayStopped(7, 'why', bar.deps);
    bar.elapse();
    const everyCall = [...bar.badge, ...bar.grounds, ...bar.stamps, ...bar.titles];
    expect(everyCall.every((c) => c.tabId === 7)).toBe(true);
  });

  it('still says something when there is no tab to scope it to', async () => {
    // `tab?.id` can be undefined on a context-menu click. A toolbar-wide mark is worse
    // than a scoped one and far better than the silence this replaces.
    const bar = fakeToolbar();
    await sayStopped(undefined, 'why', bar.deps);
    expect(bar.badge).toEqual([{ text: STOPPED_MARK }]);
    expect(bar.titles).toEqual([{ title: 'why' }]);
  });
});
