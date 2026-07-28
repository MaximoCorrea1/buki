/**
 * Serializes async jobs so read-modify-write cycles against one storage key cannot
 * interleave. Two overlapping saves would otherwise both read the same base list and
 * the last write would silently drop the other's book - reproduced as real data loss.
 *
 * One queue per storage key. Separate keys want separate queues: `storage.set` replaces
 * only the keys it is given, so a shelf write and a log write cannot clobber each other,
 * and sharing a queue would only make diagnostics wait on the shelf.
 */
export function createWriteQueue(): <T>(job: () => Promise<T>) => Promise<T> {
  let queue: Promise<unknown> = Promise.resolve();

  return function serialize<T>(job: () => Promise<T>): Promise<T> {
    const run = queue.then(job);
    queue = run.catch(() => undefined); // a failed write must not wedge the queue
    return run;
  };
}
