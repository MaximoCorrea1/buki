/**
 * One request per cover, at most a few at a time, for as long as the popup is open.
 *
 * TWO REAL DEFECTS, both found by reading the shelf's render path on 2026-09-01.
 *
 * **It went back to the network on every keystroke.** `paint()` in `popup.ts` runs on every
 * character typed into the search box and opens with `app.replaceChildren()`, so every
 * visible book is rebuilt and every cover requested again. A cover already held is cheap,
 * because `cover.ts` memoises the object URL - but a cover that MISSED has nothing to
 * memoise, so it went back out. Books with no catalogue art are the common case, not the
 * exceptional one, so a five-letter search on a shelf holding ten artless books was fifty
 * requests to learn ten things already known.
 *
 * **It had no ceiling.** Nineteen concurrent requests to openlibrary.org earned an HTTP 429
 * on 2026-08-27, the rate-limited address then stopped answering entirely, and every catch
 * for the next two minutes came back unverified. `mapPool` and `warmCovers` were both
 * bounded at four in response. The SHELF was not touched, and it opens one request per
 * book in the pile - a forty-book pile opened forty, at the same host, twice the burst that
 * caused the outage.
 *
 * WHY A MODULE AND NOT FOUR LINES IN `cover.ts`. `cover.ts` builds DOM, so nothing can
 * import it and no test can reach it - the same wall as `content.ts` and `background.ts`.
 * The scheduling is the part with the bug in it, so the scheduling is what comes out.
 *
 * WHAT IS DELIBERATELY NOT HERE: any persistence. The memo dies with the popup, so opening
 * the shelf again retries everything. That is the founder's ask on 2026-09-01 - *"when it
 * goes to the shelf try again, maybe it finds"* - at the granularity that costs nothing:
 * once per visit, not once per keystroke.
 */

/**
 * How many covers may be in flight at once.
 *
 * FOUR, the same ceiling `mapPool.GROUND_AT_ONCE` and `warmCovers.COVERS_AT_ONCE` use, and
 * for the same reason: they all talk to the same host, and a ceiling defined next to one
 * caller is a ceiling the others can exceed without anything noticing. That is exactly how
 * the 08-27 fix bounded the cover path and left the words path firing twenty-four.
 */
export const SHELF_AT_ONCE = 4;

export interface CoverQueue<T> {
  /**
   * The cover for this url, or null if there is none to be had. Called once per url per
   * popup, however many times the shelf repaints.
   */
  get(url: string): Promise<T | null>;
}

/**
 * @param limit how many `work` calls may be in flight at once
 * @param work  what actually fetches one cover. Throwing is treated as "no cover": a
 *              picture must never be able to fail the shelf, which is the same rule the
 *              recognition log follows.
 */
export function createCoverQueue<T>(
  limit: number,
  work: (url: string) => Promise<T | null>,
): CoverQueue<T> {
  // The PROMISE is memoised, not the result. Three cards asking for the same cover in one
  // paint must coalesce into one request, and they are all asking before any of them has an
  // answer - so remembering only settled values would still fire three.
  const answered = new Map<string, Promise<T | null>>();

  let live = 0;
  const waiting: (() => void)[] = [];

  const release = (): void => {
    live--;
    // Shift, not pop: the ceiling must DELAY and never DISCARD, and the shelf reads in
    // order. A queue that served the newest first would leave the top of the pile empty.
    waiting.shift()?.();
  };

  const take = async (): Promise<void> => {
    if (live < limit) {
      live++;
      return;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
    live++;
  };

  return {
    get(url) {
      const already = answered.get(url);
      if (already) return already;

      const running = (async () => {
        await take();
        try {
          return await work(url);
        } catch {
          // Silent on purpose. `rememberCover` already logs what it could not keep, and a
          // cover that does not arrive is a designed state - the card falls back to its
          // cloth, or now to the photograph it was read from.
          return null;
        } finally {
          release();
        }
      })();

      answered.set(url, running);
      return running;
    },
  };
}
