// Background service worker. Owns recognition for both flows, so the tweet button and
// the right-click menu resolve books exactly the same way - and so cross-origin calls
// happen where host_permissions apply, rather than from a content script.
//
// It is also the recognition log's ONLY writer. Every other context sends it a finished
// event. One writer means no cross-context race, and it means the right-click flow still
// records an attempt on a tab whose content script never loaded.
import { createOpenLibraryClient } from '../recognizer/openLibrary';
import { createLlmVision, VisionHttpError } from '../recognizer/llmVision';
import { recognizeBook } from '../recognizer/recognizer';
import type { RecognitionResult, Tweet } from '../recognizer/types';
import { readSettings, toVisionConfig } from './settings';
import { createLibrary, type SavedSource, type StorageArea } from './storage';
import { createRecognitionLog, type AttemptDraft, type PendingEvent } from './recognitionLog';
import { bestQuality } from './twitterImage';
import type { BackgroundRequest, BackgroundResponse, ContentRequest, TweetContext } from './messages';

const MENU_ID = 'shelfy-save-image';

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
const log = createRecognitionLog({ storage, now: () => Date.now() });
const books = createOpenLibraryClient({ fetch: (url, init) => fetch(url, init) });

class NoKeyError extends Error {}

/**
 * Would opening settings fix this? A missing key or a retired model will fail forever;
 * a rate limit or an outage will not. Saying "try again in a moment" to the first kind
 * sends people in circles - a retired model answered 404 on every retry for real.
 */
const needsSetup = (err: unknown): boolean =>
  err instanceof NoKeyError || (err instanceof VisionHttpError && err.permanent);

function setupMessage(err: unknown): string {
  if (err instanceof NoKeyError) {
    return 'Add a recognition key in Shelfy settings to read covers.';
  }
  // The provider's own words: it names the retired model, the revoked key, the bad
  // endpoint. Far more use than "something went wrong".
  return `Recognition needs setting up: ${err instanceof Error ? err.message : String(err)}`;
}

/** The shelf is the product; the log is diagnostics. A log failure never breaks a save. */
function note(event: PendingEvent): void {
  void log.record(event).catch((err) => console.error('[Shelfy] log write failed', err));
}

/**
 * A failed attempt is still a miss. Recording it keeps the rate honest - a log that only
 * sees lookups that completed reports a quality the extension doesn't have.
 */
function noteFailure(ms: number, flow: AttemptDraft['flow']): void {
  note({ ms, flow, source: 'none', confidence: 'low', outcome: 'no-match' });
}

/** Settings are read per call, so a newly saved key takes effect without a reload. */
async function visionClient() {
  const settings = await readSettings();

  // A blank key is legitimate against a proxy holding its own credential, but against a
  // public provider it just means setup is unfinished - worth saying so rather than
  // firing a request that can only 401.
  const providerNeedsKey = /googleapis\.com|openai\.com|openrouter\.ai/.test(settings.endpoint);
  if (!settings.apiKey && providerNeedsKey) throw new NoKeyError('no key');

  return {
    vision: createLlmVision({
      fetch: (url, init) => fetch(url, init),
      config: toVisionConfig(settings),
    }),
    // Carried out so the log can record which model produced the guess.
    model: settings.model,
  };
}

/**
 * The whole pipeline lives in `recognizeBook`; this only supplies the vision client,
 * which is the one dependency that needs the worker's settings and host permissions.
 */
async function recognize(tweet: Tweet): Promise<{ result: RecognitionResult; model: string }> {
  const { vision, model } = await visionClient();
  // Upgraded here rather than at either call site, so the button and the right-click menu
  // cannot drift apart on image quality - the whole reason recognition moved in here.
  const full: Tweet = { ...tweet, imageUrls: tweet.imageUrls.map(bestQuality) };
  return { result: await recognizeBook(full, { vision, books }), model };
}

/** The evidence half of an event, ready to be finished by whoever learns the outcome. */
function draftFrom(
  { result, model }: { result: RecognitionResult; model: string },
  ms: number,
  flow: AttemptDraft['flow'],
): AttemptDraft {
  const top = result.candidates[0];
  return {
    ms,
    flow,
    source: result.source,
    confidence: result.confidence,
    model,
    ...(top ? { guess: { title: top.title, author: top.author } } : {}),
  };
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

  const startedAt = Date.now();
  let recognized: { result: RecognitionResult; model: string };
  try {
    recognized = await recognize({
      text: ctx?.text ?? '',
      imageUrls: [info.srcUrl],
      links: ctx?.links ?? [],
    });
  } catch (err) {
    if (needsSetup(err)) {
      if (!(err instanceof NoKeyError)) console.error('[Shelfy] recognition failed', err);
      await toast(tabId, setupMessage(err));
      void chrome.runtime.openOptionsPage();
      return;
    }
    console.error('[Shelfy] recognition failed', err);
    noteFailure(Date.now() - startedAt, 'contextmenu');
    await toast(tabId, "Couldn't read that cover — try again in a moment.");
    return;
  }

  const { result } = recognized;
  const draft = draftFrom(recognized, Date.now() - startedAt, 'contextmenu');
  const book = result.candidates[0];

  if (!book) {
    note({ ...draft, outcome: 'no-match' });
    await toast(tabId, "Couldn't match that cover to a book.");
    return;
  }

  // Weak evidence asks instead of deciding. A confident wrong answer costs more than ten
  // misses, because it makes the whole shelf suspect.
  if (result.confidence !== 'high') {
    const shown = await tellTab<{ shown: boolean }>(tabId, {
      type: 'pick',
      candidates: result.candidates,
      srcUrl: info.srcUrl,
      permalink: ctx?.permalink ?? null,
      draft,
    });
    // The content script owns the outcome from here. If it never answered there is no
    // content script on this tab, so saving would mutate the shelf with zero feedback -
    // the exact thing the menu is scoped to x.com to avoid.
    if (!shown?.shown) note({ ...draft, outcome: 'dismissed' });
    return;
  }

  try {
    const saved = await library.add(book, 'someday', sourceFrom(ctx, info.pageUrl));
    note({ ...draft, outcome: 'auto-saved', savedId: saved.id });
    await toast(tabId, `Saved: ${book.title} → someday`);
  } catch (err) {
    console.error('[Shelfy] save failed', err);
    await toast(tabId, "Couldn't save to your shelf.");
  }
});

// The tweet button asks the worker to recognize, so both flows share one pipeline and
// the cross-origin calls stay where host_permissions apply.
chrome.runtime.onMessage.addListener((msg: BackgroundRequest, _sender, sendResponse) => {
  if (msg?.type === 'logEvent') {
    note(msg.event);
    sendResponse({ ok: true });
    return false;
  }

  if (msg?.type === 'markWrong') {
    void log.markWrong(msg.savedId).catch((err) => {
      console.error('[Shelfy] could not flag the match', err);
    });
    sendResponse({ ok: true });
    return false;
  }

  if (msg?.type === 'clearLog') {
    log
      .clear()
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) => {
        console.error('[Shelfy] could not clear the log', err);
        sendResponse({ ok: false });
      });
    return true; // async response
  }

  if (msg?.type !== 'recognize') return false;

  const startedAt = Date.now();
  recognize(msg.tweet)
    .then((recognized) =>
      sendResponse({
        ok: true,
        result: recognized.result,
        draft: draftFrom(recognized, Date.now() - startedAt, 'button'),
      } satisfies BackgroundResponse),
    )
    .catch((err: unknown) => {
      // Unfinished setup is not a miss - logging it would make the recognizer look bad
      // for something it was never given a chance to do.
      if (!(err instanceof NoKeyError)) console.error('[Shelfy] recognition failed', err);
      if (!needsSetup(err)) noteFailure(Date.now() - startedAt, 'button');

      sendResponse({
        ok: false,
        needsSetup: needsSetup(err),
        error: needsSetup(err) ? setupMessage(err) : String(err),
      } satisfies BackgroundResponse);
    });
  return true; // async response
});
