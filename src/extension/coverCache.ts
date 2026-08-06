/**
 * Cover thumbnails, kept locally so the shelf draws instantly.
 *
 * A cover URL is not an image. `covers.openlibrary.org/b/id/<n>-M.jpg` is a 302 into a
 * second 302 and finally an `ia######.us.archive.org` node that extracts the JPEG out of a
 * ZIP archive on demand. Measured repeatedly: 1-4 seconds per cover, with no edge warming,
 * and the final response carries `Cache-Control: max-age=10800` - so the browser's own
 * cache expires after three hours and re-pays the whole cost. A shelf of twenty books
 * spent that on every open.
 *
 * The bytes are stored in the Cache API rather than `chrome.storage.local`: covers would
 * eat the 10MB quota the shelf and the log share, and `unlimitedStorage` is a permission
 * that has to be justified at store review. A cover never changes, so it is fetched once
 * and kept until the book leaves the shelf.
 *
 * Every path here degrades to "no cached cover" rather than throwing. A picture must never
 * be able to fail a save - the same rule the recognition log follows.
 */
export interface CoverStore {
  match(url: string): Promise<Response | undefined>;
  put(url: string, res: Response): Promise<void>;
  keys(): Promise<string[]>;
  delete(url: string): Promise<boolean>;
}

export interface CoverDeps {
  store: CoverStore;
  fetch: (url: string) => Promise<Response>;
}

/** Bumped only if the stored shape changes; the browser keeps caches until asked not to. */
export const COVER_CACHE = 'buki-covers-v1';

/**
 * The real Cache API. Available in both the service worker and extension pages, and both
 * share the extension's origin - so the worker fills it and the popup reads it.
 *
 * The redirect chain leaves `covers.openlibrary.org` for `archive.org`, which
 * `host_permissions` does not cover. Verified against the live hosts: every hop answers
 * with permissive CORS and the final node reflects the extension origin back, so this
 * needs no extra host permission.
 */
export function openCoverStore(): CoverStore {
  const open = (): Promise<Cache> => caches.open(COVER_CACHE);
  return {
    async match(url) {
      return (await open()).match(url);
    },
    async put(url, res) {
      return (await open()).put(url, res);
    },
    async keys() {
      return (await (await open()).keys()).map((req) => req.url);
    },
    async delete(url) {
      return (await open()).delete(url);
    },
  };
}

export const liveCoverDeps = (): CoverDeps => ({
  store: openCoverStore(),
  fetch: (url) => fetch(url),
});

/** Fetch and keep a cover, once. Cheap and silent when we already hold it. */
export async function rememberCover(
  url: string | undefined,
  deps: CoverDeps,
): Promise<void> {
  if (!url) return;
  try {
    if (await deps.store.match(url)) return;
    const res = await deps.fetch(url);
    // Never keep a failure: caching a 404 would make a cover that is merely missing today
    // missing for as long as the book is on the shelf.
    if (!res.ok) return;
    await deps.store.put(url, res);
  } catch (err) {
    console.error('[Buki] could not keep a cover', err);
  }
}

/**
 * How long the cache gets to answer before the shelf stops waiting for it.
 *
 * A local lookup that takes longer than this is not a cache any more, and every cover
 * on the shelf is blocked behind its own one.
 */
export const DEADLINE_MS = 400;

/**
 * The bytes we hold for this cover, or null to fall back to the network.
 *
 * A store that THROWS was always handled. A store that simply never settles was not, and
 * the difference matters: the caller assigns nothing until this resolves, so a hung
 * lookup is a permanently empty cover with no error anywhere to explain it. Losing the
 * cache costs a slow cover; waiting forever costs the picture.
 */
export async function cachedCover(
  url: string | undefined,
  deps: Pick<CoverDeps, 'store'>,
  deadlineMs = DEADLINE_MS,
): Promise<Blob | null> {
  if (!url) return null;
  try {
    const res = await Promise.race([
      deps.store.match(url),
      new Promise<undefined>((resolve) => setTimeout(resolve, deadlineMs)),
    ]);
    return res ? await res.blob() : null;
  } catch (err) {
    console.error('[Buki] could not read a cached cover', err);
    return null;
  }
}

/**
 * Forget covers whose books have left the shelf, so the cache is bounded by the shelf
 * rather than by everything ever recognized. Returns what it dropped.
 */
export async function pruneCovers(
  keep: Iterable<string | undefined>,
  deps: Pick<CoverDeps, 'store'>,
): Promise<string[]> {
  try {
    // `keep` comes straight off the shelf, where coverUrl is optional. Letting an
    // undefined through would quietly mean "keep nothing" and wipe every cover.
    const wanted = new Set([...keep].filter((u): u is string => Boolean(u)));
    const dropped: string[] = [];
    for (const url of await deps.store.keys()) {
      if (wanted.has(url)) continue;
      await deps.store.delete(url);
      dropped.push(url);
    }
    return dropped;
  } catch (err) {
    console.error('[Buki] could not prune covers', err);
    return [];
  }
}
