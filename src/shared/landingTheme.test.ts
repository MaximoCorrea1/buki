import { describe, it, expect } from 'vitest';
import landing from '../../docs/index.html?raw';

/**
 * The light/dark switch must not be wired inside the motion script.
 *
 * It was, and the consequence was total: `docs/index.html` runs one IIFE that opens with
 *
 *   var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 *   if (still || !("IntersectionObserver" in window)) return;
 *
 * and then, forty lines later, attaches the theme button's click handler. So for any
 * reader who has reduced motion turned on — an accessibility setting, not an exotic one —
 * the button rendered, focused, and did nothing at all. Measured 2026-08-15 by forcing the
 * query true and clicking it: `data-theme` stayed `dark` and the body stayed `#080d20`.
 *
 * Maximo reported it as "there's no light mode", which is exactly what it is.
 *
 * The bug is a COUPLING bug rather than a logic one: nothing about choosing a colour scheme
 * depends on whether the reader wants animation, and the two only shared a function because
 * they shared a `<script>`. So the test asserts the structure, not the behaviour — a runner
 * with no DOM cannot click a button, but it can insist the wiring is not behind the guard.
 */

/** Every top-level `(function () { … })();` in the page, in source order. */
function iifes(): string[] {
  const out: string[] = [];
  const OPEN = '(function () {';
  let from = 0;
  for (;;) {
    const start = landing.indexOf(OPEN, from);
    if (start === -1) return out;
    let depth = 0;
    let i = landing.indexOf('{', start);
    const bodyStart = i;
    for (; i < landing.length; i++) {
      if (landing[i] === '{') depth++;
      else if (landing[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push(landing.slice(bodyStart, i + 1));
    from = i + 1;
  }
}

const REDUCED = 'prefers-reduced-motion';
const THEME_WIRING = 'buki-theme';

describe('the light/dark switch', () => {
  it('is not inside a script that returns early for reduced motion', () => {
    const blocks = iifes();
    // Guard the vacuous pass: a restructured page that parsed to nothing would report clean.
    expect(blocks.length).toBeGreaterThan(1);

    const guarded = blocks.filter(
      (b) => b.includes(REDUCED) && /\breturn\b/.test(b) && b.includes(THEME_WIRING),
    );
    expect(guarded).toEqual([]);
  });

  it('still has both a reduced-motion guard and a theme switch to keep apart', () => {
    // Without this, deleting either one satisfies the check above for the wrong reason.
    expect(landing).toContain(REDUCED);
    expect(landing).toContain(THEME_WIRING);
    expect(landing).toContain('id="theme"');
  });
});
