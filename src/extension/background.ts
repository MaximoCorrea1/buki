// Background service worker: the right-click flow.
// Right-click a book cover -> OCR (offscreen) -> ground-as-filter against OpenLibrary
// -> save the top match -> toast on the page.
import { createOpenLibraryClient } from '../recognizer/openLibrary';
import { recognizeFromOcrText } from '../recognizer/recognizeFromOcr';
import { createLibrary, type SavedSource, type StorageArea } from './storage';
import type { ContentRequest, ContentResponse, OffscreenRequest, OffscreenResponse } from './messages';

const MENU_ID = 'bookcatcher-save-image';

/** The only surfaces we can give feedback on - the content script lives here. */
const SUPPORTED_PAGES = ['https://twitter.com/*', 'https://x.com/*'];

const storage: StorageArea = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
};
const library = createLibrary({
  storage,
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
});
const books = createOpenLibraryClient({ fetch: (url: string) => fetch(url) });

chrome.runtime.onInstalled.addListener(() => {
  // removeAll first so a dev reload can't fail on a duplicate id.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: MENU_ID,
        title: 'Save book to shelf',
        contexts: ['image'],
        // Scoped deliberately: off these pages there is no content script, so a save
        // would run and mutate the shelf with no visible feedback at all.
        documentUrlPatterns: SUPPORTED_PAGES,
      },
      () => void chrome.runtime.lastError, // surface nothing; checking clears the warning
    );
  });
});

/** Shared in-flight creation - Chrome allows exactly one offscreen document. */
let creating: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  if (creating) return creating; // a concurrent right-click is already creating it

  creating = chrome.offscreen
    .createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Run Tesseract OCR on a book cover image.',
    })
    .finally(() => {
      creating = null;
    });
  await creating;
}

async function send<T extends OffscreenResponse>(req: OffscreenRequest): Promise<T | undefined> {
  try {
    return (await chrome.runtime.sendMessage(req)) as T;
  } catch {
    return undefined; // no listener yet
  }
}

/**
 * Wait until the offscreen document answers. Replaces a fixed 150ms sleep, which was a
 * guess at how long offscreen.html + the tesseract bundle take to parse - too short on
 * a cold start meant the very first right-click failed for no discoverable reason.
 */
async function waitForOffscreen(): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const pong = await send({ target: 'offscreen', type: 'ping' });
    if (pong?.ok) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Offscreen document never became ready');
}

async function ocrImage(srcUrl: string): Promise<string> {
  await ensureOffscreen();
  await waitForOffscreen();

  const resp = await send({ target: 'offscreen', type: 'ocr', srcUrl });
  if (!resp) throw new Error('No response from the OCR worker');
  if (!resp.ok) throw new Error(resp.error);
  return 'text' in resp ? resp.text : '';
}

async function tellTab<T>(tabId: number | undefined, msg: ContentRequest): Promise<T | undefined> {
  if (tabId == null) return undefined;
  try {
    return (await chrome.tabs.sendMessage(tabId, msg)) as T;
  } catch {
    return undefined; // content script not ready on this tab
  }
}

const toast = (tabId: number | undefined, text: string): Promise<unknown> =>
  tellTab(tabId, { type: 'toast', text });

/**
 * Resolve the permalink of the tweet holding this image. `info.pageUrl` is the tab's
 * URL (x.com/home), not the tweet - saving that would break "the tweet that sold you",
 * which is the whole point of keeping a source at all.
 */
async function resolveSource(
  tabId: number | undefined,
  info: chrome.contextMenus.OnClickData,
): Promise<SavedSource | undefined> {
  const resolved = await tellTab<ContentResponse>(tabId, {
    type: 'resolvePermalink',
    srcUrl: info.srcUrl ?? '',
  });
  if (resolved?.permalink) return { url: resolved.permalink, kind: 'tweet' };
  return info.pageUrl ? { url: info.pageUrl, kind: 'page' } : undefined;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl) return;
  const tabId = tab?.id;

  await toast(tabId, 'Reading the cover…');

  // Each stage reports its own failure: one catch-all blamed OCR for storage and
  // network errors alike, sending you off to retake a photo that was never the problem.
  let text: string;
  try {
    text = await ocrImage(info.srcUrl);
  } catch (err) {
    console.error('[BookCatcher] OCR failed', err);
    await toast(tabId, "Couldn't read that image.");
    return;
  }

  let candidates;
  try {
    candidates = await recognizeFromOcrText(text, books);
  } catch (err) {
    console.error('[BookCatcher] book lookup failed', err);
    await toast(tabId, 'Book lookup failed — try again in a moment.');
    return;
  }

  const book = candidates[0];
  if (!book) {
    await toast(tabId, "Couldn't match that cover to a book.");
    return;
  }

  try {
    const source = await resolveSource(tabId, info);
    await library.add(book, 'someday', source);
    await toast(tabId, `Saved: ${book.title} → someday`);
  } catch (err) {
    console.error('[BookCatcher] save failed', err);
    await toast(tabId, "Couldn't save to your shelf.");
  }
});
