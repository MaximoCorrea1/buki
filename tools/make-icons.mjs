// Generate the Buki toolbar icons as PNGs, with no image dependencies.
//
// WHAT THIS USED TO DRAW, and why it was replaced on 2026-08-15: three hard-edged bars in
// coral, jade and periwinkle, crossed by one gold cord, on a transparent ground. That is
// the FIRST-generation mark. It had not been touched since, so the icon in Chrome's
// toolbar was a different logo from the one on the landing, in the popup and on the
// options page — the one place a user sees the mark every single day.
//
// It now renders the same drawing as everywhere else, from the same definition:
// tools/mark.mjs. src/shared/mark.test.ts fails the build if any copy drifts from it.
//
// Run: node tools/make-icons.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { MARK, inRoundRect } from './mark.mjs';

const SIZES = [16, 32, 48, 128];

const PLATE = [0xfb, 0xf7, 0xec];
const SPINE = [0x0a, 0x0f, 0x33];
const CAUGHT = [0x2f, 0x7f, 0xd6];

/** The mark is inset inside its plate, matching icons/icon.svg exactly. */
const INSET = 0.86;
/** Plate corner radius, in the same 0..100 space. */
const PLATE_RX = 22;
/**
 * Supersampling. A 16px icon carries the whole burden here: without it the rounded ends
 * and the 8-degree tilt alias into a staircase, which is precisely how a drawn mark comes
 * out looking worse than three flat bars. 4x4 per pixel is 16 samples and is instant at
 * these sizes.
 */
const SS = 4;

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Undo the mark's inset, so a point in plate space can be tested against MARK's numbers. */
function toMarkSpace(x, y) {
  return [(x - 50) / INSET + 50, (y - 50) / INSET + 50];
}

/** Undo the caught spine's rotation, so it can be tested as an upright rounded rect. */
function unrotate(x, y, deg, [px, py]) {
  const r = (-deg * Math.PI) / 180;
  const dx = x - px;
  const dy = y - py;
  return [px + dx * Math.cos(r) - dy * Math.sin(r), py + dx * Math.sin(r) + dy * Math.cos(r)];
}

/**
 * The cords are dropped below 32px, and that is a size decision rather than a shortcut.
 * A cord is 1.9 units of 100, which at 16px is 0.3 of a pixel: it cannot be drawn, so it
 * renders as a grey smear across all three spines and costs the silhouette the one thing
 * a 16px mark has. Every icon set simplifies at the smallest size for exactly this reason.
 * At 32px they are 0.6px, still soft but legible as two rules, and at 48 and 128 they are
 * the stamped cords the generated covers carry.
 */
function onCord(y, size) {
  if (size < 32) return false;
  return MARK.cords.some((c) => y >= c.y && y < c.y + c.h);
}

/** Colour at one sample point, in plate space, or null for outside the plate. */
function sample(x, y, size) {
  if (!inRoundRect(x, y, { x: 0, y: 0, w: 100, h: 100, rx: PLATE_RX })) return null;

  const [mx, my] = toMarkSpace(x, y);

  // The caught spine is drawn over the shelved pair, so it is tested first.
  const c = MARK.caught;
  const [rx, ry] = unrotate(mx, my, c.rotate, c.pivot);
  if (inRoundRect(rx, ry, c)) return onCord(ry, size) ? PLATE : CAUGHT;

  for (const s of MARK.shelved) {
    if (inRoundRect(mx, my, s)) return onCord(my, size) ? PLATE : SPINE;
  }
  return PLATE;
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let py = 0; py < size; py++) {
    raw[p++] = 0; // PNG filter: none
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ((px + (sx + 0.5) / SS) / size) * 100;
          const y = ((py + (sy + 0.5) / SS) / size) * 100;
          const hit = sample(x, y, size);
          if (hit) {
            r += hit[0];
            g += hit[1];
            b += hit[2];
            a += 255;
          }
        }
      }
      const n = SS * SS;
      // Premultiplied average over COVERED samples only, so the plate's rounded corner
      // fades to transparent rather than to black.
      const cov = a / 255;
      raw[p++] = cov ? Math.round(r / cov) : 0;
      raw[p++] = cov ? Math.round(g / cov) : 0;
      raw[p++] = cov ? Math.round(b / cov) : 0;
      raw[p++] = Math.round(a / n);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir('icons', { recursive: true });
for (const size of SIZES) {
  await writeFile(`icons/icon${size}.png`, png(size));
  console.log(`icons/icon${size}.png`);
}

/**
 * The landing's favicon set is written from here too, rather than copied by hand. It is
 * the same mark at different sizes, and a hand-copied icon is one more copy to drift:
 * docs/ carried the FIRST-generation mark for as long as icons/ did.
 */
for (const [size, out] of [
  [32, 'docs/icon32.png'],
  [180, 'docs/icon180.png'],
]) {
  await writeFile(out, png(size));
  console.log(out);
}
