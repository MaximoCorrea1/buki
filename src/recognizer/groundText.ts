import type { Book, BooksDb, GroundedBook } from './types';

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
 * fuzzy-matched something unrelated. Used by `rank` to both reject unrelated hits and
 * decide which result gets saved.
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
 * Score every result against the query, drop the ones that share nothing with it, and
 * put the closest first.
 *
 * OpenLibrary does relevance search over tens of millions of works, so a short
 * incidental word ("HOME" on a meme) reliably returns *some* real book. Filtering at 0
 * is the invariant that stops those becoming silent saves. Ranking matters just as
 * much: relevance search regularly puts a loosely-related title first, and the
 * right-click flow saves whatever is first.
 */
export function rank(query: string, results: Book[]): GroundedBook[] {
  return results
    .map((book) => ({ book, score: matchScore(query, book) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Turn noisy text into grounded books using "ground-as-filter": try each cleaned line
 * (then the whole text) as a search query and return the first that resolves to a
 * plausible book. We don't guess which line is the title - the books DB decides, and
 * garbage lines simply don't match anything.
 *
 * Lines are tried in document order (a cover's title sits near the top) rather than
 * longest-first, which would favour back-cover blurb text over the title.
 *
 * Scores come back with the books: the caller needs them to decide how much to trust
 * the result, and recomputing them there would mean two definitions of "match".
 */
export async function groundText(text: string, books: BooksDb): Promise<GroundedBook[]> {
  const lines = text.split('\n').map(cleanLine).filter((l) => l.length >= 4);

  // Each line first, then the whole thing as a last resort (catches a title that OCR
  // split across lines). Deduped so a single-line cover costs exactly one request.
  const queries = [...new Set([...lines, lines.join(' ')])]
    .filter(Boolean)
    .slice(0, MAX_QUERIES);

  // Fired together, judged in order. Awaiting them one at a time cost up to MAX_QUERIES
  // round trips (10s each by openLibrary's own timeout) against a 6s end-to-end budget;
  // concurrently the whole step costs about one. The winner is still the earliest line
  // that grounds, because the results are read back in the original order.
  const settled = await Promise.all(
    queries.map(async (q) => {
      try {
        return rank(q, await books.search({ title: q }));
      } catch (err) {
        // One query failing must not cancel the others - each is an independent guess.
        console.error('[Buki] a grounding query failed', err);
        return [];
      }
    }),
  );

  for (const ranked of settled) {
    if (ranked.length) return ranked.slice(0, 3);
  }
  return [];
}
