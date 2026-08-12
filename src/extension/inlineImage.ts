/**
 * Hand the model the picture, not a link to it.
 *
 * Measured on 2026-08-04, four consecutive catches: a 1,200-token prompt returning ~30
 * tokens, with `reasoning 0`, took 12.1s / 13.4s / 13.6s / 14.0s. No thinking, nothing to
 * generate, a tiny context - and stable, so not queueing either. That time is the
 * provider going out to `pbs.twimg.com` to collect the image before it can begin.
 *
 * We already have the image. It is on the CDN the feed is already talking to, from a
 * browser that is already authenticated to it, and the fetch happens on the user's own
 * connection rather than between two datacenters that may not like each other. So fetch
 * it here, shrink it to something a cover is still legible in, and send the bytes.
 *
 * The shrink is not incidental. Gemini charges an image in 768px tiles, so a 2048px photo
 * arrives as four of them - which is exactly the ~1,030 image tokens measured above. Less
 * to upload, fewer tokens to read, one less service that has to be reachable.
 */

/**
 * Longest edge, in pixels, of what the model is shown.
 *
 * 768 is a cliff edge, not a preference: Gemini bills an image in 768px tiles, so one
 * pixel over and the same cover costs FOUR tiles - about 1,030 image tokens, and four
 * times the bytes to push up a home connection's uplink. Still above the feed's own 680px
 * render, which is the downscale that actually costs cover legibility.
 */
export const MAX_EDGE = 768;

/** JPEG quality. Cover lettering survives this; the artefacts land in the background. */
export const QUALITY = 0.82;

export interface ImagePrep {
  /** The picture as a data URL, no larger than `maxEdge` on its longest side. */
  asDataUrl(url: string, maxEdge: number): Promise<string>;
}

/** Fit inside a square of `max`, keeping the shape. Never upscales. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Every picture, together, each one allowed to fail on its own.
 *
 * A picture we cannot read falls back to its URL: the provider will fetch it itself,
 * slowly, which is the whole reason this exists - but slowly beats not at all, and a
 * picture must never be able to fail a catch.
 */
export async function inlineAll(
  urls: string[],
  prep: ImagePrep,
  maxEdge: number = MAX_EDGE,
): Promise<string[]> {
  return Promise.all(
    urls.map(async (url) => {
      try {
        return await prep.asDataUrl(url, maxEdge);
      } catch (err) {
        console.error('[Buki] could not inline a picture; sending the link instead', err);
        return url;
      }
    }),
  );
}

/**
 * Base64 without blowing the argument limit.
 *
 * `String.fromCharCode(...bytes)` is the obvious spelling and throws on any real photo -
 * a hundred thousand arguments is well past what a call frame will take.
 */
async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * The real thing. `createImageBitmap` and `OffscreenCanvas` both exist in an MV3 service
 * worker, which is the only reason this can live where recognition already does.
 *
 * `signal` is the catch's own, so calling a lookup off stops its downloads too.
 */
export const livePrep = (signal?: AbortSignal): ImagePrep => ({
  async asDataUrl(url, maxEdge) {
    const res = await fetch(url, signal ? { signal } : {});
    if (!res.ok) throw new Error(`picture request failed (HTTP ${res.status})`);

    const bitmap = await createImageBitmap(await res.blob());
    try {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context in this worker');
      ctx.drawImage(bitmap, 0, 0, width, height);
      const shrunk = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
      // The dimensions actually sent, so the provider's prompt-token count can be checked
      // against them: Gemini bills 258 tokens per 768px tile, so anything at or under
      // 768x768 must come back as one tile. A token count that says four means this line
      // and that one disagree, and one of them is lying.
      //
      // It says "kept" when nothing was resized. A picture already inside MAX_EDGE is the
      // common case off X, where a page often shows a thumbnail, and printing
      // "shrank 306x359 → 306x359" made a no-op look like work and hid the fact that the
      // model was handed a small original.
      const resized = width !== bitmap.width || height !== bitmap.height;
      console.info(
        resized
          ? `[Buki] shrank ${bitmap.width}x${bitmap.height} → ${width}x${height} · ` +
              `${Math.round(shrunk.size / 1024)}KB`
          : `[Buki] kept ${width}x${height} · ${Math.round(shrunk.size / 1024)}KB`,
      );
      return `data:image/jpeg;base64,${await base64(shrunk)}`;
    } finally {
      bitmap.close(); // decoded bitmaps are not small, and the worker may live a while
    }
  },
});
