/**
 * OPTION C: is there a second cover source, and can this extension actually use one?
 *
 * Established 2026-09-01 by `cover-missing.mjs`: OpenLibrary holds a perfect metadata
 * record and NO cover for *The Nvidia Way* (2024) and *Modern Mathematical Logic* (2022).
 * Its metadata comes from library records and its covers from contributed scans.
 *
 * A candidate source has to clear FOUR bars, not one, and a probe that only checks the
 * first is how a dead idea gets adopted:
 *
 *   1. COVERAGE   does it have these two books
 *   2. ACCESS     can we call it without a key, or is a key mandatory
 *   3. CORS       `rememberCover` READS THE BYTES with fetch(), so the image host must
 *                 send Access-Control-Allow-Origin. Item 56 is the whole lesson: a source
 *                 whose bytes cannot be read is a source that silently draws a board.
 *   4. SUBSTANCE  is it a real image or a placeholder. covers.openlibrary.org answers a
 *                 missing cover with a 43-byte blank and HTTP 200, and `rememberCover`
 *                 keeps anything with res.ok.
 *
 * SOURCES, and why each is here:
 *
 *   Google Books v1     developers.google.com/books/docs/v1/using says outright: "the
 *                       application must provide either the API key or an OAuth 2.0 token,
 *                       or both". Probed anyway to record what keyless actually does.
 *   Google Dynamic Links  the older books.google.com/books?jscmd=viewapi endpoint, which
 *                       historically needed no key. Probed to find out if it still exists.
 *   Apple iTunes Search  fully keyless by design, and returns artwork for ebooks.
 *
 * NOT IN THE SUITE: hits live hosts. Sequential with long pauses.
 *
 *   node tools/probe/cover-sources.mjs
 */

const PAUSE_MS = 4000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CASES = [
  { label: 'The Nvidia Way', isbn: '9781324086710', title: 'The Nvidia Way', author: 'Tae Kim' },
  { label: 'Modern Mathematical Logic', isbn: '9781108833141', title: 'Modern Mathematical Logic', author: 'Joseph Mileti' },
  { label: 'CONTROL: Dune', isbn: '9780441013593', title: 'Dune', author: 'Frank Herbert' },
];

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

/** Bars 3 and 4 together: real bytes, and bytes we are allowed to read. */
async function inspectImage(url) {
  try {
    const res = await fetch(url, { headers: { Origin: ORIGIN } });
    const bytes = (await res.arrayBuffer()).byteLength;
    const acao = res.headers.get('access-control-allow-origin');
    const readable = acao === '*' || acao === ORIGIN;
    return {
      line: `${res.status} ${bytes}b  ACAO=${JSON.stringify(acao)} ${readable ? 'READABLE' : 'NOT READABLE by fetch()'}${bytes < 1000 ? '  <-- placeholder-sized' : ''}`,
      ok: res.ok && bytes >= 1000 && readable,
    };
  } catch (err) {
    return { line: `ERR ${String(err).slice(0, 60)}`, ok: false };
  }
}

async function googleV1(isbn) {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  if (!res.ok) return { note: `HTTP ${res.status} (keyless)` };
  const body = await res.json();
  const v = body.items?.[0]?.volumeInfo;
  if (!v) return { note: 'no volume' };
  return { note: `"${v.title}"`, url: v.imageLinks?.thumbnail ?? null, links: Object.keys(v.imageLinks ?? {}) };
}

async function googleDynamic(isbn) {
  // The legacy Dynamic Links endpoint. jscmd=viewapi returns JSONP; callback is required
  // for JSONP but the payload is parseable either way.
  const url = `https://books.google.com/books?bibkeys=ISBN:${isbn}&jscmd=viewapi&callback=cb`;
  const res = await fetch(url);
  if (!res.ok) return { note: `HTTP ${res.status}` };
  const text = await res.text();
  const m = text.match(/"thumbnail_url"\s*:\s*"([^"]+)"/);
  if (!m) return { note: text.trim().length < 40 ? 'empty payload (no record)' : 'no thumbnail_url in payload' };
  return { note: 'thumbnail_url present', url: m[1].replace(/\\u0026/g, '&') };
}

async function itunes(title, author) {
  const term = encodeURIComponent(`${title} ${author}`);
  const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=ebook&limit=3`);
  if (!res.ok) return { note: `HTTP ${res.status}` };
  const body = await res.json();
  const hit = body.results?.[0];
  if (!hit) return { note: `no results (of ${body.resultCount ?? 0})` };
  return {
    note: `"${hit.trackName}" - ${hit.artistName}`,
    // artworkUrl100 is a template: the size segment can be raised.
    url: (hit.artworkUrl100 ?? '').replace('100x100bb', '400x400bb') || null,
  };
}

for (const { label, isbn, title, author } of CASES) {
  console.log(`\n${'='.repeat(78)}\n${label}   isbn ${isbn}\n${'='.repeat(78)}`);

  for (const [name, run] of [
    ['google books v1 (keyless)', () => googleV1(isbn)],
    ['google dynamic links', () => googleDynamic(isbn)],
    ['apple itunes search', () => itunes(title, author)],
  ]) {
    let out;
    try {
      out = await run();
    } catch (err) {
      out = { note: `ERR ${String(err).slice(0, 60)}` };
    }
    console.log(`\n  ${name}`);
    console.log(`    ${out.note}${out.links ? `  imageLinks: ${out.links.join(', ')}` : ''}`);
    if (out.url) {
      console.log(`    ${out.url}`);
      await sleep(1200);
      const img = await inspectImage(out.url);
      console.log(`    ${img.line}`);
    }
    await sleep(PAUSE_MS);
  }
}

console.log('\nA source has to clear ALL FOUR bars. Coverage alone is not an answer.');
