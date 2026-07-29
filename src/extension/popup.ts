import {
  createLibrary,
  matchesFilter,
  type StorageArea,
  type SavedBook,
  type Intent,
} from './storage';
import { createRecognitionLog, summarize, type RecognitionEvent } from './recognitionLog';
import { buyLink, type Store } from './buyLink';
import { readSettings } from './settings';
import type { BackgroundRequest } from './messages';

const storage: StorageArea = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
};
const library = createLibrary({
  storage,
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
});

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

/**
 * Bookcloth. A shelf looks like a shelf because the bindings differ, so each book
 * keeps its own colour rather than being colour-coded by status - the grouping
 * already says which pile it's in.
 */
const CLOTH = ['#ff6352', '#FFB020', '#2FB88A', '#6C7BFF', '#B265D9'];

/**
 * Same book, same cloth, forever - derived from the book, not from insertion order.
 * djb2 rather than a naive *31: the simple version bunched real titles onto the same
 * two colours, which defeats the point of having a varied shelf.
 */
function clothFor(book: SavedBook['book']): string {
  const key = book.isbn ?? `${book.title}|${book.author}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  return CLOTH[hash % CLOTH.length] ?? CLOTH[0]!;
}

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

function link(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noreferrer';
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
    links.appendChild(link(saved.source.url, SOURCE_LABEL[saved.source.kind]));
  }
  const buy = buyLink(saved.book, store);
  if (buy) {
    if (links.childElementCount) {
      const dot = document.createElement('span');
      dot.textContent = '·';
      links.appendChild(dot);
    }
    links.appendChild(link(buy, 'buy'));
  }
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
        // Finishing is not a wrong match, so it must never flag the recognition.
        await library.add(saved.book, 'read', saved.source);
        onChange();
      } catch (err) {
        console.error('[Shelfy] could not mark it finished', err);
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
    try {
      await library.remove(saved.id);
      // Deleting a wrong match is both the fix and the measurement. The background
      // decides whether this was soon enough after saving to count against the
      // recognizer, rather than you simply changing your mind about reading it.
      //
      // Started here but awaited below: waking a sleeping service worker can take long
      // enough that a re-render would read the old kept rate and appear not to have
      // noticed the delete. The collapse plays during the round trip either way.
      const flagged = chrome.runtime
        .sendMessage({ type: 'markWrong', savedId: saved.id } satisfies BackgroundRequest)
        .catch((err: unknown) => console.error('[Shelfy] could not flag the match', err));

      row.classList.add('leaving');
      setTimeout(() => void flagged.then(onChange), 170);
    } catch (err) {
      console.error('[Shelfy] remove failed', err);
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
    console.error('[Shelfy] could not read the log', err);
  }

  const { caught, keptPct } = summarize(events);

  // A shelf that predates the log would otherwise read "0 caught" next to real books.
  if (!caught) {
    el.textContent = shelfCount ? `${shelfCount}` : '';
    return;
  }
  el.textContent = keptPct === null ? `${caught} caught` : `${caught} caught · ${keptPct}% kept`;
}

let filterText = '';

async function render(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  let all: SavedBook[];
  let store: Store;
  try {
    [all, store] = await Promise.all([library.list(), readSettings().then((s) => s.store)]);
  } catch (err) {
    console.error('[Shelfy] could not read the shelf', err);
    const failed = document.createElement('p');
    failed.className = 'empty';
    failed.textContent = "The shelf didn't load. Close this and open it again.";
    app.replaceChildren(failed);
    return;
  }

  void renderStats(all.length);
  const disclosure = document.getElementById('disclosure');
  if (disclosure) disclosure.hidden = all.length === 0;

  if (!all.length) {
    renderEmpty(app);
    return;
  }

  app.replaceChildren();

  // A search box on a shelf of four is chrome for its own sake.
  if (all.length > FILTER_FROM) {
    const filter = document.createElement('input');
    filter.id = 'filter';
    filter.type = 'search';
    filter.placeholder = `Find among ${all.length} books`;
    filter.value = filterText;
    filter.addEventListener('input', () => {
      filterText = filter.value;
      void render().then(() => {
        const next = document.getElementById('filter') as HTMLInputElement | null;
        if (!next) return;
        next.focus();
        // Without this the caret jumps to the start of the field on every keystroke.
        next.setSelectionRange(next.value.length, next.value.length);
      });
    });
    app.appendChild(filter);
  }

  let index = 0;
  let shown = 0;
  for (const intent of INTENTS) {
    const group = all.filter((s) => s.intent === intent && matchesFilter(s, filterText));
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
      app.appendChild(renderBook(saved, index, store, () => void render()));
      index++;
    });
  }

  if (!shown) {
    const none = document.createElement('p');
    none.className = 'empty';
    none.textContent = `Nothing matches "${filterText.trim()}".`;
    app.appendChild(none);
  }
}

void render();
