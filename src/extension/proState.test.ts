import { describe, it, expect, vi } from 'vitest';
import {
  readPro,
  writePro,
  standingOf,
  ensureSession,
  createSessionKeeper,
  forgetSession,
  RENEW_COOLDOWN_MS,
  PRO_KEY,
  type ProState,
} from './proState';
import { GRACE_MS } from '../server/token';
import { CHECKS_PER_KEY_PER_DAY } from '../server/keyCap';
import type { StorageArea } from './storage';
import background from './background.ts?raw';
import optionsSrc from './options.ts?raw';

const NOW = Date.UTC(2026, 7, 17, 12, 0, 0);

/**
 * Assembling the one snapshot `entitlement.decide` answers from.
 *
 * It exists because three callers need it — the worker before it spends a vision call, the
 * tray before it draws the wall, the options page before it names the plan — and each one
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
      // Added 2026-08-27 with R-2, and NOT by choice: this literal stopped compiling the
      // moment the field existed, which is the entire reason the fixture is typed
      // `Required<ProState>`. `readPro` rebuilds a subset, so a field nobody names here is
      // a field it silently drops — see item 27, which is exactly that bug.
      renewFailedAt: NOW - 1_000,
    };
    await writePro(storage, full);
    expect(await readPro(storage)).toEqual(full);
  });

  /**
   * AC-5. `OPENWORK.md` item 51. **Written after mutations 51cb and 51cc SURVIVED** — the
   * field was written on every exchange and dropped on every read, so the server's grace
   * lived exactly one process lifetime and the compiled constant took over the moment the
   * worker was torn down. Which, in MV3, is between two clicks.
   *
   * Precisely the shape of item 48's activation id: written, never read back, gone.
   */
  it('carries the server’s grace back out of storage', async () => {
    const storage = fakeStorage();
    const session = { token: 'tok', expiresAt: NOW + 86_400_000, graceMs: 3 * 86_400_000 };
    await writePro(storage, { key: 'KEY-1', session });

    expect(await readPro(storage)).toEqual({ key: 'KEY-1', session });
  });

  it('refuses a stored grace that is not a finite, non-negative number', async () => {
    // ⚠ **THIS IS REACHABLE HERE AND NOT ON THE WIRE**, which is why the test lives in this
    // file. `JSON.stringify(Infinity)` is `null`, so no HTTP response can carry one — but
    // `chrome.storage.local` is structured-clone AND user-editable, so it can. An Infinity
    // grace makes `now < expiresAt + grace` true for ever: a session that never expires,
    // set by editing storage. A negative one shortens it.
    const storage = fakeStorage();
    for (const bad of [NaN, Infinity, -1, '900', null]) {
      await storage.set({
        [PRO_KEY]: { key: 'K', session: { token: 't', expiresAt: NOW, graceMs: bad } },
      });
      const got = await readPro(storage);
      expect(got.session, `storage carried ${String(bad)} into the grace`).not.toHaveProperty(
        'graceMs',
      );
    }
  });

  it('refuses a cooldown that is not a finite number', async () => {
    // `chrome.storage.local` is user-editable, and `typeof NaN === 'number'` is true. A NaN
    // here makes `now - renewFailedAt < RENEW_COOLDOWN_MS` false for ever, so the backoff
    // silently stops existing and every catch exchanges again — which is the exact failure
    // R-2 was filed for, restored by a value rather than by code.
    //
    // Written after the mutation that removed `Number.isFinite` SURVIVED: the guard was
    // there and nothing asked it anything.
    const storage = fakeStorage();
    for (const bad of [NaN, Infinity, '900', null]) {
      await storage.set({
        [PRO_KEY]: { key: 'K', session: null, renewFailedAt: bad },
      });
      expect(await readPro(storage), `storage carried ${String(bad)} into the cooldown`).not.toHaveProperty(
        'renewFailedAt',
      );
    }
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
    expect(standingOf({ key: 'K', session: live }, { spent: 0, attempts: 0 }, '', NOW).pro).toBe(true);
  });

  it('is STILL Pro on a session the server would honour on grace', () => {
    // The outage case. Anything narrower shows a subscriber the paywall.
    expect(standingOf({ key: 'K', session: stale }, { spent: 0, attempts: 0 }, '', NOW).pro).toBe(true);
  });

  it('is not Pro once the server would refuse it too', () => {
    expect(standingOf({ key: 'K', session: dead }, { spent: 0, attempts: 0 }, '', NOW).pro).toBe(false);
  });

  it('is NOT Pro on a key that has never been exchanged', () => {
    // Holding a key is not holding a subscription. Pasting anything into the field must
    // not buy unlimited catches.
    expect(standingOf({ key: 'KEY-1', session: null }, { spent: 0, attempts: 0 }, '', NOW).pro).toBe(false);
  });

  it('counts an own provider key as its own plan, not as Pro', () => {
    const s = standingOf({ key: '', session: null }, { spent: 0, attempts: 0 }, 'AIza-mine', NOW);
    expect(s.ownKey).toBe(true);
    expect(s.pro).toBe(false);
  });

  it('treats whitespace in the provider key field as no key', () => {
    expect(standingOf({ key: '', session: null }, { spent: 0, attempts: 0 }, '   ', NOW).ownKey).toBe(false);
  });

  it('carries BOTH trial counts through untouched, so one module owns the arithmetic', () => {
    // Both, because there are two ceilings now and `entitlement.trialLeft` folds them into
    // one number. A reader that carried only the advertised one would put the wall and the
    // options page back into disagreement, which is the failure the fold exists to prevent.
    const s = standingOf({ key: '', session: null }, { spent: 7, attempts: 19 }, '', NOW);
    expect(s.trialSpent).toBe(7);
    expect(s.trialAttempts).toBe(19);
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
    //
    // THIS USED TO ASSERT `save` WAS NEVER CALLED, and that was stricter than the reason
    // above. The rule is that the SESSION survives an outage, not that nothing is written:
    // R-2 records `renewFailedAt` on exactly this branch so the next catch backs off
    // instead of exchanging again. The assertion now says what the comment always meant.
    const d = deps({ exchange: vi.fn(async () => ({ ok: false, retryable: true })) });
    const got = await ensureSession({ key: 'K', session: nearlyDone }, d);
    expect(got.session).toBe(nearlyDone);

    const written = (d.save as unknown as { mock: { calls: [ProState][] } }).mock.calls[0]?.[0];
    expect(written?.session, 'the outage cost the customer their session').toBe(nearlyDone);
    expect(written?.key).toBe('K');
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

  it('the options page asks activateKey.ts rather than deciding inline', () => {
    // THIS ASSERTION USED TO BE `expect(optionsSrc).toContain('activationId')`, and the
    // 2026-08-24 review MUTATION-PROVED it worthless: replacing options.ts's reuse with
    // `undefined` made every Activate press spend one of the licence's five permanent
    // slots, and the suite stayed 620/620 green. The identifier survived in the `writePro`
    // spread and in four comments, which is all `toContain` ever needed.
    //
    // ASSERTED ON THE IMPORT LINE, which §5 records as the one thing a `?raw` guard proves
    // cleanly: there are no branches in an import, and prose about activation ids in a
    // comment cannot satisfy it. The DECISION itself is now tested with real values in
    // `activateKey.test.ts`, which is the half a source guard was never able to do.
    expect(optionsSrc).toMatch(
      /^import \{ activate as activateLicence \} from '\.\/activateKey';$/m,
    );
  });

  it('the options page no longer decides ANYTHING about the activation', () => {
    // ABSENCE, so a second copy of the rule cannot reappear beside the import above. One
    // place decides; a second place is a second place to be wrong, and it was.
    expect(optionsSrc).not.toMatch(/held\.key === pasted/);
    expect(optionsSrc).not.toMatch(/result\.activationId \|\|/);

    // AND NOTHING HERE BUILDS A ProState ANY MORE.
    //
    // A mutation proved the two rules above insufficient on their own: this handler was
    // rewritten to construct its own literal and call `writePro` directly, in a spelling
    // neither rule knows, and every test stayed green. Extracting the ARITHMETIC was half
    // the fix; `activate()` now owns the ORDER too, so the only `writePro` left in this
    // file is the one-line adapter handed to it.
    //
    // The decision that adapter protects — including "a retryable refusal writes NOTHING",
    // which is a behaviour no source text can express — is asserted with real values in
    // `activateKey.test.ts`.
    const writes = [...optionsSrc.matchAll(/writePro\(([^)]*)\)/g)].map((m) => m[1]?.trim());
    expect(writes, 'the options page writes Pro state it decided itself').toEqual([
      'storage, state',
    ]);
  });

  it('the worker cannot renew outside the latch', () => {
    // ASSERTED ON THE IMPORT LINE, not on the call, and that is deliberate. §5 records
    // that a `?raw` guard cannot see control flow — `toContain('markRestored')` passed
    // with the call in dead code and with its arguments reversed. ABSENCE in an import
    // statement is the one thing this kind of guard proves cleanly: there are no branches
    // in an import, and prose about `ensureSession` in a comment cannot satisfy it.
    //
    // It is also the real mechanism rather than a proxy for it. Renewing outside the
    // module-scope latch would mean importing `ensureSession` back into the worker, and
    // that is exactly what fails here.
    const named = background.match(/import\s*\{([^}]*)\}\s*from\s*'\.\/proState'/)?.[1] ?? '';
    expect(named, 'background.ts must import from ./proState').not.toBe('');
    expect(named).toContain('createSessionKeeper');
    expect(named).not.toContain('ensureSession');
  });
});

/**
 * TWO CATCHES IN THE SAME SECOND MUST NOT SPEND TWO SLOTS.
 *
 * `ensureSession` is a read-modify-write with a Polar call in the middle, and the Polar
 * call is the one operation in this extension that costs a finite resource: five
 * activation slots per licence, for ever. `trial.ts`, `storage.ts` and `recognitionLog.ts`
 * each wrap their read-modify-write in `createWriteQueue()` under a comment saying two
 * overlapping writes would silently drop one. This path had nothing, and it is the one
 * where an overlap costs money rather than a record.
 *
 * Click two catches in the same second and both read the same stale `ProState`, both see
 * `needsRenewal`, and both exchange: two slots for one user action, on a key that only
 * has five.
 *
 * The second half is worse and is invisible. If one exchange succeeds and the other hits
 * a retryable error, the loser returns the ORIGINAL stale object rather than re-reading —
 * so that catch travels with no token, is classified `trial` by the server, and is billed
 * to a free allowance the customer already paid to pass.
 *
 * SINGLE-FLIGHT rather than a queue, which is what `createLookupMemo` already does for
 * concurrent recognitions. A queue would serialise the second caller and then have to
 * re-read to notice the work was already done; sharing the one promise means there is no
 * second exchange to serialise and no losing caller to leave holding a stale state. Both
 * halves of the defect close at once, because there is only ever one answer.
 */
describe('createSessionKeeper', () => {
  const stale = { token: 'old', expiresAt: NOW - 1 };
  const live = { token: 'live', expiresAt: NOW + 20 * 3_600_000 };
  const renewed = { token: 'new', expiresAt: NOW + 86_400_000 };

  it('exchanges ONCE for two catches clicked in the same moment', async () => {
    let calls = 0;
    let release!: () => void;
    const held = new Promise<void>((r) => {
      release = r;
    });

    const keep = createSessionKeeper({
      exchange: async () => {
        calls++;
        await held; // still in flight while the second catch arrives
        return { ok: true as const, session: renewed, activationId: 'act_1' };
      },
      save: async () => {},
      now: () => NOW,
    });

    const first = keep({ key: 'KEY-1', session: stale, activationId: 'act_1' });
    const second = keep({ key: 'KEY-1', session: stale, activationId: 'act_1' });
    release();
    const [a, b] = await Promise.all([first, second]);

    expect(calls).toBe(1);
    // Both catches carry the FRESH token. The loser of a race must never travel with the
    // stale state, or the server classifies a paying subscriber as a trial.
    expect(a.session).toEqual(renewed);
    expect(b.session).toEqual(renewed);
  });

  it('never joins a flight for a DIFFERENT licence key', async () => {
    // Two keys are two pairings with two slot counts. Handing key B the answer to key A's
    // exchange would give it a session it never paid for.
    const asked: string[] = [];
    const keep = createSessionKeeper({
      exchange: async (key) => {
        asked.push(key);
        return { ok: true as const, session: renewed, activationId: 'act_1' };
      },
      save: async () => {},
      now: () => NOW,
    });

    await Promise.all([
      keep({ key: 'KEY-1', session: stale }),
      keep({ key: 'KEY-2', session: stale }),
    ]);

    expect(asked.sort()).toEqual(['KEY-1', 'KEY-2']);
  });

  it('does not exchange at all for a session that is still fresh', async () => {
    const exchange = vi.fn();
    const keep = createSessionKeeper({ exchange, save: async () => {}, now: () => NOW });
    expect(await keep({ key: 'KEY-1', session: live })).toEqual({ key: 'KEY-1', session: live });
    expect(exchange).not.toHaveBeenCalled();
  });

  it('renews again on a later catch, once the flight has settled', async () => {
    // The latch is for one moment, not for the life of the worker. If it never cleared,
    // tomorrow's renewal would be skipped and the session would die inside the grace
    // window with nothing trying to save it.
    let calls = 0;
    const keep = createSessionKeeper({
      exchange: async () => {
        calls++;
        return { ok: true as const, session: renewed, activationId: 'act_1' };
      },
      save: async () => {},
      now: () => NOW,
    });

    await keep({ key: 'KEY-1', session: stale });
    await keep({ key: 'KEY-1', session: stale });

    expect(calls).toBe(2);
  });

  it('clears the latch when the exchange throws, so the next catch can still renew', async () => {
    // A wedged latch would be worse than the double-spend: every later renewal would join
    // a promise that already rejected, and the subscriber would ride out the grace window
    // and meet the wall.
    let calls = 0;
    const keep = createSessionKeeper({
      exchange: async () => {
        calls++;
        if (calls === 1) throw new Error('network');
        return { ok: true as const, session: renewed, activationId: 'act_1' };
      },
      save: async () => {},
      now: () => NOW,
    });

    const first = await keep({ key: 'KEY-1', session: stale });
    expect(first.session).toEqual(stale); // kept what we had, rode the grace

    const second = await keep({ key: 'KEY-1', session: stale });
    expect(second.session).toEqual(renewed);
    expect(calls).toBe(2);
  });
});

describe('forgetSession', () => {
  /**
   * The session goes; everything that identifies this install stays.
   *
   * `ensureSession` has always done exactly this on a non-retryable refusal, inline. It
   * needed a second caller on 2026-08-25: a 401 from `/api/vision` means the token is no
   * longer one the server will honour, and the fix is to forget it so the next catch
   * exchanges the licence again (AC-3). Two copies of "which fields survive" is two chances
   * to drop the activation id — which is the bug item 27 was filed for, twice.
   */
  it('keeps the key and the activation, drops only the token', () => {
    expect(
      forgetSession({ key: 'BUKI-AAAA', session: { token: 't', expiresAt: 1 }, activationId: 'a1' }),
    ).toEqual({ key: 'BUKI-AAAA', session: null, activationId: 'a1' });
  });

  it('OMITS the activation rather than storing an empty one', () => {
    // Matching every other writer's conditional spread, so a record that never had an id
    // round-trips unchanged instead of gaining a field that means "no id".
    const next = forgetSession({ key: 'BUKI-AAAA', session: { token: 't', expiresAt: 1 } });
    expect(next).toEqual({ key: 'BUKI-AAAA', session: null });
    expect('activationId' in next).toBe(false);
  });

  it('is safe to run on a state that has no session already', () => {
    expect(forgetSession({ key: 'K', session: null, activationId: 'a1' })).toEqual({
      key: 'K',
      session: null,
      activationId: 'a1',
    });
  });
});

/**
 * ADV-8 AND C-3. `OPENWORK.md` item 48. Both are about the five permanent slots, which are
 * the only finite resource this product can burn.
 */
describe('ensureSession keeps its promise never to throw', () => {
  const NOW3 = Date.UTC(2026, 7, 17, 12, 0, 0);
  const nearlyDone = { token: 'old', expiresAt: NOW3 + 60_000 };

  it('does not throw when storage refuses the write', async () => {
    // ADV-8. The docblock says "It never throws", and both `deps.save` calls sat OUTSIDE
    // the try. `ensureSession` runs on the path of a catch somebody is waiting on, so a
    // storage-quota failure did not degrade to "carry on with what we have" — it rejected
    // into the caller and took the catch with it.
    const save = vi.fn(async () => {
      throw new Error('QUOTA_BYTES quota exceeded');
    });
    const result = await ensureSession(
      { key: 'K', session: nearlyDone },
      {
        exchange: vi.fn(async () => ({
          ok: true as const,
          session: { token: 'new', expiresAt: NOW3 + 86_400_000 },
          activationId: 'act_1',
        })),
        save,
        now: () => NOW3,
      },
    );
    // And the caller still gets the fresh session, because it exists in memory whatever
    // storage did. Worse: the exchange ALREADY SPENT A SLOT, so throwing here would lose
    // both the catch and the slot.
    expect(result.session?.token).toBe('new');
    expect(result.activationId).toBe('act_1');
  });

  it('does not throw when storage refuses the write on a definitive refusal either', async () => {
    const save = vi.fn(async () => {
      throw new Error('QUOTA_BYTES quota exceeded');
    });
    const result = await ensureSession(
      { key: 'K', session: nearlyDone, activationId: 'act_1' },
      {
        exchange: vi.fn(async () => ({ ok: false as const, retryable: false, reason: 'licence' })),
        save,
        now: () => NOW3,
      },
    );
    expect(result.session).toBeNull();
  });

  it('KEEPS the pairing even when a renewal is refused outright, and that is deliberate', async () => {
    // C-3 IS NOT FIXED HERE, and the attempt to fix it here was reverted on 2026-08-27.
    // Item 27's premise does not expire on this branch, it just does not cover everything:
    // a lapsed-then-fixed subscription still has its activation at Polar, so dropping the
    // id would activate a second time for the same machine. A deactivated install wants
    // the opposite. Telling them apart needs Polar's refusal code and the endpoints are not
    // live yet, so the escape hatch went where the signal actually is - see
    // `activateKey.activationFor`, which re-activates when a human re-pastes while unpaired.
    const result = await ensureSession(
      { key: 'K', session: nearlyDone, activationId: 'act_1' },
      {
        exchange: vi.fn(async () => ({ ok: false as const, retryable: false, reason: 'licence' })),
        save: vi.fn(async () => undefined),
        now: () => NOW3,
      },
    );
    expect(result.session).toBeNull();
    expect(result.key, 'the key must stay, or the options page cannot say what is wrong').toBe('K');
    expect(result.activationId).toBe('act_1');
  });

  it('KEEPS the activation id when the refusal might pass, which is item 27', async () => {
    // The guard on the guard. A retryable refusal is our outage, not an answer, and
    // dropping the pairing there would activate a second time for the same machine on the
    // next success — burning a slot to survive a bad minute at Polar.
    const result = await ensureSession(
      { key: 'K', session: nearlyDone, activationId: 'act_1' },
      {
        exchange: vi.fn(async () => ({ ok: false as const, retryable: true, reason: 'upstream' })),
        save: vi.fn(async () => undefined),
        now: () => NOW3,
      },
    );
    expect(result.activationId).toBe('act_1');
    expect(result.session).toEqual(nearlyDone);
  });
});

describe('forgetSession still keeps the pairing, because its caller is a different failure', () => {
  it('keeps the activation id when only the TOKEN was rejected', () => {
    // `background.ts` calls this when `/api/vision` answers 401 — a rotated secret, a
    // bumped TOKEN_VERSION. The licence is fine and the install is still paired, so
    // dropping the id here would spend a slot to recover from our own key rotation.
    expect(forgetSession({ key: 'K', session: { token: 't', expiresAt: 1 }, activationId: 'a' })).toEqual(
      { key: 'K', session: null, activationId: 'a' },
    );
  });
});

/**
 * R-1's WIRING, which is the half no unit test can reach. `OPENWORK.md` item 49.
 *
 * `canCatchOnHeldSession` is proved in `license.test.ts` with real values. What it cannot
 * prove is that `background.ts` actually asks it — and `background.ts` registers listeners
 * at module scope, so nothing can import it. Asserted as SOURCE, with comments stripped
 * first, because this repo's house style is dense enough that the paragraph explaining a
 * rule will otherwise satisfy a guard on it. See `optionsPage.test.ts`.
 */
const backgroundCode = background
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

describe('a catch waits for a renewal only when it has no usable session', () => {
  it('has NO unguarded await of the renewal', () => {
    // The absence proof. One awaited call, and the decision is asked before it. A second
    // `await keepSession` anywhere would put the licence server back in front of every
    // renewing catch, which is the whole defect.
    expect(backgroundCode.match(/await keepSession\(/g) ?? []).toHaveLength(1);
    const asks = backgroundCode.indexOf('canCatchOnHeldSession(');
    const waits = backgroundCode.indexOf('await keepSession(');
    expect(asks, 'background.ts never asks whether it needs to wait').toBeGreaterThan(-1);
    expect(waits, 'nothing awaits the renewal at all any more').toBeGreaterThan(-1);
    expect(asks, 'the wait happens before the question that decides it').toBeLessThan(waits);
  });

  it('swallows the fire-and-forget rejection instead of letting it escape', () => {
    // An unhandled rejection in a service worker is logged as an error on a catch that
    // otherwise worked perfectly. `warmCovers` records the same rule; this is the second
    // place in the worker that runs something without awaiting it.
    expect(backgroundCode).toMatch(/void keepSession\([^)]*\)\.catch\(/);
  });
});

/**
 * R-2. `OPENWORK.md` item 49. A failed renewal retried on EVERY catch.
 *
 * `createSessionKeeper` latches concurrent calls, which is what it is for, and remembers
 * nothing across them. So after a failure the next catch exchanged again, and the one after
 * that, with no backoff and no cooldown — burning `CHECKS_PER_KEY_PER_DAY = 40` against our
 * own `keyCap`, whose 429 item 39 correctly made retryable, so it kept going.
 *
 * THE COOLDOWN HAS TO BE PERSISTED, and that is the part that is not obvious. An MV3 worker
 * is torn down between clicks — the module docblock above says so, and it is why renewal
 * happens on the catch rather than on a timer — so a cooldown held in module scope would be
 * gone by the next catch. It lives in `ProState`, beside the session it protects.
 */
describe('a failed renewal does not retry on every catch', () => {
  const NOW4 = Date.UTC(2026, 7, 17, 12, 0, 0);
  const nearlyDone = { token: 'old', expiresAt: NOW4 + 60_000 };
  const outage = () => vi.fn(async () => ({ ok: false as const, retryable: true }));

  it('remembers WHEN the renewal failed', async () => {
    const saved: ProState[] = [];
    await ensureSession(
      { key: 'K', session: nearlyDone },
      { exchange: outage(), save: async (s) => void saved.push(s), now: () => NOW4 },
    );
    expect(saved[0]?.renewFailedAt, 'nothing recorded the failure, so nothing can back off').toBe(
      NOW4,
    );
  });

  it('remembers it for a definitive refusal too', async () => {
    // A refusal sets `session: null`, and `needsRenewal(null)` is true for ever — so
    // without this every catch after a revoked licence exchanges again.
    const saved: ProState[] = [];
    await ensureSession(
      { key: 'K', session: nearlyDone },
      {
        exchange: vi.fn(async () => ({ ok: false as const, retryable: false })),
        save: async (s) => void saved.push(s),
        now: () => NOW4,
      },
    );
    expect(saved[0]?.renewFailedAt).toBe(NOW4);
  });

  it('does NOT exchange again inside the cooldown', async () => {
    const exchange = outage();
    const held: ProState = { key: 'K', session: nearlyDone, renewFailedAt: NOW4 };
    const out = await ensureSession(held, {
      exchange,
      save: vi.fn(async () => undefined),
      now: () => NOW4 + RENEW_COOLDOWN_MS - 1,
    });
    expect(exchange, 'the licence server is called on every catch again').not.toHaveBeenCalled();
    expect(out, 'the held state must come back untouched').toEqual(held);
  });

  it('DOES exchange again once the cooldown is over', async () => {
    // A backoff that never lifts is an outage made permanent. The grace window is seven
    // days; there has to be a way back inside it.
    const exchange = outage();
    await ensureSession(
      { key: 'K', session: nearlyDone, renewFailedAt: NOW4 },
      {
        exchange,
        save: vi.fn(async () => undefined),
        now: () => NOW4 + RENEW_COOLDOWN_MS,
      },
    );
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('CLEARS the mark when a renewal succeeds', async () => {
    // Otherwise the next failure is measured from a stale timestamp and the backoff is
    // already spent before it starts.
    const saved: ProState[] = [];
    await ensureSession(
      { key: 'K', session: nearlyDone, renewFailedAt: NOW4 - 1 },
      {
        exchange: vi.fn(async () => ({
          ok: true as const,
          session: { token: 'new', expiresAt: NOW4 + 86_400_000 },
          activationId: 'act_1',
        })),
        save: async (s) => void saved.push(s),
        now: () => NOW4 + RENEW_COOLDOWN_MS,
      },
    );
    expect(saved[0]).not.toHaveProperty('renewFailedAt');
  });

  it('keeps the key and the activation while it backs off', async () => {
    // The cooldown must not become a quiet way to lose the pairing.
    const saved: ProState[] = [];
    await ensureSession(
      { key: 'K', session: nearlyDone, activationId: 'act_1' },
      { exchange: outage(), save: async (s) => void saved.push(s), now: () => NOW4 },
    );
    expect(saved[0]?.key).toBe('K');
    expect(saved[0]?.activationId).toBe('act_1');
  });

  it('is long enough to stay under the cap that made this a bug', () => {
    // The number and its reason, together. `keyCap` allows 40 checks per key per day, so a
    // cooldown shorter than 36 minutes lets a broken licence exhaust it again and the fix
    // is decorative. Asserted against the REAL cap rather than a copy of it.
    const perDay = Math.floor(86_400_000 / RENEW_COOLDOWN_MS);
    expect(perDay).toBeLessThan(CHECKS_PER_KEY_PER_DAY);
    // And pinned against a literal, separately: the check above also passes if somebody
    // raises the cooldown to a week, which would be an outage made permanent.
    expect(RENEW_COOLDOWN_MS).toBe(45 * 60 * 1000);
  });
});
