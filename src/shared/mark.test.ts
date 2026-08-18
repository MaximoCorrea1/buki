import { describe, it, expect } from 'vitest';
// @ts-expect-error - tools/ is plain .mjs with no types; the geometry is data, not an API.
import { MARK, contrast, rampAt } from '../../tools/mark.mjs';
import landing from '../../docs/index.html?raw';
import popup from '../../popup.html?raw';
import options from '../../options.html?raw';
import iconSvg from '../../icons/icon.svg?raw';
import markSvg from '../../icons/mark.svg?raw';
import docsIcon from '../../docs/icon.svg?raw';
import contentScript from '../extension/content.ts?raw';

/**
 * THE MARK IS THE CATCHER, as of 2026-08-17: a blue ball with two eyes.
 *
 * It replaced three spines and two stamped cords, on Maximo's instruction — *"i added the
 * newLogo.png use that everywhere"* — and the drawing is his. Every number in
 * `tools/mark.mjs` was SAMPLED out of `icons/mark-source.png` rather than redrawn by eye: the ball's
 * bounds, both eyes, both catchlights and the three gradient stops.
 *
 * It is drawn in `docs/index.html`, `popup.html`, `options.html`, `icons/icon.svg`,
 * `icons/mark.svg` and `docs/icon.svg`, and rasterised by `make-icons.mjs`. That is six
 * copies of one drawing, which is the exact shape of every drift failure this repo has had:
 * the production host was "defined once" and spelled out in seven files, and the old mark's
 * caught spine shipped as a hardcoded `#7cc0fd` in three of them. `tools/mark.mjs` is the
 * single definition and this asserts the copies agree with it.
 */

const SURFACES: Record<string, string> = {
  'docs/index.html': landing,
  'popup.html': popup,
  'options.html': options,
  'icons/icon.svg': iconSvg,
  'icons/mark.svg': markSvg,
  'docs/icon.svg': docsIcon,
  // The SEVENTH copy, added 2026-08-18 when the X button stopped being a book emoji. It is
  // the only one that is TypeScript rather than markup: the content script has no
  // `web_accessible_resources`, so it cannot load the drawing and has to spell it.
  'src/extension/content.ts': contentScript,
};

type Ground = { ground: string };

describe('the mark', () => {
  it('is a ball with two eyes, and each eye has a catchlight', () => {
    expect(MARK.ball).toBeTruthy();
    expect(MARK.eyes).toHaveLength(2);
    // The catchlight is what makes it look at you rather than through you. One per eye.
    expect(MARK.catchlights).toHaveLength(2);
  });

  it('keeps both eyes level and the same size, because a wonky eye reads as a mistake', () => {
    const eyes = MARK.eyes as { cx: number; cy: number; rx: number; ry: number }[];
    const [l, r] = [eyes[0]!, eyes[1]!];
    expect(l.cy).toBe(r.cy);
    expect(l.rx).toBe(r.rx);
    expect(l.ry).toBe(r.ry);
    // Symmetric about the ball's axis, to within the sampling error of the source PNG.
    expect(Math.abs((l.cx + r.cx) / 2 - MARK.ball.cx)).toBeLessThan(1);
  });

  it('fills its own viewBox, so a consumer sizes it with one number', () => {
    // The ball IS the artwork: there is no padding baked in, because a mark that carries
    // its own margin cannot be aligned against anything.
    expect(MARK.ball.r).toBe(50);
    expect(MARK.ball.cx).toBe(50);
    expect(MARK.ball.cy).toBe(50);
  });

  it('separates from every ground it ships on, judged across the whole ramp', () => {
    // THE BAR IS DELIBERATELY NOT "every gradient stop clears 3:1 against the ground",
    // and that is the second time this file has had to say so.
    //
    // The old mark's first test scored the WORKING night mark below the BROKEN cream one,
    // because it compared a flanked spine to the page instead of to its neighbours. This
    // is the same error one shape along. The mark is a filled disc whose ramp runs from
    // #7bcdfc to #013ebf: on the light panel the top measures 1.57:1 and the bottom 7.70:1,
    // and at night the top is 11.98:1 and the bottom 2.44:1. Demanding every stop clear the
    // ground would fail a mark that renders perfectly at 16px on both — verified by
    // rendering it, at 16/20/24/32/48/64/128, before this bar was written.
    //
    // What a disc actually owes is a legible SILHOUETTE: somewhere on the ramp there must
    // be a value the ground cannot swallow, and the eye completes the circle from there.
    const stops = MARK.ramp.stops as { color: string }[];
    for (const [name, g] of Object.entries(MARK.grounds) as [string, Ground][]) {
      const best = Math.max(...stops.map((s) => contrast(s.color, g.ground)));
      expect(best, `${name}: no part of the ramp separates from ${g.ground}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the eyes readable against the ball WHERE THE EYES ACTUALLY ARE', () => {
    // The eyes are the mark: if they close up against the ball it is a blue dot.
    //
    // But the ball is a gradient, so "the eye against the ball" has no single answer, and
    // the first draft of this assertion asked for the wrong one. It compared the eye ink
    // to every stop, including `#013ebf` — the deepest, which lives in the bottom-right
    // corner where no eye ever sits — and failed at 2.00:1. That is the flanked-element
    // error a third time, and the third different shape: a ratio against a colour that is
    // nowhere near the thing being judged.
    //
    // So the ramp is sampled at each eye's own top, centre and bottom.
    const worst = Math.min(
      ...(MARK.eyes as { cx: number; cy: number; ry: number }[]).flatMap((e) =>
        [e.cy - e.ry, e.cy, e.cy + e.ry].map((y) => {
          const rgb = rampAt(e.cx, y) as number[];
          const hex = `#${rgb.map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`;
          return contrast(MARK.ink, hex);
        }),
      ),
    );
    // THE BAR IS 3, and it is 3 because an eye is a graphical object rather than text.
    // WCAG 1.4.11 asks 3:1 of "graphical objects required to understand the content";
    // 4.5 and 7 are TEXT bars, and this repo's own 7:1 rule is written about type. The
    // measured worst point is the bottom edge of an eye at 3.75:1, which clears it — and
    // the mark was rendered at 16/20/24/32/48/64/128 on both grounds before this line was
    // written, so the number is confirming a render rather than standing in for one.
    expect(worst, 'an eye disappears into the ball').toBeGreaterThanOrEqual(3);
    expect(contrast(MARK.glint, MARK.ink), 'the catchlight vanishes').toBeGreaterThanOrEqual(3);
  });

  it('is drawn with the same coordinates everywhere it appears', () => {
    // Guard the vacuous pass: a renamed file would match nothing and report clean.
    expect(Object.keys(SURFACES).length).toBe(7);

    const eyes = MARK.eyes as { cx: number; ry: number }[];
    const lights = MARK.catchlights as { cx: number }[];
    const [eyeL, eyeR] = [eyes[0]!, eyes[1]!];
    const [glintL, glintR] = [lights[0]!, lights[1]!];
    const geometry = [
      `r="${MARK.ball.r}"`,
      `cx="${eyeL.cx}"`,
      `cx="${eyeR.cx}"`,
      `ry="${eyeL.ry}"`,
      `cx="${glintL.cx}"`,
      `cx="${glintR.cx}"`,
    ];
    const wrong: string[] = [];
    for (const [name, body] of Object.entries(SURFACES)) {
      for (const g of geometry) {
        if (!body.includes(g)) wrong.push(`${name} is missing ${g}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('paints the ball the colours sampled from the drawing, on every surface', () => {
    // THE HOLE THE OLD FILE CLOSED, kept open here. Geometry agreeing across six files
    // proves nothing about colour: the previous mark was asserted for SHAPE across six
    // surfaces while one of them shipped a caught spine nobody had measured, for a day,
    // inside a green suite. Colour is checked against the same single definition.
    const wanted = (MARK.ramp.stops as { color: string }[])
      .map((s) => s.color.toLowerCase())
      .concat(MARK.ink.toLowerCase(), MARK.glint.toLowerCase());

    const wrong: string[] = [];
    for (const [name, body] of Object.entries(SURFACES)) {
      const declared = new Set((body.match(/#[0-9a-f]{6}/gi) ?? []).map((h) => h.toLowerCase()));
      const missing = wanted.filter((c) => !declared.has(c));
      if (missing.length > 0) wrong.push(`${name} never declares ${missing.join(', ')}`);
    }
    expect(wrong).toEqual([]);
  });
});
