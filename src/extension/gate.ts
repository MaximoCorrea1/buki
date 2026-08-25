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
  trial: {
    spent: () => Promise<number>;
    /** Catches that ISSUED a request, whatever came back. See `entitlement.TRIAL_ATTEMPTS`. */
    attempts: () => Promise<number>;
    spend: () => Promise<unknown>;
    attempt: () => Promise<unknown>;
  };
  now: () => number;
}

export function createGate(deps: GateDeps) {
  const standing = async (): Promise<Standing> => {
    // In parallel: four independent reads on the path a person is waiting on.
    const [pro, settings, spent, attempts] = await Promise.all([
      deps.readPro(),
      deps.readSettings(),
      deps.trial.spent(),
      deps.trial.attempts(),
    ]);
    return standingOf(pro, { spent, attempts }, settings.apiKey, deps.now());
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
      try {
        const result = await work();
        if (verdict.spendTrial) await deps.trial.spend();
        return result;
      } finally {
        // THE ATTEMPT IS COUNTED WHATEVER HAPPENED, and that is the whole of P0-5's fix.
        //
        // `spend` above stays where it is: a reading that never came back must not cost one
        // of the advertised ten, which `trial.ts` states out loud and which is right. But a
        // caller can make `work()` reject on purpose — press catch, press the card's × two
        // seconds later, repeat — and until this line the money was committed upstream while
        // the counter stood still and the options page read "10 of 10 free catches left".
        //
        // SWALLOWED, deliberately. A `finally` that throws REPLACES the error being unwound,
        // so a storage-quota failure here would surface instead of the wall, on the one path
        // where the message is the entire point. The counter is a brake, not an accounting
        // system, and a lost increment is cheaper than a lost error.
        if (verdict.spendTrial) {
          try {
            await deps.trial.attempt();
          } catch (err) {
            console.error('[Buki] could not count the attempt', err);
          }
        }
      }
    },
  };
}
