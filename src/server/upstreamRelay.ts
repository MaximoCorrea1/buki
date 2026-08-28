/**
 * What may cross back from the provider, and how much of it.
 *
 * AC-9 / TM-6. `OPENWORK.md` item 51. `/api/vision` relayed `await upstream.text()`
 * **verbatim, with no redaction and no length cap**, while `/api/license` had scrubbed and
 * truncated the same class of data since it was written:
 *
 *     detail.split(env.polarToken).join('[redacted]').slice(0, 300)
 *
 * **The endpoint holding the money-spending credential was the one without the scrub.** Two
 * sibling handlers, one rule, applied in one of them — which `OPENWORK.md` §5 already names
 * as a shape to go looking for: *when one handler has a guard, ask what the other one has.*
 *
 * Nothing exotic is being defended against. An API that quotes back what it received is
 * ordinary, and quoting an upstream body verbatim is a common way for a server to publish
 * the credential it just used.
 */

/**
 * The most a SUCCESS body may be.
 *
 * `MAX_OUTPUT_TOKENS` is 2,048, so an honest answer is on the order of 8KB of content plus
 * its envelope. This is roughly thirty times that: generous enough that no real answer meets
 * it, small enough that a broken or hostile provider cannot hand the extension a body it
 * will spend real time parsing.
 */
export const MAX_RELAY_BYTES = 256_000;

/**
 * The most an ERROR body may be.
 *
 * Errors are diagnostics, not data. `llmVision.explain` reads `error.message` and slices it
 * to 300 characters, so anything past a few thousand is unreadable by the only thing that
 * reads it — and this is still an order of magnitude above every real provider error.
 */
export const MAX_ERROR_CHARS = 4_000;

export type Relay = { ok: true; body: string } | { ok: false; message: string };

/**
 * Take our credential out of whatever came back, whatever came back.
 *
 * ⚠ **GUARDED ON AN EMPTY SECRET, and that is not defensive padding.**
 * `text.split('').join('[redacted]')` splits a string into single CHARACTERS and puts the
 * marker between every one of them. `licenseHandler` uses this same expression and is safe
 * only because it refuses to run at all with an empty credential — a check thirty lines
 * earlier, in a different function, that nothing ties to this line. That is safety by
 * distance, and it does not survive being copied.
 */
function scrub(text: string, secret: string): string {
  return secret ? text.split(secret).join('[redacted]') : text;
}

/**
 * The body to send back, or the reason there is not one.
 *
 * **AN OVERSIZED SUCCESS IS REFUSED RATHER THAN TRUNCATED**, and the reason is AC-6 sitting
 * next door: `llmVision` does `typeof raw !== 'string' → return []`, so a truncated success
 * body fails `JSON.parse` and becomes *no books found* — the reader is told the picture had
 * no book in it. Truncating here would manufacture the exact silent wrong answer this item
 * exists to remove. An error body is different: the client already falls back to the status
 * when it cannot parse one, so capping costs a sentence rather than the truth.
 */
export function relayBody(text: string, status: number, secret: string): Relay {
  const clean = scrub(text, secret);

  // Diagnostics. Capped, and the cap cannot cost more than a message the client was only
  // ever going to slice to 300 characters anyway.
  if (status >= 400) return { ok: true, body: clean.slice(0, MAX_ERROR_CHARS) };

  // BYTES, not characters. One emoji is four bytes and a `.length` of two, so a ceiling
  // counted in characters lets a body more than twice the intended size through.
  if (new TextEncoder().encode(clean).length > MAX_RELAY_BYTES) {
    return { ok: false, message: 'The reading service sent back more than Buki can read.' };
  }

  return { ok: true, body: clean };
}
