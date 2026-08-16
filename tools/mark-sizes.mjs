/**
 * Render the mark at the sizes it actually ships at, on every ground, and look at it.
 *
 * WHY THIS EXISTS. `src/shared/mark.test.ts` proves the copies agree with `mark.mjs` and
 * that each ground clears its two bars. Neither of those is looking at the thing. On
 * 2026-08-16 a caught-spine value was changed with a commit message claiming that at 25px
 * it "reads as the gap between two dark spines rather than as a third book". That claim
 * was derived from a contrast ratio and had never been rendered. Rendered, it is false:
 * the spine is flanked by two near-black neighbours, so the eye uses the LOCAL contrast
 * and the pale blue reads perfectly well.
 *
 * The 2026-08-15 session had already reached that conclusion and rejected a
 * caught-versus-ground bar for exactly this reason. Re-deriving a discarded metric from a
 * number, twice, is what this file is meant to stop: run it, then argue.
 *
 * USAGE
 *   node tools/mark-sizes.mjs            writes zzz-mark-sizes.html
 *   node tools/mark-sizes.mjs --extra "#7cc0fd"   adds a candidate on every cream ground
 *
 * The output is gitignored. Regenerate it rather than committing it.
 */
import { writeFileSync } from 'node:fs';
import { MARK, contrast } from './mark.mjs';

/** The sizes the mark is really used at. 25 is the landing pill; 24 and 28 the extension. */
const SIZES = [16, 24, 25, 28, 40, 120];

const extraAt = process.argv.indexOf('--extra');
const extra = extraAt === -1 ? null : process.argv[extraAt + 1];

let id = 0;
const draw = (px, spine, caught) => {
  const i = ++id;
  return `<svg width="${px}" height="${px}" viewBox="0 0 100 100">
  <mask id="m${i}">
    <rect x="-25" y="-25" width="150" height="150" fill="#fff"/>
${MARK.cords
  .map((c) => `    <rect x="-25" y="${c.y}" width="150" height="${c.h}" fill="#000"/>`)
  .join('\n')}
  </mask>
  <g mask="url(#m${i})" fill="${spine}">
${MARK.shelved
  .map((s) => `    <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx}"/>`)
  .join('\n')}
  </g>
  <g transform="rotate(${MARK.caught.rotate} ${MARK.caught.pivot[0]} ${MARK.caught.pivot[1]})" mask="url(#m${i})">
    <rect x="${MARK.caught.x}" y="${MARK.caught.y}" width="${MARK.caught.w}" height="${MARK.caught.h}" rx="${MARK.caught.rx}" fill="${caught}"/>
  </g>
</svg>`;
};

const band = (label, ground, spine, caught) => {
  const cells = SIZES.map(
    (px) =>
      `<div style="text-align:center"><div style="font-size:10px;opacity:.7">${px}</div>${draw(px, spine, caught)}</div>`,
  ).join('');
  return `<section style="background:${ground};color:${spine};padding:20px 26px;font:12px ui-monospace,Menlo,Consolas,monospace">
  <p style="margin:0 0 12px">${label}
    &nbsp; caught/spines <b>${contrast(caught, spine).toFixed(2)}</b>
    &nbsp; spines/ground <b>${contrast(spine, ground).toFixed(2)}</b>
    &nbsp; caught/ground ${contrast(caught, ground).toFixed(2)}</p>
  <div style="display:flex;gap:28px;align-items:flex-end;flex-wrap:wrap">${cells}</div>
</section>`;
};

const bands = [];
for (const [name, g] of Object.entries(MARK.grounds)) {
  bands.push(band(`${name} &mdash; ${g.caught}`, g.ground, g.spine, g.caught));
  if (extra) {
    bands.push(band(`${name} &mdash; CANDIDATE ${extra}`, g.ground, g.spine, extra));
  }
}

writeFileSync(
  'zzz-mark-sizes.html',
  `<!doctype html><meta charset="utf-8"><title>the mark, at size</title>
<body style="margin:0">${bands.join('')}</body>`,
);
console.log(
  `zzz-mark-sizes.html written: ${Object.keys(MARK.grounds).length} grounds${extra ? ` plus the candidate ${extra}` : ''}, ${SIZES.length} sizes each.`,
);
