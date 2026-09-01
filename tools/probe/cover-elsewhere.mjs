/**
 * OpenLibrary has no cover for these two books. Does anyone?
 *
 * Established by `cover-missing.mjs` on 2026-09-01: for *The Nvidia Way* (2024) and
 * *Modern Mathematical Logic* (2022), OpenLibrary returns a perfect metadata record -
 * exact title, exact author, four to six ISBNs, two or three edition keys - and NO cover,
 * by id, by isbn or by olid. Its metadata comes from library records and its covers from
 * scans somebody contributed; the two datasets have nothing to do with each other.
 *
 * So before proposing a second cover source, measure whether a second source would have
 * anything to give. Google Books is the candidate: no key required for volume lookups, and
 * `volumeInfo.imageLinks` is populated from publisher feeds rather than from scans, which
 * is exactly the gap OpenLibrary has on recent titles.
 *
 * ALSO CHECKED HERE, because it fell out of the last probe and is its own problem: the app
 * stores `doc.isbn[0]`, and for *The Nvidia Way* that first entry is 9787521770162 - a 978-7
 * prefix, which is CHINA. An English book on an English shelf carrying a Chinese edition's
 * ISBN is a Buy link pointing at the wrong edition.
 *
 *   node tools/probe/cover-elsewhere.mjs
 */

const PAUSE_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CASES = [
  { title: 'The Nvidia Way', author: 'Tae Kim' },
  { title: 'Modern Mathematical Logic', author: 'Joseph Mileti' },
];

/** ISBN-13 registration group, enough to say which country's edition this is. */
function region(isbn) {
  const d = String(isbn).replace(/[^0-9X]/gi, '');
  const core = d.length === 13 ? d.slice(3) : d;
  if (d.startsWith('9787')) return 'CHINA';
  if (core.startsWith('0') || core.startsWith('1')) return 'English-language';
  if (core.startsWith('2')) return 'French';
  if (core.startsWith('3')) return 'German';
  if (core.startsWith('4')) return 'Japan';
  if (core.startsWith('5')) return 'Russian';
  if (core.startsWith('84')) return 'Spain';
  return 'other';
}

async function olIsbns(title, author) {
  const q = encodeURIComponent(`${title} ${author}`);
  const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=isbn,title&limit=1`);
  const body = await res.json();
  return body.docs?.[0]?.isbn ?? [];
}

async function googleByIsbn(isbn) {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`);
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const body = await res.json();
  const v = body.items?.[0]?.volumeInfo;
  if (!v) return { none: true };
  return { title: v.title, thumb: v.imageLinks?.thumbnail ?? null, small: v.imageLinks?.smallThumbnail ?? null };
}

async function googleByTitle(title, author) {
  const q = encodeURIComponent(`intitle:${title} inauthor:${author}`);
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3`);
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const body = await res.json();
  return (body.items ?? []).map((it) => ({
    title: it.volumeInfo?.title,
    authors: (it.volumeInfo?.authors ?? []).join(', '),
    thumb: it.volumeInfo?.imageLinks?.thumbnail ?? null,
    isbn: (it.volumeInfo?.industryIdentifiers ?? []).map((x) => x.identifier).join(' '),
  }));
}

async function realImage(url) {
  try {
    const res = await fetch(url);
    const bytes = (await res.arrayBuffer()).byteLength;
    return `${res.status} ${bytes >= 1000 ? `REAL (${bytes}b)` : `placeholder/empty (${bytes}b)`}`;
  } catch (err) {
    return `ERR ${String(err).slice(0, 40)}`;
  }
}

for (const { title, author } of CASES) {
  console.log(`\n${'='.repeat(78)}\n${title} - ${author}\n${'='.repeat(78)}`);

  const isbns = await olIsbns(title, author);
  console.log(`\n  OpenLibrary ISBNs (${isbns.length}), and which edition each one IS:`);
  isbns.slice(0, 8).forEach((i, n) => console.log(`    [${n}] ${i.padEnd(16)} ${region(i)}${n === 0 ? '   <-- the one the app stores' : ''}`));
  await sleep(PAUSE_MS);

  console.log('\n  GOOGLE BOOKS, by each ISBN:');
  for (const isbn of isbns.slice(0, 4)) {
    const g = await googleByIsbn(isbn);
    if (g.error) console.log(`    ${isbn.padEnd(16)} ${g.error}`);
    else if (g.none) console.log(`    ${isbn.padEnd(16)} no volume`);
    else console.log(`    ${isbn.padEnd(16)} "${g.title}"  thumbnail=${g.thumb ? 'YES' : 'no'}`);
    await sleep(PAUSE_MS);
  }

  console.log('\n  GOOGLE BOOKS, by title and author:');
  const hits = await googleByTitle(title, author);
  if (hits.error) {
    console.log(`    ${hits.error}`);
  } else {
    for (const h of hits) console.log(`    "${h.title}" - ${h.authors}  thumbnail=${h.thumb ? 'YES' : 'no'}  ${h.isbn}`);
    const withThumb = hits.find((h) => h.thumb);
    if (withThumb) {
      await sleep(PAUSE_MS);
      console.log(`\n  Does that thumbnail actually serve bytes?`);
      console.log(`    ${withThumb.thumb}`);
      console.log(`    ${await realImage(withThumb.thumb)}`);
    }
  }
  await sleep(PAUSE_MS);
}
