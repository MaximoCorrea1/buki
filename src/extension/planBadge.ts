/**
 * The plan badge in the popup masthead.
 *
 * `entitlement.planLabel` says what plan somebody is on. This answers a different and more
 * consequential question: whether the masthead should say anything at all, and whether it
 * is allowed to ask for something.
 *
 * **Buki asks for money in exactly two places: the wall, and the options page.** The
 * masthead is where somebody looks at their own shelf, so it states a fact and becomes an
 * offer only when the fact is "you are nearly out" — which is the one moment saying
 * nothing would make meeting the wall a surprise.
 *
 * Somebody on their own key sees nothing here, ever. Their cover reading is unlimited and
 * costs us nothing, so there is no offer to make and no news to report.
 */
import { TRIAL_CATCHES, WARN_FROM, trialLeft, type Standing } from './entitlement';

export interface Badge {
  label: string;
  /** Does pressing it lead to the pricing page? A fact is not a call to action. */
  cta: boolean;
}

export function badgeFor(standing: Standing): Badge | null {
  // Plan before count, and the order is load-bearing for the same reason it is in
  // `decide`: nearly everyone converts AT the wall, so a subscriber's trialSpent is
  // TRIAL_CATCHES forever. Checking the count first would tell them they are out.
  if (standing.pro) return { label: 'Pro', cta: false };
  if (standing.ownKey) return null;

  const left = trialLeft(standing);
  if (left === 0) return { label: 'Free covers used', cta: true };
  if (left > WARN_FROM) return null;
  return { label: `${left} free cover${left === 1 ? '' : 's'} left`, cta: true };
}

export { TRIAL_CATCHES };
