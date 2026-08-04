/**
 * Twitter's media URLs: which picture, and how big.
 *
 * The same photo is served at several sizes under one path, so the path is the identity
 * and the query string is only the rendition. Both facts below follow from that.
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

/**
 * The rendition to actually read.
 *
 * The feed renders `name=small` (~680px), which is the URL both flows pick up, and
 * downscaling to 680 is what destroys cover typography - the thing being read.
 *
 * This asked for `large` (~2048px) while the picture was sent to the model as a URL, so
 * the size cost us nothing: the provider did the downloading. It is downloaded HERE now
 * and shrunk to one 768px tile before being sent, so `large` means paying for four times
 * the pixels in order to throw three of them away, on a home connection, once per catch.
 * `medium` (~1200px) is the smallest variant comfortably above what the shrink needs.
 */
export function bestQuality(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'pbs.twimg.com') return url;
    parsed.searchParams.set('name', 'medium');
    return parsed.toString();
  } catch {
    return url; // not a URL we can reason about; send it as-is
  }
}
