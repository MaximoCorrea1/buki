/**
 * THE BUKI MARK, defined once.
 *
 * Two shelved spines and one pulled out and lit, all three crossed by two stamped cords.
 * The third spine is the whole argument: it is what makes the mark about *catching*
 * rather than about books, and the two-spine drawing that briefly replaced it lost that.
 *
 * It is drawn in `docs/index.html`, `popup.html`, `options.html` and `icons/icon.svg`, and
 * rasterised by `make-icons.mjs` beside this file. That is five copies of one drawing, so
 * this module is the definition and `src/shared/mark.test.ts` fails the build when a copy
 * disagrees with it. The repo has lost this exact bet twice: the production host was
 * "defined once" and spelled out in seven files, and the caught spine shipped as a
 * hardcoded #7cc0fd in three of them, one of which measured 1.81:1 on its own ground.
 *
 * Coordinates are a 0..100 box. Every consumer either inlines this viewBox or scales it.
 */

export const MARK = {
  /** The two books still on the shelf. Upright, because the shelf is not the subject. */
  shelved: [
    { x: 15, y: 6, w: 19, h: 88, rx: 9.5 },
    { x: 66, y: 6, w: 19, h: 88, rx: 9.5 },
  ],

  /**
   * The caught one. NEGATIVE rotation: SVG's positive angle is clockwise, which puts a
   * spine's top to the right, and the drawing leans the other way — top to the left, foot
   * to the right, the way a book tips when it is pulled half out. The extension shipped
   * `rotate(10)` for two generations and leaned it backwards.
   */
  caught: { x: 40.5, y: 7, w: 19, h: 86, rx: 9.5, rotate: -8, pivot: [50, 50] },

  /**
   * The two stamped cords, the same pair every generated cover carries, so the mark and a
   * board on the shelf are the same object at two sizes.
   *
   * They are cut with a MASK wherever this is inlined as SVG, never painted in the ground
   * colour. A painted cord is a coloured bar: it carries a background with it, and the
   * mark then only works on the one surface that background happens to match. Masked, the
   * gaps are genuinely transparent and the same mark sits on the glass pill, on a plate
   * and on flat paper. `make-icons.mjs` paints them, and may, because it is drawing onto
   * a plate it owns.
   */
  cords: [
    { y: 64.6, h: 1.9 },
    { y: 72.9, h: 1.9 },
  ],

  /**
   * THE CAUGHT SPINE IS A DIFFERENT VALUE ON EVERY GROUND, and this is the only part of
   * the mark that is not one number.
   *
   * It has to separate from two things at once: from the ground, so you can see it at
   * all, and from the shelved spines, so it reads as *caught* rather than as a third
   * book. Those pull in opposite directions, and which direction is scarce depends on
   * whether the ground is cream or navy. Measured, on cream:
   *
   *   #7cc0fd   1.81:1 vs the paper,  9.58:1 vs the spines  -> invisible as a shape
   *   #1231a8   9.66:1 vs the paper,  1.80:1 vs the spines  -> nothing looks caught
   *   #2f7fd6   3.83:1 vs the paper,  4.54:1 vs the spines  -> clears both
   *
   * The test asserts >= 3:1 on both counts for every ground listed here, so adding a
   * surface means measuring it rather than guessing.
   */
  grounds: {
    'landing, day': { ground: '#fbf7ec', spine: '#0a0f33', caught: '#2f7fd6' },
    'landing, night': { ground: '#080d20', spine: '#f5efde', caught: '#1231a8' },
    'extension paper': { ground: '#fbf7ec', spine: '#0a0f33', caught: '#2f7fd6' },
    /**
     * Added 2026-08-16, when the popup and the setup page gained a second mood.
     *
     * It is the same three values as `landing, night`, and that is the finding rather
     * than a duplicate worth collapsing: the extension's night is the CATCH TRAY'S night,
     * which the tray has carried since 2026-08-15, and the tray's night is the landing's.
     * One room, reached from three directions. Listed separately because a ground is a
     * surface rather than a palette, and the next surface to gain a mood must be measured
     * rather than assumed to land on one of these.
     */
    'extension night': { ground: '#080d20', spine: '#f5efde', caught: '#1231a8' },
    'icon plate': { ground: '#fbf7ec', spine: '#0a0f33', caught: '#2f7fd6' },
  },
};

/** WCAG 2.x relative luminance, so the values above can be asserted rather than trusted. */
export function luminance(hex) {
  const h = hex.replace('#', '');
  const ch = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/** Signed-distance test for a rounded rect, used by the rasteriser. */
export function inRoundRect(px, py, { x, y, w, h, rx }) {
  const cx = Math.min(Math.max(px, x + rx), x + w - rx);
  const cy = Math.min(Math.max(py, y + rx), y + h - rx);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= rx * rx;
}
