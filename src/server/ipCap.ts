/**
 * How many unlicensed cover readings one address gets per day.
 *
 * `/api/vision` has paired its Origin check with this since it was written, and the pairing
 * is the point: `Origin` is forgeable by anything that is not a browser, so it closes the
 * casual path and nothing more. This is the second of the three defences the handler
 * names; the third is the kill switch, and the floor under real money is a provider-side
 * spend cap.
 *
 * IT IS A BRAKE, NOT AN ACCOUNTING SYSTEM. The counter is in memory and therefore
 * per-isolate. **The trial count that matters lives in the extension, on the machine** —
 * this only stops a runaway, and `trial.ts` says out loud that the real counter is
 * forgeable and that defending it would need accounts, which would need a database, to
 * protect a fraction of a cent.
 *
 * TRIAL TRAFFIC ONLY. `visionHandler` gates this inside `if (access.kind === 'trial')`,
 * beside the kill switch, under a comment saying that stopping somebody who is paying is
 * the worst possible place to save a hundredth of a cent. That scoping was itself a fix:
 * the switch beside it got it wrong for a day and told a paying subscriber the free trial
 * was closed.
 *
 * A FACTORY rather than a module-level map, so a test gets a fresh counter. `api/vision.ts`
 * builds exactly one. Extracted from that file on 2026-08-18 for the same reason
 * `keyCap.ts` was: a day rollover and a header-parsing rule are logic, and the shell says
 * of itself that nothing in it needs a test.
 */

/**
 * Generous on purpose. The free allowance is ten catches and a household behind one NAT is
 * several people, so this has to sit well above what one person could legitimately do
 * before it means anything.
 */
export const TRIAL_PER_IP_PER_DAY = 40;

/**
 * Who is asking, from the one header that can answer.
 *
 * `x-forwarded-for` is a CHAIN: the client first, then every proxy that added itself.
 * Taking the last entry would count Vercel's own edge and drop every trial user in the
 * world into one bucket; keeping the whole string would hand one client a fresh allowance
 * per proxy hop, because the chain changes and the key would change with it.
 *
 * An absent or empty header falls into ONE shared bucket rather than getting a fresh
 * allowance each time. That makes the unidentifiable case tighter than a named one, which
 * is the safe direction for a brake: the failure mode of guessing wrong here is either
 * "one anonymous caller is throttled by another" or "the cap does nothing at all", and the
 * first is much cheaper than the second.
 */
function callerOf(request: Request): string {
  const first = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return first ? first : 'unknown';
}

export interface IpCap {
  (request: Request, now: number): boolean;
}

/**
 * NO EVICTION RULE, and that is the difference from `keyCap.ts`.
 *
 * That one counts strings the CALLER chose, so a prober supplies fresh keys for free and
 * the map has to be bounded. This one counts addresses, which real callers bound for us: an
 * attacker cannot mint new source IPs the way they can mint candidate licence keys, and the
 * isolate recycles long before a legitimate address count becomes interesting.
 */
export function createIpCap(): IpCap {
  const hits = new Map<string, { day: number; n: number }>();

  return (request: Request, now: number): boolean => {
    const caller = callerOf(request);
    const day = Math.floor(now / 86_400_000);

    const seen = hits.get(caller);
    if (!seen || seen.day !== day) {
      hits.set(caller, { day, n: 1 });
      return false;
    }
    seen.n++;
    return seen.n > TRIAL_PER_IP_PER_DAY;
  };
}
