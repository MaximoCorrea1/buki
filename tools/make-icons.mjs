// Generate the extension icons as PNGs, with no image dependencies.
// A book spine on the night-desk background: one warm spine plus a lamp-glow edge.
// Run: node tools/make-icons.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const SIZES = [16, 32, 48, 128];
const INK = [0x21, 0x1c, 0x1a]; // espresso background
const SPINE = [0x7c, 0x3a, 0x2e]; // oxblood bookcloth
const LAMP = [0xe7, 0xb2, 0x4c]; // lamp-glow amber

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

function png(size) {
  // Proportions of the mark, in fractions of the icon box.
  const left = Math.round(size * 0.3);
  const right = Math.round(size * 0.72);
  const top = Math.round(size * 0.16);
  const bottom = Math.round(size * 0.84);
  const glow = Math.max(1, Math.round(size * 0.06));

  const raw = Buffer.alloc(size * (size * 3 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // PNG filter: none
    for (let x = 0; x < size; x++) {
      const inSpine = x >= left && x < right && y >= top && y < bottom;
      const inGlow = inSpine && x >= right - glow;
      const px = inGlow ? LAMP : inSpine ? SPINE : INK;
      raw[p++] = px[0];
      raw[p++] = px[1];
      raw[p++] = px[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
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
