import { describe, it, expect } from 'vitest';
import { badgeFor } from './planBadge';
import { TRIAL_CATCHES, WARN_FROM } from './entitlement';

/**
 * The plan badge in the popup masthead, and the CTA it may or may not be.
 *
 * `entitlement.planLabel` already says what plan somebody is on. This decides whether the
 * badge is worth showing at all and whether it should ask for anything — which is a
 * different question, and the one that decides if this product nags.
 *
 * THE RULE: Buki asks for money in exactly two places, the wall and the options page.
 * The masthead is where somebody looks at their own shelf, so it states a fact and only
 * becomes an offer when the fact is "you are nearly out".
 */

describe('the plan badge', () => {
  it('says nothing at all early in the trial', () => {
    // Ten catches, one used. A badge counting down from the first catch is a countdown,
    // and a countdown on your own shelf is pressure applied to somebody browsing.
    expect(badgeFor({ pro: false, trialSpent: 1, ownKey: false })).toBeNull();
  });

  it('starts counting only once the end is close enough to be a surprise', () => {
    const badge = badgeFor({ pro: false, trialSpent: TRIAL_CATCHES - WARN_FROM, ownKey: false });
    expect(badge?.label).toBe(`${WARN_FROM} free covers left`);
    expect(badge?.cta).toBe(true);
  });

  it('says one cover, not 1 covers', () => {
    expect(badgeFor({ pro: false, trialSpent: TRIAL_CATCHES - 1, ownKey: false })?.label).toBe(
      '1 free cover left',
    );
  });

  it('says the free covers are used once they are, and offers', () => {
    const badge = badgeFor({ pro: false, trialSpent: TRIAL_CATCHES, ownKey: false });
    expect(badge?.label).toBe('Free covers used');
    expect(badge?.cta).toBe(true);
  });

  it('marks a subscriber Pro, and never asks them for anything', () => {
    const badge = badgeFor({ pro: true, trialSpent: TRIAL_CATCHES, ownKey: false });
    expect(badge?.label).toBe('Pro');
    expect(badge?.cta).toBe(false);
  });

  it('says nothing to somebody using their own key', () => {
    // Their cover reading is unlimited and costs us nothing. There is no offer to make,
    // and a badge saying "Your own key" is a label on a fact they already know.
    expect(badgeFor({ pro: false, trialSpent: TRIAL_CATCHES, ownKey: true })).toBeNull();
  });

  it('prefers Pro over the trial count, so paying visibly changes something', () => {
    // Almost everyone converts AT the wall, so a subscriber's trialSpent is 10 forever.
    expect(badgeFor({ pro: true, trialSpent: TRIAL_CATCHES, ownKey: false })?.label).toBe('Pro');
  });
});
