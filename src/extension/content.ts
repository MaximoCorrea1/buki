// Book Catcher content script: inject a Save button on tweets, scrape + recognize,
// and save the pick to your own reading list. Also renders feedback for the
// background worker's right-click OCR flow.
import type { Tweet, Book } from '../recognizer/types';
import { createLibrary, type Intent, type SavedSource, type StorageArea } from './storage';
import type { AttemptDraft, PendingEvent } from './recognitionLog';
import type {
  BackgroundRequest,
  BackgroundResponse,
  ContentRequest,
  TweetContext,
} from './messages';

const storage: StorageArea = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
};
const library = createLibrary({
  storage,
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
});

const BTN_CLASS = 'bookcatcher-save-btn';

/**
 * Boundary tracing. This extension coordinates three isolated contexts, so a failure
 * anywhere in the chain looks identical from the page: nothing happens. Logging each
 * hand-off is what makes "it does nothing" diagnosable.
 * Silence it with: localStorage.bookcatcherQuiet = '1'
 */
const trace = (...args: unknown[]): void => {
  try {
    if (localStorage.getItem('bookcatcherQuiet') === '1') return;
  } catch {
    /* storage can be blocked; log anyway */
  }
  console.info('[BookCatcher]', ...args);
};
/**
 * One stylesheet rather than inline cssText: :active press feedback, hover gating and
 * prefers-reduced-motion cannot be expressed inline, and those are the parts that decide
 * whether this reads as part of X or bolted onto it.
 *
 * Motion is rationed by how often a surface is seen. The button is hit dozens of times a
 * day, so it only ever presses - no entrance animation. The panel and pill appear once
 * per catch, so they can afford one.
 */
const STYLE = `
.bc-btn {
  cursor: pointer; background: transparent; border: 0; padding: 4px 6px;
  margin-left: 4px; border-radius: 999px; font-size: 15px; line-height: 1;
  opacity: .72; transition: opacity 140ms cubic-bezier(.23,1,.32,1),
    transform 140ms cubic-bezier(.23,1,.32,1), background-color 140ms ease;
}
.bc-btn:disabled { cursor: default; }
.bc-btn:active { transform: scale(.9); }
.bc-btn:focus-visible { outline: 2px solid #e7b24c; outline-offset: 1px; opacity: 1; }
@media (hover: hover) and (pointer: fine) {
  .bc-btn:hover { opacity: 1; background: rgba(231,178,76,.14); }
}

/* The pill reports one operation, so it updates in place. Blurring on swap makes two
   different strings read as one object changing rather than a crossfade of two. */
.bc-pill {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  max-width: 330px; padding: 10px 14px; border-radius: 10px;
  background: #211c1a; color: #e7b24c; border: 1px solid #3a322e;
  font: 13.5px/1.4 system-ui, sans-serif; box-shadow: 0 6px 22px rgba(0,0,0,.45);
  opacity: 0; transform: translateY(6px);
  transition: opacity 180ms cubic-bezier(.23,1,.32,1),
    transform 180ms cubic-bezier(.23,1,.32,1), filter 130ms ease;
}
.bc-pill.bc-in { opacity: 1; transform: none; }
.bc-pill.bc-swap { filter: blur(2.5px); opacity: .55; }

.bc-panel {
  position: absolute; z-index: 2147483000; width: 288px; padding: 6px;
  background: #211c1a; color: #f3efe7; border: 1px solid #3a322e;
  border-radius: 11px; box-shadow: 0 12px 34px rgba(0,0,0,.55);
  font: 13.5px/1.45 system-ui, sans-serif;
  /* Origin at the trigger: the panel should look like it came out of the button. */
  transform-origin: top left; opacity: 0; transform: scale(.96) translateY(-2px);
  transition: opacity 180ms cubic-bezier(.23,1,.32,1),
    transform 180ms cubic-bezier(.23,1,.32,1);
}
.bc-panel.bc-in { opacity: 1; transform: none; }

/* No anchor: the feed recycled the image away mid-recognition. Park the panel in the
   corner rather than dropping the result - losing a recognized book is the exact
   failure this extension exists to prevent. Clear of the status pill at bottom: 20px. */
.bc-panel.bc-corner {
  position: fixed; left: auto; top: auto; right: 20px; bottom: 72px;
  transform-origin: bottom right;
}

.bc-cand { position: relative; padding: 7px 8px 8px 16px; border-radius: 6px; }
.bc-cand + .bc-cand { margin-top: 1px; }
.bc-cand::before {
  content: ''; position: absolute; left: 5px; top: 4px; bottom: 4px; width: 4px;
  border-radius: 1px; background: var(--cloth, #47505c);
}
.bc-cand::after {
  content: ''; position: absolute; left: 5px; top: 11px; width: 4px; height: 1px;
  background: rgba(231,178,76,.5); box-shadow: 0 15px 0 rgba(231,178,76,.5);
}
.bc-t { font-weight: 600; letter-spacing: -.006em; }
.bc-a { font-size: 12px; opacity: .55; }

.bc-row { display: flex; gap: 4px; margin-top: 6px; }
.bc-intent {
  flex: 1; cursor: pointer; border: 0; border-radius: 6px; padding: 5px 0;
  background: #2b2422; color: #f3efe7; font: 500 11.5px/1 ui-monospace, Menlo, monospace;
  letter-spacing: .06em; text-transform: uppercase;
  transition: background-color 140ms ease, transform 140ms cubic-bezier(.23,1,.32,1);
}
.bc-intent:active { transform: scale(.96); }
.bc-intent:disabled { opacity: .45; cursor: default; }
.bc-intent:focus-visible { outline: 2px solid #e7b24c; outline-offset: 1px; }
@media (hover: hover) and (pointer: fine) {
  .bc-intent:not(:disabled):hover { background: #2e5d5a; }
}

.bc-none { padding: 10px 10px 11px; opacity: .7; line-height: 1.5; }

@media (prefers-reduced-motion: reduce) {
  .bc-panel, .bc-pill { transition-duration: 1ms; transform: none; }
  .bc-btn, .bc-intent { transition-duration: 1ms; }
}
`;

const CLOTH = ['#7c3a2e', '#c8873f', '#2e5d5a', '#47505c', '#6e7a5a'];

/** Same book, same binding - so a shelf looks varied the way a real one does. */
function clothFor(book: Book): string {
  const key = book.isbn ?? `${book.title}|${book.author}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return CLOTH[hash % CLOTH.length] ?? CLOTH[0]!;
}

const styleEl = document.createElement('style');
styleEl.textContent = STYLE;
document.head.appendChild(styleEl);

// ---------------------------------------------------------------- scraping

function tweetPermalink(article: HTMLElement): string | null {
  const link = article.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
  return link?.href ?? null;
}

/**
 * Twitter renders the expanded destination as an anchor's TEXT while the href stays a
 * t.co redirect, so the retailer URL is only visible in the text. That text is
 * attacker-shapeable, so it is only ever a *candidate*: isbn.ts requires a retailer
 * host before trusting one, and a truncated one is dropped here (a clipped ISBN would
 * silently fail the high-confidence path anyway).
 */
function candidateLinks(article: HTMLElement): string[] {
  return Array.from(article.querySelectorAll('a[href]')).flatMap((a) => {
    const el = a as HTMLAnchorElement;
    const shown = (el.textContent ?? '').trim();
    const looksLikeUrl = shown.includes('.') && !shown.includes(' ');
    const truncated = shown.includes('…') || shown.endsWith('...');
    return looksLikeUrl && !truncated
      ? [`https://${shown.replace(/^https?:\/\//, '')}`, el.href]
      : [el.href];
  });
}

function scrapeTweet(article: HTMLElement): Tweet {
  return {
    text: article.querySelector('[data-testid="tweetText"]')?.textContent ?? '',
    imageUrls: Array.from(article.querySelectorAll('img'))
      .map((img) => img.src)
      .filter((src) => src.includes('twimg.com/media')),
    links: candidateLinks(article),
  };
}

/**
 * Recognition happens in the background worker, not here: it owns the vision key, and
 * cross-origin calls belong where host_permissions apply. It also means this button and
 * the right-click menu resolve books through exactly the same pipeline - including
 * reading the cover image, which this flow previously ignored.
 */
async function recognize(tweet: Tweet): Promise<{ candidates: Book[]; draft: AttemptDraft } | null> {
  const resp = (await chrome.runtime.sendMessage({
    type: 'recognize',
    tweet,
  } satisfies BackgroundRequest)) as BackgroundResponse | undefined;

  if (!resp) throw new Error('No response from the recognizer');
  if (!resp.ok) {
    // Already phrased for the user, and retrying cannot help - say what is wrong rather
    // than throwing it onto the generic "try again in a moment" path.
    if (resp.needsSetup) {
      toast(resp.error);
      return null;
    }
    throw new Error(resp.error);
  }
  return { candidates: resp.result.candidates, draft: resp.draft };
}

/**
 * Hand a finished event to the background, which is the log's only writer. Diagnostics:
 * a failure here must never surface as a failed save.
 */
function report(event: PendingEvent): void {
  void chrome.runtime
    .sendMessage({ type: 'logEvent', event } satisfies BackgroundRequest)
    .catch((err: unknown) => console.error('[BookCatcher] log write failed', err));
}

// ---------------------------------------------------------------- toasts

/**
 * One status pill, reused. The OCR flow reports several stages in a row; separate
 * toasts either stacked up or replaced each other invisibly, so a multi-second
 * operation looked like nothing was happening.
 */
let statusEl: HTMLElement | null = null;
let statusTimer: number | undefined;

function toast(msg: string, opts: { sticky?: boolean } = {}): void {
  const fresh = !statusEl;
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.className = 'bc-pill';
    statusEl.setAttribute('role', 'status');
    document.body.appendChild(statusEl);
  }
  const el = statusEl;

  if (fresh) {
    el.textContent = msg;
    // Next frame, so the transition has a starting value to animate from.
    requestAnimationFrame(() => el.classList.add('bc-in'));
  } else {
    // Already on screen: blur out, swap the words, blur back. One object changing
    // its mind, rather than two strings crossfading through each other.
    el.classList.add('bc-swap');
    setTimeout(() => {
      el.textContent = msg;
      el.classList.remove('bc-swap');
    }, 110);
  }

  clearTimeout(statusTimer);

  // Sticky = a stage still running; it holds until the next update replaces it.
  if (opts.sticky) return;
  statusTimer = window.setTimeout(() => {
    statusEl = null;
    el.classList.remove('bc-in');
    setTimeout(() => el.remove(), 220);
  }, 2800);
}

// ---------------------------------------------------------------- picker

let openPanel: { el: HTMLElement; cleanup: () => void } | null = null;

function closePanel(): void {
  openPanel?.cleanup();
  openPanel?.el.remove();
  openPanel = null;
}

/** What the user did with a panel. Exactly one of these fires per panel, ever. */
type PickOutcome = { outcome: 'confirmed'; savedId: string } | { outcome: 'dismissed' };

interface PickerOptions {
  source?: SavedSource;
  onOutcome?: (result: PickOutcome) => void;
}

/**
 * Only a permalink is "the tweet that sold you". Falling back to the feed URL but still
 * labelling it a tweet would put `x.com/home` behind that link, which is the failure the
 * whole source field exists to prevent.
 */
function sourceFor(permalink: string | null): SavedSource {
  return permalink ? { url: permalink, kind: 'tweet' } : { url: location.href, kind: 'page' };
}

function openPicker(
  anchor: HTMLElement | null,
  candidates: Book[],
  opts: PickerOptions = {},
): void {
  closePanel(); // only ever one picker; a second would strand the first

  const panel = document.createElement('div');
  panel.className = anchor ? 'bc-panel' : 'bc-panel bc-corner';

  // Every close path runs cleanup, and cleanup reports a dismissal - so the guard is
  // what stops a successful save being logged twice, once as confirmed and once as not.
  let settled = false;
  const settle = (result: PickOutcome): void => {
    if (settled) return;
    settled = true;
    opts.onOutcome?.(result);
  };

  if (!candidates.length) {
    const empty = document.createElement('div');
    empty.className = 'bc-none';
    empty.textContent = 'No book named here. Right-click the cover image to read it instead.';
    panel.appendChild(empty);
  } else {
    candidates.forEach((book) => {
      const row = document.createElement('div');
      row.className = 'bc-cand';
      row.style.setProperty('--cloth', clothFor(book));

      const title = document.createElement('div');
      title.className = 'bc-t';
      title.textContent = book.title;
      const author = document.createElement('div');
      author.className = 'bc-a';
      author.textContent = book.author;
      row.append(title, author);

      const btns = document.createElement('div');
      btns.className = 'bc-row';
      (['now', 'next', 'someday'] as Intent[]).forEach((intent) => {
        const b = document.createElement('button');
        b.className = 'bc-intent';
        b.textContent = intent;
        b.addEventListener('click', async () => {
          // Disable the whole row: a second click would re-enter the save and race
          // the storage write.
          btns.querySelectorAll('button').forEach((el) => (el.disabled = true));
          try {
            const saved = await library.add(book, intent, opts.source);
            settle({ outcome: 'confirmed', savedId: saved.id });
            closePanel();
            toast(`Saved: ${book.title} → ${intent}`);
          } catch (err) {
            console.error('[BookCatcher] save failed', err);
            btns.querySelectorAll('button').forEach((el) => (el.disabled = false));
            toast("Couldn't save to your shelf.");
          }
        });
        btns.appendChild(b);
      });
      row.appendChild(btns);
      panel.appendChild(row);
    });
  }

  const place = (): void => {
    if (!anchor) return; // corner-anchored; the stylesheet holds it in place
    // The feed is virtualized; if the tweet was recycled away, close rather than
    // leave the panel pinned to a zeroed rect in the corner.
    if (!anchor.isConnected) return closePanel();

    const rect = anchor.getBoundingClientRect();
    // Below the anchor if it fits, above it if not. A tweet image is tall enough that
    // its bottom edge is often below the fold, and a panel rendered off-screen loses
    // the book just as surely as never showing one.
    const height = panel.offsetHeight || 120;
    const below = rect.bottom + 4;
    const top = below + height <= window.innerHeight ? below : Math.max(8, rect.top - height - 4);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 296));

    panel.style.left = `${left + window.scrollX}px`;
    panel.style.top = `${top + window.scrollY}px`;
  };
  place();
  document.body.appendChild(panel);
  place(); // again now it has a measurable height, so the flip-above check is real
  // Next frame, so it scales out of the trigger rather than appearing at full size.
  requestAnimationFrame(() => panel.classList.add('bc-in'));

  const onClickAway = (e: MouseEvent): void => {
    if (!panel.contains(e.target as Node) && e.target !== anchor) closePanel();
  };
  // One cleanup used by every close path, so listeners can't outlive the panel.
  const cleanup = (): void => {
    document.removeEventListener('click', onClickAway);
    window.removeEventListener('scroll', place, true);
    window.removeEventListener('resize', place);
    settle({ outcome: 'dismissed' }); // no-op if a pick already settled it
  };
  setTimeout(() => document.addEventListener('click', onClickAway), 0);
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);

  openPanel = { el: panel, cleanup };
}

// ---------------------------------------------------------------- injection

let injected = 0;

function addButton(article: HTMLElement): void {
  if (article.querySelector(`.${BTN_CLASS}`)) return;
  const actions = article.querySelector('[role="group"]');
  if (!actions) return;

  const btn = document.createElement('button');
  btn.className = `${BTN_CLASS} bc-btn`;
  btn.textContent = '📚';
  btn.title = 'Save book to your shelf';
  btn.setAttribute('aria-label', 'Save book to your shelf');

  // Capture phase: X delegates clicks from high up the tree, so a bubble-phase
  // listener can be pre-empted by their handler before it ever runs.
  btn.addEventListener(
    'click',
    async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (btn.disabled) return;

    // `disabled` rather than a textContent flag: a second click used to capture the
    // in-flight glyph as "original" and could leave the button stuck on it forever.
    btn.disabled = true;
    btn.textContent = '…';
    try {
      const tweet = scrapeTweet(article);
      trace('clicked. scraped:', {
        text: tweet.text.slice(0, 60),
        images: tweet.imageUrls.length,
        links: tweet.links.length,
      });

      toast('Looking up the book…', { sticky: true });
      const recognized = await recognize(tweet);
      if (!recognized) return; // no key; recognize() already said so
      const { candidates, draft } = recognized;
      trace('lookup returned', candidates.length, 'candidate(s)', candidates);

      if (!article.isConnected) return trace('tweet scrolled away; dropping result');

      // A no-match panel has nothing to pick, so its outcome is already known.
      if (!candidates.length) report({ ...draft, outcome: 'no-match' });

      openPicker(btn, candidates, {
        source: sourceFor(tweetPermalink(article)),
        ...(candidates.length ? { onOutcome: (o) => report({ ...draft, ...o }) } : {}),
      });
      toast(candidates.length ? `Found ${candidates.length}` : 'No book found in this tweet');
      trace('picker opened');
    } catch (err) {
      console.error('[BookCatcher] lookup failed', err);
      toast('Book lookup failed — try again in a moment.');
    } finally {
      btn.textContent = '📚';
      btn.disabled = false;
    }
    },
    true, // capture
  );

  actions.appendChild(btn);
  injected++;
}

function scan(root: ParentNode = document): void {
  root.querySelectorAll('article[data-testid="tweet"]').forEach((a) => addButton(a as HTMLElement));
}

// One coalesced pass per frame. X mutates constantly (and our own button/toast/panel
// writes re-trigger the observer), so running a full-document query per mutation put
// real work on the same thread as the page's scrolling.
let scheduled = false;
function requestScan(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scan();
  });
}

const feed = document.querySelector('main[role="main"]') ?? document.body;
new MutationObserver(requestScan).observe(feed, { childList: true, subtree: true });
// Safety net: catches tweets whose nodes are recycled in place (mutating attributes
// or text only), which a childList-only observer never sees.
setInterval(scan, 2000);
scan();
trace(`content script ready on ${location.host}; ${injected} button(s) injected so far`);

/**
 * Twitter serves the same media under several query strings (?format=jpg&name=small),
 * so the URL the context menu reports rarely equals the `src` in the DOM byte for byte.
 * Compare just the path - that's the media id.
 */
function sameImage(a: string, b: string): boolean {
  try {
    return new URL(a).pathname === new URL(b).pathname;
  } catch {
    return a === b;
  }
}

chrome.runtime.onMessage.addListener((msg: ContentRequest, _sender, sendResponse) => {
  if (msg?.type === 'toast') {
    toast(msg.text, { sticky: msg.sticky });
    return;
  }
  if (msg?.type === 'pick') {
    const { candidates, draft, permalink } = msg;
    // The same URL-path lookup that resolves the permalink also positions the panel, so
    // it opens at the image being pointed at.
    const img = Array.from(document.querySelectorAll('img')).find((i) =>
      sameImage(i.src, msg.srcUrl),
    );
    openPicker(img ?? null, candidates, {
      source: sourceFor(permalink),
      onOutcome: (o) => report({ ...draft, ...o }),
    });
    sendResponse({ shown: true });
    return true;
  }
  if (msg?.type === 'tweetContextFor') {
    const img = Array.from(document.querySelectorAll('img')).find((i) =>
      sameImage(i.src, msg.srcUrl),
    );
    const article = img?.closest('article[data-testid="tweet"]') as HTMLElement | null;
    // The post's words are the strongest hint for a hard-to-read cover, so send them
    // along with the permalink rather than making the model work from pixels alone.
    const context: TweetContext = article
      ? { permalink: tweetPermalink(article), ...scrapeTweet(article) }
      : { permalink: null, text: '', links: [] };
    sendResponse({ permalink: context.permalink, text: context.text, links: context.links });
    return true;
  }
});
