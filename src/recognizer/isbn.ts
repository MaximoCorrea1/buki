/**
 * Pull a book identifier (ISBN-10/13 or Amazon ASIN) out of the links attached
 * to a tweet.
 *
 * Why this matters: a retail/review link is the highest-precision signal we have.
 * If a tweet links to Amazon or Goodreads, we can resolve the exact book with
 * near-100% confidence and skip the vision model (and its cost) entirely. This is
 * the cheap pre-check that runs before we ever look at the image.
 *
 * Returns the first identifier found, or null if none of the links carry one.
 */

/** Only these hosts may seed a high-confidence match. */
const RETAILERS = /(^|\.)(amazon\.[a-z.]+|goodreads\.com|bookshop\.org)$/i;

function isRetailerUrl(link: string): boolean {
  try {
    return RETAILERS.test(new URL(link).hostname);
  } catch {
    return false; // not a parseable absolute URL
  }
}

export function extractIsbnFromLinks(links: string[]): string | null {
  for (const link of links) {
    // Host-check first: the /dp/<10 chars> pattern is matched against strings scraped
    // from tweet markup, so without this any crafted display text containing "/dp/…"
    // could spoof a "high confidence" book into the user's shelf.
    if (!isRetailerUrl(link)) continue;

    const match = link.match(/\/dp\/([0-9X]{10})\b/i);
    if (match?.[1]) return match[1];
  }
  return null;
}
