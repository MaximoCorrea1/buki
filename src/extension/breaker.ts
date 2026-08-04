import type { Book, BooksDb } from '../recognizer/types';

/**
 * Stop asking a service that has stopped answering.
 *
 * Measured 2026-08-04: OpenLibrary's search index failed every query for hours. The
 * recognizer already survives that - a silent catalogue yields an `unverified` reading
 * rather than a failed catch - but it survived it SLOWLY, paying the full six-second
 * timeout on every catch to be told the same thing each time. With vision down to under
 * five seconds, that wait had become more than half of what a catch costs.
 *
 * The shape is the standard one, and the part that matters is the probe: after the
 * cooldown exactly one request is let through, so an outage that has ended is noticed
 * without anyone restarting anything, and one that has not does not cost six seconds to
 * rediscover.
 */

/** Consecutive failures before we stop asking. One timeout is a blip, not an outage. */
export const TOLERANCE = 3;

/**
 * How long to leave it alone. Long enough that an outage is not re-probed on every
 * catch, short enough that a recovery is picked up within a couple of minutes - and this
 * lives in a service worker that Chrome tears down after ~30s idle anyway, so in practice
 * it is bounded by a burst of catches rather than by the clock.
 */
export const COOLDOWN_MS = 120_000;

export interface Breaker {
  /** May we ask? */
  ready(): boolean;
  ok(): void;
  failed(): void;
}

export function createBreaker(deps: { now: () => number }): Breaker {
  let consecutive = 0;
  let openedAt = 0;

  return {
    ready() {
      if (consecutive < TOLERANCE) return true;
      // The cooldown has passed: let exactly one through and see what happens. Whichever
      // way it goes, `ok` or `failed` is called and decides the next window.
      return deps.now() - openedAt >= COOLDOWN_MS;
    },
    ok() {
      consecutive = 0;
    },
    failed() {
      consecutive += 1;
      // Re-stamped on every failure at or past the threshold, so a failed PROBE starts a
      // fresh cooldown instead of leaving the breaker permanently half-open.
      if (consecutive >= TOLERANCE) openedAt = deps.now();
    },
  };
}

/** Raised instead of asking. `attempt()` in the recognizer turns it into "unverified". */
export class CatalogueDown extends Error {
  constructor() {
    super('Skipping the catalogue: it has not answered the last few times.');
    this.name = 'CatalogueDown';
  }
}

/**
 * A catalogue that gives up on itself.
 *
 * A 404 is not a failure - "OpenLibrary does not hold this ISBN" is an answer, and
 * counting it would open the breaker on a run of obscure books.
 */
export function withBreaker(books: BooksDb, breaker: Breaker): BooksDb {
  const guard = async <T>(work: () => Promise<T>): Promise<T> => {
    if (!breaker.ready()) throw new CatalogueDown();
    try {
      const result = await work();
      breaker.ok();
      return result;
    } catch (err) {
      breaker.failed();
      throw err;
    }
  };

  return {
    search: (query) => guard(() => books.search(query)),
    lookupByIsbn: (isbn): Promise<Book | null> => guard(() => books.lookupByIsbn(isbn)),
  };
}
