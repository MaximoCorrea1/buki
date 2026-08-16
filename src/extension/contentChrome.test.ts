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

/** Surfaces the reader reads text off. These are the ones that must be opaque. */
const GROUNDS = ['.buki-card', '.buki-intent', '.buki-act', '.buki-shelf', '.buki-thumb'];

describe('the catch tray, which lives on a page we do not control', () => {
  it('reads a real stylesheet rather than passing on a slice that matched nothing', () => {
    expect(STYLE).toContain('.buki-card');
    expect(rules().length).toBeGreaterThan(15);
  });

  it('never lets the host page show through a surface it puts text on', () => {
    // A translucent card is a card whose contrast is decided by whatever is behind it.
    // On the landing that is a measured choice, because the page owns the backdrop. Here
    // the backdrop might be a photograph.
    const leaks: string[] = [];
    for (const { selector, body } of rules()) {
      if (!GROUNDS.some((g) => selector.includes(g))) continue;
      for (const decl of body.split(';')) {
        const [rawProp, ...rest] = decl.split(':');
        const prop = (rawProp ?? '').trim();
        const value = rest.join(':');
        if (!/^(background|background-color)$/.test(prop)) continue;
        // `transparent` is legitimate on a control that sits ON the card: its ground is
        // the card, which is ours. It is only a leak on the card itself.
        if (selector.includes('.buki-card') && /\btransparent\b/.test(value)) {
          leaks.push(`${selector} { ${prop}:${value.trim()} }`);
          continue;
        }
        if (SEE_THROUGH.test(value) && !/\btransparent\b/.test(value)) {
          leaks.push(`${selector} { ${prop}:${value.trim()} }`);
        }
      }
    }
    expect(leaks).toEqual([]);
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

  it('answers a press on every control, since a finger never hovers', () => {
    const CONTROLS = ['.buki-btn', '.buki-x', '.buki-intent', '.buki-act'];
    for (const control of CONTROLS) {
      expect(STYLE, `${control} has no :active`).toContain(`${control}:active`);
    }
  });
});
