/**
 * What Buki costs, defined once.
 *
 * This is `host.ts` for money, and it exists for the same reason: the production host was
 * "defined once" and spelled out in seven files, and the plan that renamed it named three.
 * The price is worse placed than the host was. It appears in the landing's JSON-LD twice,
 * in the pricing card, in an aside above the fold, in `docs/pricing.md` — and, since
 * 2026-08-17, inside the extension itself on the wall, where a stale number stops being a
 * typo and becomes a false statement made to somebody who is about to pay.
 *
 * `pricing.test.ts` cannot inline these into a static page, so it does what
 * `host.test.ts` does: it finds every price by LOOKING and refuses any this file has not
 * declared.
 *
 * `docs/pricing.md` remains the human contract — what is in each tier, and why. This file
 * carries only the numbers, because only the numbers can drift silently.
 */

export const FREE_USD = 0;
export const PRO_MONTHLY_USD = 4;
export const PRO_YEARLY_USD = 29;

/**
 * The one sentence every surface quotes.
 *
 * Monthly first: it is the number that decides whether somebody clicks, and leading with
 * the annual figure to make it look cheaper is the kind of framing this product's voice
 * does not use.
 */
export function priceLine(): string {
  return `$${PRO_MONTHLY_USD} a month, or $${PRO_YEARLY_USD} a year`;
}

/**
 * The trial count in words, for prose.
 *
 * "ten" rather than "10": the wall is a sentence, and a numeral inside one reads as a
 * form field. The digit lives in `entitlement.TRIAL_CATCHES`, which is what the gate
 * enforces; `pricing.test.ts` holds the two to the same number so the sentence can never
 * promise a different trial from the one that runs.
 */
export const TRIAL_SPELLED = 'ten';
