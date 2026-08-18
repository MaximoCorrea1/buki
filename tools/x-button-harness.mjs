/**
 * The save button in X's action bar, on the three grounds X actually has.
 *
 * WHY THIS EXISTS. The button is the one surface no harness could reach: it is injected by
 * a content script into somebody else's feed, and Chrome stable refuses `--load-extension`.
 * So the mark that replaced the 📚 emoji on 2026-08-18 was about to be shipped on the
 * strength of a contrast table, which is exactly the move `tools/mark-sizes.mjs` exists to
 * stop. Rendering the mark alone was never the question either: the question is what a
 * filled gradient disc looks like in a ROW of thin grey outline icons, and only the row
 * answers that.
 *
 * The neighbours are approximations of X's own reply, retweet, like and share glyphs: 18px
 * boxes, ~1.6px strokes, `currentColor` at the theme's muted grey. They are here to be
 * compared against, not to be accurate reproductions.
 *
 * USAGE
 *   node tools/x-button-harness.mjs      writes zzz-x-button.html
 *
 * Gitignored. Regenerate rather than commit.
 */
import { writeFileSync } from 'node:fs';
import { MARK, contrast } from './mark.mjs';

/** X's three action-bar grounds and their muted icon colour, from its own themes. */
const GROUNDS = [
  { name: 'X default', bg: '#ffffff', muted: '#536471', text: '#0f1419' },
  { name: 'X dim', bg: '#15202b', muted: '#8b98a5', text: '#f7f9f9' },
  { name: 'X lights out', bg: '#000000', muted: '#71767b', text: '#e7e9ea' },
];

const SIZES = [16, 18, 20];

function mark(id) {
  const { ball, eyes, catchlights, ramp, ink, glint } = MARK;
  const stops = ramp.stops.map((s) => `<stop offset="${s.at}" stop-color="${s.color}"/>`).join('');
  return (
    `<svg viewBox="0 0 100 100" aria-hidden="true">` +
    `<defs><linearGradient id="${id}" x1="${ramp.x1}" y1="${ramp.y1}" x2="${ramp.x2}" y2="${ramp.y2}" gradientUnits="userSpaceOnUse">${stops}</linearGradient></defs>` +
    `<circle cx="${ball.cx}" cy="${ball.cy}" r="${ball.r}" fill="url(#${id})"/>` +
    eyes
      .map((e) => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="${ink}"/>`)
      .join('') +
    catchlights.map((l) => `<circle cx="${l.cx}" cy="${l.cy}" r="${l.r}" fill="${glint}"/>`).join('') +
    `</svg>`
  );
}

/** X's neighbours, near enough for a weight comparison. Stroke, never fill. */
const NEIGHBOURS = {
  reply: `<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5v4A2.5 2.5 0 0 1 12.5 12H8l-3.5 3v-3A2.5 2.5 0 0 1 3 9.5z"/>`,
  retweet: `<path d="M4 6h7a3 3 0 0 1 3 3v3M4 6l2.5-2.5M4 6l2.5 2.5"/><path d="M14 12H7a3 3 0 0 1-3-3V6m10 6-2.5 2.5M14 12l-2.5-2.5"/>`,
  like: `<path d="M9 14.5S3 11 3 7.2A3.2 3.2 0 0 1 9 5.5a3.2 3.2 0 0 1 6 1.7C15 11 9 14.5 9 14.5Z"/>`,
  share: `<path d="M9 3v9M9 3 6 6M9 3l3 3"/><path d="M4 10v3.5A1.5 1.5 0 0 0 5.5 15h7a1.5 1.5 0 0 0 1.5-1.5V10"/>`,
};

const glyph = (d) =>
  `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

let seq = 0;
const row = (size, muted) => `
  <div class="bar" style="--icon:${size}px; color:${muted}">
    ${Object.values(NEIGHBOURS).map((d) => `<button class="act">${glyph(d)}</button>`).join('')}
    <button class="act buki">${mark(`b${++seq}`)}</button>
  </div>`;

const panel = ({ name, bg, muted, text }) => `
  <section style="background:${bg}; color:${text}">
    <h2>${name}</h2>
    ${SIZES.map(
      (s) => `<p class="lbl">${s}px</p>${row(s, muted)}`,
    ).join('')}
    <p class="lbl">18px, hovered (opacity 1)</p>
    <div class="hovered">${row(18, muted)}</div>
  </section>`;

const best = (bg) =>
  MARK.ramp.stops.map((s) => contrast(s.color, bg)).reduce((a, b) => (b > a ? b : a));

const html = `<!doctype html>
<meta charset="utf-8">
<title>Buki in X's action bar</title>
<style>
  body { margin:0; font:14px/1.5 -apple-system, system-ui, sans-serif; background:#4a4a4a; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); }
  section { padding:22px 20px 26px; }
  h2 { margin:0 0 14px; font-size:13px; letter-spacing:.04em; text-transform:uppercase; opacity:.7; }
  .lbl { margin:14px 0 4px; font-size:11px; opacity:.5; }
  .bar { display:flex; align-items:center; gap:34px; }
  /* X's OWN icons are full-opacity muted grey. Only ours is translucent, so the harness
     has to say so or the comparison flatters us. */
  .act {
    cursor:pointer; background:transparent; border:0; padding:4px 6px; border-radius:999px;
    color:inherit;
  }
  .buki { opacity:.72; }
  .act svg { display:block; width:var(--icon); height:var(--icon); }
  .hovered .buki { opacity:1; background:rgba(127,155,234,.18); }
  .note { padding:16px 20px; color:#fff; font-size:12px; background:#2b2b2b; }
</style>
<div class="grid">${GROUNDS.map(panel).join('')}</div>
<div class="note">
  Best ramp stop against each ground:
  ${GROUNDS.map((g) => `${g.name} ${best(g.bg).toFixed(2)}:1`).join(' &nbsp;·&nbsp; ')}.
  The bar in <code>mark.test.ts</code> is 4.5:1 for the BEST stop, because a filled disc
  owes a legible silhouette rather than a uniform ratio.
</div>
`;

writeFileSync('zzz-x-button.html', html);
console.log('wrote zzz-x-button.html');
