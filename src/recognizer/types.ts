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

/**
 * Where a result came from.
 *
 * `unverified` is a reading the model took off the cover that no catalogue confirmed.
 * OpenLibrary's search index can degrade to answering nothing inside any usable budget
 * (measured at over 20s, uncontended, on 2026-08-04), and a cover that was read correctly
 * should not be thrown away because the corroborating service was down. It is a separate
 * value rather than a flag so the card, the log and the kept rate all learn about it for
 * free. `none` means nothing resolved at all.
 */
export type RecognitionSource = 'link' | 'vision' | 'unverified' | 'text' | 'none';

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

/** One book the model says it can see. Unverified until the catalogue agrees. */
export interface VisionGuess {
  title: string;
  author: string;
}

/**
 * The vision model, behind an interface so the recognizer never imports a
 * specific provider. Swap Gemini for anything else without touching the logic.
 */
export interface VisionClient {
  /**
   * EVERY book the pictures show, best first; empty when there is none.
   *
   * This returned one book, so a stack on a desk or a shelf behind someone's head
   * silently became whichever the model happened to name first. What was in the picture
   * and what reached the shelf were different things, with nothing on screen saying so.
   */
  guessBooks(input: {
    imageUrls: string[];
    text: string;
    altText?: string;
  }): Promise<VisionGuess[]>;
}

/** A books database (Google Books / OpenLibrary), also behind an interface. */
export interface BooksDb {
  lookupByIsbn(isbn: string): Promise<Book | null>;
  search(query: { title: string; author?: string }): Promise<Book[]>;
}
