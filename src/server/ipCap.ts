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
 * The same brake on `/api/license`, and it is deliberately six times looser.
 *
 * Different traffic, and a much worse failure. A licence key holds **five activation
 * slots**, each renewing about once a day, and retries multiply that; several subscribers
 * behind one NAT multiply it again. Fifteen a day is an ordinary household and forty-five
 * is a plausible one, so `TRIAL_PER_IP_PER_DAY` would have thrown real subscribers out.
 *
 * **Locking out somebody who is paying is the worst outcome this endpoint has**, and the
 * job here is only to make key ENUMERATION pointless — an enumerator needs thousands of
 * guesses, not hundreds. 240 is far under that and far over any legitimate day.
 */
export const LICENSE_PER_IP_PER_DAY = 240;

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
  return first ? bucketFor(first) : 'unknown';
}

/**
 * How many callers one isolate will track before it starts forgetting.
 *
 * Same shape and the same reasoning as `keyCap.ts`'s `MAX_TRACKED`, and the sibling rule in
 * `OPENWORK.md` §5 is why it is here at all: when one handler has a guard, ask what the
 * other one has.
 */
export const MAX_TRACKED = 20_000;

/**
 * The unit a cap counts, which is NOT always one address.
 *
 * ⚠ **THIS MODULE USED TO ARGUE THAT IT NEEDED NO EVICTION**, on the grounds that *"an
 * attacker cannot mint new source IPs the way they can mint candidate licence keys."*
 * **That is IPv4 reasoning, and it was written beside an IPv6-capable edge.** A residential
 * IPv6 customer is delegated **a /64 at minimum**, commonly a /56 or /48, and every address
 * (⚠ the bold must not open straight onto the slash. Two asterisks followed by a slash
 * spell the comment TERMINATOR, so `[star][star]/64` ends the docblock and the file stops
 * parsing. It did. And the first attempt to warn about it here spelled the terminator
 * again, inside backticks, which a block comment does not respect. `OPENWORK.md` §5 T21.)
 * inside it routes back to them. So one customer holds 2^64 source addresses, free to
 * choose per request — which made the cap both a no-op and an unbounded map. **The comment
 * vouching for it was the reason nobody looked.** `OPENWORK.md` item 51, PERF-6 / SEC-4.
 *
 * **IPv6 collapses to its /64. IPv4 does not collapse at all**, because IPv4 has no
 * per-customer delegation to fold: two addresses sharing three octets are two different
 * customers, and folding them would throttle strangers for each other. **Collapsing MORE
 * than the /64 would do the same thing** — a /48 puts unrelated customers of one ISP in one
 * bucket — so the prefix is exactly 64 bits and no wider.
 */
function bucketFor(address: string): string {
  // `[2001:db8::1]:443` is a legal way for a proxy to write it, and so is the bare form.
  // Two spellings of one caller must not be two allowances - the same reason the chain is
  // read with its spaces stripped.
  const bare = address.startsWith('[')
    ? (address.slice(1).split(']')[0] ?? address)
    : address;

  // A DOT MEANS AN IPv4 ADDRESS IS IN THERE, bare (`203.0.113.7`) or mapped
  // (`::ffff:203.0.113.7`). Either way it is ONE address and must stay whole: IPv4 has no
  // per-customer delegation to fold, and a mapped address folded to its /64 becomes
  // `0:0:0:0`, which would put every mapped caller in the world into a single bucket.
  //
  // This used to also test `!bare.includes(':')` for the bare-IPv4 case. **A mutation
  // proved that half could not fail** — `expand` already returns null for anything that is
  // not eight hextets, so bare IPv4 fell through to the same answer by a longer route. An
  // EQUIVALENT mutant is a signal to simplify, not a number to explain away. §5 T15.
  if (bare.includes('.')) return bare;

  const groups = expand(bare);
  // Anything that does not parse keeps its whole string. That is the tight direction: an
  // unrecognised spelling gets its own bucket rather than a way around the cap.
  if (!groups) return bare;
  return groups.slice(0, 4).join(':');
}

/** `2001:db8::1` → the eight hextets it stands for, normalised. `null` if it is not one. */
function expand(address: string): string[] | null {
  const halves = address.split('::');
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

  let groups: string[];
  if (halves.length === 1) {
    if (left.length !== 8) return null;
    groups = left;
  } else {
    const zeros = 8 - left.length - right.length;
    if (zeros < 0) return null;
    groups = [...left, ...Array<string>(zeros).fill('0'), ...right];
  }

  // `0db8` and `db8` are the same hextet, and two spellings must not be two buckets.
  return groups.map((g) => {
    const trimmed = g.replace(/^0+/, '').toLowerCase();
    return trimmed === '' ? '0' : trimmed;
  });
}

export interface IpCap {
  (request: Request, now: number): boolean;
  /** How many callers are being tracked. Exposed so the bound can be TESTED, as `keyCap` is. */
  size(): number;
}

/**
 * A per-caller daily brake, bounded in both directions.
 *
 * `maxTracked` is injectable for the same reason `keyCap`'s is: proving the bound holds
 * should not cost twenty thousand iterations per run.
 */
export function createIpCap(opts: { perDay?: number; maxTracked?: number } = {}): IpCap {
  const perDay = opts.perDay ?? TRIAL_PER_IP_PER_DAY;
  const maxTracked = opts.maxTracked ?? MAX_TRACKED;
  const hits = new Map<string, { day: number; n: number }>();

  const cap = (request: Request, now: number): boolean => {
    const caller = callerOf(request);
    const day = Math.floor(now / 86_400_000);

    if (hits.size > maxTracked) {
      // Stale days first, so a real caller counted this morning survives a probing
      // afternoon. A clear only happens if a single day genuinely held this many callers.
      //
      // FORGETTING OPENS THE BRAKE RATHER THAN CLOSING IT, deliberately and identically to
      // `keyCap`. Refusing everybody once the bookkeeping overflows would turn a probing
      // attack into an outage for the people who are not probing, which is worse than a
      // reset allowance on a counter that is explicitly a brake and not an accounting
      // system.
      for (const [at, seen] of hits) if (seen.day !== day) hits.delete(at);
      if (hits.size > maxTracked) hits.clear();
    }

    const seen = hits.get(caller);
    if (!seen || seen.day !== day) {
      hits.set(caller, { day, n: 1 });
      return false;
    }
    seen.n++;
    return seen.n > perDay;
  };

  cap.size = () => hits.size;
  return cap;
}
