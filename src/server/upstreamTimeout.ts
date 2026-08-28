/**
 * How long either edge function will wait on the service behind it.
 *
 * R-6 / TM-13. `OPENWORK.md` item 51. **Neither one bounded its upstream call.**
 *
 * `visionHandler` passed `request.signal`, and that is abort PROPAGATION rather than a
 * timeout — it covers the case where the caller gives up and does nothing at all when
 * nobody does. That distinction is not academic here: the reason the signal was added was
 * that a dismissed card left Gemini generating and billing, so "the provider keeps working
 * against a socket nobody is reading" is a failure this endpoint has ALREADY had once, and
 * the fix only closed the half where somebody pressed the ×.
 *
 * `licenseHandler` passed no signal of any kind, so a hung Polar held the request until the
 * platform killed it with a customer watching a spinner.
 *
 * ⚠ **THE CEILINGS ARE CHOSEN RELATIVE TO THE CLIENT'S, and the relationship is the whole
 * design.** A server ceiling ABOVE the client's does nothing — the client gives up first
 * and the server's bound never fires. Below it, the server aborts, answers a real status,
 * and the client learns *the provider was slow* instead of timing out into a failure of its
 * own with nothing to report. `upstreamTimeout.test.ts` asserts both against the client
 * constants themselves rather than against copied numbers, so moving either is what goes
 * red.
 */

/** Under `llmVision.ts`'s `TIMEOUT_MS` (12s), with a second of room to answer. */
export const VISION_UPSTREAM_MS = 10_000;

/** Under `license.ts`'s `EXCHANGE_TIMEOUT_MS` (8s), with a second of room to answer. */
export const LICENSE_UPSTREAM_MS = 6_000;

/**
 * The caller's signal AND a ceiling, whichever fires first.
 *
 * Composed rather than chosen, because the two answer different questions and dropping
 * either one loses a real case: without the caller's signal a dismissed catch goes on being
 * billed, and without the ceiling a hung provider is unbounded. Same shape as
 * `inlineImage.ts`'s `downloadSignal`, which is where this pattern already lives.
 */
export function boundedSignal(caller: AbortSignal | undefined, ms: number): AbortSignal {
  const ceiling = AbortSignal.timeout(ms);
  return caller ? AbortSignal.any([caller, ceiling]) : ceiling;
}

/**
 * Did this call run out of time, as opposed to failing to connect?
 *
 * **The status does not change either way** — both are 5xx and `worthRetrying` says yes to
 * both, so the client behaves identically and no contract moves. What changes is what gets
 * SAID, in the log and to the reader, and the two are different incidents: *"the provider is
 * down"* and *"the provider is slow"* need different responses from whoever is on the other
 * end of the alert, and `[buki] provider unreachable` printed under a `TimeoutError` answers
 * the first question wrongly.
 *
 * Matched on the same two words `llmVision.ts` and `openLibrary.ts` already match on, rather
 * than on `instanceof DOMException`: the shape differs between the edge runtime, undici and
 * jsdom, and a check that is right in one of the three is a check that lies in the other two.
 */
export function timedOut(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /timeout|abort/i.test(`${err.name} ${err.message}`);
}
