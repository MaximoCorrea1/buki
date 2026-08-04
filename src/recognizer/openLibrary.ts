import type { Book, BooksDb, FetchLike } from './types';

const SEARCH = 'https://openlibrary.org/search.json';
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
 * A BooksDb backed by OpenLibrary. Free, no API key, and no hard rate quota (unlike
 * keyless Google Books, which 429s), so this is the preferred primary grounding
 * source. `fetch` is injected so the mapping logic tests offline.
 */
export function createOpenLibraryClient(deps: { fetch: FetchLike }): BooksDb {
  async function fetchDocs(url: string): Promise<OlDoc[]> {
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

    // Without this, an error body just yields no docs, and the user is told their
    // photo was unclear when OpenLibrary was actually rate-limiting or down.
    if (res.ok === false) throw new Error(`OpenLibrary request failed (HTTP ${res.status})`);

    const data = (await res.json()) as { docs?: OlDoc[] } | null;
    // `data?.docs ?? []` and not `data.docs ?? []`: valid JSON can be `null`, and the
    // property read would throw before the fallback could apply.
    return Array.isArray(data?.docs) ? data.docs : [];
  }

  return {
    async search({ title, author }) {
      const q = encodeURIComponent([title, author].filter(Boolean).join(' '));
      const docs = await fetchDocs(`${SEARCH}?q=${q}&fields=${FIELDS}&limit=3`);
      return docs.map(toBook);
    },
    async lookupByIsbn(isbn) {
      // Keep `isbn:` literal; only the value is encoded (digits, so it's a no-op).
      const docs = await fetchDocs(
        `${SEARCH}?q=isbn:${encodeURIComponent(isbn)}&fields=${FIELDS}&limit=1`,
      );
      return docs[0] ? toBook(docs[0]) : null;
    },
  };
}
