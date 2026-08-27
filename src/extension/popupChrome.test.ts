import { describe, it, expect } from 'vitest';
import popup from '../../popup.html?raw';
import popupTs from './popup.ts?raw';

/**
 * Rules about popup.html that nothing else can check.
 *
 * These read the stylesheet as text, which is a weak kind of test and is deliberate: the
 * runner is node with no DOM, so there is no way to assert the computed style or the hit
 * test that would prove the real thing. What is here is the exact regression that shipped
 * a popup where NOTHING was clickable, written down so it cannot ship twice.
 *
 * The live check is `?demo&probe` on the dev server, which calls `elementFromPoint` on
 * every control and prints what is actually on top. Use it after touching the sheet.
 */

describe('the detail sheet', () => {
  it('gives up its layout when hidden, so a closed sheet has no size', () => {
    // `#sheet { display: grid }` is specificity (1,0,0) and the browser's own
    // `[hidden] { display: none }` is (0,1,0), so the id selector WINS and the hidden
    // attribute does nothing. The sheet stayed fixed and full-viewport at z-index 9 over
    // the whole popup, and every click on a pile tab hit the sheet instead.
    expect(popup).toContain('#sheet:not([hidden])');
    expect(popup).not.toMatch(/#sheet\s*\{[^}]*position:\s*fixed/);
  });

  it('also spells out the hidden case, so a future display rule cannot revive it', () => {
    expect(popup).toMatch(/#sheet\[hidden\]\s*\{\s*display:\s*none/);
  });

  it('is the only thing allowed to cover the whole popup', () => {
    // Any other full-bleed fixed layer would take the clicks the same way. #scrim is
    // inside the sheet and disappears with it, so it does not count.
    const fixedFullBleed = [...popup.matchAll(/([#.][\w-]+)[^{}]*\{[^}]*position:\s*fixed[^}]*\}/g)]
      .map((m) => m[1]);
    expect([...new Set(fixedFullBleed)].sort()).toEqual(['#scrim', '#sheet']);
  });
});

/**
 * THE COVER CACHE IS PRUNED INSIDE THE UNDO WINDOW. `OPENWORK.md` item 47, C-8.
 *
 * `coversToKeep` is tested directly. What no test can reach is `popup.ts`, which registers
 * listeners at module scope — and the bug was never in the decision, it was in WHERE the
 * decision was called from: `remove()` ran `removeBook`, then `refresh()` (which prunes),
 * and only then `offerUndo()`. So this is an ABSENCE proof of the shape
 * `contentSafety.test.ts` uses: there is no route to `pruneCovers` that skips the pending
 * book, and comments are stripped first so the paragraph explaining the rule cannot satisfy
 * it. See `optionsPage.test.ts` for why that stripping is not optional.
 */
const popupCode = popupTs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

describe('a removed book keeps its cover while the undo is on offer', () => {
  it('has NO call to pruneCovers that skips the pending book', () => {
    const calls = popupCode.match(/pruneCovers\(/g) ?? [];
    expect(calls, 'pruneCovers is not called at all any more').toHaveLength(1);
    expect(popupCode).toMatch(/pruneCovers\(coversToKeep\(shelf, undoable\), covers\)/);
  });

  it('records the pending book BEFORE the refresh that prunes', () => {
    // Order is the whole bug. `undoable = saved` after `await refresh()` would be a change
    // that looks right in review and fixes nothing at all.
    const set = popupCode.indexOf('undoable = saved');
    const removed = popupCode.indexOf("type: 'removeBook'");
    expect(set, 'nothing records the pending book').toBeGreaterThan(-1);
    expect(removed).toBeGreaterThan(-1);
    expect(set, 'the pending book is recorded after the book is removed').toBeLessThan(removed);
  });

  it('clears it when the offer ends, or the cache grows without bound', () => {
    expect(popupCode).toMatch(/function hideUndo\(\): void \{\s*undoable = undefined;/);
  });
});

/**
 * PERF-4. `OPENWORK.md` item 50. Five storage reads per keystroke, under a comment saying
 * there were none.
 *
 * `paint()` ran on every keystroke and every pile tab, and fired `renderStats` and
 * `renderPlan` with `void`. Between them those read the recognition log, the pro state, the
 * settings, the trial's spent count and its attempt count — and `void` on an async call from
 * a synchronous function means N keystrokes leave N renders in flight to land in whatever
 * order they finish. The comment beside the call said *"synchronous: no storage read, no
 * await, no render race"*, and all three clauses were false.
 *
 * Neither depends on the query or the pile. They belong in `refresh()`, which is the only
 * path where the shelf or the plan can have changed.
 */
describe('typing in the search box reads nothing from storage', () => {
  it('does not draw the count or the plan from paint()', () => {
    // ABSENCE, and it has to be scoped to the function rather than to the file: both calls
    // still exist, in `refresh()`, so "the file does not mention renderPlan" would be both
    // wrong and impossible to satisfy.
    const from = popupCode.indexOf('function paint(): void {');
    expect(from, 'paint() has been renamed; re-scope this guard').toBeGreaterThan(-1);
    const to = popupCode.indexOf('\nasync function refresh(', from);
    expect(to, 'refresh() no longer follows paint(); re-scope this guard').toBeGreaterThan(from);
    const body = popupCode.slice(from, to);
    expect(body).not.toContain('renderStats(');
    expect(body).not.toContain('renderPlan(');
  });

  it('draws them from refresh(), which is where the shelf actually changed', () => {
    // The other direction. Removing them from `paint()` and forgetting to put them back
    // leaves a popup whose masthead never fills in, and no other test would notice.
    const from = popupCode.indexOf('async function refresh(): Promise<void> {');
    expect(from).toBeGreaterThan(-1);
    const body = popupCode.slice(from, from + 400);
    expect(body).toContain('renderStats(shelf.length)');
    expect(body).toContain('renderPlan()');
  });
});
