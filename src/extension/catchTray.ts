import type { Book } from '../recognizer/types';

/**
 * What the corner is showing, as data.
 *
 * This replaces the toast stack AND the picker queue, which were two surfaces doing one
 * job. A catch used to begin as a toast, finish as a separate toast, and - if it needed a
 * decision - open a panel somewhere else entirely, while a confident guess saved itself
 * and reported the fact for 2.8 seconds. That is a transaction being executed at you.
 *
 * A catch is a judgement. Recognition is fallible by design, which is why there is a kept
 * rate at all, and the shelf is a list you curate. So: one card per catch, from the moment
 * it starts until you say what it is. Nothing saves without a click, and only a message
 * that carries no decision - an error, a confirmation - is allowed to leave on its own.
 */
export type CardState = 'looking' | 'found' | 'empty' | 'error' | 'done';

export interface Candidate {
  book: Book;
  /** Already on the shelf. The card says so rather than offering it as though it were new. */
  shelved: boolean;
}

export interface Card {
  readonly id: number;
  /** The recognition this card belongs to, so it can be called off by name. */
  readonly job: string;
  readonly state: CardState;
  /** The message, for every state except `found` - there, the candidates are the content. */
  readonly text: string;
  readonly candidates: Candidate[];
  /** May the renderer put this on a timer? Only true where no decision is pending. */
  readonly transient: boolean;
}

export interface CatchTray {
  list(): Card[];
  /** A catch has started. */
  open(job: string, text: string): void;
  /** It came back. Candidates make it a choice; none makes it a dead end worth saying. */
  resolve(job: string, candidates: Candidate[]): void;
  fail(job: string, text: string): void;
  /** The choice was made. */
  done(job: string, text: string): void;
  dismiss(id: number): void;
}

export function createCatchTray(): CatchTray {
  let seq = 0;
  let cards: Card[] = [];

  /**
   * Update a catch's card in place, keeping its id and its position in the column.
   *
   * A missing card is not an error: the user can dismiss a catch while it is still
   * running, and its answer arrives afterwards. Putting the card back would hand a
   * decision to somebody who already said they were finished with it.
   */
  const replace = (job: string, next: Omit<Card, 'id' | 'job'>): void => {
    const at = cards.findIndex((c) => c.job === job);
    if (at === -1) return;
    cards[at] = { id: (cards[at] as Card).id, job, ...next };
  };

  return {
    list: () => cards.map((c) => ({ ...c })),

    open(job, text) {
      cards.push({ id: ++seq, job, state: 'looking', text, candidates: [], transient: false });
    },

    resolve(job, candidates) {
      replace(
        job,
        candidates.length
          ? // No text: on a found card the books ARE the content, and the renderer builds
            // whatever heading the layout needs from them.
            { state: 'found', text: '', candidates, transient: false }
          : {
              state: 'empty',
              text: 'No book on that cover.',
              candidates: [],
              transient: false,
            },
      );
    },

    fail(job, text) {
      replace(job, { state: 'error', text, candidates: [], transient: true });
    },

    done(job, text) {
      replace(job, { state: 'done', text, candidates: [], transient: true });
    },

    dismiss(id) {
      cards = cards.filter((c) => c.id !== id);
    },
  };
}
