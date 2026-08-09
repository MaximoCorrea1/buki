/**
 * May this catch happen, and does it cost one of the free ten.
 *
 * Pure and on its own because three places need the answer: the worker before it spends a
 * vision call, the tray before it draws a footer, and the options page before it says what
 * the plan is. Three copies of this arithmetic would be three chances to advertise a
 * ten-catch trial and deliver nine.
 *
 * **It answers from a snapshot, and the spend happens later.** `decide` reads a count, the
 * vision call runs, and only then does `trial.spend()` increment. Two catches in flight at
 * nine can both be allowed, so the trial delivers eleven rather than ten. `trial.ts`'s
 * write queue guarantees neither increment is lost, which makes the overshoot land rather
 * than preventing it. Left alone deliberately: holding a reservation across an async
 * recognition to protect two hundredths of a cent is not worth the machinery, and erring
 * generous is the right direction for the one number a stranger judges the product by.
 */

/** Ten, not five. Books stand four to a board, so eight to ten is where the shelf stops
 *  being a list and starts being furniture, and that is the thing worth paying for. One
 *  catch costs about $0.00011, so this number is a design decision, not a cost one. */
export const TRIAL_CATCHES = 10;

/** How few must remain before the tray starts counting down. Earlier is nagging. */
export const WARN_FROM = 3;

/** What kind of catch this is, which decides whether anybody pays for it. */
export type CatchKind = 'link' | 'cover';

export interface Standing {
  /**
   * A session token THE SERVER WOULD ACCEPT, which is not the same as an unexpired one.
   *
   * The proxy honours a correctly signed token for a week past its 24 hour life, because
   * an expired token we signed is proof the licence was real yesterday, and that is what
   * keeps a Polar outage from becoming the customer's problem. If this field were computed
   * from the 24 hour life alone, an outage would set it false, `decide` would fall through
   * to the trial cap, and a paying subscriber who converted at the wall (which is how
   * nearly all of them convert) would be shown the paywall again. The request would never
   * even reach the server that was going to honour it.
   *
   * See `license.ts`: renewing early and still being licensed are two different questions.
   */
  pro: boolean;
  /** Hosted cover catches already spent. Only ever grows. */
  trialSpent: number;
  /** The user configured their own provider key, so we are not paying for the call. */
  ownKey: boolean;
}

export type Verdict =
  | { allow: true; spendTrial: boolean }
  | { allow: false; reason: 'trial-spent' };

/**
 * A retailer link costs nothing to serve, because no vision call happens. Charging for it
 * would be charging for arithmetic, so it is free forever at every level.
 */
export function decide(standing: Standing, kind: CatchKind): Verdict {
  if (kind === 'link') return { allow: true, spendTrial: false };
  // Plan BEFORE cap, and the order is load-bearing. Nearly every subscriber converts by
  // meeting the wall, so they arrive here with the trial already spent. Checking the cap
  // first would mean paying changed nothing.
  if (standing.pro || standing.ownKey) return { allow: true, spendTrial: false };
  if (spent(standing) >= TRIAL_CATCHES) return { allow: false, reason: 'trial-spent' };
  return { allow: true, spendTrial: true };
}

/**
 * `trialSpent` as a number we are willing to act on.
 *
 * It arrives from `chrome.storage.local`, which is user-editable and shared with every
 * other key in the extension. `trial.ts` already sanitises its own reads, so this is the
 * second line rather than the first, and it exists because this module is deliberately the
 * one chokepoint three callers share: a future caller that reads storage directly must not
 * be able to turn a NaN into unlimited free catches.
 */
function spent(standing: Standing): number {
  const raw = standing.trialSpent;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/**
 * How many of the ten remain. Raw arithmetic, and deliberately NOT plan-aware: it answers
 * "how much trial is left" even for somebody who is not on the trial. Ask `planLabel` if
 * you are about to show a human what plan they are on, or this will tell a Pro subscriber
 * they have three catches left.
 */
export function trialLeft(standing: Standing): number {
  return Math.max(0, TRIAL_CATCHES - spent(standing));
}

/**
 * What plan is this, in words, for the options page.
 *
 * Here rather than in the options page because it is the same arithmetic `decide` and
 * `footer` already do, and a fourth copy is a fourth chance to tell somebody who is paying
 * that their trial is running out.
 */
export function planLabel(standing: Standing): string {
  if (standing.pro) return 'Pro';
  if (standing.ownKey) return 'Your own key';
  return `${trialLeft(standing)} of ${TRIAL_CATCHES} free catches left`;
}

/**
 * The quiet line under the tray. Empty for most of the trial: a counter that ticks from
 * ten is a countdown, and a countdown is pressure. It appears only when the end is close
 * enough that meeting the wall would otherwise be a surprise.
 *
 * Empty means "say nothing", NOT "nothing to worry about": it is also empty once the trial
 * is spent, because the wall says that instead. A caller must never read `''` as reassurance.
 * `decide` is the gate; this is only the label.
 */
export function footer(standing: Standing): string {
  if (standing.pro || standing.ownKey) return '';
  const left = trialLeft(standing);
  if (left === 0 || left > WARN_FROM) return '';
  return `${left} catch${left === 1 ? '' : 'es'} left`;
}
