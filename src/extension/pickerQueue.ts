/**
 * Books recognized and waiting for the user to say where they go.
 *
 * `openPicker` used to call `closePanel()` unconditionally - "only ever one picker" - and
 * the 📚 flow can ONLY save through a picker. So catching a second book before choosing an
 * intent for the first destroyed the first panel and that book was never saved. Its
 * cleanup then reported `dismissed`, recording a decision the user was never given the
 * chance to make and quietly corrupting the kept rate.
 *
 * A queue rather than several panels at once: pickers anchor to their own tweet, and two
 * that both fall back to the corner would sit on top of each other. One at a time, none
 * discarded.
 */
export interface PickerQueue<T> {
  /** Recognized a book. Shown now if nothing is open, otherwise it waits its turn. */
  push(item: T): void;
  /** The one that should be on screen, or null when the queue is empty. */
  current(): T | null;
  /** The open one was saved or dismissed; bring up the next. */
  settle(): void;
  /** How many are still waiting behind the open one - what the toast counts. */
  waiting(): number;
  /** Abandon everything, returning what was dropped so the caller can account for it. */
  clear(): T[];
}

export function createPickerQueue<T>(): PickerQueue<T> {
  let open: T | null = null;
  let queued: T[] = [];

  return {
    push(item) {
      if (open === null) open = item;
      else queued.push(item);
    },
    current: () => open,
    settle() {
      open = queued.shift() ?? null;
    },
    waiting: () => queued.length,
    clear() {
      const dropped = open === null ? [...queued] : [open, ...queued];
      open = null;
      queued = [];
      return dropped;
    },
  };
}
