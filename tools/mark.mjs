/**
 * THE BUKI MARK, defined once.
 *
 * The catcher: a blue ball with two big eyes and a catchlight in each. It looks at you,
 * which is the whole idea — the thing Buki does is SEE a book in a picture.
 *
 * It replaced three shelved spines and a caught one on 2026-08-17, on Maximo's
 * instruction and from Maximo's drawing (`icons/mark-source.png`). **Every number below was
 * SAMPLED out of that PNG, not redrawn by eye**: the ball's bounds, both eyes, both
 * catchlights and the three gradient stops. The sampler is in the session context doc for
 * 2026-08-17; the numbers are here because this is where they are consumed.
 *
 * It is drawn in `docs/index.html`, `popup.html`, `options.html`, `icons/icon.svg`,
 * `icons/mark.svg` and `docs/icon.svg`, and rasterised by `make-icons.mjs` beside this
 * file. That is six copies of one drawing, so this module is the definition and
 * `src/shared/mark.test.ts` fails the build when a copy disagrees with it. The repo has
 * lost this exact bet twice: the production host was "defined once" and spelled out in
 * seven files, and the old mark's caught spine shipped as a hardcoded #7cc0fd in three of
 * them, one of which measured 1.81:1 on its own ground.
 *
 * Coordinates are a 0..100 box and the ball FILLS it. There is no baked-in padding,
 * because a mark that carries its own margin cannot be aligned against anything.
 */

export const MARK = {
  /** The ball. It is the silhouette, so it owns the whole viewBox. */
  ball: { cx: 50, cy: 50, r: 50 },

  /**
   * The eyes. Tall ovals rather than circles — that is what makes it read as *looking*
   * rather than as two holes, and it is what survives 16px in the Chrome toolbar, where
   * the old mark's three 19-unit spines became three grey hairs.
   */
  eyes: [
    { cx: 31.3, cy: 45.9, rx: 13.7, ry: 19.5 },
    { cx: 68.3, cy: 45.9, rx: 13.7, ry: 19.5 },
  ],

  /**
   * The catchlights, and they are NOT centred in the eyes.
   *
   * Both sit up and to the right of their eye's centre, by the same offset — the drawing
   * puts the light source there and it is what stops the face reading as a stare. Sampled
   * rather than guessed, because "put a dot in the eye" is exactly the kind of detail that
   * gets redrawn slightly differently in each of six files.
   */
  catchlights: [
    { cx: 35, cy: 35.2, r: 3.9 },
    { cx: 71.4, cy: 35.2, r: 3.9 },
  ],

  /**
   * The ball's gradient: light at the top left, deep at the bottom right, on the diagonal.
   *
   * The deep end is within a hair of the landing's cobalt (`#1231a8`) and the midpoint sits
   * where the old mark's caught spine did (`#2f7fd6`), so the new mark did not cost the
   * product its colour — it is the same family, lit.
   */
  ramp: {
    x1: 14,
    y1: 8,
    x2: 82,
    y2: 94,
    stops: [
      { at: 0, color: '#7bcdfc' },
      { at: 0.46, color: '#4aa3f9' },
      { at: 1, color: '#013ebf' },
    ],
  },

  /** The eyes' ink and the catchlight. One value each, on every ground, forever. */
  ink: '#091a3b',
  glint: '#fdfdfd',

  /**
   * THE GROUNDS THE MARK HAS TO SURVIVE, and the bar is about the RAMP, not any one stop.
   *
   * A filled disc owes a legible silhouette, not a uniform ratio. On the light panel the
   * ramp's top measures 1.57:1 and its bottom 7.70:1; at night the top is 11.98:1 and the
   * bottom 2.44:1. Demanding every stop clear every ground would fail a mark that renders
   * perfectly at 16px on both — which was verified by rendering it at 16, 20, 24, 32, 48,
   * 64 and 128 before the bar was written. `mark.test.ts` asserts the best stop clears
   * 4.5:1, and says at length why the naive version is the same error this repo has now
   * made twice with a flanked element.
   */
  grounds: {
    'landing, day': { ground: '#fbf7ec' },
    'landing, night': { ground: '#080d20' },
    'extension paper': { ground: '#f2f2f7' },
    'extension night': { ground: '#000000' },
    /** Chrome's own toolbar, which is the one ground nobody here chooses. */
    'toolbar, light': { ground: '#ffffff' },
    'toolbar, dark': { ground: '#292a2d' },
  },
};

/**
 * The mark as SVG, so six surfaces cannot each draw it slightly differently.
 *
 * `id` namespaces the gradient: two marks in one document with the same gradient id means
 * the second one silently takes the first one's fill.
 */
export function markSvg(id = 'bk') {
  const { ball, eyes, catchlights: lights, ramp, ink, glint } = MARK;
  const stops = ramp.stops
    .map((s) => `<stop offset="${s.at}" stop-color="${s.color}"/>`)
    .join('');
  const eye = (e) => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="${ink}"/>`;
  const light = (l) => `<circle cx="${l.cx}" cy="${l.cy}" r="${l.r}" fill="${glint}"/>`;
  return (
    `<defs><linearGradient id="${id}-ball" x1="${ramp.x1}" y1="${ramp.y1}" x2="${ramp.x2}" y2="${ramp.y2}" gradientUnits="userSpaceOnUse">${stops}</linearGradient></defs>` +
    `<circle cx="${ball.cx}" cy="${ball.cy}" r="${ball.r}" fill="url(#${id}-ball)"/>` +
    eyes.map(eye).join('') +
    lights.map(light).join('')
  );
}

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

/** Inside the ball? Used by the rasteriser. */
export function inCircle(px, py, { cx, cy, r }) {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Inside an eye? Same, for an axis-aligned ellipse. */
export function inEllipse(px, py, { cx, cy, rx, ry }) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/**
 * The ramp's colour at a point, so the rasteriser paints the same gradient the SVG does.
 * Projects the point onto the gradient axis and interpolates between the bracketing stops.
 */
export function rampAt(px, py) {
  const { x1, y1, x2, y2, stops } = MARK.ramp;
  const ax = x2 - x1;
  const ay = y2 - y1;
  const t = Math.min(1, Math.max(0, ((px - x1) * ax + (py - y1) * ay) / (ax * ax + ay * ay)));
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].at && t <= stops[i + 1].at) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi.at - lo.at || 1;
  const k = (t - lo.at) / span;
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r1, g1, b1] = rgb(lo.color);
  const [r2, g2, b2] = rgb(hi.color);
  return [r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k].map(Math.round);
}
