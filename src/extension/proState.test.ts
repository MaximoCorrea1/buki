import { describe, it, expect } from 'vitest';
import { readPro, writePro, standingOf, PRO_KEY } from './proState';
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
