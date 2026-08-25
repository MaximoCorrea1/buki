/**
 * What the extension knows about being Pro, and the one place it is assembled.
 *
 * `entitlement.decide` answers from a `Standing`. Three callers need one — the worker
 * before it spends a vision call, the tray before it draws a footer, the options page
 * before it names the plan — and each assembling it by hand is three chances to read
 * "has a licence key" as "is Pro". They are not the same: a key that has never been
 * exchanged, or one whose session has aged past the server's grace, is not a subscription
 * the proxy will honour.
 *
 * Stored separately from `visionSettings` on purpose. That record is the user's own
 * provider configuration and they are invited to edit it; this is a bearer credential and
 * a signed token, and the two having different lifetimes is the point.
 */
import type { StorageArea } from './storage';
import { isLicensed, needsRenewal, type Exchange, type Session } from './license';
import type { Standing } from './entitlement';

export const PRO_KEY = 'buki-pro';

export interface ProState {
  /** The licence key as the customer pasted it. Empty until they do. */
  key: string;
  /** The session it was last exchanged for, or null if never/failed. */
  session: Session | null;
  /**
   * Polar's id for THIS install, from the one and only `activate` call.
   *
   * Its presence is what tells the server to VALIDATE rather than activate on every later
   * exchange. Activating spends one of the key's five slots each time, and `ensureSession`
   * renews daily, so without this a subscriber exhausted their own licence in five days and
   * was then shown the wall they had paid to pass.
   *
   * Optional because every record written before 2026-08-18 lacks it. A missing id is not
   * an error: it means "activate once more, then keep what comes back."
   */
  activationId?: string;
}

const EMPTY: ProState = { key: '', session: null };

/** A stored session, or null for anything that is not one. */
function sessionFrom(raw: unknown): Session | null {
  if (!raw || typeof raw !== 'object') return null;
  const { token, expiresAt } = raw as Record<string, unknown>;
  if (typeof token !== 'string' || token === '') return null;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null;
  return { token, expiresAt };
}

/**
 * Read it, defensively.
 *
 * `chrome.storage.local` is user-editable and shared with every other key the extension
 * owns. A garbage read has to produce "not Pro" — never a crash, and never a shape that
 * lets a NaN become unlimited free catches. `entitlement.ts` sanitises again downstream;
 * this is the first line rather than the only one.
 */
export async function readPro(storage: StorageArea): Promise<ProState> {
  const got = await storage.get(PRO_KEY);
  const raw = (got as Record<string, unknown>)[PRO_KEY];
  if (!raw || typeof raw !== 'object') return EMPTY;
  const { key, activationId } = raw as Record<string, unknown>;
  return {
    key: typeof key === 'string' ? key : '',
    session: sessionFrom((raw as Record<string, unknown>)['session']),
    // WITHOUT THIS LINE THE WHOLE "activate once, validate forever" FIX IS INERT.
    //
    // `writePro` stores the whole state, but this reader rebuilt a two-field subset, so
    // the id was written on every exchange and dropped on every read. `ensureSession`
    // then handed `undefined` to the server, the server took the ACTIVATE branch, and a
    // subscriber went back to spending one of five slots a day. The handler, the client
    // and both call sites were all correct; the value never survived storage.
    //
    // Nothing was red, and it could not have been: `activationId` is optional, so a
    // literal that omits it is a valid `ProState`. Same permissiveness as the arrow with
    // fewer parameters that nearly undid this fix at the wiring.
    //
    // Omitted rather than empty-stringed when absent, matching every writer's
    // `...(id ? { activationId: id } : {})`, so a record that never had one round-trips
    // unchanged instead of gaining a field that means "no id".
    ...(typeof activationId === 'string' && activationId ? { activationId } : {}),
  };
}

export async function writePro(storage: StorageArea, state: ProState): Promise<void> {
  await storage.set({ [PRO_KEY]: state });
}

/**
 * The snapshot `entitlement.decide` answers from.
 *
 * `pro` is `isLicensed`, NOT "has a key" and NOT "the token is fresh" — see the field note
 * on `Standing.pro`. `providerKey` is the user's own vision key from `visionSettings`;
 * having one means we are not paying for the call, which is its own plan.
 */
export function standingOf(
  pro: ProState,
  // AN OBJECT, not two adjacent numbers. `standingOf(pro, spent, attempts, key, now)` puts
  // two interchangeable-looking integers side by side, and a caller that swaps them
  // compiles, passes every type check, and quietly gives somebody three times the trial.
  trial: { spent: number; attempts: number },
  providerKey: string,
  now: number,
): Standing {
  return {
    pro: isLicensed(pro.session, now),
    trialSpent: trial.spent,
    trialAttempts: trial.attempts,
    ownKey: providerKey.trim() !== '',
  };
}

/**
 * Trade the licence for a fresh session before the one we hold runs out.
 *
 * **This had no caller until 2026-08-17.** `needsRenewal` was written and tested with
 * nothing calling it, so a subscriber's token would have expired after a day, ridden the
 * seven-day grace, and then shown them the wall they had already paid to pass. Nothing was
 * red; it was found by reconciling the plan against the code.
 *
 * THE FAILURE RULE IS THE POINT. A renewal that fails for a reason that might pass — Polar
 * down, network blinked — KEEPS the token we have, because the server honours it on grace
 * and throwing it away would sign a paying customer out during OUR outage. A renewal
 * refused outright (revoked, refunded, subscription ended) is an answer rather than an
 * outage, so the session goes and the key stays, which is what lets the options page say
 * what is wrong.
 *
 * It never throws. It is called on the path of a catch somebody is waiting on, and a
 * failure to renew must degrade to "carry on with what we have", never to a lost catch.
 */
export async function ensureSession(
  pro: ProState,
  deps: {
    exchange: (key: string, activationId?: string) => Promise<Exchange>;
    save: (state: ProState) => Promise<void>;
    now: () => number;
  },
): Promise<ProState> {
  if (!pro.key) return pro;
  if (!needsRenewal(pro.session, deps.now())) return pro;

  let result: Exchange;
  try {
    // The stored id, so the server validates instead of burning another slot.
    result = await deps.exchange(pro.key, pro.activationId);
  } catch {
    return pro; // keep what we have and ride the grace window
  }

  if (result.ok) {
    // Keep whichever id we now hold. Preferring the fresh one matters on the FIRST
    // exchange, where we had none and Polar has just issued it.
    const next: ProState = {
      key: pro.key,
      session: result.session,
      ...(result.activationId || pro.activationId
        ? { activationId: result.activationId || pro.activationId }
        : {}),
    };
    await deps.save(next);
    return next;
  }

  if (result.retryable) return pro;

  const next = forgetSession(pro);
  await deps.save(next);
  return next;
}

/**
 * The session goes; everything that identifies this install stays.
 *
 * The key stays because it is what lets the options page say what is wrong. **The activation
 * stays because this install is still paired with Polar**, and dropping the id would make
 * the next successful exchange activate a SECOND time for the same machine — burning one of
 * five permanent slots. That is the bug item 27 was filed for, twice.
 *
 * A FUNCTION RATHER THAN FOUR LINES, since 2026-08-25, because it grew a second caller.
 * `ensureSession` above does this when Polar refuses outright; `background.ts` now does it
 * when `/api/vision` answers 401, which means the token is no longer one the server will
 * honour — a rotated `BUKI_TOKEN_SECRET`, a bumped `TOKEN_VERSION`, a revoked licence — and
 * the fix is to forget it so the next catch exchanges the licence again. That is AC-3, and
 * it is the only lever that makes a secret rotation survivable.
 *
 * Two copies of "which fields survive" would be two chances to drop the activation id.
 */
export function forgetSession(pro: ProState): ProState {
  return {
    key: pro.key,
    session: null,
    // Omitted rather than empty-stringed, matching every other writer's conditional spread,
    // so a record that never had one round-trips unchanged.
    ...(pro.activationId ? { activationId: pro.activationId } : {}),
  };
}

/**
 * ONE RENEWAL PER MOMENT, however many catches ask for it at once.
 *
 * `ensureSession` is a read-modify-write with a Polar call in the middle, and that call
 * spends one of a licence's five activation slots — the only finite resource this
 * extension can burn. `trial.ts`, `storage.ts` and `recognitionLog.ts` all wrap their
 * read-modify-write in `createWriteQueue()`; this path had nothing, and it is the one
 * where an overlap costs money rather than a record.
 *
 * Two catches clicked in the same second both read the same stale state, both see
 * `needsRenewal`, and both exchange: two slots for one user action. The invisible half is
 * worse — if one succeeds and the other hits a retryable error, the loser returns the
 * ORIGINAL stale object, so that catch travels with no token, is classified `trial` by the
 * server, and is billed to an allowance the customer already paid to pass.
 *
 * SINGLE-FLIGHT, not a queue, and the distinction is the point. `createLookupMemo` already
 * does this for concurrent recognitions. A queue would make the second caller wait and
 * then re-read to discover the work was done; sharing the one promise means there is no
 * second exchange to serialise and no losing caller left holding a stale state. Both
 * halves close together, because there is only ever one answer.
 *
 * Keyed on the licence key: two keys are two pairings with two slot counts, and handing
 * key B the answer to key A's exchange would give it a session nobody paid for.
 *
 * The latch is for one moment, not for the life of the worker. It clears on settle — and
 * only if it is still ours, so a flight for another key cannot clear a live one. A latch
 * that stuck would be worse than the double-spend: every later renewal would join a
 * finished promise, and the subscriber would ride out the grace window into the wall.
 */
export function createSessionKeeper(deps: {
  exchange: (key: string, activationId?: string) => Promise<Exchange>;
  save: (state: ProState) => Promise<void>;
  now: () => number;
}): (pro: ProState) => Promise<ProState> {
  let flight: { key: string; run: Promise<ProState> } | null = null;

  return function keep(pro: ProState): Promise<ProState> {
    // Both of `ensureSession`'s own early returns, restated here so a caller that needs
    // nothing never touches the latch and never waits behind somebody else's exchange.
    if (!pro.key) return Promise.resolve(pro);
    if (!needsRenewal(pro.session, deps.now())) return Promise.resolve(pro);

    if (flight && flight.key === pro.key) return flight.run;

    const run: Promise<ProState> = ensureSession(pro, deps).finally(() => {
      if (flight?.run === run) flight = null;
    });
    flight = { key: pro.key, run };
    return run;
  };
}
