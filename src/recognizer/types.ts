/** Minimal shape of fetch we depend on, so tests need no DOM or global fetch types. */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
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

/** What the recognizer hands back. `candidates` is ordered best-first. */
export interface RecognitionResult {
  candidates: Book[];
  confidence: Confidence;
  source: 'link' | 'text' | 'vision';
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
