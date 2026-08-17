import { describe, it, expect, vi } from 'vitest';
import { readPro, writePro, standingOf, ensureSession, PRO_KEY } from './proState';
import { GRACE_MS } from '../server/token';
import type { StorageArea } from './storage';

const NOW = Date.UTC(2026, 7, 17, 12, 0, 0);

/**
 * Assembling the one snapshot `entitlement.decide` answers from.
 *
 * It exists because three callers need it — the worker before it spends a vision call, the
 * tray before it draws a footer, the options page before it names the plan — and each one
 * assembling it by hand is three chances to read "has a licence key" as "is Pro". Those
 * are different: a key that has never been exchanged, or whose session has aged past the
 * server's grace, is not a subscription the proxy will honour.
 */

function fakeStorage(seed: Record<string, unknown> = {}): StorageArea {
  const data: Record<string, unknown> = { ...seed };
  return {
    get: async (key: string) => (key in data ? { [key]: data[key] } : {}),
    set: async (items: Record<string, unknown>) => {
      Object.assign(data, items);
    },
  } as unknown as StorageArea;
}

describe('what the extension knows about being Pro', () => {
  it('starts with no key and no session rather than undefined', async () => {
    expect(await readPro(fakeStorage())).toEqual({ key: '', session: null });
  });

  it('round-trips a key and its session', async () => {
    const storage = fakeStorage();
    const session = { token: 'tok', expiresAt: NOW + 86_400_000 };
    await writePro(storage, { key: 'KEY-1', session });
    expect(await readPro(storage)).toEqual({ key: 'KEY-1', session });
  });

  it('survives a stored value somebody edited by hand', async () => {
    // chrome.storage.local is user-editable and shared with every other key. A garbage
    // read must produce "not Pro", never a crash and never unlimited catches.
    for (const junk of ['nonsense', 42, null, { session: 'not-an-object' }, { key: 7 }]) {
      const got = await readPro(fakeStorage({ [PRO_KEY]: junk }));
      expect(got.key).toBe('');
      expect(got.session).toBeNull();
    }
  });
});

describe('standingOf', () => {
  const live = { token: 't', expiresAt: NOW + 3_600_000 };
  const stale = { token: 't', expiresAt: NOW - 3_600_000 };
  const dead = { token: 't', expiresAt: NOW - GRACE_MS - 1000 };

  it('is Pro on a live session', () => {
    expect(standingOf({ key: 'K', session: live }, 0, '', NOW).pro).toBe(true);
  });

  it('is STILL Pro on a session the server would honour on grace', () => {
    // The outage case. Anything narrower shows a subscriber the paywall.
    expect(standingOf({ key: 'K', session: stale }, 0, '', NOW).pro).toBe(true);
  });

  it('is not Pro once the server would refuse it too', () => {
    expect(standingOf({ key: 'K', session: dead }, 0, '', NOW).pro).toBe(false);
  });

  it('is NOT Pro on a key that has never been exchanged', () => {
    // Holding a key is not holding a subscription. Pasting anything into the field must
    // not buy unlimited catches.
    expect(standingOf({ key: 'KEY-1', session: null }, 0, '', NOW).pro).toBe(false);
  });

  it('counts an own provider key as its own plan, not as Pro', () => {
    const s = standingOf({ key: '', session: null }, 0, 'AIza-mine', NOW);
    expect(s.ownKey).toBe(true);
    expect(s.pro).toBe(false);
  });

  it('treats whitespace in the provider key field as no key', () => {
    expect(standingOf({ key: '', session: null }, 0, '   ', NOW).ownKey).toBe(false);
  });

  it('carries the trial count through untouched, so one module owns the arithmetic', () => {
    expect(standingOf({ key: '', session: null }, 7, '', NOW).trialSpent).toBe(7);
  });
});

/**
 * KEEPING A SUBSCRIPTION ALIVE.
 *
 * The session lasts 24 hours and the licence lasts as long as the subscription, so
 * something has to trade one for the other before the first runs out. Nothing did until
 * 2026-08-17: `needsRenewal` was written, tested, and had NO CALLER, so a subscriber's
 * token would have died after a day, ridden the seven-day grace, and then shown them the
 * wall they had already paid to pass. Found by reconciling the plan against the code, not
 * by a failing test — nothing was red.
 *
 * The rule that matters most here is the failure rule: OUR outage must never sign a
 * paying customer out.
 */
describe('ensureSession', () => {
  const NOW2 = Date.UTC(2026, 7, 17, 12, 0, 0);
  const fresh = { token: 'live', expiresAt: NOW2 + 20 * 3_600_000 };
  const nearlyDone = { token: 'old', expiresAt: NOW2 + 60_000 };

  const deps = (over: Record<string, unknown> = {}) => ({
    exchange: vi.fn(async () => ({
      ok: true as const,
      session: { token: 'new', expiresAt: NOW2 + 86_400_000 },
    })),
    save: vi.fn(async () => undefined),
    now: () => NOW2,
    ...over,
  });

  it('does nothing without a licence key, and never calls the server', async () => {
    const d = deps();
    expect(await ensureSession({ key: '', session: null }, d)).toEqual({ key: '', session: null });
    expect(d.exchange).not.toHaveBeenCalled();
  });

  it('leaves a session that is nowhere near expiry alone', async () => {
    const d = deps();
    const got = await ensureSession({ key: 'K', session: fresh }, d);
    expect(got.session).toBe(fresh);
    expect(d.exchange).not.toHaveBeenCalled();
  });

  it('renews early, before the token can die mid-catch', async () => {
    const d = deps();
    const got = await ensureSession({ key: 'K', session: nearlyDone }, d);
    expect(got.session?.token).toBe('new');
    expect(d.save).toHaveBeenCalledTimes(1);
  });

  it('renews when there is a key but no session at all', async () => {
    // Just activated, or storage was cleared. The key is the durable thing.
    const d = deps();
    expect((await ensureSession({ key: 'K', session: null }, d)).session?.token).toBe('new');
  });

  it('KEEPS the old session when renewal fails for a reason that might pass', async () => {
    // Polar is down, or the network blinked. The server honours the old token on grace,
    // so throwing it away here would sign a paying customer out during OUR outage - the
    // exact thing the grace window exists to prevent.
    const d = deps({ exchange: vi.fn(async () => ({ ok: false, retryable: true })) });
    const got = await ensureSession({ key: 'K', session: nearlyDone }, d);
    expect(got.session).toBe(nearlyDone);
    expect(d.save).not.toHaveBeenCalled();
  });

  it('drops the session when the licence itself is refused', async () => {
    // Revoked, refunded, or the subscription ended. That is not an outage, it is an
    // answer, and continuing to present a token for a dead licence is pointless.
    const d = deps({
      exchange: vi.fn(async () => ({ ok: false, retryable: false, message: 'Revoked' })),
    });
    const got = await ensureSession({ key: 'K', session: nearlyDone }, d);
    expect(got.session).toBeNull();
    expect(got.key).toBe('K'); // the key is kept, so the page can still show what is wrong
    expect(d.save).toHaveBeenCalledTimes(1);
  });

  it('never lets a renewal failure throw into the catch that triggered it', async () => {
    const d = deps({
      exchange: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    const got = await ensureSession({ key: 'K', session: nearlyDone }, d);
    expect(got.session).toBe(nearlyDone);
  });
});
