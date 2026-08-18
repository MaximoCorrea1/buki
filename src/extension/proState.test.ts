import { describe, it, expect, vi } from 'vitest';
import { readPro, writePro, standingOf, ensureSession, PRO_KEY, type ProState } from './proState';
import { GRACE_MS } from '../server/token';
import type { StorageArea } from './storage';
import background from './background.ts?raw';
import optionsSrc from './options.ts?raw';

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

  /**
   * THE FIXTURE IS TYPED `Required<ProState>` ON PURPOSE, and that is the whole guard.
   *
   * The test above round-trips a state with no `activationId`, so it cannot see a reader
   * that drops one. `Required<ProState>` makes the compiler enumerate the interface for
   * us: add a fourth field to `ProState` and this fixture stops compiling until it is
   * named, and then this assertion fails until `readPro` carries it back out.
   *
   * That axis matters because `activationId` is OPTIONAL, so an object literal that omits
   * it is a perfectly valid `ProState` and TypeScript had nothing to say when `readPro`
   * built one without it. Same shape as the arrow with fewer parameters that nearly undid
   * this fix at the wiring: the type system is permissive in exactly the direction that
   * silently drops data.
   */
  it('carries the activation id back out of storage', async () => {
    const storage = fakeStorage();
    const full: Required<ProState> = {
      key: 'KEY-1',
      session: { token: 'tok', expiresAt: NOW + 86_400_000 },
      activationId: 'act_1',
    };
    await writePro(storage, full);
    expect(await readPro(storage)).toEqual(full);
  });

  /**
   * The consequence, asserted at the boundary that spends money.
   *
   * `activate` CREATES an activation and burns one of the key's five slots; `validate`
   * takes the id and creates nothing. The server picks between them purely on whether an
   * id arrived. So a renewal driven by a state READ FROM STORAGE — which is every renewal,
   * because the worker is torn down between them — has to carry the id or the subscriber
   * is back to burning a slot a day and meeting the wall on day five.
   *
   * The test above guards the reader; this one guards the outcome, so a regression
   * anywhere between storage and the exchange fails here whatever shape it takes.
   */
  it('renews with the stored activation id, so the server validates instead of activating', async () => {
    const storage = fakeStorage();
    await writePro(storage, {
      key: 'KEY-1',
      session: { token: 'tok', expiresAt: NOW - 1000 }, // stale: needs renewing
      activationId: 'act_1',
    });

    const sent: (string | undefined)[] = [];
    await ensureSession(await readPro(storage), {
      exchange: async (_key, activationId) => {
        sent.push(activationId);
        return {
          ok: true,
          session: { token: 'fresh', expiresAt: NOW + 86_400_000 },
          activationId: 'act_1',
        };
      },
      save: (state) => writePro(storage, state),
      now: () => NOW,
    });

    expect(sent).toEqual(['act_1']);
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
      // '' because this fixture predates the activation id; a real first exchange
      // gets one back from Polar and `ensureSession` persists it.
      activationId: '',
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

/**
 * THE ACTIVATION ID HAS TO SURVIVE, or the fix is undone on the next renewal.
 *
 * `ensureSession` is the only thing that renews, and it renews daily. If it does not hand
 * the stored activation id to `exchange`, the server activates again and spends another of
 * the key's five slots — which is the whole defect this exists to close.
 */
describe('ensureSession keeps the activation', () => {
  const stale = { token: 'old', expiresAt: NOW - 1 };

  it('hands the stored activation id to exchange, so the server validates', async () => {
    const exchange = vi.fn(async () => ({
      ok: true as const,
      session: { token: 'new', expiresAt: NOW + 86_400_000 },
      activationId: 'act_1',
    }));

    await ensureSession({ key: 'KEY-1', session: stale, activationId: 'act_1' }, {
      exchange,
      save: async () => {},
      now: () => NOW,
    });

    expect(exchange).toHaveBeenCalledWith('KEY-1', 'act_1');
  });

  it('persists the activation id it gets back', async () => {
    // Without this the first renewal works and every one after it activates again.
    const saved: unknown[] = [];
    await ensureSession({ key: 'KEY-1', session: null }, {
      exchange: async () => ({
        ok: true as const,
        session: { token: 'new', expiresAt: NOW + 86_400_000 },
        activationId: 'act_1',
      }),
      save: async (s) => {
        saved.push(s);
      },
      now: () => NOW,
    });

    expect(saved[0]).toMatchObject({ key: 'KEY-1', activationId: 'act_1' });
  });

  it('keeps the activation id when the licence is refused', async () => {
    // The session goes, the key stays, and the activation must stay too: the customer is
    // still paired with this install, and dropping it would make the next successful
    // exchange activate a SECOND time for the same machine.
    const saved: { activationId?: string }[] = [];
    await ensureSession({ key: 'KEY-1', session: stale, activationId: 'act_1' }, {
      exchange: async () => ({ ok: false as const, retryable: false }),
      save: async (s) => {
        saved.push(s);
      },
      now: () => NOW,
    });

    expect(saved[0]).toMatchObject({ session: null, activationId: 'act_1' });
  });
});

/**
 * THE WIRING, which is where a fix like this dies quietly.
 *
 * `ensureSession` calls `deps.exchange(pro.key, pro.activationId)`. The worker supplies
 * that dep as an arrow, and **an arrow taking fewer parameters is perfectly assignable in
 * TypeScript** — so `(key) => license.exchange(key)` compiles, passes every unit test, and
 * silently throws the activation id away. The renewal then activates again and spends a
 * slot a day, which is the entire defect this was meant to close.
 *
 * Asserted as SOURCE because `background.ts` and `options.ts` register listeners and call
 * `main()` at module scope, so neither can be imported. `OPENWORK.md` §5 records what this
 * kind of guard cannot see: it proves the parameters are declared, not that they arrive.
 */
describe('the callers actually forward the activation id', () => {
  it('the worker’s renewal adapter takes BOTH parameters', () => {
    expect(background, 'background.ts must forward activationId into license.exchange').toMatch(
      /exchange:\s*\(key,\s*activationId\)\s*=>/,
    );
  });

  it('the options page reuses a stored activation instead of activating again', () => {
    // Pressing Activate on a key you already hold must not spend a second slot, and
    // writePro must not drop the id it already had.
    expect(optionsSrc).toContain('activationId');
  });
});
