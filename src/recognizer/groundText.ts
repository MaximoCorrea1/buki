import type { Book, BooksDb, GroundedBook } from './types';
// Across the folder boundary on purpose, exactly as recognizer.ts does it: what makes two
// books the same book is defined once, and duplicating it here is how `clothFor` once gave
// one book two colours.
import { sameBook } from '../extension/bookIdentity';

/**
 * Most queries one text may fire.
 *
 * Raised from 6 on 2026-08-16. Six was chosen when this function's job was to find THE
 * book on a cover, where six lines is plenty. It is also a hard ceiling on how many books
 * a post can yield, and a thread listing twenty titles is one line each - so six lines
 * meant six books, whatever the post actually said.
 *
 * They are fired concurrently, so this is one round trip of latency and a burst of up to
 * twenty-four requests. That burst is the real cost, and it is accepted rather than
 * unnoticed: `breaker.ts` stops asking OpenLibrary at all after three consecutive
 * failures, so a rate limit degrades to unverified readings rather than to a hang.
 */
export const MAX_QUERIES = 24;

/**
 * Most books one text may produce.
 *
 * A card offering fifty decisions is not a card, and the ordering below puts the
 * best-read line first, so the cut falls on the lines least likely to be right.
 */
export const MAX_GROUNDED = 20;

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
  const whole = lines.join(' ');

  const lineQueries = [...new Set(lines)].filter(Boolean);
  // The whole text is a LAST RESORT, not a peer: it exists to catch a title OCR split
  // across two lines. On a single-line cover it IS the line, so it costs nothing extra.
  const wholeIsOwnQuery = Boolean(whole) && !lineQueries.includes(whole);
  const queries = [...lineQueries, ...(wholeIsOwnQuery ? [whole] : [])].slice(0, MAX_QUERIES);
  const wholeAt = wholeIsOwnQuery ? queries.indexOf(whole) : -1;

  // Fired together, judged in order. Awaiting them one at a time cost up to MAX_QUERIES
  // round trips (10s each by openLibrary's own timeout) against a 6s end-to-end budget;
  // concurrently the whole step costs about one.
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

  const fromLines = settled.filter((_, i) => i !== wholeAt);
  // Only fall back to the blob when no individual line said anything. Letting it ground
  // alongside the lines adds a book nobody pointed at, which on a post that lists ten
  // titles is a near-guaranteed false positive.
  const chosen = fromLines.some((ranked) => ranked.length)
    ? fromLines
    : wholeAt === -1
      ? []
      : [settled[wholeAt] ?? []];

  /**
   * ONE BOOK PER LINE FIRST, in document order, THEN every line's runners-up.
   *
   * This used to return `ranked.slice(0, 3)` from the first query that grounded and stop,
   * which is a single-book finder with alternates. That is the right shape for OCR of one
   * cover, where the lines are title / subtitle / author / blurb, and the wrong shape for
   * a post that lists ten books, where every line is a different one. Reported as "some
   * post words findings dont work".
   *
   * The ORDER is what makes it work for both. A card shows this list in order and the
   * caller slices it, so putting line one's runners-up ahead of line two's best is how a
   * list of twenty gets truncated into the first few titles and their near-misses. Bests
   * first means a list yields a list; the alternates are still there underneath, which is
   * what a single cover needs.
   */
  const ordered = [
    ...chosen.map((ranked) => ranked[0]).filter((b): b is GroundedBook => Boolean(b)),
    ...chosen.flatMap((ranked) => ranked.slice(1)),
  ];

  // Two lines can name one book - "Dune" and "Dune, Frank Herbert" - and it is one book.
  // Same rule as the vision path, from the one module that defines it.
  const kept: GroundedBook[] = [];
  for (const scored of ordered) {
    if (kept.some((held) => sameBook(held.book, scored.book))) continue;
    kept.push(scored);
    if (kept.length === MAX_GROUNDED) break;
  }
  return kept;
}
