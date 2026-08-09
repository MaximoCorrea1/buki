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

export function createTrial(deps: { storage: StorageArea }) {
  // Same reason storage.ts has one: spend() is read-modify-write against a single key, and
  // two catches landing together would otherwise both read the same base and one would be
  // silently free.
  const serialize = createWriteQueue();

  async function read(): Promise<number> {
    const got = await deps.storage.get(KEY);
    const raw = got[KEY];
    // Storage is shared and user-editable. A corrupt or negative value reads as zero
    // rather than throwing, and never as "infinite free catches".
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  }

  return {
    spent: read,
    async spend(): Promise<number> {
      return serialize(async () => {
        const next = (await read()) + 1;
        await deps.storage.set({ [KEY]: next });
        return next;
      });
    },
  };
}
