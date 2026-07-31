import {
  createLibrary,
  matchesFilter,
  type StorageArea,
  type SavedBook,
  type Intent,
} from './storage';
import { createRecognitionLog, summarize, type RecognitionEvent } from './recognitionLog';
import { buyLink, type Store } from './buyLink';
import { clothFor } from './cloth';
import { readSettings } from './settings';
import type { BackgroundRequest, ShelfResponse } from './messages';

const storage: StorageArea = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
};
/**
 * Reads only. Every WRITE goes through the background worker, which owns `savedBooks`:
 * a per-context write queue cannot see a sibling context's write, and two interleaving
 * is how a book gets silently dropped.
 */
const library = createLibrary({
  storage,
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
});

async function writeShelf(request: BackgroundRequest): Promise<void> {
  const resp = (await chrome.runtime.sendMessage(request)) as ShelfResponse | undefined;
  if (!resp) throw new Error('No response from the shelf');
  if (!resp.ok) throw new Error(resp.error);
}

/**
 * Reads only. Every write goes through the background worker so the log has exactly one
 * writer - see background.ts. Constructing the full object here just avoids a second way
 * to spell the storage key.
 */
const log = createRecognitionLog({ storage, now: () => Date.now() });

const INTENTS: Intent[] = ['now', 'next', 'someday', 'read'];
const LABELS: Record<Intent, string> = {
  now: 'Reading now',
  next: 'Up next',
  someday: 'Someday',
  read: 'Finished',
};
const SOURCE_LABEL = { tweet: 'the post that sold you', page: 'where you found it' } as const;

/** Past this many books the shelf needs finding, not just scrolling. */
const FILTER_FROM = 15;

function blankCover(initial: string): HTMLElement {
  const blank = document.createElement('div');
  blank.className = 'cover blank';
  blank.textContent = initial;
  return blank;
}

/**
 * The cover does real work beyond decoration: a wrong match becomes obvious at a glance,
 * which is the feedback the kept-rate measurement depends on.
 */
function coverFor(saved: SavedBook): HTMLElement {
  const initial = saved.book.title.trim()[0]?.toUpperCase() ?? '?';
  if (!saved.book.coverUrl) return blankCover(initial);

  const img = document.createElement('img');
  img.className = 'cover';
  img.src = saved.book.coverUrl;
  img.alt = '';
  img.loading = 'lazy'; // a hundred rows must not fire a hundred requests at once
  // A cover that 404s should become the cloth block, not a broken-image glyph.
  img.addEventListener('error', () => img.replaceWith(blankCover(initial)));
  return img;
}

function link(href: string, text: string, className: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.className = className;
  a.textContent = text;
  return a;
}

function renderBook(
  saved: SavedBook,
  index: number,
  store: Store,
  onChange: () => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'spine';
  row.style.setProperty('--cloth', clothFor(saved.book));
  // Capped: a hundred books must not spend three seconds cascading in.
  row.style.animationDelay = `${Math.min(index, 8) * 28}ms`;

  const edge = document.createElement('div');
  edge.className = 'edge';

  const meta = document.createElement('div');
  meta.className = 'meta';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = saved.book.title;
  meta.appendChild(title);

  if (saved.book.author) {
    const author = document.createElement('div');
    author.className = 'author';
    author.textContent = saved.book.author;
    meta.appendChild(author);
  }

  const links = document.createElement('div');
  links.className = 'links';
  // Only http(s): the source is browser-supplied today, but this keeps a future
  // paste/import path from putting a javascript: URL on the shelf.
  if (saved.source && /^https?:\/\//i.test(saved.source.url)) {
    links.appendChild(link(saved.source.url, SOURCE_LABEL[saved.source.kind], 'src'));
  }
  const buy = buyLink(saved.book, store);
  if (buy) links.appendChild(link(buy, 'Buy', 'buy'));
  if (links.childElementCount) meta.appendChild(links);

  const actions = document.createElement('div');
  actions.className = 'actions';

  if (saved.intent !== 'read') {
    const done = document.createElement('button');
    done.className = 'act';
    done.textContent = '✓';
    done.title = `Mark ${saved.book.title} as finished`;
    done.setAttribute('aria-label', `Mark ${saved.book.title} as finished`);
    done.addEventListener('click', async () => {
      done.disabled = true;
      try {
        // Finishing is not a wrong match, so it must never flag the recognition -
        // only removeBook does that.
        await writeShelf({ type: 'saveBook', book: saved.book, intent: 'read', ...(saved.source ? { source: saved.source } : {}) });
        onChange();
      } catch (err) {
        console.error('[Buki] could not mark it finished', err);
        done.disabled = false;
      }
    });
    actions.appendChild(done);
  }

  const remove = document.createElement('button');
  remove.className = 'act';
  remove.textContent = '×';
  remove.title = `Remove ${saved.book.title}`;
  remove.setAttribute('aria-label', `Remove ${saved.book.title}`);
  remove.addEventListener('click', async () => {
    remove.disabled = true;
    // Play the collapse immediately; the worker's answer decides when to re-render.
    row.classList.add('leaving');
    try {
      // One round trip removes the book AND flags the recognition. Deleting a wrong
      // match is both the fix and the measurement, so the kept rate is guaranteed fresh
      // by the time this resolves - no fixed timer racing a sleeping worker.
      await writeShelf({ type: 'removeBook', savedId: saved.id });
      onChange();
    } catch (err) {
      console.error('[Buki] remove failed', err);
      row.classList.remove('leaving');
      remove.disabled = false;
    }
  });
  actions.appendChild(remove);

  row.append(edge, coverFor(saved), meta, actions);
  return row;
}

function renderEmpty(app: HTMLElement): void {
  const empty = document.createElement('p');
  empty.className = 'empty';
  const lead = document.createElement('b');
  lead.textContent = 'Nothing on the shelf yet.';
  empty.append(
    lead,
    document.createTextNode(
      'Hit the book icon on a post, or right-click a cover image, and it lands here.',
    ),
  );
  app.replaceChildren(empty);
}

/**
 * One line, in the masthead: `23 caught · 78% kept`. The kept rate is the only number
 * worth watching, and it costs nothing to produce - deleting a wrong match is already
 * the fix.
 */
async function renderStats(shelfCount: number): Promise<void> {
  const el = document.getElementById('count');
  if (!el) return;

  let events: RecognitionEvent[] = [];
  try {
    events = await log.list();
  } catch (err) {
    console.error('[Buki] could not read the log', err);
  }

  const { caught, keptPct } = summarize(events);

  // A shelf that predates the log would otherwise read "0 caught" next to real books.
  if (!caught) {
    el.textContent = shelfCount ? `${shelfCount}` : '';
    return;
  }
  el.textContent = keptPct === null ? `${caught} caught` : `${caught} caught · ${keptPct}% kept`;
}

/**
 * Reading and drawing are separate on purpose. Typing in the filter changes nothing on
 * disk, so it repaints from what is already in memory - the previous version re-read the
 * whole shelf AND the settings from chrome.storage on every keystroke.
 */
let shelf: SavedBook[] = [];
let store: Store = 'amazon';
let filterText = '';
let loadFailed = false;

async function load(): Promise<void> {
  try {
    [shelf, store] = await Promise.all([library.list(), readSettings().then((s) => s.store)]);
    loadFailed = false;
  } catch (err) {
    console.error('[Buki] could not read the shelf', err);
    loadFailed = true;
  }
}

function paint(): void {
  const app = document.getElementById('app');
  if (!app) return;

  if (loadFailed) {
    const failed = document.createElement('p');
    failed.className = 'empty';
    failed.textContent = "The shelf didn't load. Close this and open it again.";
    app.replaceChildren(failed);
    return;
  }

  // Snapshot focus before the rebuild, whatever caused it. Restoring only inside the
  // filter's own handler meant a delete or a finish landing mid-type silently kicked
  // the user out of the search box.
  const active = document.activeElement as HTMLInputElement | null;
  const hadFocus = active?.id === 'filter';
  const caret = hadFocus ? (active?.selectionStart ?? 0) : 0;

  void renderStats(shelf.length);
  const disclosure = document.getElementById('disclosure');
  if (disclosure) disclosure.hidden = shelf.length === 0;

  if (!shelf.length) {
    renderEmpty(app);
    return;
  }

  app.replaceChildren();

  // A search box on a shelf of four is chrome for its own sake.
  if (shelf.length > FILTER_FROM) {
    const filter = document.createElement('input');
    filter.id = 'filter';
    filter.type = 'search';
    filter.placeholder = `Find among ${shelf.length} books`;
    filter.value = filterText;
    filter.addEventListener('input', () => {
      filterText = filter.value;
      paint(); // synchronous: no storage read, no await, no render race
    });
    app.appendChild(filter);
  }

  let index = 0;
  let shown = 0;
  for (const intent of INTENTS) {
    const group = shelf.filter((s) => s.intent === intent && matchesFilter(s, filterText));
    if (!group.length) continue;
    shown += group.length;

    const heading = document.createElement('h2');
    heading.append(LABELS[intent]);
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = `${group.length}`;
    heading.appendChild(n);
    app.appendChild(heading);

    group.forEach((saved) => {
      app.appendChild(renderBook(saved, index, store, () => void refresh()));
      index++;
    });
  }

  if (!shown) {
    const none = document.createElement('p');
    none.className = 'empty';
    none.textContent = `Nothing matches "${filterText.trim()}".`;
    app.appendChild(none);
  }

  if (hadFocus) {
    const next = document.getElementById('filter') as HTMLInputElement | null;
    next?.focus();
    // Without this the caret jumps to the start of the field on every repaint.
    next?.setSelectionRange(caret, caret);
  }
}

/** The shelf changed on disk: re-read it, then draw. */
async function refresh(): Promise<void> {
  await load();
  paint();
}

void refresh();
