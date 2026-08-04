import { extractIsbnFromLinks } from './isbn';
import { groundText, rank } from './groundText';
import type { Tweet, RecognitionResult, VisionClient, BooksDb } from './types';

/**
 * Turn a tweet into a recognized book (or a few candidates), using the cheapest,
 * highest-precision signal available first.
 *
 * Called only from background.ts's recognize(), which both the tweet button and the
 * right-click menu go through - so the two flows cannot resolve books differently.
 *
 * Dependencies (vision, books) are injected so this stays pure and testable. The vision
 * client the worker passes is lazy: a post carrying a retailer link resolves in step 1
 * without ever needing a key.
 */
/**
 * Run a catalogue lookup that must not be able to fail the whole catch.
 *
 * `null` means the catalogue never answered, which is a different fact from answering
 * with nothing - and the difference decides what happens next. Grounding used to be
 * mandatory, so an outage at OpenLibrary turned every well-read cover into "signal timed
 * out" on screen.
 */
async function attempt<T>(work: Promise<T>): Promise<T | null> {
  try {
    return await work;
  } catch (err) {
    console.error('[Buki] the books catalogue did not answer', err);
    return null;
  }
}

export async function recognizeBook(
  tweet: Tweet,
  deps: { vision: VisionClient; books: BooksDb },
  opts: { fromText?: boolean } = {},
): Promise<RecognitionResult> {
  // Step 1 - THE IMAGE. If there is a picture, the picture is what this post is about.
  //
  // This used to run third, behind a link short-circuit, which meant a post showing one
  // book and linking to another returned the link's book and the cover was never looked
  // at. Reading the caption instead of the photo is the same mistake in a different
  // place, so the prompt now says the images decide (see llmVision's INSTRUCTION).
  if (tweet.imageUrls.length) {
    const guess = await deps.vision.guessBook({
      imageUrls: tweet.imageUrls,
      text: tweet.text,
      altText: tweet.altText,
    });
    if (guess) {
      const matches = await attempt(deps.books.search({ title: guess.title, author: guess.author }));

      // Score against the model's own words. Two shared words means the DB and the model
      // independently agree on a book; one means they overlap on a single token, which a
      // common surname or series word produces by accident.
      const ranked = rank(`${guess.title} ${guess.author}`, matches ?? []);
      const top = ranked[0];
      if (top) {
        return {
          candidates: ranked.slice(0, 3).map((scored) => scored.book),
          confidence: top.score >= 2 ? 'high' : 'medium',
          source: 'vision',
        };
      }

      // The catalogue never answered - which is not the same as it saying there is no
      // such book. Keep the reading rather than lose it, at the lowest confidence and
      // under its own source, so the card can say nothing checked this.
      if (matches === null) {
        return {
          candidates: [{ title: guess.title, author: guess.author }],
          confidence: 'low',
          source: 'unverified',
        };
      }
    }
  }

  // Step 2 - a retailer link. No image, or nothing readable in the one there is: an ISBN
  // in a link is free and near-certain, and it is the right answer once the cover has had
  // its turn and come back with nothing.
  const isbn = extractIsbnFromLinks(tweet.links);
  if (isbn) {
    const book = await attempt(deps.books.lookupByIsbn(isbn));
    if (book) return { candidates: [book], confidence: 'high', source: 'link' };
    // ISBN found but the DB doesn't know it: fall through rather than dropping a
    // possibly-real book.
  }

  // Step 3 - the post's own words, and ONLY when asked. As a silent fallback this
  // produced books that were never in the image, with nothing on screen to say the shelf
  // entry came from a caption rather than a cover. It is now something you choose.
  if (opts.fromText) {
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
  }

  // Nothing in the picture, no link, and either no words or nobody asked for them.
  return { candidates: [], confidence: 'low', source: 'none' };
}
