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
    trial: { spent: async () => 0, spend: vi.fn(async () => undefined) },
    now: () => NOW,
    ...over,
  } as Parameters<typeof createGate>[0];
}

describe('the gate', () => {
  it('allows a cover read inside the trial and spends one', async () => {
    const spend = vi.fn(async () => undefined);
    const gate = createGate(deps({ trial: { spent: async () => 3, spend } }));
    await gate.run('cover', async () => 'result');
    expect(spend).toHaveBeenCalledTimes(1);
  });

  it('does NOT spend when the work threw, because nothing was read', async () => {
    // The vision provider 500s. Charging a trial catch for a failure is the fastest way
    // to make ten free catches feel like six.
    const spend = vi.fn(async () => undefined);
    const gate = createGate(deps({ trial: { spent: async () => 3, spend } }));
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
    const gate = createGate(deps({ trial: { spent: async () => 3, spend } }));
    await gate.run('link', async () => 'result');
    expect(spend).not.toHaveBeenCalled();
  });

  it('never spends a trial catch for a subscriber', async () => {
    const spend = vi.fn(async () => undefined);
    const gate = createGate(
      deps({
        readPro: async () => ({ key: 'K', session: live }),
        trial: { spent: async () => 3, spend },
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
        trial: { spent: async () => 3, spend },
      }),
    );
    await gate.run('cover', async () => 'result');
    expect(spend).not.toHaveBeenCalled();
  });

  it('throws WallError once the trial is spent, without running the work', async () => {
    const work = vi.fn(async () => 'result');
    const gate = createGate(deps({ trial: { spent: async () => 10, spend: vi.fn() } }));
    await expect(gate.run('cover', work)).rejects.toBeInstanceOf(WallError);
    // The point of checking BEFORE: a refused catch must cost nothing at the provider.
    expect(work).not.toHaveBeenCalled();
  });

  it('still lets a shop link through after the trial is spent', async () => {
    // The wall is about cover reading. Everything else keeps working, which is what makes
    // it a limit rather than the end of the product.
    const gate = createGate(deps({ trial: { spent: async () => 10, spend: vi.fn() } }));
    expect(await gate.run('link', async () => 'result')).toBe('result');
  });

  it('lets a subscriber through a spent trial, because paying has to change something', async () => {
    // Nearly everyone converts AT the wall, so they arrive here with the trial gone.
    const gate = createGate(
      deps({
        readPro: async () => ({ key: 'K', session: live }),
        trial: { spent: async () => 10, spend: vi.fn() },
      }),
    );
    expect(await gate.run('cover', async () => 'result')).toBe('result');
  });

  it('reports the standing it decided from, so the tray can draw the countdown', async () => {
    const gate = createGate(deps({ trial: { spent: async () => 8, spend: vi.fn() } }));
    expect(await gate.standing()).toEqual({ pro: false, trialSpent: 8, ownKey: false });
  });
});
