import { extractIsbnFromLinks } from './isbn';
import type { Tweet, RecognitionResult, VisionClient, BooksDb } from './types';

/**
 * Turn a tweet into a recognized book (or a few candidates), using the cheapest,
 * highest-precision signal available first.
 *
 * Used by content.ts's tweet-scrape flow. The right-click/OCR flow is a separate
 * pipeline - see recognizeFromOcr.ts.
 *
 * Dependencies (vision, books) are injected so this stays pure and testable. Today
 * content.ts passes a no-op VisionClient plus the OpenLibrary client; a real vision
 * model can be dropped in without touching this logic.
 */
export async function recognizeBook(
  tweet: Tweet,
  deps: { vision: VisionClient; books: BooksDb },
): Promise<RecognitionResult> {
  // Step 1 - link short-circuit. A link carrying an ISBN is free and near-certain,
  // so resolve it and skip the vision model entirely.
  const isbn = extractIsbnFromLinks(tweet.links);
  if (isbn) {
    const book = await deps.books.lookupByIsbn(isbn);
    if (book) {
      return { candidates: [book], confidence: 'high', source: 'link' };
    }
    // ISBN found but the DB doesn't know it: fall through and treat the link as a
    // weak hint rather than dropping a possibly-real book. (Gets its own test next.)
  }

  // Step 3 - vision fallback. Ask the model to name the book from the image + text,
  // then GROUND that guess against the books DB (canonical title/cover/ISBN, and a
  // hallucination filter). Vision-sourced results cap at 'medium' so they always go
  // through the confirm step; only links (step 1) may auto-save.
  // (Step 2, the free "Title by Author" text pre-check, slots in here later - it just
  //  saves a vision call when the title is already written in the tweet.)
  const guess = await deps.vision.guessBook({
    imageUrls: tweet.imageUrls,
    text: tweet.text,
    altText: tweet.altText,
  });
  if (guess) {
    const matches = await deps.books.search({ title: guess.title, author: guess.author });
    if (matches.length > 0) {
      return { candidates: matches.slice(0, 3), confidence: 'medium', source: 'vision' };
    }
  }

  // No link, and either no vision guess or the DB couldn't confirm it: nothing to save.
  // (Next test: an unconfirmed guess should still offer the raw title so you can type/confirm.)
  return { candidates: [], confidence: 'low', source: 'vision' };
}
