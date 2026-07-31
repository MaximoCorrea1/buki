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
  /** `job` is over. Its progress pill goes; this message stays. */
  done(job: string | null, text: string): void;
  dismiss(id: number): void;
}

/** Beyond this the corner becomes a wall of text nobody reads. */
export const MAX_TOASTS = 3;

export function createToastStack(max: number = MAX_TOASTS): ToastStack {
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
      // Only this job's progress. A sibling still working keeps its own pill.
      if (job !== null) pills = pills.filter((p) => p.job !== job);
      pills.push({ id: ++seq, job: null, text });
      trim();
    },

    dismiss(id) {
      pills = pills.filter((p) => p.id !== id);
    },
  };
}
