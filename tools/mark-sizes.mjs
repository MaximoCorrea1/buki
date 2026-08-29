/**
 * Render the mark at the sizes it actually ships at, on every ground, and look at it.
 *
 * WHY THIS EXISTS. `src/shared/mark.test.ts` proves the copies agree with `mark.mjs` and
 * that each ground clears its bar. Neither of those is looking at the thing. On 2026-08-16 a
 * caught-spine value was changed with a commit message claiming that at 25px it "reads as
 * the gap between two dark spines rather than as a third book". That claim was derived from
 * a contrast ratio and had never been rendered. Rendered, it was false. The 2026-08-15
 * session had already reached that conclusion and rejected a caught-versus-ground bar for
 * exactly this reason. Re-deriving a discarded metric from a number, twice, is what this
 * file is meant to stop: run it, then argue.
 *
 * REWRITTEN 2026-08-29, because it had been drawing a mark that no longer exists. The mark
 * was replaced on 2026-08-17 — three shelved spines and a caught one became the ball with
 * two eyes — and this file still reached for `MARK.cords`, `MARK.shelved`, `MARK.caught`
 * and a per-ground `spine`/`caught`. It threw `TypeError` on the first line of output for
 * eleven days while `README.md` listed it as working, because the only guard on it asked
 * whether it PARSED. It now parses AND runs, in `entryPoints.test.ts`.
 *
 * The geometry is no longer spelled out here. It calls `markSvg`, which is the same
 * function the six shipped surfaces are checked against, so this tool cannot drift from the
 * mark again the way it just did.
 *
 * USAGE
 *   node tools/mark-sizes.mjs                     writes zzz-mark-sizes.html
 *   node tools/mark-sizes.mjs --extra "#101820"   adds a CANDIDATE GROUND
 *
 * `--extra` used to take a candidate caught-spine colour. The mark owns all of its own
 * colour now — a gradient, one ink, one glint — so the only hex worth trying against it is
 * a ground it might have to survive on.
 *
 * The output is gitignored. Regenerate it rather than committing it.
 */
import { writeFileSync } from 'node:fs';
import { MARK, markSvg, contrast } from './mark.mjs';

/** The sizes the mark is really used at. 25 is the landing pill; 24 and 28 the extension. */
const SIZES = [16, 24, 25, 28, 40, 120];

/**
 * The bar `mark.test.ts` actually asserts: the BEST stop on the ramp clears 4.5:1. Not every
 * stop, deliberately — a filled disc owes a legible silhouette, not a uniform ratio, and
 * demanding every stop clear every ground fails a mark that renders perfectly at 16px.
 */
const BAR = 4.5;

const extraAt = process.argv.indexOf('--extra');
const extra = extraAt === -1 ? null : process.argv[extraAt + 1];

let id = 0;
const draw = (px) => `<svg width="${px}" height="${px}" viewBox="0 0 100 100">${markSvg(`s${++id}`)}</svg>`;

/** Ink or glint, whichever the ground cannot swallow. The label has to be readable too. */
const legibleOn = (ground) =>
  contrast(MARK.ink, ground) >= contrast(MARK.glint, ground) ? MARK.ink : MARK.glint;

const band = (label, ground) => {
  const stops = MARK.ramp.stops.map((s) => ({ color: s.color, ratio: contrast(s.color, ground) }));
  const best = Math.max(...stops.map((s) => s.ratio));
  const fg = legibleOn(ground);

  // Hierarchy by size and weight, never by a fade: this repo's own design law, and the
  // version of this file that died broke it with an opacity on the size labels.
  const cells = SIZES.map(
    (px) =>
      `<div style="text-align:center"><div style="font-size:10px;font-weight:700;letter-spacing:.08em">${px}</div>${draw(px)}</div>`,
  ).join('');

  const ramp = stops.map((s) => `${s.color} <b>${s.ratio.toFixed(2)}</b>`).join(' &nbsp;&middot;&nbsp; ');

  return `<section style="background:${ground};color:${fg};padding:20px 26px;font:12px ui-monospace,Menlo,Consolas,monospace">
  <p style="margin:0 0 4px;font-size:14px;font-weight:700">${label} &nbsp; ${ground}</p>
  <p style="margin:0 0 12px">best stop <b>${best.toFixed(2)}</b> against a bar of ${BAR}${best >= BAR ? '' : ' &nbsp; UNDER THE BAR'}
    &nbsp;&nbsp; ramp: ${ramp}</p>
  <div style="display:flex;gap:28px;align-items:flex-end;flex-wrap:wrap">${cells}</div>
</section>`;
};

const bands = Object.entries(MARK.grounds).map(([name, g]) => band(name, g.ground));
if (extra) bands.push(band('CANDIDATE GROUND', extra));

writeFileSync(
  'zzz-mark-sizes.html',
  `<!doctype html><meta charset="utf-8"><title>the mark, at size</title>
<body style="margin:0">${bands.join('')}</body>`,
);
console.log(
  `zzz-mark-sizes.html written: ${Object.keys(MARK.grounds).length} grounds${extra ? ` plus the candidate ground ${extra}` : ''}, ${SIZES.length} sizes each.`,
);
