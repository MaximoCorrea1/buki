// Offscreen document: the one place in an MV3 extension that can spawn the Web Worker
// Tesseract needs. The background service worker can't (no nested workers), so it
// delegates OCR here. Tesseract's WASM + language data load from locally packaged
// files (extensions can't pull them from a CDN).
import { createWorker } from 'tesseract.js';
import { isOffscreenRequest, type OffscreenResponse } from './messages';

/** OCR cost scales with pixel count; cover text needs nothing beyond this. */
const MAX_EDGE = 1400;

let workerPromise: ReturnType<typeof createWorker> | null = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      workerPath: chrome.runtime.getURL('dist/tesseract/worker.min.js'),
      corePath: chrome.runtime.getURL('dist/tesseract/'),
      langPath: chrome.runtime.getURL('dist/tesseract/'),
      // REQUIRED in an extension - do not remove.
      // tesseract.js defaults this to true, which spawns the worker from a blob: URL
      // whose body is `importScripts("chrome-extension://.../worker.min.js")`. A blob
      // worker has an opaque origin, so Chrome refuses that cross-origin import and
      // every OCR call dies with "Failed to execute 'importScripts'". false takes
      // spawnWorker's other branch, `new Worker(workerPath)`, which is same-origin
      // with this offscreen document.
      workerBlobURL: false,
    }).catch((err: unknown) => {
      // A rejected promise is still truthy, so caching it would disable OCR for the
      // rest of the session. Clear it so the next attempt can retry.
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/**
 * Shrink oversized images before OCR - a full-res photo costs far more for no gain.
 *
 * The return type is `Blob` and must stay that way. tesseract.js's loadImage accepts
 * only string | HTMLElement | OffscreenCanvas | File | Blob; anything else falls
 * through to `new Uint8Array(value)`, producing garbage bytes that surface as
 * Leptonica's "truncated file / Unknown format: no pix returned". Handing it an
 * ImageBitmap is exactly what broke OCR on first run, so let the compiler forbid it.
 */
async function toRecognizable(blob: Blob): Promise<Blob> {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(blob);
    const scale = MAX_EDGE / Math.max(bitmap.width, bitmap.height);
    if (scale >= 1) return blob; // already small enough - hand back the original

    const canvas = new OffscreenCanvas(
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
    );
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await canvas.convertToBlob();
  } catch {
    return blob; // resizing is best-effort; Tesseract can take the raw blob
  } finally {
    bitmap?.close();
  }
}

async function ocr(srcUrl: string): Promise<string> {
  const res = await fetch(srcUrl, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Image fetch failed (HTTP ${res.status})`);

  const image = await toRecognizable(await res.blob());
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  return data.text;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!isOffscreenRequest(msg)) return;

  const respond = (r: OffscreenResponse): void => sendResponse(r);

  if (msg.type === 'ping') {
    respond({ ok: true, ready: true });
    return true;
  }

  ocr(msg.srcUrl)
    .then((text) => respond({ ok: true, text }))
    .catch((err: unknown) => respond({ ok: false, error: String(err) }));
  return true; // keep the message channel open for the async response
});
