import type { Book, BooksDb } from './types';

/**
 * Most queries a single image may fire. OCR of a dense image (a photographed page, a
 * code screenshot) yields dozens of lines; without a cap each one became its own
 * sequential request - tens of seconds and a burst that could trip rate limiting.
 */
export const MAX_QUERIES = 6;

/** Strip OCR punctuation noise, collapse whitespace. Keeps letters, numbers, spaces. */
function cleanLine(line: string): string {
  return line
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words long enough to carry meaning - ignores "the", "of", "and". */
function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(' ')
      .filter((w) => w.length >= 4),
  );
}

/**
 * How many real words this result shares with the query. 0 means the books DB just
 * fuzzy-matched something unrelated.
 *
 * OpenLibrary does relevance search over tens of millions of works, so a short
 * incidental word ("HOME" on a meme) reliably returns *some* real book. Since the
 * right-click flow saves candidates[0] without asking, this score does double duty:
 * it rejects unrelated hits, and it decides which result gets saved.
 */
function matchScore(query: string, book: Book): number {
  const wanted = significantWords(query);
  const got = significantWords(`${book.title} ${book.author}`);
  let shared = 0;
  for (const word of wanted) {
    if (got.has(word)) shared++;
  }
  return shared;
}

/**
 * Turn noisy OCR cover text into grounded books using "ground-as-filter": try each
 * cleaned line (then the whole text) as a search query and return the first that
 * resolves to a plausible book. We don't guess which line is the title - the books DB
 * decides, and OCR garbage lines simply don't match anything.
 *
 * Lines are tried in document order (a cover's title sits near the top) rather than
 * longest-first, which would favour back-cover blurb text over the title.
 */
export async function groundText(ocrText: string, books: BooksDb): Promise<Book[]> {
  const lines = ocrText.split('\n').map(cleanLine).filter((l) => l.length >= 4);

  // Each line first, then the whole thing as a last resort (catches a title that OCR
  // split across lines). Deduped so a single-line cover costs exactly one request.
  const queries = [...new Set([...lines, lines.join(' ')])]
    .filter(Boolean)
    .slice(0, MAX_QUERIES);

  for (const q of queries) {
    const results = await books.search({ title: q });

    // Rank rather than trusting the API's order: relevance search regularly puts a
    // loosely-related title first, and the right-click flow saves whatever is first.
    const ranked = results
      .map((book) => ({ book, score: matchScore(q, book) }))
      .filter((scored) => scored.score > 0)
      .sort((a, b) => b.score - a.score);

    if (ranked.length) return ranked.slice(0, 3).map((scored) => scored.book);
  }
  return [];
}
