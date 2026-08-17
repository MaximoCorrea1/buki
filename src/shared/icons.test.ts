import { describe, it, expect } from 'vitest';
// @ts-expect-error - tools/ is plain .mjs with no types, and this package ships no
// @types/node on purpose: everything in src/ runs in a browser. File access lives there.
import { decodePng } from '../../tools/png.mjs';
// @ts-expect-error - same reason; the geometry is data, not an API.
import { MARK } from '../../tools/mark.mjs';

/**
 * THE SHIPPED ICONS, not the intention behind them.
 *
 * `icons/*.png` are committed artefacts written by `tools/make-icons.mjs`, and nothing in
 * `build.mjs` regenerates them. So they can drift from `tools/mark.mjs` in silence, and
 * they have: the toolbar carried the FIRST-generation mark for weeks after every other
 * surface had moved on, because no test ever opened the file Chrome actually loads.
 *
 * WHAT THIS CAUGHT. On 2026-08-17 the 16px icon shipped with no catchlights - two flat
 * dark eyes - because the rasteriser gated them behind `size >= 32`. The gate carried a
 * confident comment saying a catchlight "eats the eye it is supposed to sit in" at 16px
 * and that the face would read as two grey smudges. **That was written without rendering
 * it.** Rendered at true size it is a clean lit pixel, and the ungated version is the one
 * that looks wrong. Reported from the browser first: *"the pupils are not showing"*.
 *
 * Assertions are about RELATIONSHIPS rather than exact values, because every pixel here is
 * a 4x4 supersampled blend and an exact-match test would be a test of the sampler.
 */

interface Pixel {
  r: number;
  g: number;
  b: number;
  a: number;
}
interface Png {
  width: number;
  at: (x: number, y: number) => Pixel;
}
const png = (file: string): Png => decodePng(file) as Png;

const SIZES = [16, 32, 48, 128];
/**
 * A 0..100 mark coordinate, as the index of the pixel that CONTAINS it.
 *
 * `Math.floor`, not `Math.round`: coordinate 35 of 100 on a 16px icon is 5.6, which lives
 * inside pixel 5 - pixels span [5, 6). Rounding to 6 put the catchlight probe one pixel
 * off, into the eye, and the assertion failed with a difference of exactly zero because
 * both probes were reading the same dark ink. The icon was right and the ruler was wrong.
 */
const px = (v: number, size: number): number => Math.floor((v / 100) * size);
const light = (c: { r: number; g: number; b: number }): number => c.r + c.g + c.b;

describe('the icons Chrome actually loads', () => {
  for (const size of SIZES) {
    it(`icon${size}.png is ${size}px and drawn on transparency, with no plate`, () => {
      const img = png(`icons/icon${size}.png`);
      expect(img.width).toBe(size);
      // The ball owns the viewBox, so every corner is outside it. A plate would be opaque
      // here, and the plate was deliberately removed with the three-spine mark.
      expect(img.at(0, 0).a, 'the corner is painted: a plate has come back').toBeLessThan(40);
    });

    it(`icon${size}.png has a catchlight in each eye`, () => {
      // The one that failed. At 16px this measured ZERO near-white pixels.
      const img = png(`icons/icon${size}.png`);
      const eyes = MARK.eyes as { cx: number; cy: number }[];
      const lights = MARK.catchlights as { cx: number; cy: number }[];
      for (let i = 0; i < 2; i++) {
        const eye = eyes[i]!;
        const glint = lights[i]!;
        const inEye = img.at(px(eye.cx, size), px(eye.cy + 8, size));
        const onGlint = img.at(px(glint.cx, size), px(glint.cy, size));
        expect(
          light(onGlint) - light(inEye),
          `eye ${i} at ${size}px has no lit spot in it`,
        ).toBeGreaterThan(90);
      }
    });

    it(`icon${size}.png has eyes darker than the ball around them`, () => {
      const img = png(`icons/icon${size}.png`);
      const eye = (MARK.eyes as { cx: number; cy: number }[])[0]!;
      const inEye = img.at(px(eye.cx, size), px(eye.cy + 8, size));
      const onBall = img.at(px(50, size), px(12, size));
      expect(light(onBall) - light(inEye), `the eyes have closed up at ${size}px`).toBeGreaterThan(150);
    });
  }
});
