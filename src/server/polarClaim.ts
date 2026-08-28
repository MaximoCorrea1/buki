/**
 * Reading a claim out of Polar's answer, and refusing to guess when it does not fit.
 *
 * AC-10. `OPENWORK.md` item 51. The answer used to be CAST rather than validated:
 *
 *     licenseKeyId: (parsed as PolarActivation).license_key?.id,
 *     status:       (parsed as PolarActivation).license_key?.status,
 *
 * **A cast checks nothing at runtime.** A well-formed JSON body with different keys gives
 * `status === undefined`, which is not `'granted'`, which is a 403 — *"That licence is not
 * active"* — to a subscriber whose licence is fine. The honest 502 was reachable only on
 * MALFORMED JSON, which is the one failure mode a large API almost never has.
 *
 * ⚠ **AND `licenseHandler.ts` ALREADY KNEW.** `PolarValidation`'s docblock says it out loud:
 * *"Read one as the other and `status` is `undefined`, so every renewal 403s with 'That
 * licence is not active' and looks exactly like a revoked subscription."* It was written as
 * a reason to be careful with the two shapes rather than as a reason to CHECK them, and a
 * warning is not a guard. Same family as `ipCap`'s eviction comment, which explained at
 * length why the hole beneath it was fine.
 *
 * **WHY THE STATUS CODE IS THE WHOLE FINDING.** 403 is not in `worthRetrying`, so the
 * extension throws its session away and the customer meets the wall they paid to pass. 502
 * is, so they keep it and ride the grace window. That one number decides whether a bad
 * minute upstream is invisible or a lockout — which is precisely the lesson `shared/retry.ts`
 * was written to record.
 */

/** What both Polar shapes are normalised to, so one branch decides downstream. */
export interface PolarClaim {
  licenseKeyId: string;
  activationId: string;
  status: string;
}

const text = (v: unknown): v is string => typeof v === 'string' && v !== '';

const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The claim, or `null` when the body is not one Buki can read.
 *
 * `null` means **502, not 403** — our upstream failed its own contract, which is not an
 * answer about this customer's licence. A valid shape carrying a BAD status still reads
 * fine and returns; deciding whether `'revoked'` is acceptable belongs to the caller.
 * Collapsing those two is what made an outage look like a cancellation.
 *
 * ⚠ **THE TWO SHAPES ARE INVERTED, and that is the trap this function exists for:**
 *
 *     activate   { id: <activation>,  license_key: { id: <key>, status } }
 *     validate   { id: <key>, status, activation: { id: <activation> } }
 */
export function readClaim(
  parsed: unknown,
  renewing: boolean,
  sentActivationId: string,
): PolarClaim | null {
  if (!object(parsed)) return null;

  if (renewing) {
    const activation = parsed['activation'];
    // The id we SENT is the fallback, and it is what makes renewal safe: `validate` is not
    // obliged to echo the activation back, and a renewal always carries one by construction
    // (`renewing` is `Boolean(activationId)`).
    const activationId = object(activation) && text(activation['id'])
      ? activation['id']
      : sentActivationId;

    if (!text(parsed['id']) || !text(parsed['status']) || !text(activationId)) return null;
    return { licenseKeyId: parsed['id'], activationId, status: parsed['status'] };
  }

  const key = parsed['license_key'];
  if (!object(key)) return null;

  // NO FALLBACK ON THIS PATH, deliberately: there is no prior id to fall back TO. A missing
  // one used to become `undefined`, which does not survive `JSON.stringify` — it vanished
  // from the signed claim, the client's `?? ''` yielded `''`, and THE NEXT RENEWAL
  // ACTIVATED AGAIN. Five permanent slots, renewal daily: locked out inside a week, out of
  // a resource only the Polar dashboard can free. Item 48, ADV-3.
  if (!text(parsed['id']) || !text(key['id']) || !text(key['status'])) return null;
  return { licenseKeyId: key['id'], activationId: parsed['id'], status: key['status'] };
}
