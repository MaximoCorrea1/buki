// Background service worker. Owns recognition for both flows, so the tweet button and
// the right-click menu resolve books exactly the same way - and so cross-origin calls
// happen where host_permissions apply, rather than from a content script.
//
// It is also the recognition log's ONLY writer. Every other context sends it a finished
// event. One writer means no cross-context race, and it means the right-click flow still
// records an attempt on a tab whose content script never loaded.
import { createOpenLibraryClient } from '../recognizer/openLibrary';
import { createLlmVision, MAX_IMAGES } from '../recognizer/llmVision';
import { recognizeBook } from '../recognizer/recognizer';
import type { FetchLike, RecognitionResult, Tweet, VisionClient } from '../recognizer/types';
import { readSettings, toVisionConfig, type Settings } from './settings';
import { createLibrary, identityOf, type StorageArea } from './storage';
import { sameBook } from './bookIdentity';
import { createRecognitionLog, type AttemptDraft, type PendingEvent } from './recognitionLog';
import { bestQuality, distinctMedia, keepTweetMedia } from './twitterImage';
import { inlineAll, livePrep } from './inlineImage';
import { createBreaker, withBreaker } from './breaker';
import { rememberCover, liveCoverDeps } from './coverCache';
import { PRICING_URL } from '../shared/pricing';
import { createGate, WallError } from './gate';
import { handleSaveBook, type SaveBookDeps } from './saveBook';
import { readPro, writePro, createSessionKeeper, forgetSession, type ProState } from './proState';
import { readVisionFailure, NoKeyError, type VisionFailure } from './visionFailure';
import { createLicense } from './license';
import { BUKI_HOST } from '../shared/host';
import { visionRoute } from './visionRoute';
import { createTrial } from './trial';
import { coverDataUrl } from './coverData';
import { withSignal } from './cancellable';
import { createLookupMemo, postKey } from './lookupMemo';
import { mayFetch, type PermissionDeps } from './imageOrigin';
import { ensureTray, type TrayDeps } from './ensureTray';
import { sayStopped, type ToolbarDeps } from './toolbar';
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

/**
 * One renewal per moment, shared by every catch this worker handles.
 *
 * IT HAS TO BE AT MODULE SCOPE. Built inside `recognize` it would be a fresh keeper per
 * catch, each with its own empty latch, which is the same as having no latch at all — two
 * catches clicked in the same second would still exchange twice and spend two of the
 * licence's five activation slots for one user action.
 *
 * Same lifetime argument as `catalogue` above, and the same conclusion: Chrome tears the
 * worker down after ~30s idle, so the latch covers a burst of catches and nothing longer.
 * That is exactly the window the double-spend lives in. A renewal a day later gets a fresh
 * worker and renews properly, which is what it should do.
 */
const keepSession = createSessionKeeper({
  // BOTH parameters, and the second one is the whole point. An arrow taking fewer
  // parameters is assignable in TypeScript, so `(key) => ...exchange(key)` compiled and
  // passed every test while silently dropping the activation id — which would make each
  // renewal ACTIVATE again and spend one of the licence's five slots per day.
  exchange: (key, activationId) =>
    createLicense({
      fetch: (url, init) => fetch(url, init),
      endpoint: `${BUKI_HOST}/api/license`,
      now: () => Date.now(),
    }).exchange(key, activationId),
  save: (state) => writePro(chrome.storage.local, state),
  now: () => Date.now(),
});

/**
 * WHAT TO DO ABOUT A FAILED COVER READ, and it is no longer one predicate.
 *
 * This was `needsSetup = NoKeyError || (VisionHttpError && permanent)`, and `permanent` is
 * `status < 500 && status !== 429 && status !== 408`. So **401 and 402 both told the reader
 * their setup was broken and opened the options page**, and both statements are false: a
 * 401 means our session needs re-exchanging (AC-3), a 402 means WE paused the trial (AC-7).
 * Neither is anything a keyless reader can act on, because a keyless reader configured
 * nothing — they installed the extension.
 *
 * The classification lives in `visionFailure.ts`, because this file registers listeners at
 * module scope and no test can import it. That is finding M-5, and the reason `saveBook.ts`,
 * `ensureTray.ts`, `activateKey.ts` and `realClick.ts` all live outside it too.
 */
async function failureFor(err: unknown): Promise<VisionFailure> {
  try {
    const settings = await readSettings();
    return readVisionFailure(err, { ownKey: settings.apiKey.trim() !== '' });
  } catch {
    // Settings unreadable. Assume the PROXY path, which is the one that never blames the
    // reader: guessing "own key" here would show a setup message to somebody with no setup.
    return readVisionFailure(err, { ownKey: false });
  }
}

/**
 * Forget a session the server will no longer honour, so the NEXT catch re-exchanges.
 *
 * A rotated `BUKI_TOKEN_SECRET`, a bumped `TOKEN_VERSION`, or a licence named in
 * `BUKI_REVOKED_KEY_IDS` all arrive here as a 401. Without this the extension carried a
 * dead token until it aged out — up to eight days of the wall the customer paid to pass,
 * with `policy.ts:51` and `visionHandler.ts:63` both documenting the fix in prose that
 * nothing executed. **It is the only lever that makes a secret rotation survivable.**
 *
 * ONE FAILED CATCH, NOT A RETRY LOOP, and that is deliberate. Retrying inside the catch
 * would put a second upstream request on the money path for a case that only happens
 * during an incident. The card says to try again; the next press works.
 */
async function forgetDeadSession(): Promise<void> {
  try {
    const held = await readPro(chrome.storage.local);
    if (held.session) await writePro(chrome.storage.local, forgetSession(held));
  } catch (err) {
    // Never worth failing a catch over: the next renewal tries again regardless.
    console.error('[Buki] could not clear a dead session', err);
  }
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

function visionFor(settings: Settings, net: FetchLike, pro: ProState) {
  // WHERE THIS GOES IS visionRoute's DECISION, not this function's. With their own key it
  // is their own provider; with none it is Buki's proxy, carrying a session token if one
  // is live and nothing at all if not - which is what the trial looks like on the wire.
  const route = visionRoute(settings, pro);

  // A blank key is legitimate against a proxy holding its own credential, but against a
  // public provider it just means setup is unfinished - worth saying so rather than
  // firing a request that can only 401.
  const providerNeedsKey = /googleapis\.com|openai\.com|openrouter\.ai/.test(route.endpoint);
  if (!route.apiKey && providerNeedsKey) throw new NoKeyError('no key');

  // THE ROUTE IS THE CONFIG. Not rebuilt field by field, which is what this used to do:
  //
  //     model: route.model || settings.model
  //
  // under a comment saying it fell back "only when we are talking to a provider directly".
  // The `||` never looked at the endpoint, so the user's free-text model from
  // `options.html` went straight back onto the PROXY path — and the proxy forwarded it to
  // Gemini on our key. A keyless user typing `gemini-2.5-pro` billed us for Pro-tier
  // inference through our own UI, with no forgery anywhere.
  //
  // `visionRoute` already makes that decision, and it is tested. Copying its answer into a
  // fresh object is what created a second place for the decision to live, and the second
  // place is the one that was wrong. `Route` and `VisionConfig` are the same shape on
  // purpose: passing it through means there is nothing left to get wrong here.
  //
  // The SERVER is what defends the credential — `visionBody.ts` pins the model no matter
  // what any client sends, because an attacker does not use our UI. This is the honest
  // client, made honest.
  return createLlmVision({ fetch: net, config: route });
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
  // Both read per call, so pasting a licence key or a provider key takes effect on the
  // next catch rather than the next reload.
  const [settings, held] = await Promise.all([readSettings(), readPro(chrome.storage.local)]);

  // RENEW BEFORE THE CALL, not on a timer. An MV3 worker is torn down between clicks, so a
  // background schedule is the one thing that cannot be relied on here; the catch itself is
  // the only reliable heartbeat this extension has. `ensureSession` is a no-op for anybody
  // without a licence, and it never throws - a renewal that fails keeps the token we hold
  // and rides the server's grace window.
  // Through `keepSession`, never `ensureSession` directly: two catches in the same second
  // both arrive here with the same stale state, and only the module-scope latch stops them
  // exchanging twice and spending two of the licence's five slots for one user action.
  const pro = await keepSession(held);
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
        // THE ONLY PLACE MONEY IS SPENT, so the only place there is a gate. It checks
        // before the call and accounts for it only after one that happened; a WallError
        // unwinds the whole recognition and becomes the card's wall state. A catch from a
        // retailer link never reaches here, which is why it is free at every level.
        return await gate.run('cover', () => visionFor(settings, net, pro).guessBooks(input));
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
 * The live wiring for the two things a catch has to secure before it can start. Both
 * decisions moved out to `ensureTray.ts` and `imageOrigin.ts` so they could be tested at
 * all: reaching Chrome directly from here made the riskiest behaviour in catch-anywhere
 * the only behaviour with no coverage, and it is also the part no headless check can
 * reach. Same convention as `storage.ts` and `trial.ts`, which take their deps.
 */
const liveTray: TrayDeps = {
  tell: tellTab,
  inject: (tabId) =>
    chrome.scripting.executeScript({ target: { tabId }, files: ['dist/content.js'] }),
};

const livePermissions: PermissionDeps = {
  request: (origins) => chrome.permissions.request({ origins }),
};

const liveToolbar: ToolbarDeps = {
  toolbar: chrome.action,
  after: (ms, run) => void setTimeout(run, ms),
};

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

/**
 * End a catch at the wall. NOT `failCard`: nothing went wrong, so the card carries an
 * offer instead of an apology and stays until it is dismissed.
 */
const wallCard = (tabId: number | undefined, job: string): Promise<unknown> =>
  tellTab(tabId, { type: 'catchWall', job });

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl) return;
  const tabId = tab?.id;

  // Order is load-bearing. The permission ask goes first because it needs the click's
  // user gesture and every await erodes it. The tray goes second so that anything after
  // this point has somewhere to report to.
  //
  // Both of these end the catch before anything is on screen, and both used to end it in
  // total silence: the menu item did nothing and said nothing. The toolbar is the only
  // surface Chrome still owns for us on a page we may not touch, so it carries the news.
  if (!(await mayFetch(info.srcUrl, livePermissions))) {
    await sayStopped(
      tabId,
      'Buki needs permission for that image. Nothing was caught.',
      liveToolbar,
    );
    return;
  }
  if (!(await ensureTray(tabId, liveTray))) {
    await sayStopped(
      tabId,
      'Chrome closes this page to extensions. Nothing can be caught here.',
      liveToolbar,
    );
    return;
  }

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
    // The wall FIRST, and before `needsSetup`: meeting it is not a failure and not a
    // configuration problem, so it must not open the options page or draw an apology.
    if (err instanceof WallError) {
      await wallCard(tabId, job);
      return;
    }
    const failure = await failureFor(err);
    if (failure.act === 'session') void forgetDeadSession();
    if (failure.act !== 'transient') {
      if (!(err instanceof NoKeyError)) console.error('[Buki] recognition failed', err);
      await failCard(tabId, job, failure.message);
      // ONLY when settings is genuinely where the fix is. Opening it for a 401 or a 402
      // sends somebody to a page with nothing on it they can change.
      if (failure.act === 'setup') void chrome.runtime.openOptionsPage();
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


/**
 * The entitlement gate, built once for the worker.
 *
 * `createGate` takes its dependencies so it can be tested without Chrome, which is the
 * same convention `storage.ts` and `trial.ts` use. Everything it reads is read per call,
 * so pasting a licence key takes effect on the next catch rather than the next reload.
 */
const gate = createGate({
  readPro: () => readPro(chrome.storage.local),
  readSettings: async () => ({ apiKey: (await readSettings()).apiKey }),
  trial: createTrial({ storage: chrome.storage.local }),
  now: () => Date.now(),
});

/**
 * The live half of `handleSaveBook`. Bindings only; every decision is in that module.
 *
 * `rememberCover` is voided here rather than inside the handler, which is where the
 * fire-and-forget contract is actually made good: the handler's type says the dependency
 * returns nothing, so nothing it does can reject into a save.
 */
const liveSaveBook: SaveBookDeps = {
  add: (book, intent, source, shot) => library.add(book, intent, source, shot),
  rememberCover: (url) => void rememberCover(url, liveCoverDeps()),
  markRestored: (previousId, savedId) => log.markRestored(previousId, savedId),
};
chrome.runtime.onMessage.addListener((msg: BackgroundRequest, _sender, sendResponse) => {
  if (msg?.type === 'logEvent') {
    note(msg.event);
    sendResponse({ ok: true });
    return false;
  }

  // The worker is the only writer of `savedBooks`. Other contexts ask; they never write.
  //
  // EVERY DECISION IS IN `handleSaveBook`, not here, so the relink can be spied on instead
  // of string-matched. This listener cannot be imported by a test — it registers at module
  // scope — and a reviewer proved what a `?raw` guard over it cannot see: the old inline
  // version passed `toContain('markRestored')` with the call in dead code AND with its
  // arguments reversed. Keep this adapter thin, and give the next message type its own
  // handler rather than inlining one here.
  if (msg?.type === 'saveBook') {
    void handleSaveBook(msg, liveSaveBook).then(sendResponse);
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

  if (msg?.type === 'openPage') {
    if (msg.page === 'options') void chrome.runtime.openOptionsPage();
    // The pricing anchor rather than the bare host: somebody who pressed a price button
    // should land on the prices, not at the top of a landing page they have to scroll.
    else void chrome.tabs.create({ url: PRICING_URL });
    sendResponse({ ok: true });
    return false;
  }

  if (msg?.type === 'coverBytes') {
    // The tray asks for this because it is not allowed to fetch it. A failure is answered
    // with null rather than an error: the card falls back to its cloth, which is a real
    // design and not a broken state.
    coverDataUrl(msg.url, liveCoverDeps())
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch(() => sendResponse({ ok: true, dataUrl: null }));
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

  // THE TRUST BOUNDARY IS HERE, and the filter is applied on BOTH sides of it.
  //
  // `content.ts` already drops any image that is not really X's, but it does that while
  // running inside a page Buki does not control — `ensureTray` injects it into any tab on
  // a right-click, which is catch-anywhere working as designed. A filter applied only on
  // the far side of a boundary is a filter the attacker is standing next to: this message
  // arrives over `chrome.runtime.sendMessage` and its contents are whatever the sender
  // chose to put in it.
  //
  // The CONTEXT-MENU flow deliberately does not come through here. There the URL is
  // Chrome's own `info.srcUrl`, which reports what the user actually right-clicked, and
  // catching a book from any image on any site is the product.
  const fromPage: Tweet = { ...msg.tweet, imageUrls: keepTweetMedia(msg.tweet.imageUrls) };

  const startedAt = Date.now();
  lookUp(fromPage, msg.job, { ...(msg.fromText ? { fromText: true } : {}) })
    .then(async (recognized) => {
      sendResponse({
        ok: true,
        result: recognized.result,
        draft: draftFrom(recognized, Date.now() - startedAt, 'button'),
        alreadySaved: await shelvedAmong(recognized.result.candidates),
      } satisfies BackgroundResponse);
    })
    .catch(async (err: unknown) => {
      // Unfinished setup is not a miss - logging it would make the recognizer look bad
      // for something it was never given a chance to do.
      if (!(err instanceof NoKeyError) && !(err instanceof WallError)) {
        console.error('[Buki] recognition failed', err);
      }
      const failure = await failureFor(err);
      if (failure.act === 'session') void forgetDeadSession();
      // A wall is an answer, not a miss. Counting it would make the kept rate - the one
      // number this product reports about itself - drop every time somebody met the offer.
      //
      // Nor is a setup problem, for the reason above. A CLOSED TRIAL is not a miss either,
      // and neither is our own server refusing us: both would make the recogniser look bad
      // for something we did, which is exactly the accounting `noteFailure` exists to keep
      // honest.
      if (failure.act === 'transient' && !(err instanceof WallError)) {
        noteFailure(Date.now() - startedAt, 'button');
      }

      sendResponse({
        ok: false,
        needsSetup: failure.act === 'setup',
        error: failure.act === 'transient' ? String(err) : failure.message,
        // The button path answers the page directly, so the wall travels as a flag rather
        // than as its own message. Same decision, different carrier.
        ...(err instanceof WallError ? { wall: true } : {}),
      } satisfies BackgroundResponse);
    });
  return true; // async response
});
