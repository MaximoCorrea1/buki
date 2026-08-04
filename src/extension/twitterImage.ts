/**
 * Twitter serves the same photo at several sizes, and the feed renders `name=small`
 * (~680px wide). That is the URL both flows pick up: the scraper reads `img.src`, and the
 * context menu reports the same string.
 *
 * Downscaling is exactly what destroys cover typography, which is the thing the model is
 * being asked to read. Asking for the large variant costs nothing - same request, same
 * quota - and hands the model the picture it needed in the first place.
 */
/**
 * The same photo, once.
 *
 * A media id is the path; the query string is only which rendition of it. The DOM around
 * one post can hold several renditions of one picture, and the scraper takes them all -
 * so a single-photo post could spend its whole four-image budget on four copies of that
 * photo, each of which the provider downloads before it can begin reading. `postKey`
 * already treats the path as the media's identity; this applies the same rule to what is
 * actually sent.
 *
 * Order is preserved: the first attachment is the likeliest to hold the book, and
 * MAX_IMAGES slices from the front.
 */
export function distinctMedia(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    let id: string;
    try {
      id = new URL(url).pathname;
    } catch {
      id = url; // not a URL we can reason about; it is only equal to itself
    }
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function bestQuality(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'pbs.twimg.com') return url;
    parsed.searchParams.set('name', 'large');
    return parsed.toString();
  } catch {
    return url; // not a URL we can reason about; send it as-is
  }
}
