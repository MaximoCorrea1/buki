import { describe, it, expect } from 'vitest';
import storeShots from '../../tools/store-shots.mjs?raw';
import assetsMd from '../../docs/store/assets.md?raw';

/**
 * THE STORE FRAMES MUST NOT BECOME AN EIGHTH COPY OF THE MARK.
 *
 * `src/shared/mark.test.ts` asserts six markup surfaces plus the content script against
 * `tools/mark.mjs`, because the mark has already drifted once: the old drawing's caught
 * spine shipped as a hardcoded `#7cc0fd` in three files that all believed they were the
 * definition.
 *
 * Those seven SPELL the drawing out of necessity. `docs/index.html` cannot import a
 * JavaScript module, and the content script has no `web_accessible_resources` so it cannot
 * load the SVG either. **`tools/store-shots.mjs` has neither excuse**: it is an `.mjs`
 * module that already imports `MARK` for the ground colours, so it can call `markSvg()` and
 * be incapable of drift rather than merely asserted not to have drifted.
 *
 * This guard exists so the cheap thing stays cheap. Pasting an SVG literal into the frames
 * is a thirty-second shortcut that adds a copy nobody would think to check, on the one
 * surface whose output goes in front of every prospective user before they install.
 *
 * EARNED WITH AN A/B on 2026-08-20: replacing the `markSvg(...)` call with the literal it
 * produces turns both of the first two tests red. A guard never shown to detect the thing
 * it looks for is not evidence, which is a rule this file's repo pays for in section 5.
 */
describe('the store frames draw the mark rather than redrawing it', () => {
  it('imports the generator from the single definition', () => {
    // Not a substring check on "mark.mjs" alone: importing MARK for the ground colours
    // would satisfy that while the drawing was still spelled by hand below.
    expect(storeShots).toMatch(/import\s*\{[^}]*\bmarkSvg\b[^}]*\}\s*from\s*'\.\/mark\.mjs'/);
  });

  it('spells no mark geometry of its own', () => {
    // The ball is a circle and each eye is an ellipse. Neither shape should appear as a
    // literal anywhere in this file: every one of them comes back from markSvg() at run
    // time. If a future frame genuinely needs its own ellipse, that is the moment to ask
    // whether it needs the mark's, and to widen this deliberately rather than by accident.
    expect(storeShots).not.toMatch(/<circle\b/);
    expect(storeShots).not.toMatch(/<ellipse\b/);
  });

  it('gives every mark instance its own gradient id', () => {
    // Two marks in one document sharing a gradient id means the second silently takes the
    // first one's fill: it renders, it just renders wrong, and only in the composed frame.
    // The helper takes the id as an argument, so the failure mode is passing a constant.
    const calls = [...storeShots.matchAll(/\bmark\(\s*([^,]+),/g)].map((m) => m[1]!.trim());
    expect(calls.length).toBeGreaterThan(1);
    for (const arg of calls) {
      // A template literal carrying a per-shot key, never a bare quoted constant.
      expect(arg.startsWith('`')).toBe(true);
      expect(arg).toMatch(/\$\{/);
    }
    expect(new Set(calls).size).toBe(calls.length);
  });
});


describe('shot 2 headline stays bound to the capture it describes', () => {
  /**
   * SHOT 2'S HEAD NAMES A NUMBER, AND THE NUMBER IS INSIDE THE PICTURE.
   *
   * The frame reads *"One photo. Nineteen books."* over a capture whose own copy, from
   * `trayCopy.ts`, reads *"Buki found 19 books in this picture"*. That is the strongest
   * thing in the listing: every other frame makes a claim, this one shows its evidence in
   * the same rectangle. It is also the only line a reader can falsify WITHOUT LEAVING THE
   * FRAME, so a reshoot that changes the photograph and not the headline does not produce a
   * stale sentence. It produces a visible contradiction, on the differentiator shot.
   *
   * No test can read the count out of a PNG. What it CAN do is refuse to let the two
   * documents that both spell it drift apart: the frame that prints it and the staging note
   * that tells you what to photograph.
   */
  it('assets.md quotes shot 2 head verbatim, so a reshoot cannot change one alone', () => {
    const head = /head:\s*'([^']*[Nn]ineteen[^']*)'/.exec(storeShots)?.[1];
    expect(head, 'the head naming the capture count is gone: has the copy moved?').toBeTruthy();
    expect(
      assetsMd,
      `assets.md must quote this head verbatim so the staging and the frame move together. Frame says: ${head}`,
    ).toContain(head!);
  });

  it('the staging note names a digit count for the photograph to hold', () => {
    // The head spells the number as a word and the capture prints it as a digit. The
    // staging note is the one place both live, and it is the instruction someone follows
    // with a camera. A binding note with no number in it is a note nobody can act on.
    const note = /THE COUNT IS IN THE HEADLINE[\s\S]{0,600}/.exec(assetsMd)?.[0] ?? '';
    expect(note, 'the shot 2 binding note is gone from assets.md').not.toBe('');
    expect(note).toMatch(/\*\*\d+\*\*/);
  });
});

describe('the frames stay the size the store asks for', () => {
  it('is 1280x800 exactly, in one place', () => {
    // docs/store/listing.md: "1280x800 or 640x400". The larger is preferable and it is what
    // assets.md stages for. This is the number a redesign is most likely to nudge, and a
    // frame that is 1280x820 produces five screenshots the dashboard silently rescales.
    expect(storeShots).toMatch(/width:\s*1280px;\s*height:\s*800px/);
  });

  it('keeps min-height zero on the stage, which is load-bearing', () => {
    // A flex item defaults to min-height auto and refuses to shrink below its content, so
    // max-height 100% on the image inside is ignored and a tall capture runs straight out
    // of the frame. This cost a render on 2026-08-18 and is invisible when reading the CSS.
    expect(storeShots).toMatch(/\.stage\s*\{[^}]*min-height:\s*0/);
  });
});

describe('every declared layout has an implementation', () => {
  it('names no layout the STAGES table cannot render', () => {
    // The frame builder throws on an unknown layout, but it throws at generation time on
    // Maximo's machine rather than here, and the failure looks like a broken tool rather
    // than a typo in a shot definition.
    const declared = [...storeShots.matchAll(/layout:\s*'([a-z]+)'/g)].map((m) => m[1]!);
    const table = /const STAGES = \{([^}]*)\}/.exec(storeShots)?.[1] ?? '';
    const implemented = [...table.matchAll(/(\w+):/g)].map((m) => m[1]!);

    expect(declared.length).toBeGreaterThan(0);
    expect(implemented).toContain('hero');
    for (const layout of new Set(declared)) {
      expect(implemented).toContain(layout);
    }
  });
});
