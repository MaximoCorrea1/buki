/** Minimal shape of fetch we depend on, so tests need no DOM or global fetch types. */
export type FetchLike = (
  url: string,
  init?: {
    signal?: AbortSignal;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{ ok?: boolean; status?: number; json(): Promise<unknown> }>;

/** A tweet, reduced to just what the recognizer needs. */
export interface Tweet {
  text: string;
  altText?: string;
  imageUrls: string[];
  links: string[];
}

/** A resolved book. */
export interface Book {
  title: string;
  author: string;
  isbn?: string;
  coverUrl?: string;
}

export type Confidence = 'high' | 'medium' | 'low';

/** Where a result came from. `none` means nothing resolved at all. */
export type RecognitionSource = 'link' | 'vision' | 'text' | 'none';

/**
 * A book plus the evidence behind it: how many words of four or more characters it
 * shares with the query that found it. 0 means the books DB just fuzzy-matched
 * something unrelated, which is why 0 never survives ranking.
 */
export interface GroundedBook {
  book: Book;
  score: number;
}

/** What the recognizer hands back. `candidates` is ordered best-first. */
export interface RecognitionResult {
  candidates: Book[];
  confidence: Confidence;
  source: RecognitionSource;
}

/**
 * The vision model, behind an interface so the recognizer never imports a
 * specific provider. Swap Gemini for anything else without touching the logic.
 */
export interface VisionClient {
  guessBook(input: {
    imageUrls: string[];
    text: string;
    altText?: string;
  }): Promise<{ title: string; author: string; confidence: number } | null>;
}

/** A books database (Google Books / OpenLibrary), also behind an interface. */
export interface BooksDb {
  lookupByIsbn(isbn: string): Promise<Book | null>;
  search(query: { title: string; author?: string }): Promise<Book[]>;
}
