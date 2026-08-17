/**
 * The one place Buki spends money, and the only place it refuses.
 *
 * `entitlement.decide` answers WHETHER a catch is allowed. This owns WHEN: the check runs
 * before the vision call, and the trial is spent only after a call that actually happened.
 * Both halves are load-bearing and both have an obvious failure —
 *
 *   check after the call   a refused catch still costs us a vision request
 *   spend before the call  a provider outage burns trial catches the reader never got
 *
 * It wraps the vision call rather than sitting beside it, so there is no ordering for a
 * caller to get wrong: you cannot make the call without passing through the gate.
 */
import { decide, type CatchKind, type Standing } from './entitlement';
import { standingOf, type ProState } from './proState';

/**
 * The trial is spent. Thrown rather than returned because it unwinds the whole
 * recognition: nothing downstream of a refused cover read has anything to do.
 * `background.ts` catches it and turns the card into the wall.
 */
export class WallError extends Error {
  constructor() {
    super('the free cover readings are spent');
    this.name = 'WallError';
  }
}

export interface GateDeps {
  readPro: () => Promise<ProState>;
  /** Only the provider key is needed; taking all of Settings would couple this to it. */
  readSettings: () => Promise<{ apiKey: string }>;
  /** `spend` returns the new count; the gate ignores it, so the dependency is widened
   *  rather than the trial narrowed to suit a caller. */
  trial: { spent: () => Promise<number>; spend: () => Promise<unknown> };
  now: () => number;
}

export function createGate(deps: GateDeps) {
  const standing = async (): Promise<Standing> => {
    // In parallel: three independent reads on the path a person is waiting on.
    const [pro, settings, spent] = await Promise.all([
      deps.readPro(),
      deps.readSettings(),
      deps.trial.spent(),
    ]);
    return standingOf(pro, spent, settings.apiKey, deps.now());
  };

  return {
    standing,

    /**
     * Run `work` if this catch is allowed, and account for it if it happened.
     *
     * The spend is deliberately NOT awaited inside the caller's critical path any more
     * than it has to be, but it IS awaited: `trial.ts` owns a write queue, and a lost
     * increment is a trial that never ends. See the note in `entitlement.ts` about two
     * catches in flight at nine both being allowed — that overshoot is known and chosen.
     */
    async run<T>(kind: CatchKind, work: () => Promise<T>): Promise<T> {
      const verdict = decide(await standing(), kind);
      if (!verdict.allow) throw new WallError();
      const result = await work();
      if (verdict.spendTrial) await deps.trial.spend();
      return result;
    },
  };
}
