/**
 * Twitter serves the same photo at several sizes, and the feed renders `name=small`
 * (~680px wide). That is the URL both flows pick up: the scraper reads `img.src`, and the
 * context menu reports the same string.
 *
 * Downscaling is exactly what destroys cover typography, which is the thing the model is
 * being asked to read. Asking for the large variant costs nothing - same request, same
 * quota - and hands the model the picture it needed in the first place.
 */
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
