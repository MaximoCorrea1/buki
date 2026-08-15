import { describe, it, expect } from 'vitest';
// @ts-expect-error - tools/ is plain .mjs with no types; the geometry is data, not an API.
import { MARK, contrast } from '../../tools/mark.mjs';
import landing from '../../docs/index.html?raw';
import popup from '../../popup.html?raw';
import options from '../../options.html?raw';
import iconSvg from '../../icons/icon.svg?raw';
import markSvg from '../../icons/mark.svg?raw';
import docsIcon from '../../docs/icon.svg?raw';

/**
 * The mark is now drawn in four places and rasterised in a fifth. That is exactly the
 * shape of every drift failure this repo has had.
 *
 * It has happened twice already with values that were supposed to be shared. The Vercel
 * host was "defined once" in `host.ts` and spelled out in seven files, which is why
 * `host.test.ts` globs rather than lists. Then the caught spine shipped as a hardcoded
 * `#7cc0fd` in `popup.html` AND `options.html` AND `icons/icon.svg`, directly under a
 * comment in the first two explaining that a light value on cream measures 1.6:1 and
 * cannot be used. Three copies, one of them wrong for two generations.
 *
 * `tools/mark.mjs` is the single definition. This asserts the copies agree with it.
 */

const SURFACES: Record<string, string> = {
  'docs/index.html': landing,
  'popup.html': popup,
  'options.html': options,
  'icons/icon.svg': iconSvg,
  'icons/mark.svg': markSvg,
  'docs/icon.svg': docsIcon,
};

describe('the mark', () => {
  it('is three spines, and the third is the caught one', () => {
    expect(MARK.shelved).toHaveLength(2);
    expect(MARK.caught).toBeTruthy();
    // Two stamped cords, the same ones every generated cover carries.
    expect(MARK.cords).toHaveLength(2);
  });

  it('leans the caught spine the way the drawing leans it', () => {
    // SVG's positive rotation is CLOCKWISE, which puts a spine's top to the RIGHT.
    // The drawing leans the other way: top to the left, foot to the right. The extension
    // shipped rotate(10) for two generations and leaned it backwards.
    expect(MARK.caught.rotate).toBeLessThan(0);
  });

  it('separates the caught spine from the shelved ones, and the mark from its ground', () => {
    // These are the two bars the mark actually owes, and they are deliberately NOT
    // "the caught spine clears 3:1 against the ground".
    //
    // That was the first version of this test and it was wrong. It scored the night mark —
    // cobalt between two cream spines, which renders perfectly at 25px — at 1.70:1, worse
    // than the cream-ground bug it was written to catch (#7cc0fd at 1.81:1). A metric that
    // ranks the working case below the broken one is not measuring the thing that broke.
    //
    // What actually carries the caught spine is its NEIGHBOURS: it is flanked on both
    // sides, the tilt is only 8 degrees so it never protrudes past them, and the two cord
    // gaps cut across it and prove it is a solid object. So the bars are: the caught spine
    // must differ from the spines beside it, and the spines must differ from the ground.
    for (const [name, g] of Object.entries(MARK.grounds) as [
      string,
      { ground: string; spine: string; caught: string },
    ][]) {
      expect(contrast(g.caught, g.spine), `${name}: caught vs shelved`).toBeGreaterThanOrEqual(3);
      expect(contrast(g.spine, g.ground), `${name}: the mark's silhouette`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('is drawn with the same coordinates everywhere it appears', () => {
    // Guard the vacuous pass: a renamed file would match nothing and report clean.
    expect(Object.keys(SURFACES).length).toBe(6);

    const geometry = [
      `x="${MARK.shelved[0].x}"`,
      `x="${MARK.shelved[1].x}"`,
      `x="${MARK.caught.x}"`,
      `rotate(${MARK.caught.rotate} `,
      `y="${MARK.cords[0].y}"`,
      `y="${MARK.cords[1].y}"`,
    ];
    const wrong: string[] = [];
    for (const [name, body] of Object.entries(SURFACES)) {
      for (const g of geometry) {
        if (!body.includes(g)) wrong.push(`${name} is missing ${g}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
