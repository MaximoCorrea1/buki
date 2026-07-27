import { createLibrary, type StorageArea, type SavedBook, type Intent } from './storage';

const storage: StorageArea = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
};
const library = createLibrary({
  storage,
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
});

const INTENTS: Intent[] = ['now', 'next', 'someday'];
const LABELS: Record<Intent, string> = { now: 'Reading now', next: 'Up next', someday: 'Someday' };
const SOURCE_LABEL = { tweet: 'the tweet that sold you', page: 'where you found it' } as const;

function renderBook(saved: SavedBook, onChange: () => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'row';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = saved.book.title;

  const author = document.createElement('div');
  author.className = 'author';
  author.textContent = saved.book.author;

  row.append(title, author);

  if (saved.source) {
    const link = document.createElement('a');
    // Only http(s): the source is browser-supplied today, but this keeps a future
    // paste/import path from turning into a javascript: URL in the shelf.
    const safe = /^https?:\/\//i.test(saved.source.url);
    if (safe) {
      link.href = saved.source.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = SOURCE_LABEL[saved.source.kind];
      row.appendChild(link);
    }
  }

  // The escape hatch: OCR can auto-save a wrong book, so every entry must be removable.
  const remove = document.createElement('button');
  remove.className = 'remove';
  remove.textContent = '×';
  remove.title = `Remove ${saved.book.title}`;
  remove.addEventListener('click', async () => {
    remove.disabled = true;
    try {
      await library.remove(saved.id);
      onChange();
    } catch (err) {
      console.error('[BookCatcher] remove failed', err);
      remove.disabled = false;
    }
  });
  row.appendChild(remove);

  return row;
}

async function render(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  let all: SavedBook[];
  try {
    all = await library.list();
  } catch (err) {
    console.error('[BookCatcher] could not read the shelf', err);
    const failed = document.createElement('p');
    failed.className = 'muted';
    failed.textContent = "Couldn't load your shelf. Reopen to try again.";
    app.replaceChildren(failed);
    return;
  }

  if (!all.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No books yet. Right-click a cover, or hit 📚 on a tweet.';
    app.replaceChildren(empty);
    return;
  }

  app.replaceChildren();
  for (const intent of INTENTS) {
    const group = all.filter((s) => s.intent === intent);
    if (!group.length) continue;

    const heading = document.createElement('h3');
    heading.textContent = LABELS[intent];
    app.appendChild(heading);
    group.forEach((saved) => app.appendChild(renderBook(saved, () => void render())));
  }
}

void render();
