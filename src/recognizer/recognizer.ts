import { extractIsbnFromLinks } from './isbn';
import { mapPool } from './mapPool';
import { groundText, rank } from './groundText';
// Across the folder boundary on purpose: what makes two books the same book is defined
// exactly once, and duplicating it here is how `clothFor` once gave one book two colours.
import { sameBook } from '../extension/bookIdentity';
import type { Book, Tweet, RecognitionResult, VisionClient, BooksDb } from './types';

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

/**
 * How many catalogue lookups one catch may have in flight.
 *
 * Four, and the number is a manners question rather than a throughput one. OpenLibrary is
 * free, keyless and donation-funded; nineteen sockets at once from one address is
 * indistinguishable from abuse and was answered as such. Four keeps almost all of the
 * latency win - nineteen books at roughly 400ms each finish in about two seconds instead
 * of seven and a half sequential - while never presenting as a burst.
 */
export const GROUND_AT_ONCE = 4;

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
    const guesses = await deps.vision.guessBooks({
      imageUrls: tweet.imageUrls,
      text: tweet.text,
      altText: tweet.altText,
    });

    // Grounded together, not one after another, but NEVER ALL AT ONCE. The original
    // here was a bare `Promise.all`, which fixed a real problem - four books used to mean
    // four sequential round trips stapled onto the end of a catch - and left no ceiling.
    //
    // `MAX_BOOKS` is 20, so on 2026-08-27 a photograph of nineteen books opened nineteen
    // simultaneous connections to openlibrary.org and was answered with HTTP 429. The
    // rate-limited address then stopped answering at all, sixteen 6s timeouts in a row
    // blew straight past the breaker's TOLERANCE of 3, and the catalogue was gone for the
    // full two-minute COOLDOWN_MS. Every catch in that window came back `unverified` with
    // no cover art. It presented as "covers are not loading".
    const grounded = await mapPool(guesses, GROUND_AT_ONCE, async (guess) => ({
      guess,
      matches: await attempt(deps.books.search({ title: guess.title, author: guess.author })),
    }));

    const found: Book[] = [];
    let best = 0;
    let answered = false;

    for (const { guess, matches } of grounded) {
      if (matches !== null) answered = true;
      // Score against the model's own words. Two shared words means the DB and the model
      // independently agree on a book; one means they overlap on a single token, which a
      // common surname or series word produces by accident.
      const top = rank(`${guess.title} ${guess.author}`, matches ?? [])[0];

      // A reading nothing could check is still a reading. It is only dropped when the
      // catalogue ANSWERED and did not know the book - "I could not ask" is not "no".
      const book = top?.book ?? (matches === null ? { title: guess.title, author: guess.author } : null);
      if (!book) continue;

      // Two readings of one book - "Dune" and "Dune, Frank Herbert" - are one book. The
      // identity rule lives in one place on purpose; see bookIdentity's header.
      if (found.some((held) => sameBook(held, book))) continue;

      found.push(book);
      best = Math.max(best, top?.score ?? 0);
    }

    if (found.length) {
      return {
        candidates: found,
        // Confidence describes the evidence as a whole, so the best-read book carries it.
        confidence: answered ? (best >= 2 ? 'high' : 'medium') : 'low',
        source: answered ? 'vision' : 'unverified',
      };
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
        // No slice here any more. This used to take three, which capped a post listing
        // twenty books at three however many `groundText` found. The cap belongs in one
        // place and `groundText` owns it (MAX_GROUNDED), ordered so the best-read line
        // comes first.
        candidates: grounded.map((scored) => scored.book),
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
