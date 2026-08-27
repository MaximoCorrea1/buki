import type { Book, BooksDb, FetchLike } from './types';

const SITE = 'https://openlibrary.org';
const SEARCH = `${SITE}/search.json`;
const FIELDS = 'title,author_name,cover_i,isbn';
/**
 * Short on purpose. A healthy search answers in well under a second; when the index is
 * degraded it answers in tens of seconds or not at all (measured at over 20s, uncontended,
 * on 2026-08-04). Waiting 10s to learn that buys nothing - the recognizer now treats a
 * silent catalogue as "unverified" rather than as failure, so failing fast IS the feature.
 */
const TIMEOUT_MS = 6_000;

interface OlDoc {
  title?: string;
  author_name?: string[];
  cover_i?: number;
  isbn?: string[];
}

/**
 * An edition record - the exact-key form of a book, reached at `/isbn/<isbn>.json`.
 *
 * It names its authors by key rather than by name, and its covers by id, so a full Book
 * costs two requests instead of one. That is the price of not resolving an exact
 * identifier through a full-text relevance index.
 */
interface OlEdition {
  title?: string;
  authors?: { key?: string }[];
  covers?: number[];
  isbn_13?: string[];
  isbn_10?: string[];
}

const coverFor = (id: number | undefined): string | undefined =>
  id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : undefined;

/** Map one OpenLibrary search doc into our canonical Book. */
function toBook(doc: OlDoc): Book {
  return {
    title: doc.title ?? '',
    author: (doc.author_name ?? []).join(', '),
    isbn: (doc.isbn ?? [])[0],
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
  };
}

/**
 * A BooksDb backed by OpenLibrary. Free, no API key, and the preferred primary grounding
 * source. `fetch` is injected so the mapping logic tests offline.
 *
 * ~~No hard rate quota (unlike keyless Google Books, which 429s).~~ **FALSE, and measured
 * false on 2026-08-27**: a single catch that opened nineteen concurrent searches was
 * answered `HTTP 429`, and the address then stopped answering at all for minutes. There
 * is no published quota, which is not the same as no quota, and this sentence is very
 * likely what made an unbounded `Promise.all` over twenty guesses look safe to write.
 *
 * **Treat it as rate limited and be polite.** `GROUND_AT_ONCE` in `recognizer.ts` is
 * the ceiling and `recognizer.test.ts` holds it there.
 */
export function createOpenLibraryClient(deps: { fetch: FetchLike }): BooksDb {
  async function getJson<T>(url: string): Promise<T | null> {
    let res;
    try {
      res = await deps.fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      // A bare "TimeoutError: signal timed out" reached the user's screen once, which
      // reads as a broken extension rather than a slow catalogue. Name the service.
      if (err instanceof Error && /timeout|abort/i.test(`${err.name} ${err.message}`)) {
        throw new Error(`OpenLibrary did not answer within ${TIMEOUT_MS / 1000}s.`);
      }
      throw err;
    }

    // 404 is an answer, not a failure: OpenLibrary simply does not hold this record.
    if (res.status === 404) return null;
    // Without this, an error body just yields no docs, and the user is told their
    // photo was unclear when OpenLibrary was actually rate-limiting or down.
    if (res.ok === false) throw new Error(`OpenLibrary request failed (HTTP ${res.status})`);

    return (await res.json()) as T | null;
  }

  async function fetchDocs(url: string): Promise<OlDoc[]> {
    const data = await getJson<{ docs?: OlDoc[] }>(url);
    // `data?.docs` and not `data.docs`: valid JSON can be `null`, and the property read
    // would throw before the fallback could apply.
    return Array.isArray(data?.docs) ? data.docs : [];
  }

  /**
   * The author's name, best-effort.
   *
   * An edition names its authors by key, so this is a second request. It is allowed to
   * fail: a book with nobody named is still a book worth offering, and losing the whole
   * lookup because the follow-up did not land would be the mandatory-grounding mistake
   * again, one layer down. The cost is dedup accuracy - identity is title plus surname -
   * and never the catch itself.
   */
  async function authorName(edition: OlEdition): Promise<string> {
    const key = edition.authors?.[0]?.key;
    if (!key) return '';
    try {
      const author = await getJson<{ name?: string }>(`${SITE}${key}.json`);
      return author?.name ?? '';
    } catch (err) {
      console.error('[Buki] could not name the author', err);
      return '';
    }
  }

  return {
    async search({ title, author }) {
      const q = encodeURIComponent([title, author].filter(Boolean).join(' '));
      const docs = await fetchDocs(`${SEARCH}?q=${q}&fields=${FIELDS}&limit=3`);
      return docs.map(toBook);
    },

    /**
     * An ISBN is an exact key, so it is resolved against the edition record rather than
     * the relevance index. That was always the more precise choice; on 2026-08-04 it also
     * became the only working one - `search.json` timed out on every query for over 20s
     * while `/isbn/<isbn>.json` answered in about two seconds.
     */
    async lookupByIsbn(isbn) {
      const edition = await getJson<OlEdition>(`${SITE}/isbn/${encodeURIComponent(isbn)}.json`);
      if (!edition?.title) return null;
      return {
        title: edition.title,
        author: await authorName(edition),
        // The record's own canonical form, falling back to what we were asked about.
        isbn: edition.isbn_13?.[0] ?? edition.isbn_10?.[0] ?? isbn,
        coverUrl: coverFor(edition.covers?.[0]),
      };
    },
  };
}
