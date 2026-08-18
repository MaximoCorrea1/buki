/**
 * How often one licence key may ask, per day.
 *
 * `/api/vision` has always paired its Origin check with a per-IP cap. `/api/license` had
 * the Origin check and nothing else, which two reviewers raised independently: `Origin` is
 * a header any script sets, and the extension id is public the moment the item is listed.
 * Five forged requests with a leaked key exhaust a customer's five activation slots.
 *
 * IT IS A BRAKE, NOT AN ACCOUNTING SYSTEM, and saying so is not a disclaimer. The counter
 * is in memory and therefore per-isolate, so a caller spread across isolates gets more than
 * one allowance. What bounds real money is a provider-side spend cap; what bounds slot
 * exhaustion is Polar's own activation limit plus customer deactivation. This bounds the
 * casual and the accidental, which is most of what actually happens.
 *
 * A FACTORY rather than a module-level map, so a test gets a fresh counter and cannot leak
 * state into the next one. `api/license.ts` builds exactly one.
 */

/**
 * TWO CEILINGS, because the two branches cost different things and one number cannot bound
 * both.
 *
 * A legitimate `activate` is rare: once per install, and only while the extension holds no
 * activation id. A refused attempt creates nothing, and re-pasting a key already held
 * validates instead. So three a day is generous for anybody real and far below the five
 * slots a leaked key could otherwise be made to burn in one afternoon.
 *
 * `validate` creates nothing, so its ceiling is only about how much an oracle can be
 * probed. Renewal is once a day per install and a licence has five slots, so forty leaves
 * room for a bad network day without leaving the endpoint open.
 */
export const ACTIVATIONS_PER_KEY_PER_DAY = 3;
export const CHECKS_PER_KEY_PER_DAY = 40;

/**
 * How many keys one isolate will track before it starts forgetting.
 *
 * Bounded, unlike vision's IP counter. That one counts addresses, which real callers bound
 * for us; this one counts strings the CALLER chose, so a prober supplies fresh ones for
 * free and the map would grow without limit.
 */
const MAX_TRACKED = 10_000;

/**
 * A cheap digest, so the map holds no bearer credentials.
 *
 * Not a security control and not claimed as one: it only avoids parking a licence key in a
 * map for the life of the isolate, which is the same argument `visionHandler` already makes
 * about not forwarding the session token to the provider. FNV-1a, chosen because it is four
 * lines and synchronous — `crypto.subtle` is neither, and the cap has to answer before the
 * outbound fetch. A collision merely makes two keys share one allowance, which is a tighter
 * cap rather than a way past one.
 */
function digest(key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export interface KeyCap {
  (key: string, kind: 'activate' | 'validate', now: number): boolean;
  /** For the test that proves the map stays bounded. */
  size: () => number;
  /** For the test that proves no licence key is kept. */
  tracked: () => string[];
}

export function createKeyCap(opts: { maxTracked?: number } = {}): KeyCap {
  const maxTracked = opts.maxTracked ?? MAX_TRACKED;
  const hits = new Map<string, { day: number; n: number }>();

  const cap = (key: string, kind: 'activate' | 'validate', now: number): boolean => {
    const day = Math.floor(now / 86_400_000);

    if (hits.size > maxTracked) {
      // Stale days first, so a real customer counted this morning survives a probing
      // afternoon. A clear only happens if a single day genuinely held this many keys.
      //
      // FORGETTING OPENS THE BRAKE RATHER THAN CLOSING IT, deliberately. Refusing everybody
      // once the bookkeeping overflows would turn a probing attack into an outage for the
      // people who paid, which is a worse outcome than a reset allowance.
      for (const [at, seen] of hits) if (seen.day !== day) hits.delete(at);
      if (hits.size > maxTracked) hits.clear();
    }

    // The branch is part of the identity: spending an activation and checking one are
    // separate allowances, so a normal day of renewals cannot exhaust the tight one.
    const at = `${kind}:${digest(key)}`;
    const seen = hits.get(at);
    if (!seen || seen.day !== day) {
      hits.set(at, { day, n: 1 });
      return false;
    }
    seen.n++;
    return seen.n > (kind === 'activate' ? ACTIVATIONS_PER_KEY_PER_DAY : CHECKS_PER_KEY_PER_DAY);
  };

  cap.size = () => hits.size;
  cap.tracked = () => [...hits.keys()];
  return cap;
}
