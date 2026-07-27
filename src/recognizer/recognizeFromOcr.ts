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
 * Does this result plausibly correspond to the query, or did the books DB just
 * fuzzy-match something?
 *
 * OpenLibrary does relevance search over tens of millions of works, so a short
 * incidental word ("HOME" on a meme) reliably returns *some* real book. Since the
 * right-click flow saves without asking, an unrelated hit would silently land in the
 * user's list. Require the result's title or author to share a real word with what we
 * actually searched for.
 */
function isPlausibleMatch(query: string, book: Book): boolean {
  const wanted = significantWords(query);
  const got = significantWords(`${book.title} ${book.author}`);
  for (const word of wanted) {
    if (got.has(word)) return true;
  }
  return false;
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
export async function recognizeFromOcrText(ocrText: string, books: BooksDb): Promise<Book[]> {
  const lines = ocrText.split('\n').map(cleanLine).filter((l) => l.length >= 4);

  // Each line first, then the whole thing as a last resort (catches a title that OCR
  // split across lines). Deduped so a single-line cover costs exactly one request.
  const queries = [...new Set([...lines, lines.join(' ')])]
    .filter(Boolean)
    .slice(0, MAX_QUERIES);

  for (const q of queries) {
    const results = await books.search({ title: q });
    const plausible = results.filter((book) => isPlausibleMatch(q, book));
    if (plausible.length) return plausible.slice(0, 3);
  }
  return [];
}
