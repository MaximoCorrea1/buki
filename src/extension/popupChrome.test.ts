import { describe, it, expect } from 'vitest';
import popup from '../../popup.html?raw';

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
