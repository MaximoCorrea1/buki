import { createLibrary, type StorageArea, type SavedBook, type Intent } from './storage';
import { createRecognitionLog, summarize, type RecognitionEvent } from './recognitionLog';
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
const SOURCE_LABEL = { tweet: 'the tweet that sold you', page: 'where you found it' } as const;

/**
 * Bookcloth. A shelf looks like a shelf because the bindings differ, so each book
 * keeps its own colour rather than being colour-coded by status - the grouping
 * already says which pile it's in.
 */
const CLOTH = ['#7c3a2e', '#c8873f', '#2e5d5a', '#47505c', '#6e7a5a'];

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

function renderBook(saved: SavedBook, index: number, onChange: () => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'spine';
  row.style.setProperty('--cloth', clothFor(saved.book));
  // Short titles get a shorter gap between the cords, so the binding stays in
  // proportion to the book rather than looking stretched.
  row.style.setProperty('--cords', saved.book.author ? '22px' : '14px');
  row.style.animationDelay = `${Math.min(index, 8) * 30}ms`;

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = saved.book.title;
  row.appendChild(title);

  if (saved.book.author) {
    const author = document.createElement('div');
    author.className = 'author';
    author.textContent = saved.book.author;
    row.appendChild(author);
  }

  // Only http(s): the source is browser-supplied today, but this keeps a future
  // paste/import path from putting a javascript: URL on the shelf.
  if (saved.source && /^https?:\/\//i.test(saved.source.url)) {
    const link = document.createElement('a');
    link.className = 'source';
    link.href = saved.source.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = `${SOURCE_LABEL[saved.source.kind]} →`;
    row.appendChild(link);
  }

  const remove = document.createElement('button');
  remove.className = 'remove';
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

      // Collapse the row before re-rendering, so the shelf is seen closing the
      // gap rather than the book simply blinking out of existence.
      row.style.height = `${row.offsetHeight}px`;
      requestAnimationFrame(() => row.classList.add('leaving'));
      setTimeout(() => void flagged.then(onChange), 200);
    } catch (err) {
      console.error('[Shelfy] remove failed', err);
      remove.disabled = false;
    }
  });
  row.appendChild(remove);

  return row;
}

function renderEmpty(app: HTMLElement): void {
  const empty = document.createElement('p');
  empty.className = 'empty';
  const lead = document.createElement('b');
  lead.textContent = 'The shelf is empty.';
  empty.append(
    lead,
    document.createTextNode(
      ' Hit the book icon on a tweet, or right-click a cover image, and it lands here.',
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

async function render(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  let all: SavedBook[];
  try {
    all = await library.list();
  } catch (err) {
    console.error('[Shelfy] could not read the shelf', err);
    const failed = document.createElement('p');
    failed.className = 'empty';
    failed.textContent = "The shelf didn't load. Close this and open it again.";
    app.replaceChildren(failed);
    return;
  }

  void renderStats(all.length);

  if (!all.length) {
    renderEmpty(app);
    return;
  }

  app.replaceChildren();
  let index = 0;
  for (const intent of INTENTS) {
    const group = all.filter((s) => s.intent === intent);
    if (!group.length) continue;

    const heading = document.createElement('h2');
    heading.textContent = LABELS[intent];
    heading.style.animationDelay = `${Math.min(index, 8) * 30}ms`;
    app.appendChild(heading);
    index++;

    group.forEach((saved) => {
      app.appendChild(renderBook(saved, index, () => void render()));
      index++;
    });
  }
}

void render();
