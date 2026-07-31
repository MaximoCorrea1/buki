// Buki content script: inject a Save button on tweets, scrape + recognize,
// and save the pick to your own reading list. Also renders feedback for the
// background worker's right-click OCR flow.
import type { Tweet, Book } from '../recognizer/types';
import type { Intent, SavedBook, SavedSource } from './storage';
import { clothFor } from './cloth';
import { createToastStack } from './toastStack';
import { createPickerQueue } from './pickerQueue';
import type { AttemptDraft, PendingEvent } from './recognitionLog';
import type {
  BackgroundRequest,
  BackgroundResponse,
  ContentRequest,
  ShelfResponse,
  TweetContext,
} from './messages';

const BTN_CLASS = 'buki-save-btn';

/**
 * Boundary tracing. This extension coordinates three isolated contexts, so a failure
 * anywhere in the chain looks identical from the page: nothing happens. Logging each
 * hand-off is what makes "it does nothing" diagnosable.
 * Silence it with: localStorage.bukiQuiet = '1'
 */
const trace = (...args: unknown[]): void => {
  try {
    if (localStorage.getItem('bukiQuiet') === '1') return;
  } catch {
    /* storage can be blocked; log anyway */
  }
  console.info('[Buki]', ...args);
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
.buki-btn {
  cursor: pointer; background: transparent; border: 0; padding: 4px 6px;
  margin-left: 4px; border-radius: 999px; font-size: 15px; line-height: 1;
  opacity: .72; transition: opacity 140ms cubic-bezier(.23,1,.32,1),
    transform 140ms cubic-bezier(.23,1,.32,1), background-color 140ms ease;
}
.buki-btn:disabled { cursor: default; }
.buki-btn:active { transform: scale(.9); }
.buki-btn:focus-visible { outline: 2px solid #6c7bff; outline-offset: 1px; opacity: 1; }
@media (hover: hover) and (pointer: fine) {
  .buki-btn:hover { opacity: 1; background: rgba(108,123,255,.18); }
}

/* Toasts stack rather than replace: saving three books in a row should show three
   confirmations, not one that keeps being overwritten before it can be read. Oldest at
   the top, newest nearest the corner, which is the direction they leave in. */
.buki-stack {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
  pointer-events: none;
}

/* An in-progress stage still updates in place. Blurring on swap makes two different
   strings read as one object changing its mind rather than a crossfade of two. */
.buki-pill {
  max-width: 330px; padding: 10px 14px; border-radius: 10px;
  background: #17151f; color: #f2f0fa; border: 1px solid #2a2637;
  font: 13.5px/1.4 system-ui, sans-serif; box-shadow: 0 6px 22px rgba(0,0,0,.45);
  opacity: 0; transform: translateY(8px) scale(.97);
  /* Transitions, not keyframes: toasts arrive in bursts, and a keyframe restarts from
     zero when interrupted where a transition retargets from where it is. */
  transition: opacity 180ms cubic-bezier(.23,1,.32,1),
    transform 180ms cubic-bezier(.23,1,.32,1), filter 130ms ease;
}
.buki-pill.buki-in { opacity: 1; transform: none; }
.buki-pill.buki-out { opacity: 0; transform: translateY(4px) scale(.97); }
.buki-pill.buki-swap { filter: blur(2.5px); opacity: .55; }

.buki-panel {
  position: absolute; z-index: 2147483000; width: 288px; padding: 6px;
  background: #17151f; color: #f2f0fa; border: 1px solid #2a2637;
  border-radius: 11px; box-shadow: 0 12px 34px rgba(0,0,0,.55);
  font: 13.5px/1.45 system-ui, sans-serif;
  /* Origin at the trigger: the panel should look like it came out of the button. */
  transform-origin: top left; opacity: 0; transform: scale(.96) translateY(-2px);
  transition: opacity 180ms cubic-bezier(.23,1,.32,1),
    transform 180ms cubic-bezier(.23,1,.32,1);
}
.buki-panel.buki-in { opacity: 1; transform: none; }

/* No anchor: the feed recycled the image away mid-recognition. Park the panel in the
   corner rather than dropping the result - losing a recognized book is the exact
   failure this extension exists to prevent. Clear of the status pill at bottom: 20px. */
.buki-panel.buki-corner {
  position: fixed; left: auto; top: auto; right: 20px; bottom: 72px;
  transform-origin: bottom right;
}

.buki-cand { position: relative; padding: 7px 8px 8px 16px; border-radius: 6px; }
.buki-cand + .buki-cand { margin-top: 1px; }
.buki-cand::before {
  content: ''; position: absolute; left: 5px; top: 4px; bottom: 4px; width: 4px;
  border-radius: 1px; background: var(--cloth, #6c7bff);
}
.buki-cand::after {
  /* Cords as a highlight over a shadow, never flat gilt - a gold line vanishes on
     marigold cloth, which is how the shelf's signature detail once shipped invisible. */
  content: ''; position: absolute; left: 5px; top: 11px; width: 4px; height: 1px;
  background: rgba(255,255,255,.55);
  box-shadow: 0 1px 0 rgba(0,0,0,.3), 0 15px 0 rgba(255,255,255,.55), 0 16px 0 rgba(0,0,0,.3);
}
.buki-t { font-weight: 600; letter-spacing: -.006em; }
.buki-a { font-size: 12px; opacity: .55; }

.buki-row { display: flex; gap: 4px; margin-top: 6px; }
.buki-intent {
  flex: 1; cursor: pointer; border: 0; border-radius: 6px; padding: 5px 0;
  background: #241f33; color: #f2f0fa; font: 600 11.5px/1 ui-monospace, Menlo, monospace;
  letter-spacing: .06em; text-transform: uppercase;
  transition: background-color 140ms ease, transform 140ms cubic-bezier(.23,1,.32,1);
}
.buki-intent:active { transform: scale(.96); }
.buki-intent:disabled { opacity: .45; cursor: default; }
.buki-intent:focus-visible { outline: 2px solid #6c7bff; outline-offset: 1px; }
@media (hover: hover) and (pointer: fine) {
  .buki-intent:not(:disabled):hover { background: #6c7bff; color: #fff; }
}

.buki-none { padding: 10px 10px 11px; opacity: .7; line-height: 1.5; }

@media (prefers-reduced-motion: reduce) {
  .buki-panel, .buki-pill { transition-duration: 1ms; transform: none; }
  .buki-btn, .buki-intent { transition-duration: 1ms; }
}
`;

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
/**
 * Was this content script left behind by an extension reload or update?
 *
 * Chrome does not re-inject content scripts into pages that are already open, so after
 * every update the old script keeps running against a background worker that no longer
 * exists, and every message throws "Extension context invalidated". Refreshing the tab is
 * the only fix, so say that rather than "try again in a moment" - which never works.
 */
const orphaned = (err?: unknown): boolean =>
  !chrome.runtime?.id ||
  (err instanceof Error && /context invalidated|receiving end does not exist/i.test(err.message));

const REFRESH = 'Buki just updated — refresh this page to keep catching books.';

async function recognize(
  tweet: Tweet,
  job: string,
): Promise<{ candidates: Book[]; draft: AttemptDraft } | null> {
  if (orphaned()) {
    toast(REFRESH, job);
    return null;
  }

  const resp = (await chrome.runtime.sendMessage({
    type: 'recognize',
    tweet,
  } satisfies BackgroundRequest)) as BackgroundResponse | undefined;

  if (!resp) throw new Error('No response from the recognizer');
  if (!resp.ok) {
    // Already phrased for the user, and retrying cannot help - say what is wrong rather
    // than throwing it onto the generic "try again in a moment" path.
    if (resp.needsSetup) {
      toast(resp.error, job);
      return null;
    }
    throw new Error(resp.error);
  }
  return { candidates: resp.result.candidates, draft: resp.draft };
}

/**
 * Ask the worker to write to the shelf. It owns `savedBooks` outright: a per-context
 * write queue cannot see a sibling context's write, and two of them interleaving is how
 * a book gets silently dropped.
 */
async function saveBook(book: Book, intent: Intent, source?: SavedSource): Promise<SavedBook> {
  const resp = (await chrome.runtime.sendMessage({
    type: 'saveBook',
    book,
    intent,
    ...(source ? { source } : {}),
  } satisfies BackgroundRequest)) as ShelfResponse | undefined;

  if (!resp) throw new Error('No response from the shelf');
  if (!resp.ok) throw new Error(resp.error);
  if (!resp.saved) throw new Error('Shelf did not return the saved book');
  return resp.saved;
}

/**
 * Hand a finished event to the background, which is the log's only writer. Diagnostics:
 * a failure here must never surface as a failed save.
 */
function report(event: PendingEvent): void {
  void chrome.runtime
    .sendMessage({ type: 'logEvent', event } satisfies BackgroundRequest)
    .catch((err: unknown) => console.error('[Buki] log write failed', err));
}

// ---------------------------------------------------------------- toasts

/**
 * What the corner shows is decided in `toastStack.ts` and merely drawn here.
 *
 * The rules used to live in this file as one module-level `stage` element, which meant
 * two books caught at once shared a single progress pill: the second overwrote the
 * first's text, and the first to finish dismissed the pill the second was still using.
 * Progress belongs to a book, not to the page.
 */
const toasts = createToastStack();
let stackEl: HTMLElement | null = null;
/** Pill id -> the node drawing it, so a repaint updates rather than rebuilds. */
const drawn = new Map<number, HTMLElement>();
/** Per pill, not per page: one shared timer let a second swap cancel the first's text. */
const swapTimers = new WeakMap<HTMLElement, number>();

/** How long a finished message sits before it leaves, and how long leaving takes. */
const LINGER_MS = 2800;
const LEAVE_MS = 220;

function toastHost(): HTMLElement {
  if (!stackEl) {
    stackEl = document.createElement('div');
    stackEl.className = 'buki-stack';
    document.body.appendChild(stackEl);
  }
  return stackEl;
}

/**
 * Blur out, swap the words, blur back: one object changing its mind rather than two
 * strings crossfading through each other.
 */
function swapText(el: HTMLElement, text: string): void {
  clearTimeout(swapTimers.get(el));
  el.classList.add('buki-swap');
  swapTimers.set(
    el,
    window.setTimeout(() => {
      el.textContent = text;
      el.classList.remove('buki-swap');
    }, 110),
  );
}

/** Reconcile the corner to whatever the stack now says, keyed by pill id. */
function paintToasts(): void {
  const host = toastHost();
  const pills = toasts.list();
  const live = new Set(pills.map((p) => p.id));

  for (const [id, el] of drawn) {
    if (live.has(id)) continue;
    drawn.delete(id);
    el.classList.add('buki-out');
    el.classList.remove('buki-in');
    setTimeout(() => el.remove(), LEAVE_MS);
  }

  // Pills are only ever appended, so drawing in list order keeps the DOM in step.
  for (const pill of pills) {
    const existing = drawn.get(pill.id);
    if (existing) {
      if (existing.textContent !== pill.text) swapText(existing, pill.text);
      continue;
    }
    const el = document.createElement('div');
    el.className = 'buki-pill';
    el.setAttribute('role', 'status');
    el.textContent = pill.text;
    host.appendChild(el);
    drawn.set(pill.id, el);
    // Next frame, so the transition has a starting value to animate from.
    requestAnimationFrame(() => el.classList.add('buki-in'));
  }
}

/** A stage of work still running for `job`. Updates that book's own pill in place. */
function progress(job: string, msg: string): void {
  toasts.stage(job, msg);
  paintToasts();
}

/**
 * Say something and, if `job` is given, end that catch - clearing its progress pill and
 * only its own. A sibling still working keeps hers.
 */
function toast(msg: string, job: string | null = null): void {
  toasts.done(job, msg);
  paintToasts();
  const settled = toasts.list().at(-1);
  if (!settled) return;
  setTimeout(() => {
    toasts.dismiss(settled.id);
    paintToasts();
  }, LINGER_MS);
}

// ---------------------------------------------------------------- picker

/**
 * Books recognized and waiting for a decision. See `pickerQueue.ts`: this used to be a
 * single slot that every new recognition overwrote, so catching a second book before
 * choosing an intent for the first destroyed the first panel - and since the 📚 flow can
 * only save through a panel, that book was never saved, and its cleanup logged a
 * dismissal the user was never offered the chance to make.
 */
const pickers = createPickerQueue<PendingPick>();
let mounted: { el: HTMLElement; cleanup: () => void } | null = null;

interface PendingPick {
  anchor: HTMLElement | null;
  candidates: Book[];
  opts: PickerOptions;
}

/** Take the panel down and bring up the next book that has been waiting its turn. */
function closePanel(): void {
  if (!mounted) return;
  mounted.cleanup();
  mounted.el.remove();
  mounted = null;
  pickers.settle();
  mountPicker();
}

/** Recognized a book: show it now if the screen is free, otherwise hold its place. */
function queuePick(
  anchor: HTMLElement | null,
  candidates: Book[],
  opts: PickerOptions = {},
): void {
  pickers.push({ anchor, candidates, opts });
  mountPicker();
}

/** How many books are recognized and still waiting behind the open panel. */
const waitingToPick = (): number => pickers.waiting();

function mountPicker(): void {
  if (mounted) return;
  const next = pickers.current();
  if (!next) return;
  // The feed is virtualized, so a tweet can be recycled away while its book waits in the
  // queue. Fall back to the corner rather than dropping a book we already recognized.
  const anchor = next.anchor?.isConnected ? next.anchor : null;
  mounted = buildPanel(anchor, next.candidates, next.opts);
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

function buildPanel(
  anchor: HTMLElement | null,
  candidates: Book[],
  opts: PickerOptions = {},
): { el: HTMLElement; cleanup: () => void } {
  const panel = document.createElement('div');
  panel.className = anchor ? 'buki-panel' : 'buki-panel buki-corner';

  // Every close path runs cleanup, and cleanup reports a dismissal - so the guard is
  // what stops a successful save being logged twice, once as confirmed and once as not.
  let settled = false;
  const settle = (result: PickOutcome): void => {
    if (settled) return;
    settled = true;
    opts.onOutcome?.(result);
  };

  // A click is an unambiguous confirmation, but the write is a round trip to the worker.
  // Without this flag an eviction during that trip (a scroll, a click away, a second
  // recognition) reached cleanup first and logged a save the user DID make as
  // "dismissed" - quietly corrupting the one number the log exists to produce.
  let saving = false;

  if (!candidates.length) {
    const empty = document.createElement('div');
    empty.className = 'buki-none';
    empty.textContent = 'No book named here. Right-click the cover image to read it instead.';
    panel.appendChild(empty);
  } else {
    candidates.forEach((book) => {
      const row = document.createElement('div');
      row.className = 'buki-cand';
      row.style.setProperty('--cloth', clothFor(book));

      const title = document.createElement('div');
      title.className = 'buki-t';
      title.textContent = book.title;
      const author = document.createElement('div');
      author.className = 'buki-a';
      author.textContent = book.author;
      row.append(title, author);

      const btns = document.createElement('div');
      btns.className = 'buki-row';
      (['now', 'next', 'someday'] as Intent[]).forEach((intent) => {
        const b = document.createElement('button');
        b.className = 'buki-intent';
        b.textContent = intent;
        b.addEventListener('click', async () => {
          // Disable the whole row: a second click would re-enter the save and race
          // the storage write.
          btns.querySelectorAll('button').forEach((el) => (el.disabled = true));
          saving = true;
          try {
            const saved = await saveBook(book, intent, opts.source);
            settle({ outcome: 'confirmed', savedId: saved.id });
            closePanel();
            toast(`Saved: ${book.title} → ${intent}`);
          } catch (err) {
            console.error('[Buki] save failed', err);
            saving = false;
            btns.querySelectorAll('button').forEach((el) => (el.disabled = false));
            toast(orphaned(err) ? REFRESH : "Couldn't save to your shelf.");
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
    // Only once this panel is the one on screen: during construction `mounted` is still
    // the previous panel (or nothing), and closing then would advance the queue past a
    // book that was never shown.
    if (!anchor.isConnected) {
      if (mounted?.el === panel) closePanel();
      return;
    }

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
  requestAnimationFrame(() => panel.classList.add('buki-in'));

  const onClickAway = (e: MouseEvent): void => {
    if (!panel.contains(e.target as Node) && e.target !== anchor) closePanel();
  };
  // One cleanup used by every close path, so listeners can't outlive the panel.
  const cleanup = (): void => {
    document.removeEventListener('click', onClickAway);
    window.removeEventListener('scroll', place, true);
    window.removeEventListener('resize', place);
    // Not while a confirmed save is still in flight - that click already decided this.
    if (!saving) settle({ outcome: 'dismissed' });
  };
  setTimeout(() => document.addEventListener('click', onClickAway), 0);
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);

  return { el: panel, cleanup };
}

// ---------------------------------------------------------------- injection

let injected = 0;

/** One id per press, so two books caught at once never share a progress pill. */
let jobSeq = 0;

function addButton(article: HTMLElement): void {
  if (article.querySelector(`.${BTN_CLASS}`)) return;
  const actions = article.querySelector('[role="group"]');
  if (!actions) return;

  const btn = document.createElement('button');
  btn.className = `${BTN_CLASS} buki-btn`;
  btn.textContent = '📚';
  btn.title = 'Save this book to your shelf';
  btn.setAttribute('aria-label', 'Save this book to your shelf');

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
    const job = `tweet${++jobSeq}`;
    try {
      const tweet = scrapeTweet(article);
      // Captured now, not after the await: the feed can recycle this node in place while
      // recognition runs, and re-reading it then attributes the book to another post.
      const permalink = tweetPermalink(article);
      trace('clicked. scraped:', {
        text: tweet.text.slice(0, 60),
        images: tweet.imageUrls.length,
        links: tweet.links.length,
      });

      progress(job, 'Looking up the book…');
      const recognized = await recognize(tweet, job);
      if (!recognized) return; // no key; recognize() already said so
      const { candidates, draft } = recognized;
      trace('lookup returned', candidates.length, 'candidate(s)', candidates);

      // The feed recycles tweets while a lookup is in flight. This used to drop the
      // result, which loses a book that was successfully recognized - the exact failure
      // the extension exists to prevent. Fall back to the corner, as the right-click
      // flow already does.
      const anchor = btn.isConnected ? btn : null;
      if (!anchor) trace('tweet scrolled away; anchoring the picker to the corner');

      // A no-match panel has nothing to pick, so its outcome is already known.
      if (!candidates.length) report({ ...draft, outcome: 'no-match' });

      queuePick(anchor, candidates, {
        source: sourceFor(permalink),
        ...(candidates.length ? { onOutcome: (o) => report({ ...draft, ...o }) } : {}),
      });
      // Say what is waiting, or a book recognized behind an open panel looks like nothing
      // happened - which is what made rapid catching feel like it dropped things.
      const queued = waitingToPick();
      const found = candidates.length ? `Found ${candidates.length}` : 'No book found in this tweet';
      toast(queued ? `${found} · ${queued} waiting` : found, job);
      trace('picker queued;', queued, 'waiting');
    } catch (err) {
      console.error('[Buki] lookup failed', err);
      toast(orphaned(err) ? REFRESH : 'Book lookup failed — try again in a moment.', job);
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
    // A sticky message needs a job to belong to; without one there is no way to tell
    // whose progress it is, so it degrades to a plain message rather than hijacking
    // somebody else's pill - which is exactly the bug this rewrite removed.
    if (msg.sticky && msg.job) progress(msg.job, msg.text);
    else toast(msg.text, msg.job ?? null);
    return;
  }
  if (msg?.type === 'ping') {
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'pick') {
    const { candidates, draft, permalink } = msg;
    // The progress pill is ended by the worker's own toast just before it sends this, so
    // there is nothing to clear here - and clearing "the" pill from this path is what
    // used to wipe a sibling catch's progress.
    // The same URL-path lookup that resolves the permalink also positions the panel, so
    // it opens at the image being pointed at.
    const img = Array.from(document.querySelectorAll('img')).find((i) =>
      sameImage(i.src, msg.srcUrl),
    );
    queuePick(img ?? null, candidates, {
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
