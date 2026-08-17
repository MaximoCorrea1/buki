// Generate the Buki toolbar icons as PNGs, with no image dependencies.
//
// It renders the same drawing as everywhere else, from the same definition: tools/mark.mjs.
// src/shared/mark.test.ts fails the build if any SVG copy drifts from it, and this file
// reads the definition directly so a raster copy cannot drift either.
//
// THE PLATE IS GONE, as of 2026-08-17 with the mark itself. The old drawing needed one:
// two INK spines on Chrome's dark toolbar vanished into it and left a single pale bar with
// two floating cords, so a cream plate was what made the ground ours. The ball carries its
// own colour and its own silhouette - 11.98:1 on black, 8.9:1 on white - so it is drawn on
// transparency, which is what a toolbar icon should be.
//
// Run: node tools/make-icons.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { MARK, inCircle, inEllipse, rampAt } from './mark.mjs';

const SIZES = [16, 32, 48, 128];

const INK = [0x09, 0x1a, 0x3b];
const GLINT = [0xfd, 0xfd, 0xfd];

/**
 * Supersampling. A 16px icon carries the whole burden here: without it the ball's edge and
 * the eyes' curves alias into a staircase. 4x4 per pixel is 16 samples and is instant.
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

/**
 * Colour at one sample point, or null for outside the ball.
 *
 * THE CATCHLIGHTS ARE DROPPED BELOW 32px, and that is a size decision rather than a
 * shortcut. A catchlight is 7.8 units across of 100, which at 16px is 1.2 pixels sitting
 * inside a 4-pixel eye: drawn, it eats the eye it is supposed to sit in and the face reads
 * as two grey smudges. The eyes are what carry the mark at 16px, so they get the pixels.
 * Every icon set simplifies at its smallest size for exactly this reason.
 */
function sample(x, y, size) {
  if (!inCircle(x, y, MARK.ball)) return null;
  if (size >= 32 && MARK.catchlights.some((c) => inCircle(x, y, c))) return GLINT;
  if (MARK.eyes.some((e) => inEllipse(x, y, e))) return INK;
  return rampAt(x, y);
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
      // Premultiplied average over COVERED samples only, so the ball's edge fades to
      // transparent rather than to black.
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
