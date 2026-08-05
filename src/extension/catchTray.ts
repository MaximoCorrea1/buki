import type { Book, RecognitionSource } from '../recognizer/types';
import type { Intent } from './storage';

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
 *
 * A catch is named by the POST it is about, not by a click counter. That is what makes
 * "one card however many times you press" a property of the data rather than a rule three
 * collaborating maps have to remember to enforce.
 */
export type CardState = 'looking' | 'found' | 'empty' | 'error' | 'done';

export interface Candidate {
  book: Book;
  /**
   * Which pile the shelf already has this book in, if it has it at all.
   *
   * A boolean would only say "you own this". Naming the pile is what turns the marker
   * into a decision you can act on: the buttons become MOVE rather than SAVE, and the
   * one that would change nothing is the one you can see is pointless.
   */
  shelvedIn?: Intent;
  /**
   * Filed just now, from this card. Distinct from `shelvedIn`, which is what the shelf
   * already held when the answer arrived: one is history, the other is a receipt for
   * something you did a second ago, and a card holding four books needs to show which
   * of them you have dealt with.
   */
  savedTo?: Intent;
}

export interface Card {
  readonly id: number;
  /** The recognition this card belongs to, so it can be called off by name. */
  readonly job: string;
  readonly state: CardState;
  /** The message, for every state except `found` - there, the candidates are the content. */
  readonly text: string;
  /**
   * The books found in this picture, best-read first. A photographed stack or a shelf
   * behind someone's head is several books, and this used to hold competing guesses at
   * ONE of them - so a second row meant two different things depending on the catch.
   */
  readonly candidates: Candidate[];
  /**
   * What the answer was built from. The card says it out loud: a shelf you cannot audit
   * is a shelf you stop trusting, and "read from the cover" is the whole claim.
   */
  readonly source?: RecognitionSource;
  /** The picture this catch is about. Three identical "Reading…" cards are indistinguishable. */
  readonly image?: string;
  /** May the renderer put this on a timer? Only true where no decision is pending. */
  readonly transient: boolean;
}

export interface CatchTray {
  list(): Card[];
  /**
   * A catch has started. Answers whether it actually opened a card: `false` means this
   * post is already on screen, and the caller should draw attention to that card rather
   * than stacking a second one behind it.
   */
  open(job: string, text: string, image?: string): boolean;
  /** It came back. Candidates make it a choice; none makes it a dead end worth saying. */
  resolve(job: string, candidates: Candidate[], source?: RecognitionSource): void;
  /**
   * The same catch, asked a different way. "No book on that cover" is a wall unless the
   * card offers a door, and trying the post's words is that door - on the card that came
   * back empty, not on a second one stacked underneath it.
   */
  retry(job: string, text: string): void;
  fail(job: string, text: string): void;
  /** The choice was made. */
  done(job: string, text: string): void;
  /**
   * One book on this card is filed. The card stays put for the others - a photo of four
   * books is four decisions, and closing on the first would take the other three away.
   */
  savedOne(job: string, index: number, intent: Intent): void;
  /** Something worth saying that belongs to no catch - an update notice, a missing key. */
  say(text: string): void;
  dismiss(id: number): void;
}

/** Everything an update decides. `id`, `job` and `image` outlive it. */
type Update = Omit<Card, 'id' | 'job' | 'image'>;

export function createCatchTray(): CatchTray {
  let seq = 0;
  let cards: Card[] = [];

  /**
   * This catch's card, or -1.
   *
   * '' is deliberately never found: standalone messages all carry it, and an answer
   * arriving for the empty job would otherwise rewrite the oldest message on screen as
   * though it were a catch.
   */
  const find = (job: string): number => (job ? cards.findIndex((c) => c.job === job) : -1);

  /**
   * Update a catch's card in place, keeping its id and its position in the column.
   *
   * A missing card is not an error: the user can dismiss a catch while it is still
   * running, and its answer arrives afterwards. Putting the card back would hand a
   * decision to somebody who already said they were finished with it.
   */
  const replace = (job: string, next: Update): void => {
    const at = find(job);
    if (at === -1) return;
    const held = cards[at] as Card;
    // `image` survives every update: it is what this catch is LOOKING at, not part of
    // any particular answer about it.
    cards[at] = { ...next, id: held.id, job, ...(held.image ? { image: held.image } : {}) };
  };

  return {
    list: () => cards.map((c) => ({ ...c })),

    open(job, text, image) {
      // Pressing one post ten times is one catch asked about ten times. Returning early
      // also protects an answer that already landed: a late repeat press must not drag a
      // found card back to "Reading the cover…".
      if (find(job) !== -1) return false;
      cards.push({
        id: ++seq,
        job,
        state: 'looking',
        text,
        candidates: [],
        transient: false,
        ...(image ? { image } : {}),
      });
      return true;
    },

    resolve(job, candidates, source) {
      const common = {
        transient: false,
        ...(source ? { source } : {}),
      };
      replace(
        job,
        candidates.length
          ? // No text: on a found card the books ARE the content, and the renderer builds
            // whatever heading the layout needs from them.
            { state: 'found', text: '', candidates, ...common }
          : { state: 'empty', text: 'No book on that cover.', candidates: [], ...common },
      );
    },

    retry(job, text) {
      // Candidates cleared: leaving them would offer books from the very answer being
      // replaced, on a card that says it is still looking.
      replace(job, { state: 'looking', text, candidates: [], transient: false });
    },

    fail(job, text) {
      replace(job, { state: 'error', text, candidates: [], transient: true });
    },

    done(job, text) {
      replace(job, { state: 'done', text, candidates: [], transient: true });
    },

    savedOne(job, index, intent) {
      const at = find(job);
      if (at === -1) return;
      const held = cards[at] as Card;
      if (!held.candidates[index]) return;
      cards[at] = {
        ...held,
        candidates: held.candidates.map((c, i) => (i === index ? { ...c, savedTo: intent } : c)),
      };
    },

    say(text) {
      cards.push({
        id: ++seq,
        job: '', // belongs to no catch, and `find` refuses to match it as one
        state: 'error',
        text,
        candidates: [],
        transient: true,
      });
    },


    dismiss(id) {
      cards = cards.filter((c) => c.id !== id);
    },
  };
}
