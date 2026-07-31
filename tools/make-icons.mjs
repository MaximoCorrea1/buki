// Generate the Buki icons as PNGs, with no image dependencies.
// Three spines of unequal height, crossed by one cord.
// Run: node tools/make-icons.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const SIZES = [16, 32, 48, 128];

const CLOTH = [
  [0xff, 0x63, 0x52], // coral
  [0x2f, 0xb8, 0x8a], // jade
  [0x6c, 0x7b, 0xff], // periwinkle
];
const GILT = [0xfa, 0xe6, 0x36];

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
 * Transparent ground, so the mark reads on a light or a dark toolbar alike. At 16px it
 * reduces to three coloured bars and a gold line, which is the whole test: a mark that
 * survives the toolbar is a mark.
 */
function png(size) {
  const u = size / 16; // one unit = one pixel at the smallest size
  const px = (n) => Math.round(n * u);

  // Two upright, one leaning against them. The lean is what makes this a shelf rather
  // than a bar chart - it is the silhouette everyone recognises, and it survives 16px
  // where a drawn book never would.
  const spines = [
    { x0: px(1.5), x1: px(5), y0: px(3.5), lean: 0 },
    { x0: px(5.5), x1: px(9), y0: px(1.5), lean: 0 },
    { x0: px(9.5), x1: px(12.5), y0: px(4), lean: px(2.5) },
  ];
  const floor = px(14.5);
  const cordY = px(9);
  const cordH = Math.max(1, px(1));

  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // PNG filter: none
    for (let x = 0; x < size; x++) {
      const hit = spines.findIndex((s) => {
        if (y < s.y0 || y >= floor) return false;
        // Upright at the floor, displaced at the top: the book tips away from the stack.
        const shift = s.lean ? (s.lean * (floor - y)) / (floor - s.y0) : 0;
        return x >= s.x0 + shift && x < s.x1 + shift;
      });
      if (hit === -1) {
        raw[p++] = 0;
        raw[p++] = 0;
        raw[p++] = 0;
        raw[p++] = 0; // transparent
        continue;
      }
      const onCord = y >= cordY && y < cordY + cordH;
      const colour = onCord ? GILT : CLOTH[hit];
      raw[p++] = colour[0];
      raw[p++] = colour[1];
      raw[p++] = colour[2];
      raw[p++] = 0xff;
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
