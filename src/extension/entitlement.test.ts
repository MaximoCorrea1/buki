import { describe, it, expect } from 'vitest';
import { decide, footer, TRIAL_CATCHES, WARN_FROM, type Standing } from './entitlement';

const free: Standing = { pro: false, trialSpent: 0, ownKey: false };
const withKey: Standing = { pro: false, trialSpent: 0, ownKey: true };
const pro: Standing = { pro: true, trialSpent: 0, ownKey: false };

describe('decide', () => {
  it('lets a retailer-link catch through however spent the trial is', () => {
    // No vision call happens, so there is nothing to charge for.
    const spent = { ...free, trialSpent: TRIAL_CATCHES };
    expect(decide(spent, 'link')).toEqual({ allow: true, spendTrial: false });
  });

  it('lets a trial catch through and marks it chargeable', () => {
    expect(decide(free, 'cover')).toEqual({ allow: true, spendTrial: true });
  });

  it('stops a cover catch once the trial is spent', () => {
    const spent = { ...free, trialSpent: TRIAL_CATCHES };
    expect(decide(spent, 'cover')).toEqual({ allow: false, reason: 'trial-spent' });
  });

  it('counts the tenth catch as allowed and the eleventh as not', () => {
    // Off-by-one here is the difference between the advertised trial and a shorter one.
    expect(decide({ ...free, trialSpent: TRIAL_CATCHES - 1 }, 'cover').allow).toBe(true);
    expect(decide({ ...free, trialSpent: TRIAL_CATCHES }, 'cover').allow).toBe(false);
  });

  it('never spends the trial when the user brought their own key', () => {
    const spent = { ...withKey, trialSpent: TRIAL_CATCHES };
    expect(decide(spent, 'cover')).toEqual({ allow: true, spendTrial: false });
  });

  it('never spends the trial for Pro', () => {
    expect(decide(pro, 'cover')).toEqual({ allow: true, spendTrial: false });
  });

  it('lets a lapsed Pro fall back to whatever trial is left rather than to nothing', () => {
    // A card that expires must not feel like the extension broke.
    const lapsed: Standing = { pro: false, trialSpent: 4, ownKey: false };
    expect(decide(lapsed, 'cover')).toEqual({ allow: true, spendTrial: true });
  });
});

describe('footer', () => {
  it('says nothing while the trial is comfortable', () => {
    expect(footer(free)).toBe('');
  });

  it('starts counting down only near the end', () => {
    expect(footer({ ...free, trialSpent: TRIAL_CATCHES - WARN_FROM })).toBe('3 catches left');
  });

  it('says one catch, not one catchs', () => {
    expect(footer({ ...free, trialSpent: TRIAL_CATCHES - 1 })).toBe('1 catch left');
  });

  it('says nothing once there are none left, because the wall says it instead', () => {
    expect(footer({ ...free, trialSpent: TRIAL_CATCHES })).toBe('');
  });

  it('says nothing to Pro or to someone with their own key', () => {
    expect(footer(pro)).toBe('');
    expect(footer({ ...withKey, trialSpent: 9 })).toBe('');
  });
});
