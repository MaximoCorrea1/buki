import { describe, it, expect } from 'vitest';
import { fitWithin, inlineAll, MAX_EDGE, type ImagePrep } from './inlineImage';

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

  it('asks for a size the model can read without paying for four tiles', () => {
    // Gemini charges an image in 768px tiles. 2048px arrives as four of them - which is
    // the ~1030 image tokens measured on a single cover.
    expect(MAX_EDGE).toBeLessThanOrEqual(1024);
  });
});
