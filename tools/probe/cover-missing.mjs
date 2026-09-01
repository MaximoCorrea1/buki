/**
 * WHY DOES A BOOK GET A TITLE AND AN AUTHOR BUT NO COVER?
 *
 * Founder, 2026-09-01, two reproducible cases off his own shelf:
 *
 *   The Nvidia Way - Tae Kim              found correctly, no cover, fell back to purple
 *   Modern Mathematical Logic - Mileti    same
 *
 * `openLibrary.ts` takes its cover from ONE field and nowhere else:
 *
 *     const FIELDS = 'title,author_name,cover_i,isbn';
 *     const coverUrl = coverFor(doc.cover_i);
 *
 * So the question is entirely about `cover_i`. This probe asks four things, in order, and
 * refuses to guess any of them:
 *
 *   1. does the app's EXACT query find these books at all
 *   2. does the doc carry `cover_i`, and does it carry `isbn`
 *   3. do the fields we DO NOT ask for - cover_edition_key, edition_key - carry a cover
 *   4. does the covers API serve anything for the isbn or the edition key
 *
 * ⚠ AND ONE TRAP, WHICH IS THE POINT OF STEP 4. `covers.openlibrary.org` answers a MISSING
 * cover with a blank placeholder image and HTTP 200 unless you pass `default=false`. So a
 * naive "just build the url from the isbn" fix would replace a drawn board with a blank
 * grey rectangle and report success. Both forms are measured here.
 *
 * NOT IN THE SUITE: hits live hosts. Sequential with pauses - nineteen concurrent searches
 * earned an HTTP 429 on 2026-08-27 and took the catalogue down for two minutes.
 *
 *   node tools/probe/cover-missing.mjs
 */

const SITE = 'https://openlibrary.org';
const APP_FIELDS = 'title,author_name,cover_i,isbn';
const WIDE_FIELDS = 'title,author_name,cover_i,isbn,cover_edition_key,edition_key,first_publish_year';
const PAUSE_MS = 2500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CASES = [
  { title: 'The Nvidia Way', author: 'Tae Kim' },
  { title: 'Nvidia Way', author: 'Tae Kim' },
  { title: 'Modern Mathematical Logic', author: 'Joseph Mileti' },
];

async function search(title, author, fields) {
  const q = encodeURIComponent([title, author].filter(Boolean).join(' '));
  const url = `${SITE}/search.json?q=${q}&fields=${fields}&limit=3`;
  const res = await fetch(url);
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const body = await res.json();
  return { docs: body.docs ?? [], found: body.numFound };
}

/** Does this url serve a REAL cover, or the blank placeholder that pretends to be one? */
async function coverProbe(label, url) {
  try {
    const res = await fetch(url);
    const bytes = (await res.arrayBuffer()).byteLength;
    // A real -M cover measured 10-25KB on 2026-09-01. The placeholder is tiny.
    const verdict = !res.ok ? 'NO COVER (404)' : bytes < 1000 ? `PLACEHOLDER (${bytes}b)` : `REAL (${bytes}b)`;
    console.log(`      ${label.padEnd(34)} ${String(res.status).padEnd(4)} ${verdict}`);
    return res.ok && bytes >= 1000;
  } catch (err) {
    console.log(`      ${label.padEnd(34)} ERR  ${String(err).slice(0, 50)}`);
    return false;
  }
}

for (const { title, author } of CASES) {
  console.log(`\n${'='.repeat(78)}\n${title} - ${author}\n${'='.repeat(78)}`);

  console.log('\n  [1] THE APP\'S EXACT QUERY  fields=' + APP_FIELDS);
  const app = await search(title, author, APP_FIELDS);
  if (app.error) {
    console.log('      ' + app.error);
  } else {
    console.log(`      numFound=${app.found}`);
    app.docs.forEach((d, i) => {
      console.log(
        `      doc${i}: cover_i=${JSON.stringify(d.cover_i)}  isbn=${d.isbn ? `${d.isbn.length} values, first ${d.isbn[0]}` : 'ABSENT'}`,
      );
      console.log(`            "${d.title}" - ${(d.author_name ?? []).join(', ')}`);
    });
  }
  await sleep(PAUSE_MS);

  console.log('\n  [2] THE SAME QUERY, WIDER FIELDS  (what we are not asking for)');
  const wide = await search(title, author, WIDE_FIELDS);
  if (wide.error) {
    console.log('      ' + wide.error);
  } else {
    wide.docs.forEach((d, i) => {
      console.log(
        `      doc${i}: cover_i=${JSON.stringify(d.cover_i)} cover_edition_key=${JSON.stringify(d.cover_edition_key)} year=${JSON.stringify(d.first_publish_year)}`,
      );
      console.log(`            edition_key=${JSON.stringify((d.edition_key ?? []).slice(0, 4))}`);
    });
  }
  await sleep(PAUSE_MS);

  const doc = wide.docs?.[0];
  if (!doc) continue;

  console.log('\n  [3] CAN THE COVERS API SERVE ONE ANYWAY?');
  if (doc.cover_i) {
    await coverProbe('by id (what the app builds)', `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`);
    await sleep(PAUSE_MS);
  } else {
    console.log('      by id                              -    no cover_i, so the app builds NOTHING');
  }

  const isbn = doc.isbn?.[0];
  if (isbn) {
    await coverProbe('by isbn, default on', `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`);
    await sleep(PAUSE_MS);
    await coverProbe('by isbn, default=false', `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`);
    await sleep(PAUSE_MS);
  } else {
    console.log('      by isbn                            -    no isbn in the doc either');
  }

  const olid = doc.cover_edition_key ?? doc.edition_key?.[0];
  if (olid) {
    await coverProbe(`by olid ${olid}, default=false`, `https://covers.openlibrary.org/b/olid/${olid}-M.jpg?default=false`);
    await sleep(PAUSE_MS);
  } else {
    console.log('      by olid                            -    no edition key either');
  }
}

console.log('\nDone. Read cover_i first: if it is absent, the app cannot build a url at all.');
