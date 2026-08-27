import { describe, it, expect } from 'vitest';
import source from './inlineImage.ts?raw';
import {
  fitWithin,
  inlineAll,
  downloadSignal,
  MAX_EDGE,
  DOWNLOAD_TIMEOUT_MS,
  type ImagePrep,
} from './inlineImage';

describe('fitWithin', () => {
  it('leaves a picture already inside the limit alone', () => {
    // Never upscale: enlarging a small cover invents detail the model then tries to read.
    expect(fitWithin(600, 400, 1024)).toEqual({ width: 600, height: 400 });
  });

  it('brings the longest edge down to the limit and keeps the shape', () => {
    expect(fitWithin(2048, 1024, 1024)).toEqual({ width: 1024, height: 512 });
  });

  it('measures the longest edge, not the width', () => {
    // A photographed cover is usually portrait, and scaling by width would leave it
    // twice as tall as the budget allows.
    expect(fitWithin(1024, 2048, 1024)).toEqual({ width: 512, height: 1024 });
  });

  it('rounds to whole pixels', () => {
    expect(fitWithin(1000, 333, 500)).toEqual({ width: 500, height: 167 });
  });
});

describe('inlineAll', () => {
  it('hands over the bytes instead of a link to them', () => {
    // Measured 2026-08-04: a single 1200-token prompt returning 30 tokens with no
    // thinking took 13 seconds. That is not inference - it is the provider going out to
    // pbs.twimg.com to fetch the picture before it can start. We already have the
    // picture, on a connection the browser uses for the feed anyway.
    const prep: ImagePrep = { asDataUrl: async () => 'data:image/jpeg;base64,AAAA' };

    return expect(inlineAll(['https://pbs.twimg.com/media/A'], prep)).resolves.toEqual([
      'data:image/jpeg;base64,AAAA',
    ]);
  });

  it('sends the link when the picture cannot be read', async () => {
    // The provider can still fetch it itself - slowly, which is the whole reason this
    // module exists, but slowly beats not at all. A picture must never fail a catch.
    const prep: ImagePrep = {
      asDataUrl: async () => {
        throw new Error('offline');
      },
    };

    expect(await inlineAll(['https://pbs.twimg.com/media/A'], prep)).toEqual([
      'https://pbs.twimg.com/media/A',
    ]);
  });

  it('keeps the ones it could read when one of them fails', async () => {
    const prep: ImagePrep = {
      asDataUrl: async (url) => {
        if (url.endsWith('B')) throw new Error('offline');
        return `data:${url}`;
      },
    };

    expect(await inlineAll(['A', 'B', 'C'], prep)).toEqual(['data:A', 'B', 'data:C']);
  });

  it('reads the pictures at the same time, not one after another', async () => {
    // A post can carry four. Sequentially that is four round trips added to a catch that
    // is already the slowest thing the extension does.
    let inFlight = 0;
    let peak = 0;
    const prep: ImagePrep = {
      async asDataUrl(url) {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return `data:${url}`;
      },
    };

    await inlineAll(['A', 'B', 'C'], prep);

    expect(peak).toBe(3);
  });

  it('sends one tile, not four', () => {
    // Gemini bills an image in 768px tiles, so 768 is a cliff edge rather than a
    // preference: one pixel over and the same cover costs four tiles instead of one -
    // ~1030 image tokens, which is what was measured before this, and four times the
    // bytes to get onto a home connection's uplink.
    expect(MAX_EDGE).toBeLessThanOrEqual(768);
  });
});

/**
 * R-4. `OPENWORK.md` item 49. The download every catch blocks on had a signal and no ceiling.
 *
 * `livePrep` fetched with the catch's own signal, so cancelling reached it — and nothing
 * else did. A `pbs.twimg.com` that accepts the connection and never answers left the catch
 * waiting for as long as the reader was willing to look at "Reading the cover…", on a page
 * Buki does not own. Both siblings on this path are bounded: `openLibrary` at 6s,
 * `llmVision` at 12s. This one was not.
 *
 * The composition is named here rather than written inline in `livePrep`, which no test can
 * reach: it needs `createImageBitmap` and `OffscreenCanvas`, neither of which exists in node.
 */
describe('downloadSignal', () => {
  it('is an AbortSignal even when the catch supplies none', () => {
    // `asDataUrl` used `signal ? { signal } : {}` — no signal meant NO CEILING, which is
    // exactly the case a context-menu catch on a slow host lands in.
    expect(downloadSignal(undefined)).toBeInstanceOf(AbortSignal);
  });

  it('aborts when the catch is called off', () => {
    const job = new AbortController();
    const signal = downloadSignal(job.signal);
    expect(signal.aborted).toBe(false);
    job.abort();
    expect(signal.aborted, 'cancelling the catch no longer stops its download').toBe(true);
  });

  it('carries a ceiling of its own, so a hung host cannot wait for ever', async () => {
    // Proved by making the ceiling arrive, rather than by reading the source for a
    // constant: a guard that greps for `AbortSignal.timeout` is satisfied by the comment
    // explaining it. Uses a real short signal against the composition, not the shipped
    // value, because a test that waits ten seconds to pass is a test nobody runs.
    const composed = downloadSignal(undefined, 5);
    await new Promise((r) => setTimeout(r, 40));
    expect(composed.aborted, 'the composed signal has no ceiling in it').toBe(true);
  });

  it('keeps the ceiling even WHEN the catch supplied a signal, which is the composition', async () => {
    // THE MUTATION THAT SURVIVED. `return job ?? AbortSignal.timeout(ms)` passes every test
    // above: a supplied job still aborts it, and an absent one still gets a ceiling. What
    // no test asked was whether a catch that supplies a signal ALSO gets a ceiling - which
    // is every catch on the feed path, and therefore the whole of R-4.
    const job = new AbortController();
    const composed = downloadSignal(job.signal, 5);
    await new Promise((r) => setTimeout(r, 40));
    expect(job.signal.aborted, 'the job itself must not have aborted').toBe(false);
    expect(composed.aborted, 'a catch that can be cancelled has no ceiling').toBe(true);
  });

  it('has NO fetch in this module that skips the composition', () => {
    // `livePrep` needs `createImageBitmap` and `OffscreenCanvas`, neither of which exists
    // in node, so nothing inside it can be reached by a test - and a mutation putting the
    // unbounded `signal ? { signal } : {}` back SURVIVED. An absence proof is what is left:
    // there is one fetch here and it goes through `downloadSignal`. Comments stripped, or
    // the paragraph above explaining the rule satisfies the guard on it.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    const fetches = code.match(/[^.\w]fetch\(/g) ?? [];
    expect(fetches, 'inlineImage no longer fetches at all').toHaveLength(1);
    expect(code).toContain('fetch(url, { signal: downloadSignal(signal) })');
  });

  it('the shipped ceiling is a real number, and it is not zero', () => {
    // Pinned against a literal, separately. `expect(x).toBeLessThan(LIMIT)` where LIMIT is
    // the constant goes green when somebody raises the constant — §5 records that one.
    expect(DOWNLOAD_TIMEOUT_MS).toBe(10_000);
  });
});
