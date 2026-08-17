import { describe, it, expect } from 'vitest';
import popup from '../../popup.html?raw';
import options from '../../options.html?raw';

/**
 * The extension's page chrome must take its colours from tokens, never from literals.
 *
 * `landingTokens.test.ts` is the same guard for `docs/index.html`, and it exists because
 * that page shipped the trap three separate times. This file is the extension's copy, and
 * it was written the moment the popup and the setup page gained a second mood, because a
 * literal is only a latent bug until a token moves underneath it.
 *
 * The landing's three, all of them dark-mode-only and all of them invisible in daylight:
 *
 *   rgba(255, 255, 255, 0.4)   a 40% white veil. Nothing over cream; over navy it
 *                              composited to a mid-grey slab at 2.93:1.
 *   var(--navy) on the page    1.04:1. The emphasised card had no edge at all.
 *   #fff on var(--blue)        10.34:1 by day, 2.70:1 by night, because the token flipped
 *                              and the literal did not.
 *
 * `OPENWORK.md` §5 states the general case: a retokening that changes a colour's LIGHTNESS
 * invalidates every hardcoded value sitting on it. A grep cannot express the exceptions,
 * which is why this is a test.
 *
 * SHADOWS ARE CHECKED HERE AND ARE NOT ON THE LANDING'S LIST, deliberately. `docs/brand.md`
 * records that the landing's shadows were navy at every depth, which is a shadow that does
 * nothing on a navy page. A popup that gains a night mood inherits that problem exactly.
 */

/**
 * Selectors whose colours are deliberately literal, with the reason each is exempt.
 *
 * All of them draw a BOOK rather than a surface of the page. A binding is a dye, and
 * `docs/brand.md` is explicit that a book keeps its cloth in any light: the five dyes, the
 * two inks stamped on them and the cords are identical in both moods and must not respond
 * to one. This is the same carve-out `landingTokens.test.ts` makes for `.cover`.
 *
 * The cloth is the one place white-at-an-alpha is allowed, and the reason is in brand.md:
 * over ONE solid binding it resolves to one solid value, so it is texture rather than the
 * blend the flat rule forbids.
 */
const LITERAL_BY_DESIGN = [
  // popup.html: a generated cover is the book, not the panel
  '.cloth',
  // options.html: the spine and its two stamped cords on the "why this is needed" card
  '.why::before',
  '.why::after',
];

const SURFACES: Record<string, string> = {
  'popup.html': popup,
  'options.html': options,
};

/** Declarations that carry a colour. `border` and `box-shadow` do; `font` does not. */
const COLOURED = /^(color|background|background-color|border|border-color|box-shadow|outline)$/;

const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/;

/** The stylesheet, with comments and the token definitions themselves removed. */
function chromeRules(body: string): { selector: string; body: string }[] {
  const style = body.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const withoutComments = style.replace(/\/\*[\s\S]*?\*\//g, '');

  const rules: { selector: string; body: string }[] = [];
  for (const m of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (m[1] ?? '').trim().replace(/\s+/g, ' ');
    const declarations = m[2] ?? '';
    // `:root` is where tokens are DEFINED. A literal is the entire point there.
    if (/^:root/.test(selector) || selector.startsWith('@')) continue;
    if (LITERAL_BY_DESIGN.some((s) => selector.includes(s))) continue;
    rules.push({ selector, body: declarations });
  }
  return rules;
}

describe('the extension takes its colours from tokens', () => {
  for (const [name, body] of Object.entries(SURFACES)) {
    it(`${name} has no literal colour on page chrome`, () => {
      const rules = chromeRules(body);
      // Guard the vacuous pass: a restructured stylesheet that matched nothing would
      // report clean, which is the exact failure this file exists to catch.
      expect(rules.length).toBeGreaterThan(15);

      const offenders: string[] = [];
      for (const { selector, body: decls } of rules) {
        for (const decl of decls.split(';')) {
          const [rawProp, ...rest] = decl.split(':');
          const prop = (rawProp ?? '').trim();
          const value = rest.join(':');
          if (!COLOURED.test(prop)) continue;
          if (LITERAL.test(value)) offenders.push(`${selector} { ${prop}:${value.trim()} }`);
        }
      }

      expect(offenders).toEqual([]);
    });
  }

  /**
   * A book keeps its cloth in any light. `docs/brand.md` is explicit that the dyes and the
   * two inks stamped on them are identical in both moods and never respond to one, so
   * these are the only colour tokens allowed a single value.
   */
  const MOOD_INVARIANT = new Set([
    // the two inks stamped on a binding
    '--stamp',
    '--stamp-dim',
    // a binding dye itself, on the setup page's "why this is needed" card. It costs the
    // spine contrast at night, and the two white cords across it carry it. That is
    // precisely why brand.md says a cord is white rather than gilt.
    '--forest',
    // The caught spine, and this one is EARNED rather than exempted. It must separate from
    // its NEIGHBOURS, and the neighbours used to invert between moods (navy on cream, then
    // cream on navy), so the value had to invert with them. Against the iOS neutrals it
    // does not: #2f7fd6 measures 4.60:1 against the day spine and 4.10:1 against the night
    // one, clearing the bar from both sides. mark.test.ts checks this line against
    // tools/mark.mjs for BOTH extension grounds, so a single value here is asserted twice
    // rather than merely permitted.
    '--mark-caught',
  ]);

  for (const [name, body] of Object.entries(SURFACES)) {
    it(`${name} declares both moods from one declaration`, () => {
      const style = body.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
      const withoutComments = style.replace(/\/\*[\s\S]*?\*\//g, '');
      const root = withoutComments.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? '';
      expect(root, `${name}: no :root block found`).not.toBe('');

      // light-dark() is inert unless the element opts into both schemes.
      expect(root, `${name}: light-dark() needs color-scheme: light dark`).toMatch(
        /color-scheme:\s*light dark/,
      );

      // AND the switch has to be able to narrow it, which is a separate thing and was
      // missed. Measured 2026-08-16 with a synchronous probe in the popup harness:
      // data-theme=light, stored=light, and body background rgb(8, 13, 32) — the NIGHT
      // value. `color-scheme: light dark` alone means light-dark() follows the OPERATING
      // SYSTEM and nothing else, so data-theme was an attribute nobody read and the
      // button changed it and did nothing. That is the landing's dead theme button in a
      // different costume, and the first version of this test could not see it because it
      // asserted the mechanism was AVAILABLE, never that it was WIRED.
      for (const mood of ['light', 'dark']) {
        expect(
          withoutComments.replace(/\s+/g, ' '),
          `${name}: [data-theme="${mood}"] must narrow color-scheme, or the switch is inert`,
        ).toContain(`:root[data-theme="${mood}"] { color-scheme: ${mood}; }`);
      }

      // A second palette under a media query is the duplication light-dark() replaced, and
      // this repo's recorded failure mode is that the copies drifted. The landing carries
      // none and neither may these.
      expect(
        withoutComments,
        `${name}: a duplicated dark palette is what light-dark() exists to prevent`,
      ).not.toMatch(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/);

      const single: string[] = [];
      for (const decl of root.split(';')) {
        const [rawProp, ...rest] = decl.split(':');
        const prop = (rawProp ?? '').trim();
        const value = rest.join(':').trim();
        if (!prop.startsWith('--') || MOOD_INVARIANT.has(prop)) continue;
        if (!LITERAL.test(value)) continue; // not a colour: radii, easings, the type stack
        if (!/light-dark\(/.test(value)) single.push(`${prop}: ${value}`);
      }
      expect(single).toEqual([]);
    });
  }

  /**
   * THE WINDOW'S RADIUS HAS TO BE ON SOMETHING THAT CAN ACTUALLY CLIP.
   *
   * `html` declares no background, so per CSS Backgrounds §2.11.2 the `body`'s background
   * PROPAGATES TO THE CANVAS - and a canvas background is painted across the whole canvas
   * and is not clipped by anybody's `border-radius`. The body's own background is then not
   * painted at all. So a rounded `html` plus a rounded, painted `body` produces two live
   * declarations and square corners, which is exactly what shipped.
   *
   * Measured 2026-08-16 as a corner PIXEL rather than argued, headless over a transparent
   * backdrop so alpha answers outright:
   *
   *   html + body rounded, body painted   rgba(0,0,0,255) at (2,2)   square
   *   root transparent, wrapper painted   rgba(0,0,0,0)   at (2,2)   round
   *
   * Neither the root NOR the body may carry the paint, because a transparent root
   * propagates from the body in turn. It has to be a third element inside.
   */
  const ROOTS = new Set(['html', 'body', 'html, body', 'body, html']);
  const PAINTS = /(^|;)\s*background(-color)?\s*:/;

  /**
   * THE POPUP WINDOW CANNOT BE ROUNDED, AND TRYING MADE IT WORSE. Settled 2026-08-17.
   *
   * The CSS half of this was established the day before and is still true: a background on
   * `html` or `body` propagates to the CANVAS, and a canvas background is painted across
   * the whole canvas and is not clipped by any `border-radius`. Moving the paint to an
   * inner `.win` and leaving the canvas transparent did genuinely produce a rounded panel —
   * measured as a corner pixel, `rgba(0,0,0,0)` where it had been `rgba(0,0,0,255)`.
   *
   * What that measurement could not see is what Chrome paints BEHIND the document, because
   * `--load-extension` is refused here and no harness renders in a popup bubble. Maximo
   * looked, in the real browser: *"it still has an outside container with sharp
   * coorners"*. Chrome's extension popup on Windows is a square native window that paints
   * its own opaque background, and no API rounds it. So a transparent canvas does not
   * reveal a rounded window — it reveals CHROME'S square one, with our rounded panel inset
   * inside it and a visible frame between the two.
   *
   * The honest answer is one uniform surface with no seam, and the roundness lives inside:
   * the segmented control, the search field, the cards and the sheet are all rounded, which
   * is what iOS actually looks like inside a square screen. **So the popup MUST paint from
   * the root**, and nothing may carry a window radius.
   */
  it('popup.html paints its window edge to edge, with no inset panel to show a seam', () => {
    const rules = chromeRules(popup);
    expect(rules.length).toBeGreaterThan(15);

    const painted = rules.filter(({ selector, body }) => ROOTS.has(selector) && PAINTS.test(body));
    expect(
      painted.length,
      'nothing paints the canvas, so Chrome\'s own square bubble shows through',
    ).toBeGreaterThan(0);
  });

  for (const [name, body] of Object.entries(SURFACES)) {
    it(`${name} claims no window radius, because neither surface can have one`, () => {
      // The popup's window is Chrome's and is square; options.html is a full browser tab
      // and has no window of its own at all. A `--r-win` reappearing in either is a
      // rounded panel inset in a square one, which is the seam this is here to prevent.
      expect(body).not.toMatch(/--r-win|border-radius:\s*var\(--r-win\)/);
    });
  }

  it('exempts only the surfaces that draw a book rather than the panel', () => {
    // If a name in the allowlist stops existing, the exemption is silently protecting
    // nothing, and the next literal to appear under that name goes unnoticed.
    const all = Object.values(SURFACES).join('\n');
    for (const selector of LITERAL_BY_DESIGN) {
      expect(all).toContain(selector);
    }
  });
});
