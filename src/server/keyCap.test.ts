import { describe, it, expect } from 'vitest';
import { createKeyCap, ACTIVATIONS_PER_KEY_PER_DAY, CHECKS_PER_KEY_PER_DAY } from './keyCap';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 18, 12, 0, 0);

/**
 * The counter behind `/api/license`'s cap.
 *
 * It lives here rather than in `api/license.ts` because that file says of itself that it is
 * "the shell only ... deliberately short enough that nothing here needs a test", and a day
 * rollover, two ceilings and an eviction rule are not nothing. `api/vision.ts` still holds
 * its IP counter inline; that is the sibling, not the precedent.
 */

describe('the per-key daily cap', () => {
  it('lets a normal day of renewals through', () => {
    // Five installs renewing once each, plus a re-paste or two. Nobody real meets this.
    const cap = createKeyCap();
    for (let i = 0; i < 7; i++) {
      expect(cap('KEY-1', 'validate', NOW)).toBe(false);
    }
  });

  it('stops the checks at their ceiling and not before', () => {
    const cap = createKeyCap();
    for (let i = 0; i < CHECKS_PER_KEY_PER_DAY; i++) {
      expect(cap('KEY-1', 'validate', NOW)).toBe(false);
    }
    expect(cap('KEY-1', 'validate', NOW)).toBe(true);
  });

  it('stops ACTIVATIONS far sooner, because those are the ones that spend a slot', () => {
    const cap = createKeyCap();
    for (let i = 0; i < ACTIVATIONS_PER_KEY_PER_DAY; i++) {
      expect(cap('KEY-1', 'activate', NOW)).toBe(false);
    }
    expect(cap('KEY-1', 'activate', NOW)).toBe(true);
  });

  it('keeps the two allowances apart, so a day of renewals cannot exhaust the tight one', () => {
    // THE POINT OF HAVING TWO. One shared counter generous enough for five installs
    // renewing daily would also be generous enough to burn all five slots.
    const cap = createKeyCap();
    for (let i = 0; i < CHECKS_PER_KEY_PER_DAY; i++) cap('KEY-1', 'validate', NOW);

    expect(cap('KEY-1', 'validate', NOW)).toBe(true);
    expect(cap('KEY-1', 'activate', NOW)).toBe(false);
  });

  it('counts each key separately', () => {
    const cap = createKeyCap();
    for (let i = 0; i <= ACTIVATIONS_PER_KEY_PER_DAY; i++) cap('KEY-1', 'activate', NOW);

    expect(cap('KEY-1', 'activate', NOW)).toBe(true);
    expect(cap('KEY-2', 'activate', NOW)).toBe(false);
  });

  it('forgets yesterday', () => {
    // A cap that never reset would permanently lock a customer out of pairing a new
    // install, which is a worse outcome than the abuse it is there to slow down.
    const cap = createKeyCap();
    for (let i = 0; i <= ACTIVATIONS_PER_KEY_PER_DAY; i++) cap('KEY-1', 'activate', NOW);
    expect(cap('KEY-1', 'activate', NOW)).toBe(true);

    expect(cap('KEY-1', 'activate', NOW + DAY)).toBe(false);
  });

  it('does not grow without limit when probed with fresh keys', () => {
    // This endpoint counts strings the CALLER chose, so a prober supplies new ones for
    // free. `/api/vision` counts IPs, which real callers bound for us; here nothing does.
    const cap = createKeyCap({ maxTracked: 50 });
    for (let i = 0; i < 500; i++) cap(`KEY-${i}`, 'activate', NOW);

    expect(cap.size()).toBeLessThanOrEqual(51);
  });

  it('opens rather than locks out when it has to forget', () => {
    // The failure DIRECTION, stated as a test because it is a decision and not an accident.
    // A brake that refuses everybody once its bookkeeping overflows would turn a probing
    // attack into an outage for paying customers. Resetting an allowance is the cheaper
    // wrong answer, and the floor under real money is the provider-side spend cap.
    const cap = createKeyCap({ maxTracked: 4 });
    for (let i = 0; i <= ACTIVATIONS_PER_KEY_PER_DAY; i++) cap('MINE', 'activate', NOW);
    expect(cap('MINE', 'activate', NOW)).toBe(true);

    for (let i = 0; i < 50; i++) cap(`OTHER-${i}`, 'activate', NOW);

    expect(cap('MINE', 'activate', NOW)).toBe(false);
  });

  it('does not keep the licence key itself', () => {
    // Not a security control and not claimed as one. It only avoids parking a bearer
    // credential in a map for the life of the isolate, which is the same argument
    // `visionHandler` already makes about not forwarding the session token upstream.
    const cap = createKeyCap();
    cap('polar-licence-key-abc123', 'activate', NOW);

    expect(cap.tracked().join(' ')).not.toContain('polar-licence-key-abc123');
  });
});
