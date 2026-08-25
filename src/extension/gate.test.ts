import { describe, it, expect, vi } from 'vitest';
import { createGate, WallError } from './gate';

const NOW = Date.UTC(2026, 7, 17, 12, 0, 0);
const live = { token: 't', expiresAt: NOW + 3_600_000 };

/**
 * The one place money is spent, and the two ways to get it wrong.
 *
 * Charge a subscriber, or hand out unlimited free cover readings. Both are quiet: the
 * first shows a paywall to somebody who paid, the second costs about a hundredth of a cent
 * per catch and is invisible until the bill. `entitlement.decide` already answers WHETHER;
 * this is about WHEN — the check happens before the call, and the spend only after one
 * that actually happened.
 */

function deps(over: Partial<Parameters<typeof createGate>[0]> = {}) {
  return {
    readPro: async () => ({ key: '', session: null }),
    readSettings: async () => ({ apiKey: '' }),
    trial: {
      spent: async () => 0,
      attempts: async () => 0,
      spend: vi.fn(async () => undefined),
      attempt: vi.fn(async () => undefined),
    },
    now: () => NOW,
    ...over,
  } as Parameters<typeof createGate>[0];
}

describe('the gate', () => {
  it('allows a cover read inside the trial and spends one', async () => {
    const spend = vi.fn(async () => undefined);
    const gate = createGate(deps({ trial: { spent: async () => 3, attempts: async () => 0, spend, attempt: vi.fn(async () => undefined) } }));
    await gate.run('cover', async () => 'result');
    expect(spend).toHaveBeenCalledTimes(1);
  });

  it('does NOT spend when the work threw, because nothing was read', async () => {
    // The vision provider 500s. Charging a trial catch for a failure is the fastest way
    // to make ten free catches feel like six.
    const spend = vi.fn(async () => undefined);
    const gate = createGate(deps({ trial: { spent: async () => 3, attempts: async () => 0, spend, attempt: vi.fn(async () => undefined) } }));
    await expect(
      gate.run('cover', async () => {
        throw new Error('provider down');
      }),
    ).rejects.toThrow('provider down');
    expect(spend).not.toHaveBeenCalled();
  });

  it('never spends for a catch from a shop link', async () => {
    // No vision call happens, so nobody paid for it. Free at every level, forever.
    const spend = vi.fn(async () => undefined);
    const gate = createGate(deps({ trial: { spent: async () => 3, attempts: async () => 0, spend, attempt: vi.fn(async () => undefined) } }));
    await gate.run('link', async () => 'result');
    expect(spend).not.toHaveBeenCalled();
  });

  it('never spends a trial catch for a subscriber', async () => {
    const spend = vi.fn(async () => undefined);
    const gate = createGate(
      deps({
        readPro: async () => ({ key: 'K', session: live }),
        trial: { spent: async () => 3, attempts: async () => 0, spend, attempt: vi.fn(async () => undefined) },
      }),
    );
    await gate.run('cover', async () => 'result');
    expect(spend).not.toHaveBeenCalled();
  });

  it('never spends a trial catch when the user brought their own key', async () => {
    const spend = vi.fn(async () => undefined);
    const gate = createGate(
      deps({
        readSettings: async () => ({ apiKey: 'AIza-mine' }),
        trial: { spent: async () => 3, attempts: async () => 0, spend, attempt: vi.fn(async () => undefined) },
      }),
    );
    await gate.run('cover', async () => 'result');
    expect(spend).not.toHaveBeenCalled();
  });

  it('throws WallError once the trial is spent, without running the work', async () => {
    const work = vi.fn(async () => 'result');
    const gate = createGate(deps({ trial: { spent: async () => 10, attempts: async () => 0, spend: vi.fn(), attempt: vi.fn(async () => undefined) } }));
    await expect(gate.run('cover', work)).rejects.toBeInstanceOf(WallError);
    // The point of checking BEFORE: a refused catch must cost nothing at the provider.
    expect(work).not.toHaveBeenCalled();
  });

  it('still lets a shop link through after the trial is spent', async () => {
    // The wall is about cover reading. Everything else keeps working, which is what makes
    // it a limit rather than the end of the product.
    const gate = createGate(deps({ trial: { spent: async () => 10, attempts: async () => 0, spend: vi.fn(), attempt: vi.fn(async () => undefined) } }));
    expect(await gate.run('link', async () => 'result')).toBe('result');
  });

  it('lets a subscriber through a spent trial, because paying has to change something', async () => {
    // Nearly everyone converts AT the wall, so they arrive here with the trial gone.
    const gate = createGate(
      deps({
        readPro: async () => ({ key: 'K', session: live }),
        trial: { spent: async () => 10, attempts: async () => 0, spend: vi.fn(), attempt: vi.fn(async () => undefined) },
      }),
    );
    expect(await gate.run('cover', async () => 'result')).toBe('result');
  });

  it('reports the standing it decided from, so the tray can draw the countdown', async () => {
    const gate = createGate(
      deps({
        trial: {
          spent: async () => 8,
          attempts: async () => 19,
          spend: vi.fn(),
          attempt: vi.fn(async () => undefined),
        },
      }),
    );
    // BOTH counts, because `entitlement.trialLeft` folds both ceilings into the one number
    // the tray, the wall and the options page all read. A standing that carried only the
    // advertised count would let the footer say "2 catches left" while the gate walled.
    expect(await gate.standing()).toEqual({
      pro: false,
      trialSpent: 8,
      trialAttempts: 19,
      ownKey: false,
    });
  });
});

/**
 * COUNTING THE ATTEMPT SEPARATELY FROM THE READING.
 *
 * The gate's existing promise — a failed catch costs nothing — is right and is kept. What
 * it could not survive is a caller who makes `work()` reject on purpose: press catch, press
 * the card's × two seconds later, repeat. The abort surfaces as a 408, `spendTrial` is
 * skipped, and the money is already committed upstream because until 2026-08-25 the server
 * never passed an AbortSignal to Gemini either.
 *
 * So the attempt is counted in a `finally`, for every attempt that got as far as calling
 * `work()`, whatever it returned.
 */
describe('the gate counts attempts as well as readings', () => {
  const counting = (spent = 0, attempts = 0) => {
    const spend = vi.fn(async () => undefined);
    const attempt = vi.fn(async () => undefined);
    return {
      spend,
      attempt,
      deps: deps({
        trial: { spent: async () => spent, attempts: async () => attempts, spend, attempt },
      }),
    };
  };

  it('counts an attempt even when the work was called off', async () => {
    const { attempt, spend, deps: d } = counting();
    const gate = createGate(d);
    await expect(
      gate.run('cover', async () => {
        throw new Error('aborted by the user');
      }),
    ).rejects.toThrow('aborted by the user');

    expect(attempt, 'a cancelled catch cost us a request and counted nothing').toHaveBeenCalledTimes(1);
    expect(spend, 'a failed catch was charged as a reading').not.toHaveBeenCalled();
  });

  it('counts both when the reading came back', async () => {
    const { attempt, spend, deps: d } = counting();
    await createGate(d).run('cover', async () => 'a book');
    expect(spend).toHaveBeenCalledTimes(1);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('counts neither for a catch from a shop link', async () => {
    const { attempt, spend, deps: d } = counting();
    await createGate(d).run('link', async () => 'a book');
    expect(spend).not.toHaveBeenCalled();
    expect(attempt, 'a free catch was counted against the trial').not.toHaveBeenCalled();
  });

  it('counts neither for a subscriber', async () => {
    const attempt = vi.fn(async () => undefined);
    const gate = createGate(
      deps({
        readPro: async () => ({ key: 'K', session: live }),
        trial: { spent: async () => 0, attempts: async () => 0, spend: vi.fn(), attempt },
      }),
    );
    await gate.run('cover', async () => 'a book');
    expect(attempt).not.toHaveBeenCalled();
  });

  it('refuses once the attempt ceiling is met, without calling the work', async () => {
    const work = vi.fn(async () => 'a book');
    const gate = createGate(counting(0, 999).deps);
    await expect(gate.run('cover', work)).rejects.toThrow(WallError);
    expect(work, 'a walled catch still spent a request').not.toHaveBeenCalled();
  });

  it('lets the REAL error through when the counter itself fails', async () => {
    // A `finally` that throws replaces the error being unwound. Here that would mean a
    // storage quota failure surfacing instead of the wall, on the one path where the
    // message is the whole point. The counter is a brake, not an accounting system.
    const gate = createGate(
      deps({
        trial: {
          spent: async () => 0,
          attempts: async () => 0,
          spend: vi.fn(async () => undefined),
          attempt: vi.fn(async () => {
            throw new Error('QuotaExceededError');
          }),
        },
      }),
    );
    await expect(
      gate.run('cover', async () => {
        throw new Error('provider down');
      }),
    ).rejects.toThrow('provider down');
  });
});
