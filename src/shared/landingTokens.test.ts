import { describe, it, expect } from 'vitest';
import landing from '../../docs/index.html?raw';

/**
 * The landing's page chrome must take its colours from tokens, never from literals.
 *
 * This is the retokening trap in `docs/brand.md`, and it has now cost real defects twice.
 *
 * The first time, dark mode found thirteen hardcoded `rgba(251, 247, 236, …)` — the cream
 * at an alpha. None of them named `--paper`, so relighting `--paper` did not touch one of
 * them, and every one would have survived into dark mode as a cream bar across a navy page.
 *
 * The second time, on 2026-08-15, three more had survived that sweep because they were not
 * cream and so did not match the grep that found the first thirteen:
 *
 *   .plan  background: rgba(255, 255, 255, 0.4)
 *     A 40% WHITE veil. Over the light paper it is invisible; over the dark paper it
 *     composites to #6b6e79, a mid-grey slab. Measured: body text at 2.93:1 and the price
 *     at 4.43:1, both failing, on a page whose every other pair is AAA. It also inverted
 *     the pricing hierarchy, because the loudest card was the one nobody is meant to take.
 *
 *   .flag  color: #fff  (on background: var(--blue))
 *     `--blue` is #1231a8 by day and #7f9bea by night. White on the first is 10.34:1; on
 *     the second it is 2.70:1. The literal did not change when the token under it did,
 *     which is the trap `OPENWORK.md` §5 states in the general case: a retokening that
 *     changes an accent's LIGHTNESS invalidates every hardcoded colour sitting on it.
 *
 * A grep cannot express the exception, which is why this is a test rather than a note. Two
 * families of literal are correct here and are allowed by name below.
 */

/**
 * Selectors whose colours are deliberately literal, with the reason each is exempt.
 *
 * The three step mockups depict the EXTENSION'S OWN light surface — `#faf7f2` is the paper
 * of the real product, and Chrome's context menu is Chrome's, not ours. `OPENWORK.md`
 * item 8 records the decision not to darken them: dimming a screenshot to suit the page
 * would misrepresent what the reader is being shown, the same way the real book covers on
 * the shelf are photographs and do not invert.
 *
 * The generated covers carry `generatedCover.ts`'s five binding dyes unchanged, because a
 * board drawn on this page has to be the board the extension draws for the same book.
 */
const LITERAL_BY_DESIGN = [
  // the step mockups: a picture of the product, not a surface of the page
  '.frame',
  '.shot',
  '.menu',
  '.card-hd',
  '.found',
  '.evidence',
  '.piles',
  '.mini-shelf',
  '.board-line',
  '.shelf-stat',
  // the generated covers: the extension's own dyes
  '.cover',
  '.cloth',
  '.rules',
];

/** The stylesheet, with comments and the token definitions themselves removed. */
function pageChromeRules(): { selector: string; body: string }[] {
  const style = landing.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const withoutComments = style.replace(/\/\*[\s\S]*?\*\//g, '');

  const rules: { selector: string; body: string }[] = [];
  for (const m of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (m[1] ?? '').trim().replace(/\s+/g, ' ');
    const body = m[2] ?? '';
    // `:root` and `[data-theme]` are where tokens are DEFINED. Literals are the point there.
    if (/^:root/.test(selector) || selector.startsWith('@')) continue;
    if (LITERAL_BY_DESIGN.some((s) => selector.includes(s))) continue;
    rules.push({ selector, body });
  }
  return rules;
}

const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/;

describe('the landing takes its colours from tokens', () => {
  it('has no literal colour on a page-chrome background, text or border', () => {
    const rules = pageChromeRules();
    // Guard the vacuous pass: a restructured stylesheet that matched nothing would
    // otherwise report clean, which is the failure mode this whole file exists to catch.
    expect(rules.length).toBeGreaterThan(40);

    const offenders: string[] = [];
    for (const { selector, body } of rules) {
      for (const decl of body.split(';')) {
        const [rawProp, ...rest] = decl.split(':');
        const prop = (rawProp ?? '').trim();
        const value = rest.join(':');
        if (!/^(color|background|background-color|border-color)$/.test(prop)) continue;
        if (LITERAL.test(value)) offenders.push(`${selector} { ${prop}:${value.trim()} }`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('exempts only the surfaces that depict the product rather than the page', () => {
    // If a name in the allowlist stops existing, the exemption is silently protecting
    // nothing and the next literal to appear under that name goes unnoticed.
    for (const selector of LITERAL_BY_DESIGN) {
      expect(landing).toContain(`${selector} `);
    }
  });
});
