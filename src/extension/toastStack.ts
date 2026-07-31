/**
 * What the corner of the screen is showing, as data.
 *
 * This exists because the previous version kept a single module-level `stage` element for
 * the whole page. Catching two books at once meant the second one's progress overwrote
 * the first's - and because both said "Looking up the book...", the screen looked frozen.
 * Worse, when the first finished it dismissed whatever `stage` pointed at, which by then
 * belonged to the book still running, so that one lost its indicator entirely.
 *
 * The fix is that progress belongs to a *job*, not to the page. Kept separate from the DOM
 * so the rules can be tested; `content.ts` renders whatever `list()` returns.
 */
export interface Pill {
  readonly id: number;
  /** The in-flight job this pill reports on, or null for a finished message. */
  readonly job: string | null;
  readonly text: string;
}

export interface ToastStack {
  /** Oldest first, which is also the order they are drawn in. */
  list(): Pill[];
  /** A stage of work still running for `job`. Updates that job's pill in place. */
  stage(job: string, text: string): void;
  /**
   * `job` is over. Its progress pill BECOMES this message, keeping its id and its place
   * in the column, and is handed back so the caller can time its dismissal.
   */
  done(job: string | null, text: string): Pill;
  dismiss(id: number): void;
}

/**
 * No cap by default. Three books caught should read as three confirmations; capping the
 * count meant a burst of catches silently dropped its own evidence. The column is bounded
 * by the screen instead - see `.buki-stack` in content.ts, which clips at the top so the
 * newest is always the one you can see.
 */
export function createToastStack(max: number = Infinity): ToastStack {
  let seq = 0;
  let pills: Pill[] = [];

  /**
   * Drop the stalest *finished* message first, and only sacrifice a pill for work still
   * running if there is nothing else left. Trimming purely by age would make the book you
   * are actually waiting on disappear while a stale "Saved: something else" stayed put.
   */
  const trim = (): void => {
    while (pills.length > max) {
      const finished = pills.findIndex((p) => p.job === null);
      pills.splice(finished === -1 ? 0 : finished, 1);
    }
  };

  return {
    list: () => [...pills],

    stage(job, text) {
      const mine = pills.findIndex((p) => p.job === job);
      if (mine !== -1) {
        // In place, so a book that reports three stages keeps one pill in one position
        // rather than hopping to the end of the queue on every update.
        pills[mine] = { ...(pills[mine] as Pill), text };
        return;
      }
      pills.push({ id: ++seq, job, text });
      trim();
    },

    done(job, text) {
      const mine = job === null ? -1 : pills.findIndex((p) => p.job === job);
      if (mine !== -1) {
        // In place, keeping the id, so the renderer sees only a text change. Removing the
        // pill and appending the result instead made a node leave the middle of the column
        // while a taller one arrived at the end - and since flex reflow is instant and
        // cannot be transitioned, that read as the result overlapping the books still
        // working. A sibling still working keeps its own pill either way.
        const settled: Pill = { id: (pills[mine] as Pill).id, job: null, text };
        pills[mine] = settled;
        return settled;
      }
      const settled: Pill = { id: ++seq, job: null, text };
      pills.push(settled);
      trim();
      return settled;
    },

    dismiss(id) {
      pills = pills.filter((p) => p.id !== id);
    },
  };
}
