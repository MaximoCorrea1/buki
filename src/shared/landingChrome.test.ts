import { describe, it, expect } from 'vitest';
import landing from '../../docs/index.html?raw';

/**
 * Rules about `docs/index.html` that nothing else can check.
 *
 * Same technique and same weakness as `popupChrome.test.ts`: this reads the stylesheet as
 * text, because the runner has no browser and cannot resolve a cascade or measure a
 * computed colour. What is here is a regression that shipped, written down so it cannot
 * ship twice.
 */

describe('the masthead call to action', () => {
  it('is not recoloured by the nav link rule sitting above it', () => {
    // `.top nav a` is specificity (0,1,2) and `.btn` is (0,1,0), so the NAV rule wins and
    // the page's primary call to action rendered var(--ink-2) on var(--ink): 2.11:1.
    // Worse on hover, where `.btn:hover` sets the background to var(--blue) while
    // `.top nav a:hover` (0,2,2) sets the TEXT to var(--blue) as well. Measured 1.00:1.
    // The label was not merely hard to read, it was gone.
    //
    // Exactly the trap `popup.html` hit when `#sheet` at (1,0,0) beat `[hidden]` at
    // (0,1,0), and it takes exactly the same answer: exclude the case with `:not()`
    // rather than escalating specificity on the other side.
    const colouringRules = [...landing.matchAll(/\.top\s+nav\s+a([^,{]*)\{([^}]*)\}/g)]
      .filter((m) => /(^|[;\s])color\s*:/.test(m[2] ?? ''))
      .map((m) => (m[1] ?? '').trim());

    // Guard the vacuous pass: a renamed masthead would match nothing and report clean.
    expect(colouringRules.length).toBeGreaterThan(0);
    for (const qualifier of colouringRules) {
      expect(qualifier).toContain(':not(.btn)');
    }
  });
});
