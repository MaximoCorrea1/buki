import { describe, it, expect } from 'vitest';
import {
  LICENSE_UPSTREAM_MS,
  VISION_UPSTREAM_MS,
  boundedSignal,
  timedOut,
} from './upstreamTimeout';
import { TIMEOUT_MS as CLIENT_VISION_MS } from '../recognizer/llmVision';
import { EXCHANGE_TIMEOUT_MS as CLIENT_LICENSE_MS } from '../extension/license';

/**
 * R-6 / TM-13. `OPENWORK.md` item 51.
 *
 * **Neither edge function bounded its upstream call.** `visionHandler` passes
 * `request.signal`, which is abort PROPAGATION and not a timeout: it covers the case where
 * the caller gives up, and does nothing at all when nobody does. A hung provider then holds
 * the isolate open and goes on generating — and generating is what costs money.
 *
 * `licenseHandler` passed no signal of any kind, so a hung Polar held the request until the
 * platform killed it, with the customer watching a spinner.
 */

const aborted = (signal: AbortSignal): Promise<string> =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve((signal.reason as Error)?.name ?? 'aborted');
    signal.addEventListener('abort', () =>
      resolve((signal.reason as Error)?.name ?? 'aborted'),
    );
  });

describe('bounding an upstream call', () => {
  it('aborts on its own when nobody else does', async () => {
    // THE WHOLE POINT. `request.signal` covers "the caller gave up". This covers "nobody
    // did", which is the case that leaves a provider generating against a socket no one
    // is reading.
    const signal = boundedSignal(undefined, 5);
    expect(signal.aborted).toBe(false);
    expect(await aborted(signal)).toBe('TimeoutError');
  });

  it('still follows the caller, so a dismissed catch stops the provider', async () => {
    // The behaviour `visionHandler` already had must survive being composed with a
    // ceiling. Dismissing a card is what makes the × stop costing money.
    const caller = new AbortController();
    const signal = boundedSignal(caller.signal, 60_000);

    caller.abort(new Error('dismissed'));
    expect(await aborted(signal)).toBeTruthy();
    expect(signal.aborted).toBe(true);
  });

  it('is already aborted when the caller left before the fetch started', async () => {
    const caller = new AbortController();
    caller.abort(new Error('gone'));

    expect(boundedSignal(caller.signal, 60_000).aborted).toBe(true);
  });

  /**
   * THE RELATIONSHIP IS THE FINDING, not the numbers.
   *
   * A server ceiling ABOVE the client's does nothing: the client gives up first and the
   * server's bound never fires. A ceiling below it means the server aborts, answers a real
   * status, and the client learns *the provider was slow* instead of timing out into an
   * opaque failure of its own.
   *
   * Asserted against the client constants themselves rather than against copied numbers, so
   * moving either one is what goes red — the same class as the price guard, which reads the
   * store listing instead of a remembered figure.
   */
  it('sits under the client timeout it answers to, on both endpoints', () => {
    expect(VISION_UPSTREAM_MS).toBeLessThan(CLIENT_VISION_MS);
    expect(LICENSE_UPSTREAM_MS).toBeLessThan(CLIENT_LICENSE_MS);
  });

  it('tells a timeout apart from a failure to connect', () => {
    // The two are different incidents. "The provider is down" and "the provider is slow"
    // need different responses from whoever reads the alert, and the log said the first
    // under both.
    // THE NAME IS WHAT CARRIES IT, and that is deliberate rather than incidental: the two
    // errors that actually arrive here are named `TimeoutError` and `AbortError`, and a
    // name is stable across the edge runtime, undici and jsdom where a message is not.
    expect(timedOut(new DOMException('The operation timed out.', 'TimeoutError'))).toBe(true);
    expect(timedOut(new DOMException('This operation was aborted', 'AbortError'))).toBe(true);

    expect(timedOut(new TypeError('Failed to fetch'))).toBe(false);
    expect(timedOut(new Error('ECONNREFUSED'))).toBe(false);

    // ⚠ A KNOWN GAP, asserted so it is a decision rather than a surprise. The rule is
    // `/timeout|abort/i`, which is `llmVision.ts`'s and `openLibrary.ts`'s rule verbatim, and
    // "timed out" is not "timeout". No error that reaches this catch is spelled that way -
    // the name always is - and forking the regex here would give this repo two versions of
    // one rule, which is the exact drift `shared/retry.ts` was created to end.
    expect(timedOut(new Error('signal timed out'))).toBe(false);
  });

  it('does not throw on the things a catch block actually receives', () => {
    // A `catch` receives whatever was thrown, and that is not always an Error.
    expect(timedOut(undefined)).toBe(false);
    expect(timedOut(null)).toBe(false);
    expect(timedOut('timeout')).toBe(false);
    expect(timedOut({ name: 'TimeoutError' })).toBe(false);
  });

  it('leaves the client enough room to receive the answer', () => {
    // Under, but not so far under that a slow-but-fine provider is cut off. A full second
    // of headroom on each: enough for the response to cross back, small enough that the
    // ceiling still means something.
    expect(CLIENT_VISION_MS - VISION_UPSTREAM_MS).toBeGreaterThanOrEqual(1_000);
    expect(CLIENT_LICENSE_MS - LICENSE_UPSTREAM_MS).toBeGreaterThanOrEqual(1_000);
  });
});
