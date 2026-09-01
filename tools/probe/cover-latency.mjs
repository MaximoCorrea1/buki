/**
 * How long does a cover actually take, and how much of it is the redirect chain?
 *
 * `coverCache.ts` says "measured repeatedly: 1-4 seconds per cover" and dates that claim to
 * 2026-08-04. Item 50's PERF work and `warmCovers` were both built on it. Founder,
 * 2026-09-01: the cover still lands visibly after the book. Before changing anything, the
 * number gets re-derived rather than carried.
 *
 * NOT IN THE SUITE, deliberately: it hits live hosts. `tools/probe/` is where those live.
 *
 * SEQUENTIAL, WITH PAUSES. Nineteen concurrent searches at openlibrary.org earned an HTTP
 * 429 on 2026-08-27 and took the catalogue down for two minutes. This probe exists to
 * measure that host, not to knock it over.
 *
 *   node tools/probe/cover-latency.mjs
 */

/** Real cover ids, from books this shelf actually holds. -M is the size the shelf uses. */
const COVERS = [
  'https://covers.openlibrary.org/b/id/14625765-M.jpg',
  'https://covers.openlibrary.org/b/id/8231856-M.jpg',
  'https://covers.openlibrary.org/b/id/12648304-M.jpg',
];

const PAUSE_MS = 2500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function timed(url, label) {
  const started = performance.now();
  try {
    // `redirect: 'follow'` is the default and is the point: the cost being measured IS the
    // chain. covers.openlibrary.org 302s to archive.org, which extracts the JPEG from a ZIP.
    const res = await fetch(url, { redirect: 'follow' });
    const bytes = (await res.arrayBuffer()).byteLength;
    const ms = Math.round(performance.now() - started);
    console.log(
      `  ${label.padEnd(10)} ${String(res.status).padEnd(4)} ${String(ms).padStart(6)}ms  ${String(bytes).padStart(7)} bytes  ${res.headers.get('cache-control') ?? '(no cache-control)'}`,
    );
    return { ms, bytes, status: res.status, finalUrl: res.url };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    console.log(`  ${label.padEnd(10)} ERR  ${String(ms).padStart(6)}ms  ${String(err).slice(0, 60)}`);
    return { ms, bytes: 0, status: 0, finalUrl: '' };
  }
}

console.log('COVER LATENCY, live, sequential, 2.5s apart\n');
const cold = [];
for (const [i, url] of COVERS.entries()) {
  console.log(`cover ${i + 1}: ${url}`);
  const first = await timed(url, 'cold');
  await sleep(PAUSE_MS);
  const second = await timed(url, 'repeat');
  if (first.finalUrl && first.finalUrl !== url) console.log(`  redirected to ${first.finalUrl}`);
  cold.push(first.ms);
  console.log('');
  await sleep(PAUSE_MS);
}

const sorted = [...cold].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
console.log('COLD FETCHES:', cold.map((m) => `${m}ms`).join(', '));
console.log(`median ${median}ms, min ${sorted[0]}ms, max ${sorted[sorted.length - 1]}ms`);
console.log(
  '\nThe claim on record in coverCache.ts is 1-4 SECONDS per cover, measured 2026-08-04.',
);
