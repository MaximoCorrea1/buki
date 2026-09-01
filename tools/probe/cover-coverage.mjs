/**
 * OPTION C, the number that actually decides it: HOW OFTEN would a second source help?
 *
 * `cover-sources.mjs` (2026-09-01) narrowed the field to one usable candidate and it was
 * not the obvious one:
 *
 *   Google Books v1        HTTP 429 keyless, and the docs say a key is mandatory
 *   Google Dynamic Links   HAS every cover tried, and answers with NO
 *                          Access-Control-Allow-Origin - so `rememberCover`, which reads
 *                          the bytes with fetch(), cannot keep any of them. Item 56's
 *                          lesson, arriving from the other direction.
 *   Apple iTunes Search    keyless, ACAO=*, real bytes - and it missed a Cambridge
 *                          monograph entirely.
 *
 * So the question is no longer "does a second source exist". It is: of the books
 * OpenLibrary has no art for, what share does Apple actually cover, and what does it cost
 * to ask. Two data points is an anecdote.
 *
 * ALSO MEASURED: the artwork's real pixel dimensions, read out of the JPEG header rather
 * than assumed. Apple's `bb` suffix is a BOUNDING BOX - if it letterboxes a cover to a
 * square with white bars, a face-out shelf of them looks worse than the drawn boards.
 *
 *   node tools/probe/cover-coverage.mjs
 */

const PAUSE_MS = 2200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A spread of what somebody actually catches: trade, technical, academic, translated. */
const BOOKS = [
  ['The Nvidia Way', 'Tae Kim'],
  ['Modern Mathematical Logic', 'Joseph Mileti'],
  ['The Anxious Generation', 'Jonathan Haidt'],
  ['Chip War', 'Chris Miller'],
  ['Designing Data-Intensive Applications', 'Martin Kleppmann'],
  ['Cien anos de soledad', 'Gabriel Garcia Marquez'],
  ['Category Theory in Context', 'Emily Riehl'],
  ['The Bitcoin Standard', 'Saifedean Ammous'],
  ['Termination Shock', 'Neal Stephenson'],
  ['Dune', 'Frank Herbert'],
];

/** Width and height out of the JPEG's SOF marker. No library, no guessing. */
function jpegSize(buf) {
  const b = new Uint8Array(buf);
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    // SOF0..SOF15, excluding DHT (c4), JPG (c8) and DAC (cc).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return null;
}

async function openLibraryHasCover(title, author) {
  const q = encodeURIComponent(`${title} ${author}`);
  const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=title,cover_i&limit=1`);
  if (!res.ok) return { err: `HTTP ${res.status}` };
  const body = await res.json();
  const doc = body.docs?.[0];
  return { found: Boolean(doc), cover: Boolean(doc?.cover_i) };
}

async function appleCover(title, author) {
  const term = encodeURIComponent(`${title} ${author}`);
  const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=ebook&limit=1`);
  if (!res.ok) return { err: `HTTP ${res.status}` };
  const body = await res.json();
  const hit = body.results?.[0];
  if (!hit?.artworkUrl100) return { none: true };
  return { url: hit.artworkUrl100.replace('100x100bb', '400x400bb'), name: hit.trackName, by: hit.artistName };
}

const rows = [];
for (const [title, author] of BOOKS) {
  const ol = await openLibraryHasCover(title, author);
  await sleep(PAUSE_MS);
  const ap = await appleCover(title, author);
  await sleep(PAUSE_MS);

  let dims = '';
  let bytes = 0;
  if (ap.url) {
    const img = await fetch(ap.url);
    const buf = await img.arrayBuffer();
    bytes = buf.byteLength;
    const s = jpegSize(buf);
    dims = s ? `${s.w}x${s.h}${s.w === s.h ? '  SQUARE - letterboxed' : ''}` : 'not a jpeg';
    await sleep(PAUSE_MS);
  }

  rows.push({ title, olCover: ol.cover, apple: Boolean(ap.url), dims, bytes, matched: ap.name ?? '' });
  console.log(
    `${title.slice(0, 38).padEnd(38)} OL:${ol.cover ? 'cover' : 'NONE '}  Apple:${ap.url ? 'cover' : 'NONE '}  ${dims.padEnd(22)} ${bytes ? `${bytes}b` : ''}`,
  );
  if (ap.url && ap.name && !ap.name.toLowerCase().includes(title.toLowerCase().slice(0, 12))) {
    console.log(`${''.padEnd(38)}  ⚠ Apple matched a DIFFERENT title: "${ap.name}" - ${ap.by}`);
  }
}

const noOl = rows.filter((r) => !r.olCover);
const rescued = noOl.filter((r) => r.apple);
console.log(`\n${'-'.repeat(78)}`);
console.log(`OpenLibrary has no cover for ${noOl.length} of ${rows.length}`);
console.log(`Apple has a cover for ${rescued.length} of those ${noOl.length}`);
console.log(`Apple would ALSO cover ${rows.filter((r) => r.olCover && r.apple).length} that OpenLibrary already handles`);
const squares = rows.filter((r) => r.dims.includes('SQUARE'));
console.log(`Letterboxed to square: ${squares.length} of ${rows.filter((r) => r.apple).length}`);
