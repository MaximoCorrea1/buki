import { describe, it, expect } from 'vitest';
import content from './content.ts?raw';

/**
 * Rules about the catch tray that only hold because it renders inside SOMEBODY ELSE'S
 * page.
 *
 * Every other Buki surface chooses its own background. The tray is handed one: X in
 * daylight, X at night, Reddit, a newsletter, a black photo essay, a white documentation
 * site. `OPENWORK.md` item 21 held this surface back through two design generations for
 * exactly that reason, and said not to retheme it by copying tokens across without
 * solving it first.
 *
 * The solution is that the card owns its own ground and does not borrow the host's. That
 * is the same argument `icons/icon.svg` makes for its cream plate: where the ground is not
 * ours, we bring one.
 *
 * The stylesheet is read as text because there is no browser here. What is asserted is
 * what an eye cannot check on one page: an invariant that holds against every page.
 */

const STYLE = content.slice(content.indexOf('const STYLE = `'), content.indexOf('\n`;\n'));

/** Rules in the injected stylesheet, as { selector, body }. */
function rules(): { selector: string; body: string }[] {
  const withoutComments = STYLE.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: { selector: string; body: string }[] = [];
  for (const m of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (m[1] ?? '').trim().replace(/\s+/g, ' ');
    if (selector.startsWith('@') || !selector.includes('buki')) continue;
    out.push({ selector, body: m[2] ?? '' });
  }
  return out;
}

/** Anything that lets the page underneath show through a surface we are drawing on. */
const SEE_THROUGH =
  /\b(?:rgba|hsla)\([^)]*,\s*0?\.\d+\s*\)|\btransparent\b|\bcolor-mix\(|\bbackdrop-filter\b/;

/**
 * Surfaces the reader reads text off. These are the ones that must be opaque.
 *
 * `.buki-card` is the one that matters and the one that can never move: it is what the
 * HOST page is behind. The rest sit on the card, so their ground is ours and a translucent
 * fill on them composites to a value we can compute — which is exactly what the tray's
 * control fill does as of 2026-08-17, at a measured #39393d.
 */
const GROUNDS = ['.buki-card', '.buki-intent', '.buki-act', '.buki-shelf', '.buki-thumb'];

/**
 * Tokens declared on `.buki-tray`, so a see-through value cannot hide behind a `var()`.
 *
 * IT COULD, until this existed. The check below reads declaration VALUES, so
 * `background: var(--fill)` looked opaque while `--fill` was `rgba(120,120,128,.32)` —
 * the guard was walked straight through on the day the fill was introduced, by the person
 * who wrote the guard. A rule that only inspects the surface syntax is not checking the
 * colour.
 */
function tokens(): Record<string, string> {
  const block = STYLE.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.buki-tray\s*\{([^{}]*)\}/)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const decl of block.split(';')) {
    const [name, ...rest] = decl.split(':');
    const key = (name ?? '').trim();
    if (key.startsWith('--')) out[key] = rest.join(':').trim();
  }
  return out;
}

/** A declaration value with its `var(--x)` references resolved one level. */
function resolved(value: string): string {
  const table = tokens();
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (whole, name: string) => table[name] ?? whole);
}

describe('the catch tray, which lives on a page we do not control', () => {
  it('reads a real stylesheet rather than passing on a slice that matched nothing', () => {
    expect(STYLE).toContain('.buki-card');
    expect(rules().length).toBeGreaterThan(15);
  });

  it('never lets the host page show through the card, whatever the value hides behind', () => {
    // A translucent CARD is a card whose contrast is decided by whatever is behind it. On
    // the landing that is a measured choice, because the page owns the backdrop. Here the
    // backdrop might be a photograph.
    //
    // Values are resolved through the tray's own tokens first, because they were not, and
    // `background: var(--fill)` sailed past this on the day `--fill` became an rgba.
    const leaks: string[] = [];
    for (const { selector, body } of rules()) {
      if (!GROUNDS.some((g) => selector.includes(g))) continue;
      const onTheCard = /\.buki-card(?![\w-])/.test(selector);
      for (const decl of body.split(';')) {
        const [rawProp, ...rest] = decl.split(':');
        const prop = (rawProp ?? '').trim();
        if (!/^(background|background-color)$/.test(prop)) continue;
        const value = resolved(rest.join(':'));

        // On the CARD itself nothing see-through is allowed, `transparent` included: the
        // host page is directly behind it.
        if (onTheCard) {
          if (SEE_THROUGH.test(value)) leaks.push(`${selector} { ${prop}:${value.trim()} }`);
          continue;
        }
        // A control sits ON the card, so its ground is ours and an alpha composites to a
        // value we can compute. What is still forbidden is a BLUR, which samples whatever
        // the browser has behind the whole stack.
        if (/\bbackdrop-filter\b|\bcolor-mix\(/.test(value)) {
          leaks.push(`${selector} { ${prop}:${value.trim()} }`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it('can actually see a see-through value that hides behind a token', () => {
    // Proves the resolver discriminates rather than passing everything. Without this the
    // rule above is a guard nobody has watched catch anything, which is the state it was
    // in for exactly one day.
    expect(SEE_THROUGH.test(resolved('var(--fill)'))).toBe(true);
    expect(SEE_THROUGH.test(resolved('var(--bg)'))).toBe(false);
  });

  it('gates every hover, because a tap on a phone leaves one stuck on', () => {
    const ungated: string[] = [];
    const withoutComments = STYLE.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of withoutComments.matchAll(/(^|\n)\s*([^{}\n]*:hover[^{}\n]*)\{/g)) {
      const selector = (m[2] ?? '').trim();
      // A gated rule is nested inside the media block, so it is indented past column 0.
      const at = withoutComments.indexOf(selector);
      const before = withoutComments.slice(Math.max(0, at - 400), at);
      if (!/@media \(hover: hover\) and \(pointer: fine\)\s*\{[^{}]*$/.test(before)) {
        ungated.push(selector);
      }
    }
    expect(ungated).toEqual([]);
  });

  /**
   * A CARD MUST NOT BE ABLE TO OUTGROW THE TRAY IT LIVES IN.
   *
   * The card's height is a function of how many books the recognizer returned, and that
   * cap went 8 → 20 on 2026-08-16 so a post listing twenty books stops becoming seven.
   * Nothing about that change is wrong. Its consequence lands here, on the one surface
   * with no bound of its own.
   *
   * Rendered and measured the same day: a five-book card is 680px. The tray is
   * `calc(100vh - 36px)`, which is 732px on a laptop. So one card already fills the column
   * at five books and cannot fit at twenty.
   *
   * Two things follow, and the second is the reported bug. A card taller than the tray
   * cannot be read without scrolling past its own action. And every neighbour a card
   * displaces travels its FULL HEIGHT: a new card is laid out at its final position at
   * once while the stack is held back by the FLIP transform, so the front of that travel
   * draws the stack across the newcomer. Measured at 436px of overlap for a five-book
   * card, resolving by 25% of the 280ms travel. That transient was a few frames and a
   * couple of hundred pixels when a card held three books.
   *
   * The bound has to be on the LIST, not the card: pinning the head and the action is what
   * keeps "Save all" reachable, which is the whole reason a batch card exists.
   */
  it('bounds the one part of a card whose height is a list', () => {
    const list = rules().find((r) =>
      r.selector.split(',').some((s) => s.trim() === '.buki-books'),
    );
    expect(list, '.buki-books is not styled: a card can still grow without limit').toBeDefined();
    expect(list?.body, '.buki-books needs a ceiling').toMatch(/max-height:/);
    expect(list?.body, '.buki-books needs to scroll once it reaches it').toMatch(
      /overflow-y:\s*auto/,
    );
  });

  it('puts the book rows inside that bounded list rather than straight onto the card', () => {
    // Read as text, like everything else here: there is no DOM in this runner and
    // content.ts registers chrome.runtime.onMessage at module scope, so it cannot be
    // imported at all. This asserts the builder names the container the rule above bounds
    // — it cannot prove the rows end up inside it. tools/tray-harness.mjs is for looking.
    expect(content).toContain(`'buki-books'`);
  });

  /** Vertical padding of a rule, as [top, bottom], from the shorthand. */
  function padY(body: string): [number, number] | null {
    const raw = body.match(/(?:^|;)\s*padding:\s*([^;]+)/)?.[1]?.trim();
    if (!raw) return null;
    const parts = raw.split(/\s+/).map((v) => parseFloat(v));
    if (parts.some((n) => Number.isNaN(n))) return null;
    const [a, , c] = parts;
    // 1 value: all round. 2 or 3: top/bottom given. 4: top … bottom.
    if (parts.length === 1) return [a as number, a as number];
    if (parts.length === 2) return [a as number, a as number];
    return [a as number, (c ?? a) as number];
  }

  it('centres a button label vertically as well as horizontally', () => {
    // Measured in Chrome 151 on 2026-08-17, comparing each button's box centre to its own
    // text range: dx was 0.00 on all four — horizontally they were already dead centre —
    // and dy was -1.00 on every one. `padding: 9px 0 10px` is a pixel more underneath the
    // label than above it, so the line box sits a pixel high. Small, and reported: *"the
    // ctas (now, next someday) the text is not centered on the button"*.
    const off: string[] = [];
    for (const { selector, body } of rules()) {
      if (!/\.buki-(intent|act|x|btn)\b/.test(selector) || selector.includes(':')) continue;
      const p = padY(body);
      if (p && p[0] !== p[1]) off.push(`${selector} { padding-top:${p[0]} bottom:${p[1]} }`);
    }
    expect(off, 'a control whose label cannot sit on its own centre line').toEqual([]);
  });

  it('lets a scroll that runs out of book list carry on to the tray', () => {
    // `overscroll-behavior: contain` on the INNER list stops the scroll chaining outward,
    // so reaching the end of one card's books left the wheel dead instead of moving to the
    // next card. Reported the day after it shipped: *"it was easy to scroll through each
    // toast, hard to scroll between toasts"*. It belongs on the tray, which is the edge of
    // Buki — chaining past THAT would scroll somebody else's page.
    const list = rules().find((r) =>
      r.selector.split(',').some((s) => s.trim() === '.buki-books'),
    );
    expect(list, '.buki-books is not styled').toBeDefined();
    expect(list?.body).not.toMatch(/overscroll-behavior/);

    const tray = rules().find((r) => r.selector.split(',').some((s) => s.trim() === '.buki-tray'));
    expect(tray?.body, 'the tray must still not chain to the host page').toMatch(
      /overscroll-behavior:\s*contain/,
    );
  });

  it('answers a press on every control, since a finger never hovers', () => {
    const CONTROLS = ['.buki-btn', '.buki-x', '.buki-intent', '.buki-act'];
    for (const control of CONTROLS) {
      expect(STYLE, `${control} has no :active`).toContain(`${control}:active`);
    }
  });
});
