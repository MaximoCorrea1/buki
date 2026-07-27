// Book Catcher content script: inject a Save button on tweets, scrape + recognize,
// and save the pick to your own reading list. Also renders feedback for the
// background worker's right-click OCR flow.
import { recognizeBook } from '../recognizer/recognizer';
import { createOpenLibraryClient } from '../recognizer/openLibrary';
import type { VisionClient, Tweet, Book } from '../recognizer/types';
import { createLibrary, type Intent, type StorageArea } from './storage';
import type { ContentRequest, ContentResponse } from './messages';

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

// The tweet flow reads links + text only. Image recognition lives in the right-click
// flow (background -> offscreen Tesseract), which is where the cover actually gets read.
const noVision: VisionClient = {
  async guessBook() {
    return null;
  },
};

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
const PALETTE = {
  ink: '#211c1a',
  paper: '#f3efe7',
  lamp: '#e7b24c',
  teal: '#2e5d5a',
  rule: '#47505c',
};

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

async function recognize(tweet: Tweet): Promise<Book[]> {
  const result = await recognizeBook(tweet, { vision: noVision, books });
  if (result.candidates.length) return result.candidates;

  // Fallback: search the tweet text itself (catches "reading X by Y" tweets).
  const q = tweet.text.replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  return q ? (await books.search({ title: q })).slice(0, 3) : [];
}

// ---------------------------------------------------------------- toasts

const activeToasts: HTMLElement[] = [];

function toast(msg: string): void {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText =
    `position:fixed;right:20px;z-index:99999;background:${PALETTE.ink};color:${PALETTE.lamp};` +
    'padding:10px 14px;border-radius:8px;font:14px system-ui;box-shadow:0 4px 16px rgba(0,0,0,.4)';
  // Stack rather than overlap: the OCR flow fires two toasts inside one lifetime.
  t.style.bottom = `${20 + activeToasts.length * 48}px`;

  document.body.appendChild(t);
  activeToasts.push(t);
  setTimeout(() => {
    t.remove();
    const i = activeToasts.indexOf(t);
    if (i !== -1) activeToasts.splice(i, 1);
    activeToasts.forEach((el, n) => (el.style.bottom = `${20 + n * 48}px`));
  }, 2500);
}

// ---------------------------------------------------------------- picker

let openPanel: { el: HTMLElement; cleanup: () => void } | null = null;

function closePanel(): void {
  openPanel?.cleanup();
  openPanel?.el.remove();
  openPanel = null;
}

function openPicker(anchor: HTMLElement, candidates: Book[], source?: string): void {
  closePanel(); // only ever one picker; a second would strand the first

  const panel = document.createElement('div');
  panel.style.cssText =
    `position:absolute;z-index:99999;background:${PALETTE.ink};color:${PALETTE.paper};` +
    `border:1px solid ${PALETTE.rule};border-radius:10px;padding:8px;width:270px;` +
    'font:13px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.5)';

  if (!candidates.length) {
    const empty = document.createElement('div');
    empty.textContent = 'No match found. Try the right-click flow on the cover image.';
    empty.style.opacity = '.7';
    panel.appendChild(empty);
  } else {
    candidates.forEach((book) => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:6px 0;border-bottom:1px solid #333';

      const title = document.createElement('div');
      title.style.fontWeight = '600';
      title.textContent = book.title;
      const author = document.createElement('div');
      author.style.opacity = '.7';
      author.textContent = book.author;
      row.append(title, author);

      const btns = document.createElement('div');
      btns.style.marginTop = '5px';
      (['now', 'next', 'someday'] as Intent[]).forEach((intent) => {
        const b = document.createElement('button');
        b.textContent = intent;
        b.style.cssText =
          `margin-right:4px;cursor:pointer;background:${PALETTE.teal};color:#fff;border:none;` +
          'border-radius:6px;padding:3px 8px';
        b.addEventListener('click', async () => {
          // Disable the whole row: a second click would re-enter the save and race
          // the storage write.
          btns.querySelectorAll('button').forEach((el) => (el.disabled = true));
          try {
            await library.add(book, intent, source ? { url: source, kind: 'tweet' } : undefined);
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
    // The feed is virtualized; if the tweet was recycled away, close rather than
    // leave the panel pinned to a zeroed rect in the corner.
    if (!anchor.isConnected) return closePanel();
    const rect = anchor.getBoundingClientRect();
    panel.style.left = `${rect.left + window.scrollX}px`;
    panel.style.top = `${rect.bottom + window.scrollY + 4}px`;
  };
  place();
  document.body.appendChild(panel);

  const onClickAway = (e: MouseEvent): void => {
    if (!panel.contains(e.target as Node) && e.target !== anchor) closePanel();
  };
  // One cleanup used by every close path, so listeners can't outlive the panel.
  const cleanup = (): void => {
    document.removeEventListener('click', onClickAway);
    window.removeEventListener('scroll', place, true);
    window.removeEventListener('resize', place);
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
  btn.className = BTN_CLASS;
  btn.textContent = '📚';
  btn.title = 'Save book to your shelf';
  btn.style.cssText = 'cursor:pointer;background:transparent;border:none;font-size:16px;margin-left:8px';

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

      const candidates = await recognize(tweet);
      trace('lookup returned', candidates.length, 'candidate(s)', candidates);

      if (!article.isConnected) return trace('tweet scrolled away; dropping result');
      openPicker(btn, candidates, tweetPermalink(article) ?? location.href);
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

chrome.runtime.onMessage.addListener((msg: ContentRequest, _sender, sendResponse) => {
  if (msg?.type === 'toast') {
    toast(msg.text);
    return;
  }
  if (msg?.type === 'resolvePermalink') {
    const img = Array.from(document.querySelectorAll('img')).find((i) => i.src === msg.srcUrl);
    const article = img?.closest('article[data-testid="tweet"]') as HTMLElement | null;
    const response: ContentResponse = { permalink: article ? tweetPermalink(article) : null };
    sendResponse(response);
    return true;
  }
});
