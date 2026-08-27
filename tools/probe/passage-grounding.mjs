/**
 * Can Buki find a book from a PASSAGE, and can the answer be CHECKED?
 *
 * `OPENWORK.md` item 57. Re-runnable evidence for
 * `docs/superpowers/specs/2026-08-27-passage-probe.md`, which this replaced the guesses
 * in. Run from the repo root:
 *
 *     node tools/probe/passage-grounding.mjs
 *
 * It hits a live third-party endpoint, so it is a PROBE and not a test: it is not in the
 * vitest suite, nothing in CI depends on it, and its numbers are expected to move. What
 * it must keep proving is the SHAPE - that scoping works, that the check refuses, and
 * that coverage stops at the public domain.
 *
 * ---
 *
 * WHAT IT ESTABLISHED, 2026-08-27, and each line is a query below rather than a belief:
 *
 * 1. FIELD FILTERS ARE DEAD. `AND meta_mediatype:texts` is true of every document in the
 *    corpus and returns 0. The meta_* keys are STORED, not indexed. The first spec guessed
 *    `edition_key:` and read its 0 as "scoping is impossible" - a wrong field name and an
 *    unsupported filter look identical from outside, which is why step A watches a filter
 *    that MUST match everything before believing one that failed.
 *
 * 2. BARE BOOLEAN SCOPING WORKS. `"<passage>" AND Austen` cut 2,228 hits to 227 and moved
 *    the book from absent-in-the-top-3 to RANK 1. That is the floor the spec said might
 *    not exist.
 *
 * 3. THE COUNT IS NOT THE CHECK. `"<austen passage>" AND Hemingway` returns 115 hits,
 *    because Hemingway is a cocktail and the top hit is a cocktail recipe book. Any design
 *    reading "total > 0" as confirmation would put Hemingway on the shelf.
 *
 * 4. THE TITLES ARE THE CHECK. Right author -> "Pride and prejudice, Jane Austen" at rank
 *    1. Wrong author -> "Book girl's guide to cocktails". Comparing the model's proposed
 *    title against the hit titles discriminated 5 of 5, and it costs no extra request
 *    because the titles are already in the payload.
 *
 * 5. IT REFUSES THE REALISTIC MISTAKE. Wrong-book-right-author is what a model actually
 *    gets wrong, not wrong-author. 7 of 8 refused; the 8th matched an omnibus at rank 8
 *    while the right answer sat at rank 1, so BEST match rather than ANY match closes it.
 *
 * 6. COVERAGE IS THE CEILING, NOT RANKING. Four modern in-copyright novels: none found,
 *    two returned literally zero hits. Public-domain classics work. This decides what the
 *    feature may PROMISE.
 */

const INSIDE = 'https://openlibrary.org/search/inside.json';

/**
 * Sequential, with a pause. Nineteen concurrent searches at openlibrary.org earned an
 * HTTP 429 and two minutes of nothing on 2026-08-27. See `mapPool.ts`.
 */
const PAUSE_MS = 2600;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Does this hit's title claim to BE the proposed book?
 *
 * STARTS-WITH, NOT CONTAINS, and the difference is the whole finding. "Twentieth century
 * interpretations of Pride and prejudice" CONTAINS the title and is a book of criticism;
 * "Pride and prejudice, Jane Austen" STARTS WITH it and is the book. Contains is the loose
 * rule that ranked criticism as the answer, which is the failure the first spec recorded.
 */
export function claimsToBe(hitTitle, wanted) {
  const h = norm(hitTitle);
  const w = norm(wanted);
  if (!h || !w) return false;
  return h === w || h.startsWith(w + ' ') || h.startsWith(w);
}

async function ask(q) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${INSIDE}?q=${encodeURIComponent(q)}`, {
      headers: { 'user-agent': 'buki-probe/1.0 (pre-launch feasibility probe)' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { status: res.status, total: 0, hits: [], ms: Date.now() - t0 };
    const body = await res.json();
    return {
      status: 200,
      total: body?.hits?.total ?? 0,
      hits: (body?.hits?.hits ?? []).map((h) => (h.fields?.meta_title ?? [])[0] ?? ''),
      ms: Date.now() - t0,
    };
  } catch (err) {
    return { status: 0, total: 0, hits: [], ms: Date.now() - t0, err: err.name };
  }
}

const AUSTEN =
  'It is a truth universally acknowledged, that a single man in possession of a good fortune';

const CASES = [
  ['Pride and Prejudice', 'Austen', 'Hemingway', AUSTEN],
  ['Nineteen Eighty-Four', 'Orwell', 'Tolkien', 'It was a bright cold day in April, and the clocks were striking thirteen'],
  ['Moby-Dick', 'Melville', 'Dickens', 'Call me Ishmael. Some years ago, never mind how long precisely'],
  ['A Tale of Two Cities', 'Dickens', 'Austen', 'It was the best of times, it was the worst of times, it was the age of wisdom'],
  ['Frankenstein', 'Shelley', 'Twain', 'You will rejoice to hear that no disaster has accompanied the commencement of an enterprise'],
];

const MODERN = [
  ['The Hunger Games', 'Collins', 'When I wake up, the other side of the bed is cold'],
  ['Gone Girl', 'Flynn', 'When I think of my wife, I always think of her head'],
  ['The Road', 'McCarthy', 'When he woke in the woods in the dark and the cold of the night'],
  ['Normal People', 'Rooney', 'Marianne answers the door when Connell rings the bell'],
];

async function main() {
  console.log('A. IS SCOPING HONOURED AT ALL? (watch a filter SUCCEED before trusting one that failed)');
  const bare = await ask(`"${AUSTEN}"`);
  await sleep(PAUSE_MS);
  console.log(`   bare phrase                 total=${bare.total}  ${bare.ms}ms`);
  const everything = await ask(`"${AUSTEN}" AND meta_mediatype:texts`);
  await sleep(PAUSE_MS);
  console.log(`   AND meta_mediatype:texts    total=${everything.total}  <- true of EVERY document; 0 means field filters are dead`);
  const word = await ask(`"${AUSTEN}" AND Austen`);
  await sleep(PAUSE_MS);
  console.log(`   AND Austen (bare term)      total=${word.total}  top=${JSON.stringify(word.hits[0])}`);
  const impossible = await ask(`"${AUSTEN}" AND zzqxwvunobtainium`);
  await sleep(PAUSE_MS);
  console.log(`   AND impossible word         total=${impossible.total}  <- negative control: AND must narrow`);

  console.log('\nB. DOES A TITLE-MATCH CHECK DISCRIMINATE? Each book paired with a wrong author.');
  let ok = 0;
  const latency = [];
  for (const [book, author, wrong, passage] of CASES) {
    const good = await ask(`"${passage}" AND ${author}`);
    await sleep(PAUSE_MS);
    const bad = await ask(`"${passage}" AND ${wrong}`);
    await sleep(PAUSE_MS);
    latency.push(good.ms, bad.ms);
    const g = good.hits.findIndex((h) => claimsToBe(h, book));
    const b = bad.hits.findIndex((h) => claimsToBe(h, book));
    const discriminates = g >= 0 && b < 0;
    if (discriminates) ok++;
    console.log(
      `   ${book.padEnd(22)} right(+${author}) ${g >= 0 ? `rank ${g + 1}` : 'none'}`.padEnd(56) +
        `wrong(+${wrong}) ${b >= 0 ? `rank ${b + 1}` : 'none'}`.padEnd(26) +
        (discriminates ? 'DISCRIMINATES' : 'DOES NOT'),
    );
  }
  console.log(`   => ${ok}/${CASES.length} discriminate`);

  console.log('\nC. THE REALISTIC HALLUCINATION: wrong BOOK, right author.');
  const a = await ask(`"${AUSTEN}" AND Austen`);
  await sleep(PAUSE_MS);
  for (const wrongBook of ['Emma', 'Sense and Sensibility', 'Persuasion', 'Mansfield Park']) {
    const r = a.hits.findIndex((h) => claimsToBe(h, wrongBook));
    console.log(
      `   proposed ${JSON.stringify(wrongBook).padEnd(24)} -> ${r >= 0 ? `MATCHED rank ${r + 1} (${JSON.stringify(a.hits[r])})` : 'refused'}`,
    );
  }
  const right = a.hits.findIndex((h) => claimsToBe(h, 'Pride and Prejudice'));
  console.log(`   proposed "Pride and Prejudice" -> rank ${right + 1}   <- BEST match, not ANY match, is what settles it`);

  console.log('\nD. COVERAGE. Modern in-copyright fiction - the ceiling on what this may promise.');
  for (const [title, author, passage] of MODERN) {
    const r = await ask(`"${passage}" AND ${author}`);
    await sleep(PAUSE_MS);
    latency.push(r.ms);
    const rank = r.hits.findIndex((h) => claimsToBe(h, title));
    console.log(
      `   ${title.padEnd(22)} total=${String(r.total).padEnd(5)} ${rank >= 0 ? `found rank ${rank + 1}` : 'NOT FOUND'}`,
    );
  }

  const max = Math.max(...latency);
  console.log(`\nE. LATENCY. min ${Math.min(...latency)}ms, max ${max}ms.`);
  console.log(`   openLibrary.ts TIMEOUT_MS is 6000. ${max > 6000 ? 'THE MAX EXCEEDS IT.' : 'The max fits.'}`);
}

main().catch((e) => {
  console.error('PROBE FAILED', e);
  process.exit(1);
});
