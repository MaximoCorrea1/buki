import { createLibrary, type StorageArea, type SavedBook, type Intent } from './storage';
import { createRecognitionLog, summarize, type RecognitionEvent } from './recognitionLog';
import { buyLink, type Store } from './buyLink';
import { coverFor } from './cover';
import { pruneCovers, liveCoverDeps } from './coverCache';
import { readSettings } from './settings';
import {
  PILES,
  PILE_LABEL,
  booksIn,
  countByPile,
  finishedBooks,
  finishedHead,
  searchAll,
  shelvesOf,
} from './shelfView';
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

/** One handle for the whole popup: each call to `liveCoverDeps` opens the cache again. */
const covers = liveCoverDeps();

async function writeShelf(request: BackgroundRequest): Promise<void> {
  const resp = (await chrome.runtime.sendMessage(request)) as ShelfResponse | undefined;
  if (!resp) throw new Error('No response from the shelf');
  if (!resp.ok) throw new Error(resp.error);
}

/**
 * Reads only. Every write goes through the background worker so the log has exactly one
 * writer - see background.ts.
 */
const log = createRecognitionLog({ storage, now: () => Date.now() });

const SOURCE_LABEL = { tweet: 'the post that sold you', page: 'where you found it' } as const;

/**
 * The Buy button names where it goes.
 *
 * It used to say "Buy" on a 3px pill. As a full-width action it can afford the truth, and
 * a control that says where it is about to send you is the honest form for a link that
 * earns a commission. The disclosure in the footer stays either way; Web Store policy
 * permits an affiliate link only when it is disclosed.
 */
const STORE_LABEL: Record<Store, string> = {
  amazon: 'Buy on Amazon',
  bookshop: 'Buy on Bookshop.org',
};

/** Four across at 560px is a 118px cover, the smallest a title reads at. */
const PER_SHELF = 4;

/** An empty state is an invitation, so each one says what puts a book here. */
const EMPTY_PILE: Record<Intent, string> = {
  now: 'Nothing on the go. Open a book from Next and it moves here.',
  next: 'Nothing queued. Catch a book from a post and it lands here.',
  someday: 'Nothing parked here yet.',
  read: "You haven't finished a book yet. Mark one as read and it becomes a record here.",
};

function link(href: string, text: string, className: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.className = className;
  a.textContent = text;
  return a;
}

/* ------------------------------------------------------------------------ *
 * State. Reading and drawing are separate on purpose: typing in the search
 * box changes nothing on disk, so it repaints from what is already in memory.
 * ------------------------------------------------------------------------ */

let shelf: SavedBook[] = [];
let store: Store = 'amazon';
let query = '';
/** Which pile you are standing in. Not persisted: opening the popup starts you at Now. */
let pile: Intent = 'now';
let loadFailed = false;

async function load(): Promise<void> {
  try {
    [shelf, store] = await Promise.all([library.list(), readSettings().then((s) => s.store)]);
    loadFailed = false;
    // Bound the cache by the shelf rather than by everything ever recognized. Safe here
    // because a book still on the shelf is always in `keep`, including one the worker is
    // fetching a cover for right now.
    // Both urls per book: pruning on coverUrl alone would delete every caught picture
    // on the next open, which is the cache going from a speed-up to a liability.
    void pruneCovers(
      shelf.flatMap((s) => [s.shot, s.book.coverUrl]),
      covers,
    );
  } catch (err) {
    console.error('[Buki] could not read the shelf', err);
    loadFailed = true;
  }
}

/* ------------------------------------------------------------------------ *
 * The shelf
 * ------------------------------------------------------------------------ */

/**
 * One book, face out: its cover, then its title and author underneath.
 *
 * The caption carries the title even though the drawn board also stamps it. Real cover
 * art at 118px is often unreadable, so the caption is the one place a title is
 * guaranteed - and a shelf where some books are captioned and some are not is worse than
 * saying it twice.
 */
function renderSlot(
  saved: SavedBook,
  tag?: (saved: SavedBook) => string,
): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'slot';

  const pick = document.createElement('button');
  pick.className = 'pick';
  pick.setAttribute('aria-label', `${saved.book.title} by ${saved.book.author}`);
  pick.addEventListener('click', () => openSheet(saved));
  pick.appendChild(coverFor(saved, covers));

  const cap = document.createElement('div');
  cap.className = 'cap';
  const title = document.createElement('div');
  title.className = 't';
  title.textContent = saved.book.title;
  cap.appendChild(title);
  if (saved.book.author) {
    const author = document.createElement('div');
    author.className = 'a';
    author.textContent = saved.book.author;
    cap.appendChild(author);
  }
  if (tag) {
    const from = document.createElement('div');
    from.className = 'from';
    from.textContent = tag(saved);
    cap.appendChild(from);
  }

  slot.append(pick, cap);
  return slot;
}

/** A pile, as boards with four books resting on each. */
function renderShelves(
  app: HTMLElement,
  books: SavedBook[],
  tag?: (saved: SavedBook) => string,
): void {
  for (const row of shelvesOf(books, PER_SHELF)) {
    const shelfRow = document.createElement('div');
    shelfRow.className = 'shelf';
    for (const saved of row) shelfRow.appendChild(renderSlot(saved, tag));
    const plank = document.createElement('div');
    plank.className = 'plank';
    app.append(shelfRow, plank);
  }
}

/**
 * The piles, as places rather than headings.
 *
 * One scroll containing four groups made the piles a typographic convention: you could
 * not be IN Now. A segment is somewhere you stand, and the same control moves a book in
 * the sheet, so there is one idea to learn rather than two.
 */
function renderPiles(app: HTMLElement): void {
  const counts = countByPile(shelf);
  const bar = document.createElement('div');
  bar.className = 'piles';
  bar.setAttribute('role', 'tablist');

  for (const each of PILES) {
    const tab = document.createElement('button');
    tab.className = 'pile';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(each === pile));
    tab.append(PILE_LABEL[each]);
    if (counts[each]) {
      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = `${counts[each]}`;
      tab.appendChild(n);
    }
    tab.addEventListener('click', () => {
      pile = each;
      paint();
    });
    bar.appendChild(tab);
  }
  app.appendChild(bar);
}

/* ------------------------------------------------------------------------ *
 * Picking a book up
 * ------------------------------------------------------------------------ */

let lastPicked: HTMLElement | null = null;

function closeSheet(): void {
  const sheet = document.getElementById('sheet');
  if (!sheet || sheet.hidden) return;
  sheet.dataset.in = 'false';
  // Exit is never slower than entrance: the system responding must not feel slower than
  // the system arriving.
  setTimeout(() => {
    sheet.hidden = true;
    sheet.replaceChildren();
  }, 150);
  lastPicked?.focus();
}

/**
 * The same control that says where a book is, is the one that moves it.
 *
 * That answers "promoting Someday to Now means re-catching the book" without adding a
 * menu, and it is the same component as the top-level navigation. `saveBook` upserts on
 * `sameBook`, so this IS the move - there is no move message and there must not be one,
 * because the worker owns the shelf.
 */
function movePiles(saved: SavedBook): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'piles';

  for (const each of PILES) {
    const to = document.createElement('button');
    to.className = 'pile';
    to.setAttribute('aria-selected', String(each === saved.intent));
    to.textContent = PILE_LABEL[each];
    to.addEventListener('click', async () => {
      if (each === saved.intent) return closeSheet();
      const buttons = [...bar.querySelectorAll('button')] as HTMLButtonElement[];
      buttons.forEach((b) => (b.disabled = true));
      try {
        // Moving is not a wrong match, so it must never flag the recognition. Only
        // removeBook does that.
        await writeShelf({
          type: 'saveBook',
          book: saved.book,
          intent: each,
          ...(saved.source ? { source: saved.source } : {}),
        });
        closeSheet();
        await refresh();
      } catch (err) {
        console.error('[Buki] could not move it', err);
        buttons.forEach((b) => (b.disabled = false));
      }
    });
    bar.appendChild(to);
  }
  return bar;
}

/** Set apart, and not red. Red is for danger; removing a book you chose to save is a
 *  decision. */
function removeButton(saved: SavedBook): HTMLElement {
  const drop = document.createElement('button');
  drop.className = 'drop';
  drop.textContent = 'Remove from shelf';
  drop.addEventListener('click', async () => {
    drop.disabled = true;
    try {
      // One round trip removes the book AND flags the recognition. Deleting a wrong match
      // is both the fix and the measurement, so the kept rate is fresh by the time this
      // resolves - no fixed timer racing a sleeping worker.
      await writeShelf({ type: 'removeBook', savedId: saved.id });
      closeSheet();
      await refresh();
    } catch (err) {
      console.error('[Buki] remove failed', err);
      drop.disabled = false;
    }
  });
  return drop;
}

/** A sheet over the shelf, not a new page: you are still on the shelf, you have just
 *  taken one book off it. */
function openSheet(saved: SavedBook): void {
  const sheet = document.getElementById('sheet');
  if (!sheet) return;
  lastPicked = document.activeElement as HTMLElement | null;

  const scrim = document.createElement('div');
  scrim.id = 'scrim';
  scrim.addEventListener('click', closeSheet);

  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', saved.book.title);

  const shut = document.createElement('button');
  shut.className = 'shut';
  shut.textContent = '×';
  shut.setAttribute('aria-label', 'Close');
  shut.addEventListener('click', closeSheet);

  /**
   * ONE COLUMN, in the order the card is actually used: the book, then where it goes,
   * then what you can do with it, then the way out.
   *
   * It used to be a left-aligned two-column block above two centred controls, which put
   * the Buy pill alone on the left while everything under it sat on the axis. Two axes in
   * a 500px card, and the stranded one was the control that earns money.
   */
  const art = document.createElement('div');
  art.className = 'held';
  art.appendChild(coverFor(saved, covers));

  const title = document.createElement('h3');
  title.textContent = saved.book.title;

  const parts: Node[] = [shut, art, title];

  if (saved.book.author) {
    const by = document.createElement('div');
    by.className = 'by';
    by.textContent = saved.book.author;
    parts.push(by);
  }

  // Filing the book is what the sheet is FOR, so the pile control comes before Buy. An
  // affiliate link outranking the product's own job would be a dark pattern in a small way.
  parts.push(movePiles(saved));

  // No buy link on a finished book. A record is not an inbox item.
  const buy = saved.intent === 'read' ? null : buyLink(saved.book, store);
  if (buy) parts.push(link(buy, STORE_LABEL[store], 'buy'));

  // The post that sold you: the one thing no competitor stores, so it goes on the axis
  // rather than into a column of links.
  // Only http(s): the source is browser-supplied today, but this keeps a future
  // paste/import path from putting a javascript: URL on the shelf.
  if (saved.source && /^https?:\/\//i.test(saved.source.url)) {
    parts.push(link(saved.source.url, SOURCE_LABEL[saved.source.kind], 'src'));
  }

  parts.push(removeButton(saved));
  card.append(...parts);
  sheet.replaceChildren(scrim, card);
  sheet.hidden = false;
  // Two frames: the element has to be laid out at its start state before the transition
  // has anything to travel from.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      sheet.dataset.in = 'true';
    }),
  );
  shut.focus();
}

/* ------------------------------------------------------------------------ *
 * Paint
 * ------------------------------------------------------------------------ */

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

function say(app: HTMLElement, text: string): void {
  const line = document.createElement('p');
  line.className = 'empty';
  line.textContent = text;
  app.appendChild(line);
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
  // search box's own handler meant a move or a removal landing mid-type silently kicked
  // the user out of the field.
  const active = document.activeElement as HTMLInputElement | null;
  const hadFocus = active?.id === 'find';
  const caret = hadFocus ? (active?.selectionStart ?? 0) : 0;

  void renderStats(shelf.length);
  const disclosure = document.getElementById('disclosure');
  if (disclosure) disclosure.hidden = shelf.length === 0;

  if (!shelf.length) {
    renderEmpty(app);
    return;
  }

  app.replaceChildren();
  renderPiles(app);

  const find = document.createElement('input');
  find.id = 'find';
  find.type = 'search';
  find.placeholder = `Find among ${shelf.length} book${shelf.length === 1 ? '' : 's'}`;
  find.value = query;
  find.addEventListener('input', () => {
    query = find.value;
    paint(); // synchronous: no storage read, no await, no render race
  });
  app.appendChild(find);

  // Searching leaves the pile you were in and crosses all of them; clearing the box puts
  // you back where you were. Finding a book is a different job from browsing a pile.
  if (query.trim()) {
    const hits = searchAll(shelf, query);
    renderShelves(
      app,
      hits.map((hit) => hit.saved),
      (saved) => PILE_LABEL[saved.intent],
    );
    if (!hits.length) say(app, `Nothing matches "${query.trim()}".`);
  } else if (pile === 'read') {
    const head = finishedHead(shelf);
    if (head) {
      const record = document.createElement('p');
      record.className = 'record';
      record.textContent = head;
      app.appendChild(record);
    }
    const done = finishedBooks(shelf);
    const month = new Map(done.map((f) => [f.saved.id, f.month]));
    renderShelves(
      app,
      done.map((f) => f.saved),
      (saved) => month.get(saved.id) ?? '',
    );
    if (!done.length) say(app, EMPTY_PILE.read);
  } else {
    const books = booksIn(shelf, pile);
    renderShelves(app, books);
    if (!books.length) say(app, EMPTY_PILE[pile]);
  }

  if (hadFocus) {
    const next = document.getElementById('find') as HTMLInputElement | null;
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

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSheet();
});

document.getElementById('settings')?.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});

void refresh();
