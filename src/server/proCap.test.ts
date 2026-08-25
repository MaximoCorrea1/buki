import { describe, it, expect } from 'vitest';
import { createProCap, parseRevoked, CATCHES_PER_LICENCE_PER_DAY } from './proCap';

/**
 * THE BRAKE ON THE PAID PATH, WHICH HAD NONE AT ALL.
 *
 * Both existing brakes sat inside one conditional — `if (access.kind === 'trial')` — under
 * a comment saying that stopping somebody who is paying is the worst possible place to save
 * a hundredth of a cent. That reasoning is sound for a $0.00011 catch and stops being sound
 * the moment the caller can choose what a catch costs, which is what P0-1 was.
 *
 * So a valid session token had: no IP cap, no kill switch, no per-key cap, and no Origin
 * check (`policy.test.ts:73` asserts the origin is not required when a token is present).
 * It is an 8-day bearer — `TOKEN_TTL_MS` 24h plus `GRACE_MS` 7 days — bound to no device
 * and no IP, with no revocation path, in a build that is deliberately unminified with
 * `PRO_KEY = 'buki-pro'` in plain text. Pay $4 once, read the token out of
 * `chrome.storage.local`, and share it.
 *
 * **The field a per-licence cap keys on was already being computed and thrown away.**
 * `decideAccess` returns `licenseKeyId`; `handleVision` read only `.kind`.
 */

const NOW = Date.UTC(2026, 7, 25, 12, 0, 0);
const DAY = 86_400_000;

/** Ask `n` times and answer how many were refused. */
const spend = (
  cap: (id: string, now: number) => boolean,
  id: string,
  n: number,
  now = NOW,
): number => {
  let refused = 0;
  for (let i = 0; i < n; i++) if (cap(id, now)) refused++;
  return refused;
};

describe('createProCap', () => {
  it('lets a subscriber through far past anything a person does', () => {
    // `TRIAL_PER_IP_PER_DAY = 40` is this repo's own estimate of "well above what one
    // person could legitimately do". The ceiling here is an order of magnitude above that,
    // because the promise on the pricing page is "unlimited, no throttling" and a brake a
    // customer can feel is a broken promise rather than a brake.
    const cap = createProCap();
    expect(spend(cap, 'lk_real', 400)).toBe(0);
  });

  it('stops somewhere, which is the entire point', () => {
    const cap = createProCap();
    expect(spend(cap, 'lk_leaked', CATCHES_PER_LICENCE_PER_DAY + 10)).toBe(10);
  });

  it('counts each licence separately, so one leak cannot wall everybody', () => {
    const cap = createProCap();
    spend(cap, 'lk_leaked', CATCHES_PER_LICENCE_PER_DAY + 50);
    expect(cap('lk_someone_else', NOW), 'an innocent licence was refused').toBe(false);
  });

  it('forgives at the day boundary', () => {
    const cap = createProCap();
    spend(cap, 'lk_1', CATCHES_PER_LICENCE_PER_DAY + 5);
    expect(cap('lk_1', NOW), 'still over the cap today').toBe(true);
    expect(cap('lk_1', NOW + DAY), 'a new day did not reset the count').toBe(false);
  });

  it('keeps no licence id in memory', () => {
    // Same argument `keyCap.ts` makes: a digest is not a security control and is not
    // claimed as one. It only avoids parking an identifier in a map for the life of the
    // isolate, when nothing needs the identifier itself.
    const cap = createProCap();
    cap('lk_a_real_customers_licence', NOW);
    expect(cap.tracked().join(' ')).not.toContain('lk_a_real_customers_licence');
  });

  it('stays bounded when somebody mints ids', () => {
    // Unlike `ipCap`, this counts a string that arrives inside a token. Forging one needs
    // the signing secret, so the realistic path here is not a prober — but an unbounded
    // map in a long-lived isolate is a bug whether or not anyone is aiming at it.
    const cap = createProCap({ maxTracked: 50 });
    for (let i = 0; i < 400; i++) cap(`lk_${i}`, NOW);
    expect(cap.size()).toBeLessThanOrEqual(51);
  });

  it('drops YESTERDAY first, so a customer counted this morning survives', () => {
    // Copied deliberately from `keyCap.ts`, including the reason: forgetting OPENS the
    // brake rather than closing it, because refusing everybody once the bookkeeping
    // overflows would turn a bookkeeping problem into an outage for the people who paid.
    //
    // Within ONE day an overflow still clears everything, and that is not an oversight —
    // there is nothing staler to drop, and a reset allowance is the cheaper mistake. What
    // this proves is that yesterday goes first when yesterday is enough.
    const cap = createProCap({ maxTracked: 3 });
    for (let i = 0; i < 3; i++) cap(`yesterday_${i}`, NOW - DAY);
    cap('lk_today', NOW);

    cap('someone_else_today', NOW); // tips it over, and the stale three are what go

    expect(cap('lk_today', NOW), "today's count was thrown away first").toBe(false);
    expect(cap.size(), 'yesterday was kept').toBeLessThanOrEqual(3);
  });
});

describe('parseRevoked', () => {
  /**
   * THE ONLY TARGETED LEVER in a design with no database. `launch.md`'s "If something goes
   * wrong" table lists three, and all three are all-or-nothing: close the trial, pull the
   * Gemini key (which 500s the product for payers too), or hit the spend cap.
   */

  it('revokes nothing when it is unset, which is the normal state', () => {
    expect(parseRevoked(undefined).size).toBe(0);
    expect(parseRevoked('').size).toBe(0);
  });

  it('does NOT turn an empty value into a revoked empty id', () => {
    // The failure this exists to prevent: `''.split(',')` is `['']`, and a set containing
    // the empty string revokes every token whose claim carries no id. That is a one-line
    // environment change that signs out everybody, which is the exact thing this lever
    // exists to be an alternative to.
    expect(parseRevoked('').has('')).toBe(false);
    expect(parseRevoked(',,,').has('')).toBe(false);
  });

  it('reads a list a human typed, spaces and all', () => {
    const revoked = parseRevoked(' lk_1, lk_2 ,lk_3 ');
    expect([...revoked].sort()).toEqual(['lk_1', 'lk_2', 'lk_3']);
  });

  it('revokes only what it names', () => {
    const revoked = parseRevoked('lk_leaked');
    expect(revoked.has('lk_leaked')).toBe(true);
    expect(revoked.has('lk_paying_customer')).toBe(false);
  });
});
