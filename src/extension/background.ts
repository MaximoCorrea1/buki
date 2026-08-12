// Background service worker. Owns recognition for both flows, so the tweet button and
// the right-click menu resolve books exactly the same way - and so cross-origin calls
// happen where host_permissions apply, rather than from a content script.
//
// It is also the recognition log's ONLY writer. Every other context sends it a finished
// event. One writer means no cross-context race, and it means the right-click flow still
// records an attempt on a tab whose content script never loaded.
import { createOpenLibraryClient } from '../recognizer/openLibrary';
import { createLlmVision, MAX_IMAGES, VisionHttpError } from '../recognizer/llmVision';
import { recognizeBook } from '../recognizer/recognizer';
import type { FetchLike, RecognitionResult, Tweet, VisionClient } from '../recognizer/types';
import { readSettings, toVisionConfig, type Settings } from './settings';
import { createLibrary, identityOf, type StorageArea } from './storage';
import { sameBook } from './bookIdentity';
import { createRecognitionLog, type AttemptDraft, type PendingEvent } from './recognitionLog';
import { bestQuality, distinctMedia } from './twitterImage';
import { inlineAll, livePrep } from './inlineImage';
import { createBreaker, withBreaker } from './breaker';
import { rememberCover, liveCoverDeps } from './coverCache';
import { withSignal } from './cancellable';
import { createLookupMemo, postKey } from './lookupMemo';
import { originPatternFor } from './imageOrigin';
import type {
  BackgroundRequest,
  BackgroundResponse,
  ContentRequest,
  ShelfResponse,
  Shelved,
  TweetContext,
} from './messages';

const MENU_ID = 'buki-save-image';

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

/**
 * One controller per in-flight recognition, so the page can call one off by name. Entries
 * are cleared in a `finally`, which aborts the controller - that is also what stops a
 * finished catch's still-running sibling requests, since `groundText` fires several
 * OpenLibrary queries at once and only the first to ground is used.
 */
const running = new Map<string, AbortController>();

/**
 * One recognition per post, shared by BOTH flows.
 *
 * The memo used to live in the content script, so the right-click menu never saw it:
 * reading the same cover ten times paid for ten vision calls and ten sets of OpenLibrary
 * queries. Recognition is the worker's job, so the memory of it belongs here too - and a
 * cover one flow has already read is now free to the other.
 */
const lookups = createLookupMemo<{ result: RecognitionResult; model: string }>({
  now: () => Date.now(),
});

/**
 * One breaker for the books catalogue, shared by every catch this worker handles.
 *
 * Deliberately not persisted: Chrome tears the worker down after ~30s idle, so it resets
 * itself constantly. That is the right lifetime - it saves the six seconds within a burst
 * of catches, which is where the waiting was actually felt, and a fresh worker always
 * re-probes rather than inheriting a verdict about a service that may have recovered.
 */
const catalogue = createBreaker({ now: () => Date.now() });

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
    return 'Add a recognition key in Buki settings to read covers.';
  }
  // The provider's own words: it names the retired model, the revoked key, the bad
  // endpoint. Far more use than "something went wrong".
  return `Recognition needs setting up: ${err instanceof Error ? err.message : String(err)}`;
}

/** The shelf is the product; the log is diagnostics. A log failure never breaks a save. */
function note(event: PendingEvent): void {
  void log.record(event).catch((err) => console.error('[Buki] log write failed', err));
}

/**
 * A failed attempt is still a miss. Recording it keeps the rate honest - a log that only
 * sees lookups that completed reports a quality the extension doesn't have.
 */
function noteFailure(ms: number, flow: AttemptDraft['flow']): void {
  note({ ms, flow, source: 'none', confidence: 'low', outcome: 'no-match' });
}

function visionFor(settings: Settings, net: FetchLike) {
  // A blank key is legitimate against a proxy holding its own credential, but against a
  // public provider it just means setup is unfinished - worth saying so rather than
  // firing a request that can only 401.
  const providerNeedsKey = /googleapis\.com|openai\.com|openrouter\.ai/.test(settings.endpoint);
  if (!settings.apiKey && providerNeedsKey) throw new NoKeyError('no key');

  return createLlmVision({ fetch: net, config: toVisionConfig(settings) });
}

/**
 * The whole pipeline lives in `recognizeBook`; this only supplies the vision client,
 * which is the one dependency that needs the worker's settings and host permissions.
 *
 * The client is built LAZILY, and a missing key is swallowed until the end. Building it
 * up front made the key mandatory for every recognition, including the ones that never
 * need it: a post carrying a retailer link still resolves for free, and so does grounding
 * the post's own words when the card asks for it. Three separate documents promised those
 * worked without a key, and none of them did.
 *
 * So: no key means no cover reading, exactly as advertised. The prompt to set one up
 * appears only when nothing else found the book.
 */
async function recognize(
  tweet: Tweet,
  job: string,
  opts: { fromText?: boolean } = {},
): Promise<{ result: RecognitionResult; model: string }> {
  const settings = await readSettings(); // read per call, so a new key needs no reload
  let keyWasMissing = false;

  // Every request this catch makes goes through one signal, so calling it off reaches the
  // vision model AND the OpenLibrary queries. Wrapping fetch rather than threading a
  // signal through BooksDb and VisionClient is why neither interface had to change.
  const control = new AbortController();
  running.set(job, control);
  const net = withSignal((url, init) => fetch(url, init), control.signal);

  // Which stage a slow catch is actually spending its time in. Without this, "it takes
  // too long" is one number for a pipeline with two external services in it, and the
  // wrong one gets tuned.
  const startedAt = Date.now();
  let visionMs = 0;

  const vision: VisionClient = {
    async guessBooks(input) {
      const at = Date.now();
      try {
        return await visionFor(settings, net).guessBooks(input);
      } catch (err) {
        if (!(err instanceof NoKeyError)) throw err;
        keyWasMissing = true;
        return []; // fall through to the retailer link, which needs no key
      } finally {
        visionMs = Date.now() - at;
      }
    },
  };

  // Deduped, capped, upgraded, then INLINED - here rather than at either call site, so
  // the button and the right-click menu cannot drift apart on what the model is shown,
  // which is the whole reason recognition moved into the worker.
  //
  // Capped BEFORE fetching: there is no point paying to download a fifth picture that
  // llmVision would slice off before sending anyway.
  const picked = distinctMedia(tweet.imageUrls).slice(0, MAX_IMAGES).map(bestQuality);
  const pickedAt = Date.now();
  const full: Tweet = { ...tweet, imageUrls: await inlineAll(picked, livePrep(control.signal)) };
  const imagesMs = Date.now() - pickedAt;

  let outcome = 'failed';
  try {
    const result = await recognizeBook(
      full,
      { vision, books: withBreaker(createOpenLibraryClient({ fetch: net }), catalogue) },
      opts,
    );
    outcome = result.source;

    if (keyWasMissing && !result.candidates.length) throw new NoKeyError('no key');
    return { result, model: settings.model };
  } finally {
    // In `finally`, because the run that most needs explaining is the one that FAILED.
    // This lived after a successful recognizeBook, so six timed-out catches in a row
    // reported nothing whatsoever about where their time had gone.
    //
    // `inlined` cannot be checked offline - OffscreenCanvas encoding exists only in a
    // real worker - so it is the claim testing itself. `KB up` is what this machine now
    // pushes up its own uplink: the cost that MOVED here when we stopped handing the
    // provider a link and started handing it the bytes.
    const inlined = full.imageUrls.filter((url) => url.startsWith('data:')).length;
    const kb = Math.round(full.imageUrls.reduce((n, url) => n + url.length, 0) / 1024);
    console.info(
      `[Buki] ${full.imageUrls.length} image(s) · inlined ${inlined}/${full.imageUrls.length}` +
        ` · ${kb}KB up · ours ${imagesMs}ms · vision ${visionMs}ms` +
        ` · grounding ${Date.now() - startedAt - visionMs - imagesMs}ms · ${outcome}`,
    );
    // Resolved, failed or cancelled: nothing for this catch should still be on the wire.
    control.abort();
    running.delete(job);
  }
}

/**
 * Recognition, but never twice for the same post.
 *
 * `job` is the post key, so cancelling a catch and forgetting its memo are the same
 * lookup by the same name - which is why `cancelRecognize` below can drop the memory
 * without being told anything except which catch was called off.
 */
function lookUp(
  tweet: Tweet,
  job: string,
  opts: { fromText?: boolean } = {},
): Promise<{ result: RecognitionResult; model: string }> {
  // Asking for the post's WORDS is a different question about the same post, so it must
  // not be answered out of the memo with the cover-only result that came back first.
  return lookups.run(opts.fromText ? `words:${job}` : job, () => recognize(tweet, job, opts));
}

/**
 * Which of these the shelf already holds, and in which pile. Never throws: an unreadable
 * shelf should cost a marker on the card, not the whole recognition.
 */
async function shelvedAmong(candidates: { title: string; author: string; isbn?: string }[]) {
  try {
    // sameBook against the shelf, not a key lookup: a matching ISBN counts even when the
    // two records spell the title differently. The identity is then returned in the work
    // key's form, which is what the page compares against.
    const shelf = await library.list();
    return candidates.flatMap((c) => {
      const held = shelf.find((s) => sameBook(s.book, c));
      return held ? [{ identity: identityOf(c), intent: held.intent } satisfies Shelved] : [];
    });
  } catch (err) {
    console.error('[Buki] could not check the shelf', err);
    return [];
  }
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
        // Every image on the web, deliberately. This used to be scoped to X because off
        // it there is no content script, so a save would mutate the shelf with nothing on
        // screen to say so. That was a FEEDBACK problem, not a recognition one: the
        // recogniser never cared what site it was on. The worker now puts a tray on the
        // tab before it starts, so the feedback follows the catch anywhere.
      },
      () => void chrome.runtime.lastError,
    );
  });
  // Recognition needs a key, so say so rather than failing silently on first use. Also
  // on update: someone who installed before cover reading existed has never seen this,
  // and would otherwise meet it as an error message.
  if (details.reason === 'install') {
    void chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    void readSettings().then((s) => {
      if (!s.apiKey) void chrome.runtime.openOptionsPage();
    });
  }
});

async function tellTab<T>(tabId: number | undefined, msg: ContentRequest): Promise<T | undefined> {
  if (tabId == null) return undefined;
  try {
    return (await chrome.tabs.sendMessage(tabId, msg)) as T;
  } catch {
    return undefined; // content script not ready on this tab
  }
}

/**
 * Put a tray on this tab, wherever it is.
 *
 * A context-menu click is a user gesture, and a user gesture grants `activeTab`, which is
 * exactly enough to inject here without asking for host access at install. Returns false
 * when there is nowhere to inject, which is the normal answer on a chrome:// page or the
 * Web Store: those tabs are closed to every extension and the catch simply does not start.
 */
async function ensureTray(tabId: number | undefined): Promise<boolean> {
  if (tabId == null) return false;
  // Cheapest possible probe. X already has a tray from the manifest, and injecting a
  // second one would leave that tab with two listeners answering the same messages.
  const alive = await tellTab<{ ok: true }>(tabId, { type: 'ping' });
  if (alive) return true;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['dist/content.js'] });
    return true;
  } catch (err) {
    console.error('[Buki] could not put a tray on this page', err);
    return false;
  }
}

/**
 * Ask for the one origin this catch needs, if it needs one.
 *
 * MUST be the first await in the click handler. `permissions.request` requires the user
 * gesture from the click, and awaiting anything else first can consume it. It is also
 * called WITHOUT a `permissions.contains` check in front of it, for the same reason: an
 * already-granted origin resolves true with no prompt, so the check would buy nothing and
 * cost the gesture.
 *
 * A rejection is not a refusal. `false` means the user said no, so the catch stops. A
 * throw means the pattern was unusable, and then the honest move is to carry on and let
 * the fetch succeed or fail visibly rather than silently doing nothing.
 */
async function mayFetch(srcUrl: string): Promise<boolean> {
  const origin = originPatternFor(srcUrl);
  if (origin === null) return true; // nothing to ask for; see originPatternFor
  try {
    return await chrome.permissions.request({ origins: [origin] });
  } catch (err) {
    console.error('[Buki] could not ask for', origin, err);
    return true;
  }
}

/** Put a card up for this catch on the tab that started it. */
const openCard = (
  tabId: number | undefined,
  job: string,
  text: string,
  image?: string,
): Promise<unknown> => tellTab(tabId, { type: 'catchOpen', job, text, ...(image ? { image } : {}) });

/** End a catch that never reached a book. Its card says why, then leaves on its own. */
const failCard = (tabId: number | undefined, job: string, text: string): Promise<unknown> =>
  tellTab(tabId, { type: 'catchFail', job, text });

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl) return;
  const tabId = tab?.id;

  // Order is load-bearing. The permission ask goes first because it needs the click's
  // user gesture and every await erodes it. The tray goes second so that anything after
  // this point has somewhere to report to.
  if (!(await mayFetch(info.srcUrl))) return; // declined, and a card would have nowhere to go
  if (!(await ensureTray(tabId))) return; // a page no extension may touch

  // The post's words are the best hint for a hard-to-read cover, so pull the whole tweet
  // around the clicked image rather than sending the picture on its own.
  //
  // Fetched BEFORE the card opens because the post is what NAMES the catch: two
  // right-clicks on one cover have to arrive at the same job, or they are two lookups
  // and two cards for one book. The round trip is to the same tab and costs nothing.
  const ctx = await tellTab<TweetContext>(tabId, {
    type: 'tweetContextFor',
    srcUrl: info.srcUrl,
  });
  const tweet: Tweet = {
    text: ctx?.text ?? '',
    imageUrls: [info.srcUrl],
    links: ctx?.links ?? [],
  };
  const job = postKey(tweet);

  await openCard(tabId, job, 'Reading the cover…', info.srcUrl);

  const startedAt = Date.now();
  let recognized: { result: RecognitionResult; model: string };
  try {
    recognized = await lookUp(tweet, job);
  } catch (err) {
    if (needsSetup(err)) {
      if (!(err instanceof NoKeyError)) console.error('[Buki] recognition failed', err);
      await failCard(tabId, job, setupMessage(err));
      void chrome.runtime.openOptionsPage();
      return;
    }
    console.error('[Buki] recognition failed', err);
    noteFailure(Date.now() - startedAt, 'contextmenu');
    await failCard(tabId, job, "Couldn't read that cover. Try again in a moment.");
    return;
  }

  const { result } = recognized;
  const draft = draftFrom(recognized, Date.now() - startedAt, 'contextmenu');

  // NOTHING IS SAVED WITHOUT A CLICK, however sure the model was.
  //
  // This used to auto-save on high confidence and report the fact for 2.8 seconds. A
  // confident wrong answer costs more than ten misses: it makes the whole shelf suspect,
  // and a shelf you have to double-check is worth less than no shelf. So every catch -
  // even a certain one - waits on its card until you say what it is.
  const shown = await tellTab<{ shown: boolean }>(tabId, {
    type: 'catchResolve',
    job,
    candidates: result.candidates,
    source: result.source,
    alreadySaved: await shelvedAmong(result.candidates),
    draft,
    permalink: ctx?.permalink ?? null,
    tweet,
  });
  // The content script owns the outcome from here. If it never answered there is no tray
  // on this tab, so the book has nowhere to go - record it as dropped rather than
  // pretend it was offered.
  if (!shown?.shown) {
    note({ ...draft, outcome: result.candidates.length ? 'dismissed' : 'no-match' });
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

  // The worker is the only writer of `savedBooks`. Other contexts ask; they never write.
  if (msg?.type === 'saveBook') {
    library
      .add(msg.book, msg.intent, msg.source, msg.shot)
      .then((saved) => {
        // Both, and the picture first: it is what the shelf draws. Keeping the bytes
        // also means the shelf survives the post being deleted, which is the whole
        // point of having caught it.
        void rememberCover(saved.shot, liveCoverDeps());
        void rememberCover(msg.book.coverUrl, liveCoverDeps());
        sendResponse({ ok: true, saved } satisfies ShelfResponse);
      })
      .catch((err: unknown) => {
        console.error('[Buki] save failed', err);
        sendResponse({ ok: false, error: String(err) } satisfies ShelfResponse);
      });
    return true; // async response
  }

  if (msg?.type === 'removeBook') {
    const savedId = msg.savedId;
    library
      .remove(savedId)
      // Flagged in the same round trip. The popup used to send this separately and wait a
      // fixed 170ms for it, which raced a sleeping worker and left the kept rate stale.
      .then(() =>
        log
          .markWrong(savedId)
          .catch((err: unknown) => console.error('[Buki] could not flag the match', err)),
      )
      .then(() => sendResponse({ ok: true } satisfies ShelfResponse))
      .catch((err: unknown) => {
        console.error('[Buki] remove failed', err);
        sendResponse({ ok: false, error: String(err) } satisfies ShelfResponse);
      });
    return true; // async response
  }

  if (msg?.type === 'clearLog') {
    log
      .clear()
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) => {
        console.error('[Buki] could not clear the log', err);
        sendResponse({ ok: false });
      });
    return true; // async response
  }

  if (msg?.type === 'cancelRecognize') {
    // A cancel for a catch that already finished is normal, not an error - the page
    // cannot know the worker got there first.
    running.get(msg.job)?.abort();
    running.delete(msg.job);
    // And forget it, or pressing the same post again would join a promise nobody is
    // going to settle. The job IS the post key, which is why calling a catch off and
    // forgetting what it found are the same name.
    lookups.forget(msg.job);
    lookups.forget(`words:${msg.job}`);
    sendResponse({ ok: true });
    return false;
  }

  if (msg?.type !== 'recognize') return false;

  const startedAt = Date.now();
  lookUp(msg.tweet, msg.job, { ...(msg.fromText ? { fromText: true } : {}) })
    .then(async (recognized) => {
      sendResponse({
        ok: true,
        result: recognized.result,
        draft: draftFrom(recognized, Date.now() - startedAt, 'button'),
        alreadySaved: await shelvedAmong(recognized.result.candidates),
      } satisfies BackgroundResponse);
    })
    .catch((err: unknown) => {
      // Unfinished setup is not a miss - logging it would make the recognizer look bad
      // for something it was never given a chance to do.
      if (!(err instanceof NoKeyError)) console.error('[Buki] recognition failed', err);
      if (!needsSetup(err)) noteFailure(Date.now() - startedAt, 'button');

      sendResponse({
        ok: false,
        needsSetup: needsSetup(err),
        error: needsSetup(err) ? setupMessage(err) : String(err),
      } satisfies BackgroundResponse);
    });
  return true; // async response
});
