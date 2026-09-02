/**
 * The founder's second batch of cover-source candidates, 2026-09-02, against the same four
 * bars `cover-sources.mjs` used: COVERAGE, ACCESS, CORS, LICENCE.
 *
 * The CORS bar is the one that keeps eliminating candidates, and it is not negotiable:
 * `rememberCover` reads the bytes with fetch(), so a source that sends no
 * Access-Control-Allow-Origin caches nothing and silently draws a board - the exact symptom
 * being fixed. Item 56, from the other direction.
 *
 *   node tools/probe/cover-sources-2.mjs
 */

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const PAUSE_MS = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CASES = [
  { title: 'The Nvidia Way', author: 'Tae Kim', isbn: '9781324086710' },
  { title: 'Modern Mathematical Logic', author: 'Joseph Mileti', isbn: '9781108833141' },
  { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' },
];

async function inspectImage(url) {
  const res = await fetch(url, { headers: { Origin: ORIGIN } });
  const bytes = (await res.arrayBuffer()).byteLength;
  const acao = res.headers.get('access-control-allow-origin');
  const readable = acao === '*' || acao === ORIGIN;
  return `${res.status} ${bytes}b ACAO=${JSON.stringify(acao)} ${readable ? 'READABLE' : 'NOT READABLE by fetch()'}`;
}

/** bookcover-api, the public instance named in the repo's own README. */
async function bookcoverApi({ title, author, isbn }) {
  const out = [];
  for (const [label, url] of [
    ['by isbn', `https://bookcover.longitood.com/bookcover/${isbn}`],
    [
      'by title+author',
      `https://bookcover.longitood.com/bookcover?book_title=${encodeURIComponent(title)}&author_name=${encodeURIComponent(author)}`,
    ],
  ]) {
    try {
      const res = await fetch(url, { headers: { Origin: ORIGIN } });
      const text = await res.text();
      const acao = res.headers.get('access-control-allow-origin');
      let coverUrl = null;
      try {
        coverUrl = JSON.parse(text).url ?? null;
      } catch { /* not json */ }
      out.push(`    ${label.padEnd(16)} ${res.status} api-ACAO=${JSON.stringify(acao)} ${coverUrl ? '' : text.slice(0, 70)}`);
      if (coverUrl) {
        out.push(`      -> ${coverUrl.slice(0, 96)}`);
        await sleep(1200);
        out.push(`      image: ${await inspectImage(coverUrl)}`);
      }
    } catch (err) {
      out.push(`    ${label.padEnd(16)} ERR ${String(err).slice(0, 60)}`);
    }
    await sleep(PAUSE_MS);
  }
  return out;
}

for (const c of CASES) {
  console.log(`\n${'='.repeat(78)}\n${c.title}\n${'='.repeat(78)}`);
  console.log('  bookcover-api (bookcover.longitood.com, scrapes Goodreads)');
  for (const line of await bookcoverApi(c)) console.log(line);
}

console.log('\nA cover the extension cannot READ is a cover it cannot keep.');
