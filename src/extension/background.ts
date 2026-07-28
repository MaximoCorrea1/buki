// Background service worker. Owns recognition for both flows, so the tweet button and
// the right-click menu resolve books exactly the same way - and so cross-origin calls
// happen where host_permissions apply, rather than from a content script.
import { createOpenLibraryClient } from '../recognizer/openLibrary';
import { createLlmVision } from '../recognizer/llmVision';
import { groundText } from '../recognizer/groundText';
import { recognizeBook } from '../recognizer/recognizer';
import type { Book, Tweet } from '../recognizer/types';
import { readSettings, toVisionConfig } from './settings';
import { createLibrary, type SavedSource, type StorageArea } from './storage';
import type { BackgroundRequest, BackgroundResponse, ContentRequest, TweetContext } from './messages';

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
const books = createOpenLibraryClient({ fetch: (url, init) => fetch(url, init) });

class NoKeyError extends Error {}

/** Settings are read per call, so a newly saved key takes effect without a reload. */
async function visionClient() {
  const settings = await readSettings();

  // A blank key is legitimate against a proxy holding its own credential, but against a
  // public provider it just means setup is unfinished - worth saying so rather than
  // firing a request that can only 401.
  const providerNeedsKey = /googleapis\.com|openai\.com|openrouter\.ai/.test(settings.endpoint);
  if (!settings.apiKey && providerNeedsKey) throw new NoKeyError('no key');

  return createLlmVision({
    fetch: (url, init) => fetch(url, init),
    config: toVisionConfig(settings),
  });
}

/**
 * Cheapest, highest-precision signal first: a retailer link resolves an ISBN outright,
 * then the cover and the post text go to the vision model together, and finally the
 * post text is grounded line by line.
 */
async function recognize(tweet: Tweet): Promise<Book[]> {
  const vision = await visionClient();
  const result = await recognizeBook(tweet, { vision, books });
  if (result.candidates.length) return result.candidates;
  return groundText(tweet.text, books);
}

chrome.runtime.onInstalled.addListener((details) => {
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
      () => void chrome.runtime.lastError,
    );
  });
  // Recognition needs a key, so say so once rather than failing silently on first use.
  if (details.reason === 'install') void chrome.runtime.openOptionsPage();
});

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

/** An in-progress stage - stays on screen until the next update replaces it. */
const progress = (tabId: number | undefined, text: string): Promise<unknown> =>
  tellTab(tabId, { type: 'toast', text, sticky: true });

function sourceFrom(ctx: TweetContext | undefined, pageUrl: string | undefined): SavedSource | undefined {
  // `pageUrl` is the tab's URL (x.com/home), not the tweet - saving that would break
  // "the tweet that sold you", which is the point of keeping a source at all.
  if (ctx?.permalink) return { url: ctx.permalink, kind: 'tweet' };
  return pageUrl ? { url: pageUrl, kind: 'page' } : undefined;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl) return;
  const tabId = tab?.id;

  await progress(tabId, 'Reading the cover…');

  // The post's words are the best hint for a hard-to-read cover, so pull the whole
  // tweet around the clicked image rather than sending the picture on its own.
  const ctx = await tellTab<TweetContext>(tabId, {
    type: 'tweetContextFor',
    srcUrl: info.srcUrl,
  });

  let candidates: Book[];
  try {
    candidates = await recognize({
      text: ctx?.text ?? '',
      imageUrls: [info.srcUrl],
      links: ctx?.links ?? [],
    });
  } catch (err) {
    if (err instanceof NoKeyError) {
      await toast(tabId, 'Add a recognition key in Book Catcher settings to read covers.');
      void chrome.runtime.openOptionsPage();
      return;
    }
    console.error('[BookCatcher] recognition failed', err);
    await toast(tabId, "Couldn't read that cover — try again in a moment.");
    return;
  }

  const book = candidates[0];
  if (!book) {
    await toast(tabId, "Couldn't match that cover to a book.");
    return;
  }

  try {
    await library.add(book, 'someday', sourceFrom(ctx, info.pageUrl));
    await toast(tabId, `Saved: ${book.title} → someday`);
  } catch (err) {
    console.error('[BookCatcher] save failed', err);
    await toast(tabId, "Couldn't save to your shelf.");
  }
});

// The tweet button asks the worker to recognize, so both flows share one pipeline and
// the cross-origin calls stay where host_permissions apply.
chrome.runtime.onMessage.addListener((msg: BackgroundRequest, _sender, sendResponse) => {
  if (msg?.type !== 'recognize') return;

  recognize(msg.tweet)
    .then((candidates) => sendResponse({ ok: true, candidates } satisfies BackgroundResponse))
    .catch((err: unknown) => {
      if (!(err instanceof NoKeyError)) console.error('[BookCatcher] recognition failed', err);
      sendResponse({
        ok: false,
        needsKey: err instanceof NoKeyError,
        error: String(err),
      } satisfies BackgroundResponse);
    });
  return true; // async response
});
