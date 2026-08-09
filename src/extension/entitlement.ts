/**
 * May this catch happen, and does it cost one of the free ten.
 *
 * Pure and on its own because three places need the answer: the worker before it spends a
 * vision call, the tray before it draws a footer, and the options page before it says what
 * the plan is. Three copies of this arithmetic would be three chances to advertise a
 * ten-catch trial and deliver nine.
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
  /** A valid, unexpired session token exists. */
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
  if (standing.pro || standing.ownKey) return { allow: true, spendTrial: false };
  if (standing.trialSpent >= TRIAL_CATCHES) return { allow: false, reason: 'trial-spent' };
  return { allow: true, spendTrial: true };
}

export function trialLeft(standing: Standing): number {
  return Math.max(0, TRIAL_CATCHES - standing.trialSpent);
}

/**
 * The quiet line under the tray. Empty for most of the trial: a counter that ticks from
 * ten is a countdown, and a countdown is pressure. It appears only when the end is close
 * enough that meeting the wall would otherwise be a surprise.
 */
export function footer(standing: Standing): string {
  if (standing.pro || standing.ownKey) return '';
  const left = trialLeft(standing);
  if (left === 0 || left > WARN_FROM) return '';
  return `${left} catch${left === 1 ? '' : 'es'} left`;
}
