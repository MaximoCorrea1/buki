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
  const { key } = raw as Record<string, unknown>;
  return {
    key: typeof key === 'string' ? key : '',
    session: sessionFrom((raw as Record<string, unknown>)['session']),
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
  trialSpent: number,
  providerKey: string,
  now: number,
): Standing {
  return {
    pro: isLicensed(pro.session, now),
    trialSpent,
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

  // The session goes and the key stays — and so does the activation. This install is
  // still paired with Polar, so dropping the id would make the next successful exchange
  // activate a SECOND time for the same machine.
  const next: ProState = {
    key: pro.key,
    session: null,
    ...(pro.activationId ? { activationId: pro.activationId } : {}),
  };
  await deps.save(next);
  return next;
}
