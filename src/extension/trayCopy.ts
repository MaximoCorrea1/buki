/**
 * The words on a catch card.
 *
 * Separate from `content.ts` for the reason `slotTravel.ts` is: that file registers
 * `chrome.runtime.onMessage` at module scope, so no test can import it, and copy that
 * cannot be tested is copy that quietly pluralises wrongly for a year.
 */
import type { Intent } from './storage';
import { PRO_MONTHLY_USD, TRIAL_SPELLED } from '../shared/pricing';

/**
 * The heading on a card that found something.
 *
 * It was `${n} books in this picture`, which is a label on a form rather than a sentence.
 * Maximo, 2026-08-17: *'should have something like "buki found xbooks on this image"'*.
 * Naming Buki matters more than it looks: the card draws inside somebody else's page, so
 * the one thing it must never be mistaken for is part of that page.
 */
export function foundHeading(count: number): string {
  if (count < 1) {
    // A card with nothing on it takes the empty state, which is a different sentence.
    // Reaching here means the caller has a bug, and saying so beats "Buki found 0 books".
    throw new Error('foundHeading needs at least one book; the empty state is its own card');
  }
  // "one book" rather than "1 book": a count of one reads as prose, and only the plural
  // is a number worth scanning.
  return count === 1
    ? 'Buki found one book in this picture'
    : `Buki found ${count} books in this picture`;
}

/**
 * The three actions, with the verb.
 *
 * "now / next / someday" are the pile NAMES, and three bare nouns on three buttons never
 * said what pressing one would do. The verb is the whole difference between a label and a
 * control.
 *
 * NOTE FOR WHOEVER TOUCHES THE PILES: the shelf's fourth pile is called "Read", meaning
 * finished. "Read now" here is the verb; "Read" there is a place. They are distinguishable
 * in context but they are not distinct words, and renaming the finished pile to "Finished"
 * would remove the collision permanently. That is a founder decision, not a refactor.
 */
/** The three the tray offers. `Intent` has a fourth, `read`, which is the finished pile
    and is reached from the shelf rather than from a catch. */
export type Offered = Exclude<Intent, 'read'>;

export const INTENT_LABEL: Record<Offered, string> = {
  now: 'Read now',
  next: 'Read next',
  someday: 'Read someday',
};

/**
 * Where an answer came from. The card's audit trail: a shelf you cannot question is a
 * shelf you stop trusting.
 *
 * `unverified` USED TO READ "read from the cover · unverified" and no longer does.
 * Maximo, 2026-08-17: *"what is that, remove it"*. The distinction was real — the cover
 * was read but OpenLibrary was unreachable, so nothing corroborated it — but it is an
 * internal state, and printing it asked the reader to adjudicate something they have no
 * way to check. The provenance itself stays, because that is the part that earns trust.
 */
export const PROVENANCE: Record<string, string> = {
  vision: 'read from the cover',
  unverified: 'read from the cover',
  link: 'from the link in the post',
  text: "from the post's words",
  none: 'found',
};

/**
 * THE WALL: the ten free cover readings are spent.
 *
 * This is the only moment Buki asks anybody for money, and it is the moment a stranger
 * decides what kind of product this is. Four rules, all asserted in `trayCopy.test.ts`
 * rather than left to whoever edits next:
 *
 * 1. **Say what happened**, in the number the code actually enforces.
 * 2. **Name the price.** A paywall that hides it reads as a trap, and $4 is small enough
 *    to be the argument rather than something to soften.
 * 3. **Offer the free way out as plainly as the paid one.** With your own provider key,
 *    cover reading is unlimited and free forever. That is genuinely true, so burying it
 *    would make this a dark pattern instead of an offer.
 * 4. **Never threaten the shelf.** Nothing already saved is ever at risk. That is the line
 *    between a limit and a hostage, and the test forbids the words that cross it.
 *
 * It also does NOT say "upgrade". Nothing about the shelf improves; what you buy is the
 * one job Buki cannot do on your own computer.
 */
export const WALL = {
  eyebrow: 'the free covers are used',
  head: `That was the last of your ${TRIAL_SPELLED} free cover readings.`,
  body:
    'Reading a cover from a photograph is the one thing Buki cannot do on your computer. ' +
    'Your shelf, your piles, export, and any book you catch from a shop link stay free ' +
    'forever.',
  act: `Get Buki Pro, $${PRO_MONTHLY_USD} a month`,
  free: 'Use your own key instead, free',
} as const;
