/**
 * Just enough PNG to READ the icons this repo writes back off disk.
 *
 * It lives in `tools/` rather than in a test for the same reason `mark.mjs` does: this
 * package ships no `@types/node`, deliberately, because everything in `src/` runs in a
 * browser. A `.ts` test cannot touch `node:fs` or `Buffer` without adding that dependency
 * to a browser extension, so the file access lives here and the test imports it the way it
 * imports the mark - untyped, with one `@ts-expect-error`.
 *
 * It also stops the fourth hand-rolled copy of this decoder: verifying a rendered pixel is
 * the only honest way to check a drawing, and 2026-08-17 alone produced three throwaway
 * versions in the scratch directory before this one earned a home.
 *
 * Handles 8-bit RGB and RGBA, non-interlaced, which is exactly what `make-icons.mjs`
 * emits. Anything else throws rather than returning plausible garbage.
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function decodePng(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file} is not a PNG`);

  let p = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error(`${file}: only 8-bit is handled, got ${depth}`);
  if (interlace !== 0) throw new Error(`${file}: interlaced PNGs are not handled`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`${file}: colour type ${colorType} is not handled`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  const prev = Buffer.alloc(stride);
  let off = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[off++];
    const line = raw.subarray(off, off + stride);
    off += stride;
    const row = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? row[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[i] = v & 0xff;
    }
    row.copy(pixels, y * stride);
    row.copy(prev);
  }

  const clamp = (v, hi) => Math.min(hi - 1, Math.max(0, v));
  return {
    width,
    height,
    /** The pixel containing this coordinate, clamped to the image. */
    at(x, y) {
      const i = (clamp(y, height) * width + clamp(x, width)) * channels;
      return {
        r: pixels[i],
        g: pixels[i + 1],
        b: pixels[i + 2],
        a: channels === 4 ? pixels[i + 3] : 255,
      };
    },
  };
}
