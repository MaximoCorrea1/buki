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
/**
 * `wall` is the trial running out. It is a STATE OF THIS CATCH rather than a separate
 * surface, so it lands where the answer would have landed, keeps the card's id and keeps
 * the picture it was reading - which is what makes it an answer about this book instead of
 * an advert that appeared while you were busy.
 */
export type CardState = 'looking' | 'found' | 'empty' | 'error' | 'done' | 'wall';

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
  /**
   * How many pictures this catch COVERED, which is not the same as how many the card
   * shows. The card shows one: `content.ts` opens it with `tweet.imageUrls[0]`. `shotFor`
   * needs the real count, because storing photograph one as a book's cover is only honest
   * when photograph one was the only photograph. `OPENWORK.md` item 47, C-9.
   */
  readonly pictures: number;
  /** May the renderer put this on a timer? Only true where no decision is pending. */
  readonly transient: boolean;
  /**
   * When this catch started, so a card that never finishes can be found. `OPENWORK.md` 49, R-3.
   *
   * A `looking` card had no watchdog in either direction: nothing timed it out, and nothing
   * noticed a worker that died holding it. An MV3 worker is torn down aggressively, and on
   * the context-menu flow the tray is injected into a page Buki does not own — so
   * "Reading the cover…" sat there for the life of the tab, dismissible only by hand, on
   * somebody else's site.
   */
  readonly openedAt: number;
}

export interface CatchTray {
  list(): Card[];
  /**
   * A catch has started. Answers whether it actually opened a card: `false` means this
   * post is already on screen, and the caller should draw attention to that card rather
   * than stacking a second one behind it.
   */
  open(job: string, text: string, image?: string, pictures?: number): boolean;
  /** It came back. Candidates make it a choice; none makes it a dead end worth saying. */
  resolve(job: string, candidates: Candidate[], source?: RecognitionSource): void;
  /**
   * The same catch, asked a different way. "No book on that cover" is a wall unless the
   * card offers a door, and trying the post's words is that door - on the card that came
   * back empty, not on a second one stacked underneath it.
   */
  retry(job: string, text: string): void;
  fail(job: string, text: string): void;
  /**
   * The ten free cover readings are spent. Replaces this catch's card in place; does
   * nothing if the card is gone, because putting a paywall back on screen after somebody
   * dismissed the catch is the behaviour that gets an extension uninstalled.
   */
  wall(job: string): void;
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

/**
 * Everything an update decides. `id`, `job`, `image` and `pictures` outlive it.
 *
 * `pictures` belongs with `image` rather than with the state: how many photographs a catch
 * covered is a fact about the post, fixed the moment the card opens, and no later
 * transition can learn a different answer. The compiler enumerating this list is what
 * caught it — adding the field to `Card` turned every transition red until it was named.
 */
type Update = Omit<Card, 'id' | 'job' | 'image' | 'pictures' | 'openedAt'>;

/**
 * How long a catch may sit on "Reading the cover…" before the tray gives up on it.
 * `OPENWORK.md` item 49, R-3.
 *
 * **THE NUMBER IS A CEILING ON THE PIPELINE, not a guess at it.** Every stage already
 * bounds itself, and this has to clear the sum of them or it fires on catches that were
 * going to succeed — which is worse than the bug, because it replaces a slow answer with a
 * wrong error:
 *
 *     picture download        10s   `inlineImage.DOWNLOAD_TIMEOUT_MS`
 *     vision, twice           24s   `llmVision.TIMEOUT_MS` × `ATTEMPTS`
 *     catalogue grounding      6s   `openLibrary.TIMEOUT_MS`
 *     licence exchange         8s   `license.EXCHANGE_TIMEOUT_MS`, when it blocks at all
 *     ------------------------------
 *                             48s
 *
 * 90s is that with room. `catchTray.test.ts` computes the sum from the real constants
 * rather than trusting this comment, so raising any stage's ceiling without raising this
 * one goes red.
 *
 * WHY THE TRAY NEEDS ONE AT ALL. The worker is what answers a catch, and an MV3 worker is
 * torn down aggressively. If it dies mid-catch nothing ever arrives, and on the
 * context-menu flow the card is sitting in a page Buki does not own — so it stayed for the
 * life of the tab, dismissible only by hand.
 */
export const STALL_MS = 90_000;

/**
 * The catches that have stopped answering.
 *
 * Data rather than a timer, because the timer belongs in `content.ts` and nothing there can
 * be imported by a test. Only `looking` counts: every other state is either an answer or
 * already on its way out under `transient`.
 */
export function stalledJobs(cards: readonly Card[], now: number, ms: number = STALL_MS): string[] {
  return cards.filter((c) => c.state === 'looking' && now - c.openedAt >= ms).map((c) => c.job);
}

export function createCatchTray(now: () => number = () => Date.now()): CatchTray {
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
    cards[at] = {
      ...next,
      id: held.id,
      job,
      pictures: held.pictures,
      openedAt: held.openedAt,
      ...(held.image ? { image: held.image } : {}),
    };
  };

  return {
    list: () => cards.map((c) => ({ ...c })),

    open(job, text, image, pictures) {
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
        // Defaults to one when a picture was given, which is the guarantee the context-menu
        // flow makes: `background.ts` builds its Tweet as `imageUrls: [info.srcUrl]`, so
        // exactly one picture was sent to the model. The feed flow passes the real count.
        pictures: pictures ?? (image ? 1 : 0),
        openedAt: now(),
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

    wall(job) {
      // No text and no candidates: the renderer owns every word of an offer, and a card
      // with candidates would draw save buttons on a catch nobody is allowed to save.
      // NOT transient - an offer that removes itself after four seconds is an offer
      // nobody read, and every other self-dismissing state here carries no decision.
      replace(job, { state: 'wall', text: '', candidates: [], transient: false });
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
        pictures: 0, // a bare message is about no picture at all
        openedAt: now(),
      });
    },


    dismiss(id) {
      cards = cards.filter((c) => c.id !== id);
    },
  };
}
