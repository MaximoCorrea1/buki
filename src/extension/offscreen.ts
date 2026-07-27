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
    }).catch((err: unknown) => {
      // A rejected promise is still truthy, so caching it would disable OCR for the
      // rest of the session. Clear it so the next attempt can retry.
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/** Shrink oversized images before OCR - a full-res photo costs far more for no gain. */
async function toRecognizable(blob: Blob): Promise<Blob | ImageBitmap> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = MAX_EDGE / Math.max(bitmap.width, bitmap.height);
    if (scale >= 1) return bitmap;

    const canvas = new OffscreenCanvas(
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
    );
    const ctx = canvas.getContext('2d');
    if (!ctx) return bitmap;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await canvas.convertToBlob();
  } catch {
    return blob; // decoding is best-effort; Tesseract can take the raw blob
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
