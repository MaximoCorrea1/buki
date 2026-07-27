import { build } from 'esbuild';
import { cp, mkdir, access, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

const OUT = 'dist';
const TESS = `${OUT}/tesseract`;

// 1. Bundle the TypeScript entry points.
await build({
  entryPoints: {
    content: 'src/extension/content.ts',
    popup: 'src/extension/popup.ts',
    background: 'src/extension/background.ts',
    offscreen: 'src/extension/offscreen.ts',
  },
  outdir: OUT,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome110',
  logLevel: 'info',
});

// 2. Copy Tesseract's worker + WASM cores locally (extensions can't load them from a CDN).
//
// Only the *-lstm* cores can ever load: offscreen.ts calls createWorker('eng', 1, ...)
// where 1 = OEM.LSTM_ONLY, and tesseract.js sets lstmOnlyCore=true for that value
// (createWorker.js:36). It then picks relaxedsimd-lstm / simd-lstm / lstm by feature
// detection. Copying the whole core dir shipped 3 unreachable non-LSTM cores (~24MB).
// Keep the LICENSE - tesseract.js-core is Apache-2.0 and requires attribution.
await mkdir(TESS, { recursive: true });
await cp('node_modules/tesseract.js-core', TESS, {
  recursive: true,
  filter: (src) => {
    const name = basename(src);
    if (!name.includes('tesseract-core')) return true; // dirs, LICENSE, package.json
    return name.includes('-lstm.');
  },
});
await cp('node_modules/tesseract.js/dist/worker.min.js', `${TESS}/worker.min.js`);

// 3. Download the English language data once (not shipped in node_modules).
const TRAINEDDATA = `${TESS}/eng.traineddata.gz`;
const haveData = await access(TRAINEDDATA).then(() => true, () => false);
if (!haveData) {
  const url = 'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz';
  console.log('Downloading', url, '...');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`traineddata download failed: HTTP ${res.status}`);
  await writeFile(TRAINEDDATA, Buffer.from(await res.arrayBuffer()));
  console.log('Saved', TRAINEDDATA);
}

console.log('Built dist/{content,popup,background,offscreen}.js + tesseract assets');
