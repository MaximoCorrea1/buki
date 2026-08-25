import type { StorageArea } from './storage';
import { createWriteQueue } from './writeQueue';

/**
 * How many hosted cover catches have been spent.
 *
 * Deliberately forgeable: it is a number in local storage and anybody can clear it.
 * Defending it needs identity, which needs accounts, which needs a database, to protect a
 * resource worth one hundredth of a cent. Whoever resets storage every ten books was never
 * going to pay four dollars.
 *
 * A catch is spent only when a reading came BACK. A timeout, a no-match, a refused
 * grounding or a dismissed card costs nothing: charging one of ten free catches for a
 * failure is the fastest uninstall there is, and it would make the trial shorter than
 * advertised.
 */
const KEY = 'trialSpent';

/**
 * Catches that ISSUED a request, whatever came back.
 *
 * The counter above is the advertised one and only moves when a reading arrives, which is
 * a promise this module makes out loud and keeps. This one exists because that promise can
 * be turned into an unbounded free-read loop by anybody willing to press the card's x:
 * the abort surfaces as a 408, the spend is skipped, and the request was already paid for.
 *
 * `entitlement.TRIAL_ATTEMPTS` is the ceiling, three per advertised catch, and
 * `entitlement.trialLeft` folds both into ONE number so the wall, the plan label and the
 * tray footer cannot tell one person three different stories.
 */
const ATTEMPTS_KEY = 'trialAttempts';

export function createTrial(deps: { storage: StorageArea }) {
  // Same reason storage.ts has one: spend() is read-modify-write against a single key, and
  // two catches landing together would otherwise both read the same base and one would be
  // silently free.
  const serialize = createWriteQueue();

  async function read(key: string): Promise<number> {
    const got = await deps.storage.get(key);
    const raw = (got as Record<string, unknown>)[key];
    // Storage is shared and user-editable. A corrupt or negative value reads as zero
    // rather than throwing, and never as "infinite free catches".
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  }

  /** Read, add one, write - through the queue, because two catches can land together. */
  const bump = (key: string): Promise<number> =>
    serialize(async () => {
      const next = (await read(key)) + 1;
      await deps.storage.set({ [key]: next });
      return next;
    });

  return {
    spent: () => read(KEY),
    attempts: () => read(ATTEMPTS_KEY),
    spend: () => bump(KEY),
    attempt: () => bump(ATTEMPTS_KEY),
  };
}
