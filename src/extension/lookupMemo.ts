/**
 * One lookup per post.
 *
 * Pressing the save button twice on the same post used to run recognition twice - two vision
 * calls, two
 * sets of OpenLibrary queries, and two pickers for one book. The button's `disabled` flag
 * only covered its own press; a second press after the first finished, or a press on the
 * same image from the right-click menu, paid for the whole pipeline again.
 *
 * A press while a lookup is running joins it. A press shortly after one finished reuses
 * the answer. A failure is never remembered - a lookup that died because the network
 * blipped has to be retryable straight away.
 */
interface Entry<T> {
  /** When the work started, then when it settled. Only meaningful once `settled`. */
  at: number;
  value: Promise<T>;
  settled: boolean;
}

/** Long enough to cover a double-press and a change of mind, short enough to re-ask. */
export const DEFAULT_TTL_MS = 120_000;

export function createLookupMemo<T>(deps: { now: () => number; ttlMs?: number }) {
  const ttl = deps.ttlMs ?? DEFAULT_TTL_MS;
  const entries = new Map<string, Entry<T>>();

  return {
    run(key: string, work: () => Promise<T>): Promise<T> {
      const held = entries.get(key);
      // An unsettled entry is a lookup still in flight - join it whatever its age.
      if (held && (!held.settled || deps.now() - held.at < ttl)) return held.value;

      const entry: Entry<T> = { at: deps.now(), value: work(), settled: false };
      entries.set(key, entry);
      entry.value.then(
        () => {
          entry.settled = true;
          // The clock starts when the answer lands, not when the work began: a slow
          // lookup should not arrive already half-stale.
          entry.at = deps.now();
        },
        () => {
          entries.delete(key);
        },
      );
      return entry.value;
    },

    /** Drop what we know about a post, so the next press really looks again. */
    forget(key: string): void {
      entries.delete(key);
    },
  };
}

/**
 * What makes two presses "the same post". Image identity is the HOST plus the URL *path*:
 * Twitter serves the same media under several `?format=&name=` query strings, and the
 * right-click menu reports a different variant from the one sitting in the DOM, so the
 * query has to go. Sorted, because the order images come back in is not part of what the
 * post is.
 *
 * THE HOST WAS MISSING AND IT WAS NOT COSMETIC. `OPENWORK.md` item 47, C-7. Two images
 * sharing a path on different sites were one catch, and the cost is not a duplicate row -
 * it is a MEMO HIT. The second post's press returns the FIRST post's books, so the reader
 * saves a book that was never on the page they were looking at and the recognition log
 * records a catch that did not happen. On X alone it could not bite, because every picture
 * comes from `pbs.twimg.com`; catch-anywhere is what made it reachable.
 *
 * The SCHEME is still dropped. `https://p.test/a.jpg` and `http://p.test/a.jpg` are one
 * picture, and including the scheme would split a catch on a detail of how it was linked.
 */
export function postKey(post: { text: string; imageUrls: string[] }): string {
  const media = post.imageUrls
    .map((url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.host}${parsed.pathname}`;
      } catch {
        return url;
      }
    })
    .sort()
    .join(',');
  return `${post.text.trim()}|${media}`;
}
