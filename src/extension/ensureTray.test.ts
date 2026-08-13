import { describe, it, expect } from 'vitest';
import { ensureTray, type TrayDeps } from './ensureTray';
import type { ContentRequest } from './messages';

/**
 * A tab, recorded. `answers` is what the tray on that tab says to a ping: an object when
 * one is listening, undefined when nothing is - which is exactly what `tellTab` hands
 * back, because it swallows "no receiving end" and returns undefined.
 */
function fakeTab(opts: { answers?: unknown; injectThrows?: Error } = {}) {
  const told: { tabId: number; msg: ContentRequest }[] = [];
  const injected: number[] = [];
  const deps: TrayDeps = {
    tell: async (tabId, msg) => {
      told.push({ tabId, msg });
      return opts.answers;
    },
    inject: async (tabId) => {
      injected.push(tabId);
      if (opts.injectThrows) throw opts.injectThrows;
    },
  };
  return { deps, told, injected };
}

/**
 * Run something expected to report a failure, and hand back what it reported.
 *
 * The report is the assertion: a swallowed error nobody ever sees is how a catch that
 * quietly does nothing becomes unexplainable, which this project has shipped three times.
 * Capturing it also keeps a deliberate failure out of the suite's own output, where a
 * stack trace under a passing test reads as something being broken.
 */
async function whileWatchingErrors<T>(run: () => Promise<T>): Promise<[T, unknown[][]]> {
  const reported: unknown[][] = [];
  const real = console.error;
  console.error = (...args: unknown[]) => void reported.push(args);
  try {
    return [await run(), reported];
  } finally {
    console.error = real;
  }
}

describe('ensureTray', () => {
  it('leaves a tab that already has a tray alone', async () => {
    // X carries a tray from the manifest. A second one would leave that tab with two
    // listeners answering the same messages, which is two cards for one catch.
    const tab = fakeTab({ answers: { ok: true } });
    expect(await ensureTray(7, tab.deps)).toBe(true);
    expect(tab.injected).toEqual([]);
  });

  it('probes with a ping before it injects anything', async () => {
    const tab = fakeTab({ answers: { ok: true } });
    await ensureTray(7, tab.deps);
    expect(tab.told).toEqual([{ tabId: 7, msg: { type: 'ping' } }]);
  });

  it('puts a tray on a tab that has none', async () => {
    const tab = fakeTab({ answers: undefined });
    expect(await ensureTray(7, tab.deps)).toBe(true);
    expect(tab.injected).toEqual([7]);
  });

  it('reports no tray on a page no extension may touch', async () => {
    // chrome:// and the Web Store are closed to every extension. The catch does not
    // start, because there would be nowhere for it to report to.
    const tab = fakeTab({ injectThrows: new Error('Cannot access contents of the page') });
    const [reached, reported] = await whileWatchingErrors(() => ensureTray(7, tab.deps));
    expect(reached).toBe(false);
    // And say so in the worker console. This is the only trace a developer gets of a
    // catch that could not start; item 6 adds the user's half.
    expect(reported).toHaveLength(1);
  });

  it('does nothing at all without a tab to put it on', async () => {
    const tab = fakeTab({ answers: { ok: true } });
    expect(await ensureTray(undefined, tab.deps)).toBe(false);
    expect(tab.told).toEqual([]);
    expect(tab.injected).toEqual([]);
  });
});
