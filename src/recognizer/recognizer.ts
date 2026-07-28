import { extractIsbnFromLinks } from './isbn';
import { groundText, rank } from './groundText';
import type { Tweet, RecognitionResult, VisionClient, BooksDb } from './types';

/**
 * Turn a tweet into a recognized book (or a few candidates), using the cheapest,
 * highest-precision signal available first.
 *
 * Used by content.ts's tweet-scrape flow. The right-click/OCR flow is a separate
 * pipeline - see groundText.ts.
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
  // hallucination filter).
  // (Step 2, the free "Title by Author" text pre-check, slots in here later - it just
  //  saves a vision call when the title is already written in the tweet.)
  const guess = await deps.vision.guessBook({
    imageUrls: tweet.imageUrls,
    text: tweet.text,
    altText: tweet.altText,
  });
  if (guess) {
    const matches = await deps.books.search({ title: guess.title, author: guess.author });

    // Score against the model's own words. Two shared words means the DB and the model
    // independently agree on a book; one means they overlap on a single token, which a
    // common surname or series word produces by accident.
    const ranked = rank(`${guess.title} ${guess.author}`, matches);
    const top = ranked[0];
    if (top) {
      return {
        candidates: ranked.slice(0, 3).map((scored) => scored.book),
        confidence: top.score >= 2 ? 'high' : 'medium',
        source: 'vision',
      };
    }
  }

  // Step 4 - the post's own words, grounded line by line. A post listing ten books has
  // its titles on separate lines, so searching the whole blob finds nothing while
  // searching each line finds plenty.
  const grounded = await groundText(tweet.text, deps.books);
  if (grounded.length) {
    return {
      candidates: grounded.slice(0, 3).map((scored) => scored.book),
      // Text alone never reaches `high`, however well it scores. A post listing ten
      // books can ground the wrong line to a real book, and that failure is invisible:
      // you never learn to distrust a shelf entry you had no reason to doubt.
      confidence: 'medium',
      source: 'text',
    };
  }

  // No link, no confirmed guess, nothing in the words: nothing to save.
  return { candidates: [], confidence: 'low', source: 'none' };
}
