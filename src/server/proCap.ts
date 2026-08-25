/**
 * How many cover readings ONE LICENCE gets per day.
 *
 * The paid path had no brake of any kind. Both existing ones sit inside
 * `if (access.kind === 'trial')` at `visionHandler.ts:80`, under a comment saying that
 * stopping somebody who is paying is the worst possible place to save a hundredth of a
 * cent. **That reasoning is sound for a $0.00011 catch and stops being sound the moment the
 * caller can choose what a catch costs**, which is exactly what P0-1 was. Both halves are
 * fixed together on purpose: the pin bounds the price of a request, this bounds the number
 * of them.
 *
 * So a valid session token had no IP cap, no kill switch, no per-key cap and no Origin
 * check — `policy.test.ts:73` asserts the origin is deliberately not required when a token
 * is present. It is an 8-day bearer bound to no device and no IP, in a build that is
 * unminified on purpose with `PRO_KEY = 'buki-pro'` in plain text. Pay $4 once, read the
 * token out of `chrome.storage.local`, and share it.
 *
 * **The field this keys on was already computed and thrown away.** `decideAccess` returns
 * `licenseKeyId` — it is in the signed claim and always has been — and `handleVision` read
 * only `.kind`. There is no new plumbing here, only a value that stopped being discarded.
 *
 * A THIRD COUNTER, and that is a decision rather than drift. `ipCap` counts addresses that
 * real callers bound for us; `keyCap` counts strings a caller chooses and must therefore be
 * bounded; this counts a value that only exists inside a signed token. The 2026-08-24
 * review's clean bill #17 blessed the first two as justified duplication *because each
 * documents how and why it differs*. That is the bar this one is held to. **If a fourth
 * appears, extract a shared day-counter instead of writing this comment a fourth time.**
 */

/**
 * Generous to the point of being invisible, which the pricing page requires.
 *
 * "Unlimited, no throttling" is a sentence on `docs/pricing.md` and on the Pro card, so a
 * brake a customer can FEEL is a broken promise rather than a brake. `TRIAL_PER_IP_PER_DAY`
 * is 40 and is documented as sitting "well above what one person could legitimately do";
 * this is an order of magnitude above that again.
 *
 * What it bounds: with the model pinned by `visionBody.ts`, a catch costs about $0.000135,
 * so a leaked token is worth **about $0.07 a day** and about **$0.54** across the whole
 * 8-day life of a bearer that cannot be revoked. Against a $4/month subscription that is a
 * number worth naming and not worth engineering further.
 */
export const CATCHES_PER_LICENCE_PER_DAY = 500;

/**
 * How many licences one isolate tracks before it starts forgetting.
 *
 * Bounded like `keyCap`'s map rather than unbounded like `ipCap`'s. The realistic path here
 * is not a prober — minting a fresh `licenseKeyId` needs the signing secret — but an
 * unbounded map in a long-lived isolate is a bug whether or not anybody is aiming at it.
 */
const MAX_TRACKED = 10_000;

/**
 * A cheap digest, so the map holds no licence identifiers.
 *
 * Not a security control and not claimed as one, exactly as `keyCap.ts` says of its own:
 * it avoids parking an identifier in a map for the life of the isolate when nothing needs
 * the identifier itself. FNV-1a because it is four lines and synchronous, and the cap has
 * to answer before the outbound fetch. A collision merely makes two licences share one
 * allowance, which is a tighter cap rather than a way past one.
 */
function digest(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export interface ProCap {
  (licenseKeyId: string, now: number): boolean;
  /** For the test that proves the map stays bounded. */
  size: () => number;
  /** For the test that proves no licence id is kept. */
  tracked: () => string[];
}

export function createProCap(opts: { maxTracked?: number } = {}): ProCap {
  const maxTracked = opts.maxTracked ?? MAX_TRACKED;
  const hits = new Map<string, { day: number; n: number }>();

  const cap = (licenseKeyId: string, now: number): boolean => {
    const day = Math.floor(now / 86_400_000);

    if (hits.size > maxTracked) {
      // Stale days first, so a subscriber counted this morning survives a busy afternoon.
      // A clear only happens if a single day genuinely held this many licences.
      //
      // FORGETTING OPENS THE BRAKE RATHER THAN CLOSING IT, deliberately and for the same
      // reason `keyCap.ts` gives: refusing everybody once the bookkeeping overflows would
      // turn a bookkeeping problem into an outage for the people who paid, which is a
      // worse outcome than a reset allowance.
      for (const [at, seen] of hits) if (seen.day !== day) hits.delete(at);
      if (hits.size > maxTracked) hits.clear();
    }

    const at = digest(licenseKeyId);
    const seen = hits.get(at);
    if (!seen || seen.day !== day) {
      hits.set(at, { day, n: 1 });
      return false;
    }
    seen.n++;
    return seen.n > CATCHES_PER_LICENCE_PER_DAY;
  };

  cap.size = () => hits.size;
  cap.tracked = () => [...hits.keys()];
  return cap;
}

/**
 * Licences turned off out of band, from a comma-separated environment variable.
 *
 * THE ONLY REVOCATION LEVER IN A DESIGN WITH NO DATABASE, and that is why it is worth ten
 * lines. `token.ts` is stateless on purpose — the token IS the state — which buys a Polar
 * outage being invisible and nothing to migrate, back up or leak. The price is that a
 * leaked or refunded token keeps working for up to eight days and the only lever was
 * rotating `BUKI_TOKEN_SECRET`, which signs everybody out at once.
 *
 * `docs/store/launch.md` lists exactly three levers for when something goes wrong and every
 * one of them is all-or-nothing. This is the targeted one.
 *
 * UNSET IS THE NORMAL STATE, like `BUKI_TRIAL_CLOSED`, so it adds nothing to the six
 * variables that must be set at launch. An empty value revokes nothing — a parser that
 * turned `''` into a one-element list containing the empty string would revoke every token
 * whose claim failed to carry an id.
 */
export function parseRevoked(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}
