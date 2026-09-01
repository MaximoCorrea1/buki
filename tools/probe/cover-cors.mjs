/**
 * ITEM 56, and it has been open since the 08-24 review: does the cover redirect chain
 * answer with CORS headers the extension can actually use?
 *
 * `coverCache.ts` claims it: *"Verified against the live hosts: every hop answers with
 * permissive CORS and the final node reflects the extension origin back, so this needs no
 * extra host permission."* THE LANE says the opposite — never probed. Two records
 * disagreeing is settled by the system, not by picking the confident one.
 *
 * WHY IT MATTERS, in the founder's words on 2026-09-01: *"sometimes the cover doesnt load
 * or doesnt find it, instead of showing a color."* Item 56's own line predicts exactly that
 * — *"if it is wrong every shelf cover silently falls back to a drawn board."*
 *
 * The worker fetches covers with the extension's origin. Chrome sends `Origin:
 * chrome-extension://<id>` on those requests, and without a matching
 * `Access-Control-Allow-Origin` the response is opaque and `res.ok` is false, so
 * `rememberCover` keeps nothing and every cover is a permanent miss.
 *
 *   node tools/probe/cover-cors.mjs
 */

const COVERS = [
  'https://covers.openlibrary.org/b/id/8231856-M.jpg',
  'https://covers.openlibrary.org/b/id/12648304-M.jpg',
];

// The id is not knowable until publication (item 37), so this stands in for the shape.
// What matters is that the server reflects an arbitrary chrome-extension origin, or *.
const FAKE_ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const PAUSE_MS = 2500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CORS_KEYS = [
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'timing-allow-origin',
  'cross-origin-resource-policy',
];

function reportCors(label, res) {
  const acao = res.headers.get('access-control-allow-origin');
  const usable = acao === '*' || acao === FAKE_ORIGIN;
  console.log(`  ${label.padEnd(22)} ${String(res.status).padEnd(4)} ACAO=${JSON.stringify(acao)} ${usable ? 'USABLE' : 'NOT USABLE'}`);
  for (const key of CORS_KEYS.slice(1)) {
    const v = res.headers.get(key);
    if (v) console.log(`  ${''.padEnd(22)}      ${key}: ${v}`);
  }
  return usable;
}

console.log(`ITEM 56 — cover CORS, live. Origin sent: ${FAKE_ORIGIN}\n`);

let allUsable = true;
for (const url of COVERS) {
  console.log(url);

  // Hop 1, NOT followed: this is what the first host says on its own.
  const first = await fetch(url, { redirect: 'manual', headers: { Origin: FAKE_ORIGIN } });
  console.log(`  hop 1 status ${first.status}${first.headers.get('location') ? ` -> ${first.headers.get('location')}` : ''}`);
  reportCors('hop 1', first);
  await sleep(PAUSE_MS);

  // The whole chain, as the worker actually performs it.
  const followed = await fetch(url, { redirect: 'follow', headers: { Origin: FAKE_ORIGIN } });
  const usable = reportCors('final (followed)', followed);
  const bytes = (await followed.arrayBuffer()).byteLength;
  console.log(`  final url  ${followed.url}`);
  console.log(`  ok=${followed.ok} bytes=${bytes}`);
  if (!usable) allUsable = false;
  console.log('');
  await sleep(PAUSE_MS);
}

console.log(
  allUsable
    ? 'EVERY HOP RETURNED A USABLE Access-Control-Allow-Origin. coverCache.ts is right; item 56 closes.'
    : 'AT LEAST ONE HOP DID NOT. In a browser that response is opaque, res.ok is false, and rememberCover keeps NOTHING - every cover a permanent miss, every shelf a drawn board.',
);
console.log(
  '\nCAVEAT, stated rather than discovered later: node does not ENFORCE CORS. This reads the\nheaders the server sends; only a real extension proves the browser accepts them. Item 3.',
);
