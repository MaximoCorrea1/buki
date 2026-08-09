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
      .split(/\s+/)
      // Punctuation at the EDGE of a token is noise; punctuation inside it is the word.
      //
      // Without any trim, "Dune:" and "dune" are different tokens, so a subtitled
      // OpenLibrary record shares one fewer word than a bare sequel for the exact word
      // that makes it the right book. But stripping punctuation EVERYWHERE splits
      // "X-Men" into "x" and "men", both under the significance threshold, so a cover
      // reading only "X-MEN" grounded to nothing at all, and every book by any Paul
      // scored a free point against "Jean-Paul". Trimming the edges fixes the first
      // without causing the second.
      .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
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
 * The title with subtitle and edition noise removed, for `strayWords` only.
 *
 * Mirrors `../extension/bookIdentity.ts`'s `normTitle` ("a subtitle is what one catalogue
 * writes and another leaves out"), narrowed to the colon and parenthesis shapes an
 * OpenLibrary edition record adds ("Dune: 40th Anniversary Edition", "Dune (Deluxe
 * Edition)"). Not imported from there: src/recognizer/ is the standalone domain layer and
 * must not depend on src/extension/, so the narrow rule is repeated here rather than
 * shared. Without it, the correct record's own edition tag counted as MORE stray words
 * than a sequel's one real extra word, and the tie-break picked the sequel again.
 */
function stripEditionNoise(title: string): string {
  const mainTitle = title.split(':')[0] ?? '';
  return mainTitle.replace(/\([^)]*\)/g, ' ');
}

/**
 * Significant words the RESULT's title has and the query never mentioned.
 *
 * The tie-break, not the score. "Children of Dune" and "Dune" share exactly the same
 * three words with "Dune Frank Herbert", so matchScore cannot tell them apart and the
 * catalogue's relevance order decides, which is how a photo of Dune put Children of Dune
 * on the shelf. A title carrying words nobody asked for is the further away of the two.
 *
 * Title only, never the author: the author is shared by every book in a series, so
 * counting it would score all the sequels identically all over again.
 */
function strayWords(query: string, book: Book): number {
  const wanted = significantWords(query);
  let stray = 0;
  for (const word of significantWords(stripEditionNoise(book.title))) {
    if (!wanted.has(word)) stray++;
  }
  return stray;
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
    .map((book) => ({ book, score: matchScore(query, book), stray: strayWords(query, book) }))
    .filter((scored) => scored.score > 0)
    // Score first, so a closer match always wins. Stray words only separate equals, and
    // it is a REORDER rather than a filter: grounding raw OCR lines produces results that
    // legitimately carry words the query never had, and those must still ground.
    .sort((a, b) => b.score - a.score || a.stray - b.stray)
    .map(({ book, score }) => ({ book, score }));
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
