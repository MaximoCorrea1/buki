// Buki content script: inject a Save button on tweets, scrape + recognize, and render the
// catch tray - the extension's only in-page surface. Both flows (the 📚 button and the
// worker's right-click menu) put their catches in the same tray.
import type { Book, RecognitionSource, Tweet } from '../recognizer/types';
import { identityOf, type Intent, type SavedSource } from './storage';
import { clothFor } from './cloth';
import { createCatchTray, type Candidate, type Card } from './catchTray';
import { postKey } from './lookupMemo';
import type { AttemptDraft, PendingEvent } from './recognitionLog';
import type {
  BackgroundRequest,
  BackgroundResponse,
  ContentRequest,
  ShelfResponse,
  Shelved,
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
 * The palette is the landing page's, variable for variable - a library at night, one warm
 * lamp. The extension is the same room seen from inside X, so a catch should look like a
 * shelf row that drifted into the feed rather than a notification from another product.
 *
 * Motion is rationed by how often a surface is seen. The button is hit dozens of times a
 * day, so it only ever presses - no entrance animation. A card appears once per catch, so
 * it can afford one.
 */
const STYLE = `
.buki-btn {
  cursor: pointer; background: transparent; border: 0; padding: 4px 6px;
  margin-left: 4px; border-radius: 999px; font-size: 15px; line-height: 1;
  opacity: .72; transition: opacity 140ms cubic-bezier(.23,1,.32,1),
    transform 140ms cubic-bezier(.23,1,.32,1), background-color 140ms ease;
}
.buki-btn:active { transform: scale(.9); }
.buki-btn:focus-visible { outline: 2px solid #ffcf8a; outline-offset: 1px; opacity: 1; }
@media (hover: hover) and (pointer: fine) {
  .buki-btn:hover { opacity: 1; background: rgba(255,207,138,.16); }
}

/* ------------------------------------------------------------------ the tray

   One column, bottom-right, newest nearest the corner. Unlimited by count and bounded
   only by the screen: catching six books in a row should show six cards, and the stack
   that used to cap at three quietly dropped the rest of your afternoon. */
.buki-tray {
  /* docs/brand.md is the source. A content script cannot share a stylesheet with the
     landing page, so these are a copy: change them there and here in the same commit. */
  --night: #0f0d10; --sunk: #1b1424; --line: #3a2e4d;
  --paper: #ffffff; --chalk: #ede7f4; --dim: #b4a6c8; --glow: #ffc24d;
  /* The shelf marker's jade is lightened for text; the binding jade lives in cloth.ts. */
  --jade: #6fe0b6;
  --ease: cubic-bezier(.23,1,.32,1);
  --drawer: cubic-bezier(.32,.72,0,1);
  --book: ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --ui: system-ui, -apple-system, "Segoe UI", sans-serif;
  --tag: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  position: fixed; right: 18px; bottom: 18px; z-index: 2147483000;
  display: flex; flex-direction: column; gap: 9px;
  width: 332px; max-width: calc(100vw - 36px); max-height: calc(100vh - 36px);
  overflow-y: auto; overscroll-behavior: contain;
  scrollbar-width: thin; scrollbar-color: #332a45 transparent;
  /* The column is transparent to clicks so it never swallows one meant for the feed.
     Each card opts back in. */
  pointer-events: none;
}
.buki-tray, .buki-tray * { box-sizing: border-box; }
/* Bottom-aligned by margin, not justify-content: a flex-end column clips its own
   overflow at the TOP, which hides the oldest card instead of letting you scroll to it. */
.buki-slot:first-child { margin-top: auto; }
.buki-slot { width: 100%; pointer-events: auto; }

.buki-card {
  position: relative; width: 100%;
  padding: 11px 30px 12px 19px; /* left inset for the spine, right for the dismiss */
  background: var(--night); color: var(--chalk);
  border: 1px solid var(--line); border-radius: 12px;
  box-shadow: 0 16px 38px -14px rgba(0,0,0,.8);
  font: 13.5px/1.45 var(--ui);
  opacity: 0; transform: translateY(10px) scale(.985);
  /* Transitions, not keyframes: catches arrive in bursts, and a keyframe restarts from
     zero when interrupted where a transition retargets from wherever it got to. */
  transition: opacity 180ms var(--ease), transform 180ms var(--ease), filter 120ms ease;
}
.buki-card.buki-in { opacity: 1; transform: none; }
/* Exit is faster than entrance: the system responding should never be slower than the
   system arriving. */
.buki-card.buki-out { opacity: 0; transform: translateY(4px) scale(.99);
  transition-duration: 190ms; }
/* Blur bridges the two states so "reading" BECOMING "a book" reads as one object
   changing rather than two cards crossfading through each other. */
.buki-card.buki-swap { filter: blur(3px); opacity: .45; }

/* The signature: a cloth spine down the edge, as on the shelf and in the popup. */
.buki-card::before {
  content: ''; position: absolute; left: 7px; top: 12px; bottom: 12px; width: 4px;
  border-radius: 2px; background: var(--cloth, var(--line));
}
.buki-card[data-book]::after {
  /* Cords as a highlight over a shadow, never flat gilt - a gold line vanishes on
     marigold cloth, which is how this detail once shipped invisible. */
  content: ''; position: absolute; left: 7px; top: 20px; width: 4px; height: 1px;
  background: #ffffff; box-shadow: 0 13px 0 #ffffff;
}

.buki-head { display: flex; gap: 11px; align-items: flex-start; }
/* A found card's head is the card's own masthead: where the answer came from, and how
   many books are in it. Both sit on the axis. The rows below stay left-aligned, because
   a title is read from its first letter. */
.buki-card[data-book] .buki-head { display: block; text-align: center; }
.buki-count { margin-top: 2px; font-size: 12.5px; color: var(--dim); }
.buki-thumb {
  position: relative; width: 30px; height: 44px; flex: none; border-radius: 2px;
  overflow: hidden; box-shadow: 0 1px 6px -1px #000;
  /* Flat cloth, not a gradient. It is also the floor rather than a placeholder: X's own
     CSP can refuse an OpenLibrary cover, and a broken-image glyph would read as the
     extension being broken rather than as a picture that did not load. */
  background: var(--cloth, #3a2e4d);
}
.buki-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.buki-who { flex: 1; min-width: 0; }

/* The eyebrow carries WHERE the answer came from. It is the audit trail: a shelf you
   cannot question is a shelf you stop trusting. */
.buki-eyebrow {
  font: 10px/1.5 var(--tag); text-transform: uppercase; letter-spacing: .1em;
  color: var(--dim);
}
.buki-eyebrow[data-shelf] { color: var(--jade); }
.buki-t {
  margin-top: 1px; font: 15.5px/1.25 var(--book); overflow-wrap: anywhere;
  color: var(--paper);
}
/* A message is the interface talking, not a book title - so it stays in the UI face. */
.buki-t.buki-plain { font: 13.5px/1.45 var(--ui); margin-top: 0; color: var(--chalk); }
.buki-a { margin-top: 2px; font-size: 12.5px; color: var(--dim); }

.buki-x {
  /* Out of the flow, so a centred head is actually centred on the card rather than on
     whatever space is left over beside a button. */
  position: absolute; top: 9px; right: 8px; z-index: 1;
  cursor: pointer; border: 0; border-radius: 7px; padding: 1px 6px 3px;
  background: transparent; color: var(--chalk); opacity: .45; font: 16px/1 var(--ui);
  transition: opacity 140ms ease, background-color 140ms ease,
    transform 140ms var(--ease);
}
.buki-x:active { transform: scale(.9); }
.buki-x:focus-visible { outline: 2px solid var(--glow); outline-offset: 1px; opacity: 1; }
@media (hover: hover) and (pointer: fine) {
  .buki-x:hover { opacity: 1; background: #2a2135; }
}

/* Still working. Constant motion, so linear - an eased sweep looks like it is being
   pushed rather than running. */
.buki-wait {
  margin: 9px 0 1px; height: 2px; border-radius: 1px; overflow: hidden;
  background: var(--line);
}
.buki-wait::after {
  content: ''; display: block; height: 100%; width: 38%; border-radius: 1px;
  background: var(--glow);
  animation: buki-sweep 1.15s linear infinite;
}
@keyframes buki-sweep { from { transform: translateX(-105%); } to { transform: translateX(370%); } }

.buki-row { display: flex; gap: 5px; margin: 11px 0 0; }
.buki-intent {
  flex: 1; cursor: pointer; border: 1px solid transparent; border-radius: 7px;
  padding: 6px 0 7px; background: var(--sunk); color: var(--chalk);
  font: 600 10.5px/1 var(--tag); letter-spacing: .1em; text-transform: uppercase;
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease,
    transform 140ms var(--ease);
}
.buki-intent:active { transform: scale(.96); }
.buki-intent:disabled { cursor: default; }
.buki-intent:focus-visible { outline: 2px solid var(--glow); outline-offset: 1px; }
@media (hover: hover) and (pointer: fine) {
  .buki-intent:not(:disabled):hover { background: var(--glow); color: #241705; }
}
/* The pile it is already in. Stated rather than greyed out: the point is that clicking
   it would change nothing, which is information, not a disabled control. */
.buki-intent[data-here] {
  background: transparent; border-color: var(--line); color: var(--dim);
}

.buki-act {
  margin: 11px 0 0; cursor: pointer; border: 1px solid var(--line); border-radius: 7px;
  padding: 6px 11px 7px; background: transparent; color: var(--chalk);
  font: 600 10.5px/1 var(--tag); letter-spacing: .1em; text-transform: uppercase;
  transition: border-color 140ms ease, background-color 140ms ease,
    transform 140ms var(--ease);
}
.buki-act:active { transform: scale(.97); }
.buki-act:focus-visible { outline: 2px solid var(--glow); outline-offset: 1px; }
@media (hover: hover) and (pointer: fine) {
  .buki-act:hover { border-color: var(--glow); background: #2a2135; }
}


/* One book among several.

   The hairline between rows is what makes four decisions read as four rather than as one
   long form: the card is a short list, and a list needs its items separated or it is a
   paragraph. */
.buki-find { display: flex; gap: 11px; align-items: flex-start; margin-top: 12px; }
.buki-find + .buki-find { padding-top: 12px; border-top: 1px solid var(--line); }
/* Per book, not per card: a photographed stack can be half yours already. */
.buki-shelf {
  display: inline-block; margin-left: 3px; padding: 1px 6px 2px; border-radius: 999px;
  vertical-align: 1px; background: #10352a; color: var(--jade);
  font: 600 9.5px/1.6 var(--tag); letter-spacing: .06em; text-transform: uppercase;
}
.buki-act.buki-wide { width: 100%; margin-top: 12px; }

/* Pressing a post that is already on screen. Nothing new happens by design, so the card
   that already exists has to be the thing that answers. */
@keyframes buki-nudge {
  35% { border-color: var(--glow); box-shadow: 0 0 0 3px rgba(255,207,138,.15),
    0 16px 38px -14px rgba(0,0,0,.8); }
}
.buki-card.buki-nudge { animation: buki-nudge 620ms var(--ease); }

@media (prefers-reduced-motion: reduce) {
  .buki-card, .buki-slot, .buki-intent, .buki-act, .buki-x, .buki-btn {
    transition-duration: 1ms !important; animation: none !important;
  }
  .buki-card { transform: none !important; }
  .buki-wait::after { animation: none; width: 100%; opacity: .45; }
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

// ---------------------------------------------------------------- the worker

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

const REFRESH = 'Buki just updated. Refresh this page to keep catching books.';

interface Recognized {
  candidates: Book[];
  source: RecognitionSource;
  draft: AttemptDraft;
  alreadySaved: Shelved[];
}

/**
 * Recognition happens in the background worker, not here: it owns the vision key, and
 * cross-origin calls belong where host_permissions apply. It also means this button and
 * the right-click menu resolve books through exactly the same pipeline - including
 * reading the cover image, which this flow previously ignored.
 */
async function recognize(tweet: Tweet, job: string, fromText = false): Promise<Recognized | null> {
  if (orphaned()) {
    tray.fail(job, REFRESH);
    paintTray();
    return null;
  }

  const resp = (await chrome.runtime.sendMessage({
    type: 'recognize',
    tweet,
    job,
    ...(fromText ? { fromText: true } : {}),
  } satisfies BackgroundRequest)) as BackgroundResponse | undefined;

  if (!resp) throw new Error('No response from the recognizer');
  if (!resp.ok) {
    // Already phrased for the user, and retrying cannot help - say what is wrong rather
    // than throwing it onto the generic "try again in a moment" path.
    if (resp.needsSetup) {
      tray.fail(job, resp.error);
      paintTray();
      return null;
    }
    throw new Error(resp.error);
  }
  return {
    candidates: resp.result.candidates,
    source: resp.result.source,
    draft: resp.draft,
    alreadySaved: resp.alreadySaved,
  };
}

/**
 * Ask the worker to write to the shelf. It owns `savedBooks` outright: a per-context
 * write queue cannot see a sibling context's write, and two of them interleaving is how
 * a book gets silently dropped.
 */
async function saveBook(book: Book, intent: Intent, source?: SavedSource, shot?: string) {
  const resp = (await chrome.runtime.sendMessage({
    type: 'saveBook',
    book,
    intent,
    ...(source ? { source } : {}),
    // The picture this catch was read from. It becomes the cover on the shelf, because
    // it is the book that was actually seen rather than whatever edition a relevance
    // index put first.
    ...(shot ? { shot } : {}),
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

// ---------------------------------------------------------------- what a catch knows

const tray = createCatchTray();

/** What the user did with a catch. Exactly one of these is ever recorded per attempt. */
type Outcome =
  | { outcome: 'confirmed'; savedId: string }
  | { outcome: 'dismissed' }
  | { outcome: 'no-match' };

interface CatchContext {
  /** Kept so "try the post's words" can re-ask without the worker remembering anything. */
  tweet: Tweet;
  source: SavedSource;
  draft: AttemptDraft;
  settled: boolean;
}

const contexts = new Map<string, CatchContext>();

/**
 * Only a permalink is "the tweet that sold you". Falling back to the feed URL but still
 * labelling it a tweet would put `x.com/home` behind that link, which is the failure the
 * whole source field exists to prevent.
 */
const sourceFor = (permalink: string | null): SavedSource =>
  permalink ? { url: permalink, kind: 'tweet' } : { url: location.href, kind: 'page' };

function remember(job: string, tweet: Tweet, permalink: string | null, draft: AttemptDraft): void {
  contexts.set(job, { tweet, source: sourceFor(permalink), draft, settled: false });
}

/**
 * Record what became of an attempt, once.
 *
 * Every close path used to report a dismissal, so a successful save could be logged twice
 * - once as confirmed and once as not - quietly corrupting the one number the log exists
 * to produce.
 */
function settle(job: string, result: Outcome): void {
  const ctx = contexts.get(job);
  if (!ctx || ctx.settled) return;
  ctx.settled = true;
  report({ ...ctx.draft, ...result });
}

/**
 * Turn the worker's answer into the card's candidates, marking what the shelf already
 * has and where. Both sides key on `identityOf`, so a book the shelf holds under a
 * different edition still matches - that was complaint #4's real cause.
 */
function candidatesOf(books: Book[], shelved: Shelved[]): Candidate[] {
  const where = new Map(shelved.map((s) => [s.identity, s.intent]));
  return books.map((book) => {
    const intent = where.get(identityOf(book));
    return intent ? { book, shelvedIn: intent } : { book };
  });
}

// ---------------------------------------------------------------- rendering the tray

/** How long a message with nothing to decide sits before it leaves. */
const DONE_MS = 2600;
const ERROR_MS = 6000;
/** Leaving, swapping one state for another, and travelling to a new position. */
const LEAVE_MS = 200;
const SWAP_MS = 115;
const TRAVEL_MS = 280;

let trayEl: HTMLElement | null = null;
/** Card id -> the nodes drawing it. The slot travels; the card fades, blurs and holds. */
const drawn = new Map<number, { slot: HTMLElement; card: HTMLElement }>();
/** Per card, not per page: one shared timer let a second swap cancel the first's text. */
const swaps = new Map<number, number>();
/** Transient cards that are already on their way out. */
const leaving = new Map<number, number>();

const motion = (): boolean => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function trayHost(): HTMLElement {
  if (!trayEl) {
    trayEl = document.createElement('div');
    trayEl.className = 'buki-tray';
    trayEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(trayEl);
  }
  return trayEl;
}

/**
 * Move things without teleporting them.
 *
 * A card that becomes a book is twice the height it was, and its neighbours have to go
 * somewhere. Flex reflow is not transitionable, so: measure, mutate, put everything back
 * where it was, and let it travel from there. This is the whole fix for a found card
 * appearing to shove the column rather than push it.
 */
function reflow(mutate: () => void): void {
  if (!motion()) {
    mutate();
    return;
  }
  const before = new Map<HTMLElement, number>();
  for (const { slot } of drawn.values()) before.set(slot, slot.getBoundingClientRect().top);

  mutate();

  const moved: HTMLElement[] = [];
  for (const { slot } of drawn.values()) {
    const was = before.get(slot);
    if (was === undefined) continue; // brand new: it fades in, it does not travel
    const delta = was - slot.getBoundingClientRect().top;
    if (!delta) continue;
    slot.style.transition = 'none';
    slot.style.transform = `translateY(${delta}px)`;
    moved.push(slot);
  }
  if (!moved.length) return;

  requestAnimationFrame(() => {
    for (const slot of moved) {
      slot.style.transition = `transform ${TRAVEL_MS}ms var(--drawer)`;
      slot.style.transform = '';
    }
  });
}

/** Everything the DOM depends on, so a repaint only rebuilds what actually changed. */
const signature = (c: Card): string =>
  [
    c.state,
    c.text,
    c.source ?? '',
    c.image ?? '',
    c.candidates
      .map((x) => `${x.book.title}/${x.book.coverUrl ?? ''}/${x.shelvedIn ?? ''}/${x.savedTo ?? ''}`)
      .join(),
  ].join('|');

/** Reconcile the corner to whatever the tray now says, keyed by card id. */
function paintTray(): void {
  const host = trayHost();
  const cards = tray.list();
  const live = new Set(cards.map((c) => c.id));

  for (const [id, held] of drawn) {
    if (live.has(id)) continue;
    drawn.delete(id);
    window.clearTimeout(swaps.get(id));
    swaps.delete(id);
    held.card.classList.remove('buki-in');
    held.card.classList.add('buki-out');
    // Fade first, then close the gap - so the neighbours travel instead of jumping when
    // the node finally leaves the flow.
    window.setTimeout(() => reflow(() => held.slot.remove()), LEAVE_MS);
  }

  const fresh: HTMLElement[] = [];
  reflow(() => {
    for (const card of cards) {
      if (drawn.has(card.id)) continue;
      const slot = document.createElement('div');
      slot.className = 'buki-slot';
      const el = document.createElement('div');
      el.className = 'buki-card';
      paintCard(el, card);
      slot.appendChild(el);
      host.appendChild(slot);
      drawn.set(card.id, { slot, card: el });
      fresh.push(el);
    }
  });
  // Next frame, so the transition has a starting value to animate from.
  for (const el of fresh) requestAnimationFrame(() => el.classList.add('buki-in'));

  for (const card of cards) {
    const held = drawn.get(card.id);
    if (held && held.card.dataset['sig'] !== signature(card)) swapCard(card);
  }

  tick(cards);
  host.scrollTop = host.scrollHeight;
}

/** Blur out, change what the card is, blur back. One object changing its mind. */
function swapCard(card: Card): void {
  const held = drawn.get(card.id);
  if (!held) return;
  window.clearTimeout(swaps.get(card.id));
  held.card.classList.add('buki-swap');
  swaps.set(
    card.id,
    window.setTimeout(
      () => {
        swaps.delete(card.id);
        reflow(() => paintCard(held.card, card));
        held.card.classList.remove('buki-swap');
      },
      motion() ? SWAP_MS : 0,
    ),
  );
}

/** Only a message with nothing left to decide is allowed to leave on its own. */
function tick(cards: Card[]): void {
  for (const card of cards) {
    if (!card.transient || leaving.has(card.id)) continue;
    leaving.set(
      card.id,
      window.setTimeout(
        () => {
          leaving.delete(card.id);
          contexts.delete(card.job);
          tray.dismiss(card.id);
          paintTray();
        },
        card.state === 'error' ? ERROR_MS : DONE_MS,
      ),
    );
  }
  for (const [id, timer] of leaving) {
    if (cards.some((c) => c.id === id)) continue;
    window.clearTimeout(timer);
    leaving.delete(id);
  }
}

// ---------------------------------------------------------------- what a card looks like

/** Where the answer came from, in the card's own words. */
const PROVENANCE: Record<string, string> = {
  vision: 'read from the cover',
  // Read off the cover, but the catalogue was unreachable, so nothing corroborated it.
  // Saying so is the difference between a shelf you trust and one you have to re-check.
  unverified: 'read from the cover · unverified',
  link: 'from the link in the post',
  text: "from the post's words",
  none: 'no source',
};

function paintCard(el: HTMLElement, card: Card): void {
  // The best-read book lends the card its cloth. On a card with no book the cords made
  // the edge look like a dashed line somebody forgot to finish, so they come off too.
  const book = card.candidates[0]?.book;
  el.style.setProperty('--cloth', book ? clothFor(book) : '#3a2e4d');
  if (book) el.dataset['book'] = '';
  else delete el.dataset['book'];
  el.replaceChildren(...(card.state === 'found' ? foundBody(card) : messageBody(card)));
  el.dataset['sig'] = signature(card);
}

/**
 * A picture can hold more than one book, so the card is a short list rather than a single
 * answer. Each book carries its own buttons, because a stack of four is four decisions
 * and they are rarely the same decision.
 */
function foundBody(card: Card): Node[] {
  const head = document.createElement('div');
  head.className = 'buki-head';

  const who = document.createElement('div');
  who.className = 'buki-who';
  who.append(provenanceOf(card));
  if (card.candidates.length > 1) {
    const count = document.createElement('div');
    count.className = 'buki-count';
    count.textContent = `${card.candidates.length} books in this picture`;
    who.append(count);
  }
  head.append(who, closeButton(card));

  const body: Node[] = [head, ...card.candidates.map((c, i) => bookRow(card, c, i))];
  // Only worth offering when there is a batch. On one book it would be a second button
  // saying what the three above it already say.
  if (card.candidates.length > 1) body.push(saveAllButton(card));
  return body;
}

/** Looking, empty, error, done: one line of text and whatever it can be acted on with. */
function messageBody(card: Card): Node[] {
  const head = document.createElement('div');
  head.className = 'buki-head';

  const thumb = photoThumb(card);
  if (thumb) head.append(thumb);

  const who = document.createElement('div');
  who.className = 'buki-who';
  if (card.state === 'empty') {
    const eye = document.createElement('div');
    eye.className = 'buki-eyebrow';
    eye.textContent = 'nothing on the cover';
    who.append(eye);
  }
  const msg = document.createElement('div');
  msg.className = 'buki-t buki-plain';
  msg.textContent = card.text;
  who.append(msg);

  head.append(who, closeButton(card));

  const body: Node[] = [head];
  if (card.state === 'looking') body.push(waitBar());
  if (card.state === 'empty' && contexts.has(card.job)) body.push(wordsButton(card));
  return body;
}

/** One book: its cover, its name, where the shelf already has it, and three decisions. */
function bookRow(card: Card, cand: Candidate, index: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'buki-find';
  row.append(coverThumb(cand.book));

  const who = document.createElement('div');
  who.className = 'buki-who';

  const title = document.createElement('div');
  title.className = 'buki-t';
  title.textContent = cand.book.title;

  const author = document.createElement('div');
  author.className = 'buki-a';
  author.textContent = cand.book.author;
  if (cand.shelvedIn) {
    // "IT SAVED A BOOK I ALREADY SAVED." It says so before you touch anything - and per
    // book, because a stack can be half yours already.
    const tag = document.createElement('span');
    tag.className = 'buki-shelf';
    tag.textContent = `on your shelf · ${cand.shelvedIn}`;
    author.append(' ', tag);
  }

  who.append(title, author, intentRow(card, cand, index));
  row.append(who);
  return row;
}

/** The picture this catch is reading, for the states that have no book to show yet. */
function photoThumb(card: Card): HTMLElement | null {
  if (!card.image) return null;
  const thumb = document.createElement('div');
  thumb.className = 'buki-thumb';
  const img = document.createElement('img');
  img.src = card.image;
  img.alt = '';
  // The cloth gradient underneath is already the fallback, so a refused picture just
  // leaves a spine rather than a broken-image glyph.
  img.addEventListener('error', () => img.remove());
  thumb.append(img);
  return thumb;
}

/**
 * Where this card's answer came from. It heads the whole card rather than a single book,
 * because the evidence is the picture and the picture is one thing however many books it
 * turned out to hold.
 */
function provenanceOf(card: Card): HTMLElement {
  const eye = document.createElement('div');
  eye.className = 'buki-eyebrow';
  eye.textContent = PROVENANCE[card.source ?? 'none'] ?? 'found';
  return eye;
}

/** A book's own cover. No falling back to the post photo: four books would wear it. */
function coverThumb(book: Book): HTMLElement {
  const thumb = document.createElement('div');
  thumb.className = 'buki-thumb';
  thumb.style.setProperty('--cloth', clothFor(book));
  if (book.coverUrl) {
    const img = document.createElement('img');
    img.src = book.coverUrl;
    img.alt = '';
    img.addEventListener('error', () => img.remove());
    thumb.append(img);
  }
  return thumb;
}

/** Everything at once, at the pile you reach for least. The batch case is a batch. */
function saveAllButton(card: Card): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'buki-act buki-wide';
  b.textContent = 'Save all to Someday';
  b.addEventListener('click', () => void saveAll(card, b));
  return b;
}

function waitBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'buki-wait';
  return bar;
}

function closeButton(card: Card): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'buki-x';
  b.textContent = '×';
  const stopping = card.state === 'looking';
  b.title = stopping ? 'Stop looking' : 'Dismiss';
  b.setAttribute('aria-label', stopping ? 'Stop looking for this book' : 'Dismiss this catch');
  b.addEventListener('click', () => dismiss(card));
  return b;
}

function intentRow(card: Card, cand: Candidate, index: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'buki-row';
  (['now', 'next', 'someday'] as Intent[]).forEach((intent) => {
    const b = document.createElement('button');
    b.className = 'buki-intent';
    b.textContent = intent;
    if (cand.savedTo) {
      b.disabled = true;
      if (cand.savedTo === intent) b.dataset['here'] = '';
    } else if (cand.shelvedIn === intent) {
      // Saving it here again would rewrite the same row with the same value.
      b.disabled = true;
      b.dataset['here'] = '';
      b.title = `Already in ${intent}`;
    }
    b.addEventListener('click', () => void choose(card, cand, index, intent, row));
    row.append(b);
  });
  return row;
}

/** Re-enable everything the click disabled, except the pile the book is already in. */
const releaseRow = (row: HTMLElement): void =>
  row.querySelectorAll('button').forEach((b) => (b.disabled = b.hasAttribute('data-here')));

/** The text a finished card settles on. One book earns its name; four earn a count. */
function doneText(card: Card, moved: boolean): string {
  const only = card.candidates.length === 1 ? card.candidates[0] : undefined;
  return only
    ? `${moved ? 'Moved' : 'Saved'} · ${only.book.title} → ${only.savedTo}`
    : `${card.candidates.length} books on your shelf`;
}

/** Has every book on this card been dealt with? Only then is the card a receipt. */
function allSettled(id: number): Card | null {
  const card = tray.list().find((c) => c.id === id);
  return card && card.candidates.length && card.candidates.every((c) => c.savedTo) ? card : null;
}

async function choose(
  card: Card,
  cand: Candidate,
  index: number,
  intent: Intent,
  row: HTMLElement,
): Promise<void> {
  // Disable the whole row: a second click would re-enter the save and race the write.
  row.querySelectorAll('button').forEach((b) => (b.disabled = true));
  try {
    const saved = await saveBook(cand.book, intent, contexts.get(card.job)?.source, card.image);
    settle(card.job, { outcome: 'confirmed', savedId: saved.id });
    tray.savedOne(card.job, index, intent);
    // Filing one book out of four must not take the other three away with it, so the
    // card only becomes a receipt once there is nothing left on it to decide.
    const finished = allSettled(card.id);
    if (finished) tray.done(card.job, doneText(finished, Boolean(saved.moved)));
    paintTray();
  } catch (err) {
    console.error('[Buki] save failed', err);
    releaseRow(row);
    // On its own card: the decision is still pending, so the card holding it must stay.
    tray.say(orphaned(err) ? REFRESH : "Couldn't save to your shelf.");
    paintTray();
  }
}

/** Everything still undecided on this card, at the pile you commit to least. */
async function saveAll(card: Card, button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  button.textContent = 'Saving…';
  const source = contexts.get(card.job)?.source;
  let firstId = '';
  try {
    // One at a time. The worker serializes shelf writes anyway, so firing four at once
    // only queues them somewhere nobody can see.
    for (const [i, cand] of card.candidates.entries()) {
      if (cand.savedTo) continue;
      const saved = await saveBook(cand.book, 'someday', source, card.image);
      firstId ||= saved.id;
      tray.savedOne(card.job, i, 'someday');
    }
    // One attempt, one event: the log links a recognition to a book so a later delete can
    // mark it wrong, and the first is the one the model read most clearly.
    if (firstId) settle(card.job, { outcome: 'confirmed', savedId: firstId });
    const finished = allSettled(card.id);
    if (finished) tray.done(card.job, doneText(finished, false));
    paintTray();
  } catch (err) {
    console.error('[Buki] save failed', err);
    button.disabled = false;
    button.textContent = 'Save all to Someday';
    tray.say(orphaned(err) ? REFRESH : "Couldn't save to your shelf.");
    paintTray();
  }
}

function wordsButton(card: Card): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'buki-act';
  b.textContent = "Try the post's words";
  b.addEventListener('click', () => void tryWords(card));
  return b;
}

/**
 * The cover held nothing, so ask the other question.
 *
 * Grounding the post's text used to happen silently whenever the image failed, which put
 * books on the shelf that were never in the picture with nothing on screen saying so. As
 * a button it is the same capability with the authorship the other way round.
 */
async function tryWords(card: Card): Promise<void> {
  const ctx = contexts.get(card.job);
  if (!ctx) return;
  tray.retry(card.job, 'Reading the post…');
  paintTray();
  try {
    const found = await recognize(ctx.tweet, card.job, true);
    if (!found) return; // recognize() already put the reason on the card
    remember(card.job, ctx.tweet, ctx.source.kind === 'tweet' ? ctx.source.url : null, found.draft);
    tray.resolve(card.job, candidatesOf(found.candidates, found.alreadySaved), found.source);
    if (!found.candidates.length) settle(card.job, { outcome: 'no-match' });
    paintTray();
  } catch (err) {
    console.error('[Buki] lookup failed', err);
    tray.fail(card.job, orphaned(err) ? REFRESH : 'Book lookup failed. Try again in a moment.');
    paintTray();
  }
}

/**
 * Take a card away. A catch still looking is a lookup still running, so dismissing it
 * calls it off - which is the same button, because "stop" and "I'm done with this" are
 * the same intention at two moments.
 */
function dismiss(card: Card): void {
  if (card.state === 'looking') {
    void chrome.runtime
      .sendMessage({ type: 'cancelRecognize', job: card.job } satisfies BackgroundRequest)
      .catch(() => undefined); // an orphaned page cannot cancel; the card still goes
  } else {
    settle(card.job, { outcome: 'dismissed' });
  }
  contexts.delete(card.job);
  window.clearTimeout(leaving.get(card.id));
  leaving.delete(card.id);
  tray.dismiss(card.id);
  paintTray();
}

/** This post is already on screen. Say so with the card that exists, not a second one. */
function nudge(job: string): void {
  const card = tray.list().find((c) => c.job === job);
  const held = card && drawn.get(card.id);
  if (!held) return;
  held.slot.scrollIntoView({ block: 'nearest', behavior: motion() ? 'smooth' : 'auto' });
  held.card.classList.remove('buki-nudge');
  void held.card.offsetWidth; // restart the animation rather than ignore a repeat press
  held.card.classList.add('buki-nudge');
}

// ---------------------------------------------------------------- injection

let injected = 0;

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

      const tweet = scrapeTweet(article);
      // Captured now, not after the await: the feed can recycle this node in place while
      // recognition runs, and re-reading it then attributes the book to another post.
      const permalink = tweetPermalink(article);
      // The catch is named by the POST. That single choice is what makes one card, one
      // lookup and one cancel-handle the same thing however many times this is pressed -
      // it used to take three collaborating maps to approximate.
      const job = postKey(tweet);

      // Flat, not an object: a collapsed console group hides the image count, and the
      // image count is the first number worth knowing when a catch is slow - every extra
      // picture is one the provider has to download before it can start reading.
      trace(`clicked · ${tweet.imageUrls.length} image(s) · ${tweet.links.length} link(s)`, {
        text: tweet.text.slice(0, 60),
        images: tweet.imageUrls,
      });

      if (!tray.open(job, 'Reading the cover…', tweet.imageUrls[0])) {
        nudge(job);
        return;
      }
      paintTray();

      try {
        const found = await recognize(tweet, job);
        if (!found) return; // recognize() already put the reason on the card
        trace('lookup returned', found.candidates.length, 'candidate(s)', found.candidates);

        remember(job, tweet, permalink, found.draft);
        tray.resolve(job, candidatesOf(found.candidates, found.alreadySaved), found.source);
        // A card with nothing to choose has its outcome already; the button it offers
        // starts a fresh attempt with a draft of its own.
        if (!found.candidates.length) settle(job, { outcome: 'no-match' });
        paintTray();
      } catch (err) {
        console.error('[Buki] lookup failed', err);
        // A dismissed catch has no card left, so this quietly does nothing - which is
        // exactly right for a lookup the user called off.
        tray.fail(job, orphaned(err) ? REFRESH : 'Book lookup failed. Try again in a moment.');
        paintTray();
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

// One coalesced pass per frame. X mutates constantly (and our own button/card writes
// re-trigger the observer), so running a full-document query per mutation put real work
// on the same thread as the page's scrolling.
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

// ---------------------------------------------------------------- from the worker

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
  if (msg?.type === 'catchOpen') {
    if (tray.open(msg.job, msg.text, msg.image)) paintTray();
    else nudge(msg.job);
    sendResponse({ shown: true });
    return true;
  }

  if (msg?.type === 'catchResolve') {
    // Only if the card is still here. Dismissing a catch is "I'm done with this one", and
    // the worker needs to know nobody took the answer so it can record that.
    const shown = tray.list().some((c) => c.job === msg.job);
    if (shown) {
      remember(msg.job, msg.tweet, msg.permalink, msg.draft);
      tray.resolve(msg.job, candidatesOf(msg.candidates, msg.alreadySaved), msg.source);
      if (!msg.candidates.length) settle(msg.job, { outcome: 'no-match' });
      paintTray();
    }
    sendResponse({ shown });
    return true;
  }

  if (msg?.type === 'catchFail') {
    tray.fail(msg.job, msg.text);
    paintTray();
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
  return undefined;
});
