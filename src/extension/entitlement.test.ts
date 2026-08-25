import { describe, it, expect } from 'vitest';
import {
  decide,
  footer,
  planLabel,
  trialLeft,
  TRIAL_CATCHES,
  TRIAL_ATTEMPTS,
  WARN_FROM,
  type Standing,
} from './entitlement';

const free: Standing = { pro: false, trialSpent: 0, trialAttempts: 0, ownKey: false };
const withKey: Standing = { pro: false, trialSpent: 0, trialAttempts: 0, ownKey: true };
const pro: Standing = { pro: true, trialSpent: 0, trialAttempts: 0, ownKey: false };

describe('decide', () => {
  it('lets a retailer-link catch through however spent the trial is', () => {
    // No vision call happens, so there is nothing to charge for.
    const spent = { ...free, trialSpent: TRIAL_CATCHES , trialAttempts: 0};
    expect(decide(spent, 'link')).toEqual({ allow: true, spendTrial: false });
  });

  it('lets a trial catch through and marks it chargeable', () => {
    expect(decide(free, 'cover')).toEqual({ allow: true, spendTrial: true });
  });

  it('stops a cover catch once the trial is spent', () => {
    const spent = { ...free, trialSpent: TRIAL_CATCHES , trialAttempts: 0};
    expect(decide(spent, 'cover')).toEqual({ allow: false, reason: 'trial-spent' });
  });

  it('counts the tenth catch as allowed and the eleventh as not', () => {
    // Off-by-one here is the difference between the advertised trial and a shorter one.
    expect(decide({ ...free, trialSpent: TRIAL_CATCHES - 1 , trialAttempts: 0}, 'cover').allow).toBe(true);
    expect(decide({ ...free, trialSpent: TRIAL_CATCHES , trialAttempts: 0}, 'cover').allow).toBe(false);
  });

  it('never spends the trial when the user brought their own key', () => {
    const spent = { ...withKey, trialSpent: TRIAL_CATCHES , trialAttempts: 0};
    expect(decide(spent, 'cover')).toEqual({ allow: true, spendTrial: false });
  });

  it('never spends the trial for Pro', () => {
    expect(decide(pro, 'cover')).toEqual({ allow: true, spendTrial: false });
  });

  it('lets a lapsed Pro fall back to whatever trial is left rather than to nothing', () => {
    // A card that expires must not feel like the extension broke.
    const lapsed: Standing = { pro: false, trialSpent: 4, trialAttempts: 0, ownKey: false };
    expect(decide(lapsed, 'cover')).toEqual({ allow: true, spendTrial: true });
  });
});

describe('footer', () => {
  it('says nothing while the trial is comfortable', () => {
    expect(footer(free)).toBe('');
  });

  it('starts counting down only near the end', () => {
    expect(footer({ ...free, trialSpent: TRIAL_CATCHES - WARN_FROM , trialAttempts: 0})).toBe('3 catches left');
  });

  it('says one catch, not one catchs', () => {
    expect(footer({ ...free, trialSpent: TRIAL_CATCHES - 1 , trialAttempts: 0})).toBe('1 catch left');
  });

  it('says nothing once there are none left, because the wall says it instead', () => {
    expect(footer({ ...free, trialSpent: TRIAL_CATCHES , trialAttempts: 0})).toBe('');
  });

  it('says nothing to Pro or to someone with their own key', () => {
    expect(footer(pro)).toBe('');
    expect(footer({ ...withKey, trialSpent: 9 , trialAttempts: 0})).toBe('');
  });
});

describe('the case that actually pays', () => {
  it('lets Pro through even after the trial was exhausted first', () => {
    // How nearly every subscriber arrives: they spend ten catches, meet the wall, and
    // buy. If the cap were checked before the plan, converting would change nothing and
    // the customer would still be looking at a paywall. Moving the cap check above the
    // pro check leaves all twelve original tests green, so nothing guarded this.
    const converted: Standing = { pro: true, trialSpent: TRIAL_CATCHES, trialAttempts: 0, ownKey: false };
    expect(decide(converted, 'cover')).toEqual({ allow: true, spendTrial: false });
    expect(decide({ ...converted, trialSpent: TRIAL_CATCHES + 50 , trialAttempts: 0}, 'cover')).toEqual({
      allow: true,
      spendTrial: false,
    });
  });

  it('says Pro rather than counting catches nobody is counting', () => {
    expect(planLabel({ pro: true, trialSpent: 7, trialAttempts: 0, ownKey: false })).toBe('Pro');
  });

  it('names the own-key plan, which is also not metered', () => {
    expect(planLabel({ pro: false, trialSpent: 7, trialAttempts: 0, ownKey: true })).toBe('Your own key');
  });

  it('counts only for someone actually on the trial', () => {
    expect(planLabel({ pro: false, trialSpent: 7, trialAttempts: 0, ownKey: false })).toBe('3 of 10 free catches left');
  });

  it('treats a corrupt count as an untouched trial, not as a spent one', () => {
    // trialSpent arrives from storage, which is user-editable and shared with every other
    // key in the extension, so a NaN is far likelier to be a bug than an attack. Failing
    // closed would show a paywall to somebody who never earned one, and it would defend
    // nothing: the count is deliberately forgeable, so anyone wanting a free trial could
    // simply write 0. Generous is both kinder and consistent with trial.ts's own read.
    const corrupt = { pro: false, ownKey: false, trialSpent: Number.NaN , trialAttempts: 0} as Standing;
    expect(decide(corrupt, 'cover')).toEqual({ allow: true, spendTrial: true });
    // What the clamp is really for: without it this line reads "NaN catches left".
    expect(footer(corrupt)).toBe('');
    expect(planLabel(corrupt)).toBe('10 of 10 free catches left');
  });
});

/**
 * THE CARD'S × WAS A FREE-READ BUTTON, and this is the half that bounds it.
 *
 * `gate.run` spends the trial only after `work()` RESOLVES, which is a deliberate promise
 * `trial.ts` states out loud: *"A catch is spent only when a reading came BACK. A timeout,
 * a no-match, a refused grounding or a dismissed card costs nothing: charging one of ten
 * free catches for a failure is the fastest uninstall there is."* That promise is right and
 * is kept.
 *
 * What it did not survive is a caller who makes `work()` reject ON PURPOSE. Press catch,
 * press "Stop looking" two seconds later, repeat: `dismiss` sends `cancelRecognize`, the
 * worker aborts, `lookups.forget(job)` makes the next press a fresh full-price lookup, the
 * abort surfaces as a 408, and the spend is skipped. The money is committed and the counter
 * never moves. **No forgery and no storage editing** — and the options page goes on reading
 * "10 of 10 free catches left".
 *
 * So there are two numbers now. `trialSpent` stays the advertised generous one. `trialAttempts`
 * counts every attempt that actually issued a request, and exists only to stop an unbounded
 * loop.
 */
describe('the attempt ceiling', () => {
  const standing = (over: Partial<Standing> = {}): Standing => ({
    pro: false,
    trialSpent: 0,
    trialAttempts: 0,
    ownKey: false,
    ...over,
  });

  it('is far enough out that only a loop reaches it', () => {
    // Three attempts per advertised catch. Somebody with a genuinely terrible connection
    // burns one attempt per catch, so this is 30 consecutive real failures — at which
    // point the product is broken for them in a way a wall is not the worst part of.
    expect(TRIAL_ATTEMPTS).toBeGreaterThanOrEqual(TRIAL_CATCHES * 3);
  });

  it('walls a caller who has spent nothing but attempted everything', () => {
    // The × loop, exactly: zero successful readings, so `trialSpent` never moved.
    const verdict = decide(standing({ trialSpent: 0, trialAttempts: TRIAL_ATTEMPTS }), 'cover');
    expect(verdict.allow).toBe(false);
  });

  it('still allows a caller with attempts to spare', () => {
    expect(decide(standing({ trialAttempts: TRIAL_ATTEMPTS - 1 }), 'cover').allow).toBe(true);
  });

  it('NEVER contradicts what the options page tells the same person', () => {
    // The failure this folds into one function. Two ceilings read in two places is two
    // places to disagree, and the disagreement would be the wall saying "spent" while
    // `planLabel` says "10 of 10 left" — a false statement made to somebody at the moment
    // they are deciding whether to pay.
    const walled = standing({ trialSpent: 0, trialAttempts: TRIAL_ATTEMPTS });
    expect(decide(walled, 'cover').allow).toBe(false);
    expect(trialLeft(walled), 'the wall and the plan label disagree').toBe(0);
    expect(planLabel(walled)).toContain('0 of');
  });

  it('does not touch a subscriber or somebody using their own key', () => {
    // The ceiling is a TRIAL ceiling. Neither of these spends our money at all, and
    // `decide` answers plan-before-cap for exactly this reason.
    const many = { trialAttempts: TRIAL_ATTEMPTS * 10, trialSpent: TRIAL_CATCHES * 10 };
    expect(decide(standing({ ...many, pro: true }), 'cover').allow).toBe(true);
    expect(decide(standing({ ...many, ownKey: true }), 'cover').allow).toBe(true);
  });

  it('never lets a shop link meet the ceiling', () => {
    // No vision call happens, so no attempt was ever issued and nothing can accumulate.
    const verdict = decide(standing({ trialAttempts: TRIAL_ATTEMPTS * 10 }), 'link');
    expect(verdict).toEqual({ allow: true, spendTrial: false });
  });

  it('reads a corrupt attempt count as zero, never as unlimited', () => {
    // Same storage, same editability, same rule `trialSpent` already follows.
    for (const raw of [NaN, -5, Infinity, undefined, 'lots']) {
      const s = standing({ trialAttempts: raw as unknown as number });
      expect(decide(s, 'cover').allow, `${String(raw)}`).toBe(true);
      expect(trialLeft(s)).toBe(TRIAL_CATCHES);
    }
  });
});
