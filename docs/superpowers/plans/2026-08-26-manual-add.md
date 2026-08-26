# Adding a book by hand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `+` in the popup masthead opens a sheet where you search OpenLibrary by title and put a book on a pile, without catching it from a picture.

**Architecture:** Two new pure modules either side of one new message. `manualAdd.ts` holds every popup-side decision (when to search, which answer to keep, what the shelf already holds, what a pick writes); `searchBooks.ts` holds the worker-side handler and reuses the same OpenLibrary client and `catalogue` breaker recognition already uses. `popup.ts` does DOM wiring only, because no test can import it. **No schema change, no manifest change, no new permission.**

**Tech Stack:** TypeScript, MV3 service worker, vitest (Node env, no DOM), esbuild via `build.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-26-manual-add-design.md` (approved 2026-08-26).

> ### Commands on this machine
> `npm run` and `npx` both fail here. Use the binaries directly:
> - Tests: `./node_modules/.bin/vitest run <path>`
> - Typecheck: `node node_modules/typescript/bin/tsc --noEmit`
> - Build: `node build.mjs`
>
> **Large heredocs through bash break on this box.** For any file over ~20 lines, write it
> with the Write tool. See `OPENWORK.md` §5.

> ### The rule this repo runs on
> **Every guard gets mutated before it is committed.** A test that has never been watched to
> fail is not evidence. Task 10 is the mutation pass and it is not optional.
>
> When mutating, **compare the TOTAL, not the failure count**: a mutation that breaks parsing
> makes a file fail to load, so vitest reports a *smaller* all-green total, which reads as
> "survived" and is exactly backwards.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/extension/manualAdd.ts` | **New.** Popup-side decisions. No DOM, no chrome APIs |
| `src/extension/manualAdd.test.ts` | **New.** |
| `src/extension/searchBooks.ts` | **New.** The worker's handler for one message |
| `src/extension/searchBooks.test.ts` | **New.** |
| `src/extension/messages.ts` | `searchBooks` request + `SearchResponse` |
| `src/extension/background.ts` | Three lines: dispatch to `handleSearchBooks` |
| `src/extension/popup.ts` | The `+`, the sheet contents, `renderEmpty`'s third route |
| `popup.html` | The `+` button and its styles |
| `docs/store/listing.md` | The single-purpose statement |

**Untouched, deliberately:** `manifest.json`, `src/extension/storage.ts`, `src/extension/entitlement.ts`, `src/extension/trayCopy.ts`, every pricing surface.

---

### Task 1: The query rule

**Files:**
- Create: `src/extension/manualAdd.ts`
- Create: `src/extension/manualAdd.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { MIN_QUERY, shouldSearch } from './manualAdd';

describe('when a typed query is worth a request', () => {
  it('needs three characters after trimming', () => {
    expect(MIN_QUERY).toBe(3);
    expect(shouldSearch('du')).toBe(false);
    expect(shouldSearch('dun')).toBe(true);
  });

  it('does not count whitespace toward the minimum', () => {
    // A field the user tabbed into and left alone must not fire a request, and
    // "  a  " is that field, not a query.
    expect(shouldSearch('   ')).toBe(false);
    expect(shouldSearch('  a  ')).toBe(false);
    expect(shouldSearch('  dune  ')).toBe(true);
  });

  it('refuses an empty string', () => {
    expect(shouldSearch('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/extension/manualAdd.test.ts`
Expected: FAIL — `Failed to resolve import "./manualAdd"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/extension/manualAdd.ts`:

```ts
/**
 * Every decision behind adding a book by hand, with no DOM and no chrome APIs in it.
 *
 * It is a separate module because `popup.ts` is one of the four files no test can import
 * (`OPENWORK.md` item 55, findings M-5 and M-6). Logic put there would be untestable at
 * birth, which is the exact failure item 43 was filed about: the arithmetic was extracted
 * and the ORDER was left behind, so a mutation bypassed it with the suite green.
 */

/**
 * Below this, a query is noise rather than a search.
 *
 * OpenLibrary answers `a` with thousands of rows that mean nothing, and a request per
 * keystroke is a request per keystroke against the SAME breaker recognition depends on.
 * Three is the shortest prefix that narrows anything.
 */
export const MIN_QUERY = 3;

export function shouldSearch(raw: string): boolean {
  return raw.trim().length >= MIN_QUERY;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/extension/manualAdd.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/extension/manualAdd.ts src/extension/manualAdd.test.ts
git commit -m "feat: the query rule for adding a book by hand"
```

---

### Task 2: Dropping a stale answer

**Files:**
- Modify: `src/extension/manualAdd.ts`
- Modify: `src/extension/manualAdd.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/extension/manualAdd.test.ts`:

```ts
import { isCurrent } from './manualAdd';

describe('which answer to paint when two are in flight', () => {
  it('keeps the newest and drops everything older', () => {
    expect(isCurrent(4, 4)).toBe(true);
    expect(isCurrent(3, 4)).toBe(false);
  });

  it('drops an answer from the FUTURE as well', () => {
    // Not paranoia about time travel: a seq higher than the newest means the popup's
    // counter was reset while a request was in flight, and the safe read of a number
    // that cannot exist is "not mine". Equality, never `>=`.
    expect(isCurrent(9, 4)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/extension/manualAdd.test.ts`
Expected: FAIL — `isCurrent is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/extension/manualAdd.ts`:

```ts
/**
 * A catalogue search is one cheap fetch, so there is no cancel message: the only real
 * hazard is a slow answer landing after a faster newer one and painting the wrong rows.
 * The popup counts its requests and keeps only the answer whose number is still the
 * newest one. `cancelRecognize` exists for the other path because a recognition is long
 * and bills money; this one is neither.
 */
export function isCurrent(seq: number, newest: number): boolean {
  return seq === newest;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/extension/manualAdd.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/extension/manualAdd.ts src/extension/manualAdd.test.ts
git commit -m "feat: drop a search answer the popup has already moved past"
```

---

### Task 3: Matching results against the shelf you already hold

**Files:**
- Modify: `src/extension/manualAdd.ts`
- Modify: `src/extension/manualAdd.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/extension/manualAdd.test.ts`:

```ts
import { candidatesFor } from './manualAdd';
import type { SavedBook } from './storage';

const shelved = (title: string, author: string, intent: SavedBook['intent']): SavedBook => ({
  id: `id-${title}`,
  book: { title, author },
  intent,
  savedAt: 0,
});

describe('a result knows whether the shelf already holds it', () => {
  it('reports the pile a held book is in', () => {
    const rows = candidatesFor(
      [{ title: 'Dune', author: 'Frank Herbert' }],
      [shelved('Dune', 'Frank Herbert', 'next')],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.held).toBe('next');
  });

  it('reports null for a book the shelf does not hold', () => {
    const rows = candidatesFor(
      [{ title: 'Dune', author: 'Frank Herbert' }],
      [shelved('Range', 'David Epstein', 'now')],
    );
    expect(rows[0]!.held).toBeNull();
  });

  it('matches on IDENTITY, not on the title string', () => {
    // `identityOf` is `bookKey`, which normalises. A result that differs only in case or
    // punctuation is the SAME book, and reporting it as new is how a duplicate reaches
    // the shelf. That is item 47's bug (ADV-6) and this feature must not open a second
    // door onto it.
    const rows = candidatesFor(
      [{ title: 'dune', author: 'frank herbert' }],
      [shelved('Dune', 'Frank Herbert', 'someday')],
    );
    expect(rows[0]!.held).toBe('someday');
  });

  it('keeps the order the catalogue returned', () => {
    const rows = candidatesFor(
      [
        { title: 'Dune', author: 'Frank Herbert' },
        { title: 'Range', author: 'David Epstein' },
      ],
      [],
    );
    expect(rows.map((r) => r.book.title)).toEqual(['Dune', 'Range']);
  });

  it('survives an empty shelf and an empty result set', () => {
    expect(candidatesFor([], [])).toEqual([]);
    expect(candidatesFor([], [shelved('Dune', 'Frank Herbert', 'now')])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/extension/manualAdd.test.ts`
Expected: FAIL — `candidatesFor is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add the imports at the top of `src/extension/manualAdd.ts`:

```ts
import type { Book } from '../recognizer/types';
import { identityOf, type Intent, type SavedBook } from './storage';
```

Append:

```ts
/** A catalogue result, paired with where the shelf already keeps it. */
export interface Candidate {
  book: Book;
  /** The pile it is already in, or `null` when the shelf does not hold it. */
  held: Intent | null;
}

/**
 * NO MESSAGE AND NO ROUND TRIP. `paint()` already reads the whole shelf to draw the
 * boards, so the popup has it in memory and matching against it is a map lookup.
 *
 * The catch tray answers `alreadySaved` for the same question, but that field exists
 * because a CONTENT SCRIPT cannot read storage. The popup can.
 */
export function candidatesFor(
  books: readonly Book[],
  shelf: readonly SavedBook[],
): Candidate[] {
  const held = new Map(shelf.map((saved) => [identityOf(saved.book), saved.intent]));
  return books.map((book) => ({ book, held: held.get(identityOf(book)) ?? null }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/extension/manualAdd.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/extension/manualAdd.ts src/extension/manualAdd.test.ts
git commit -m "feat: a search result knows which pile already holds it"
```

---

### Task 4: What a pick writes, and what it must NOT write

**Files:**
- Modify: `src/extension/manualAdd.ts`
- Modify: `src/extension/manualAdd.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/extension/manualAdd.test.ts`:

```ts
import { saveRequest } from './manualAdd';

describe('what putting a hand-added book on a pile sends', () => {
  it('is the existing saveBook message, with the book and the pile', () => {
    const book = { title: 'Dune', author: 'Frank Herbert' };
    expect(saveRequest(book, 'next')).toEqual({ type: 'saveBook', book, intent: 'next' });
  });

  it('carries NO source, because there is no post behind it', () => {
    // `SavedSource` is `{url, kind}` and the detail sheet renders it as "the post that
    // sold you". A manual add has no post. Filling it with the popup's own URL, or the
    // active tab's, would put a lie on the one surface whose whole job is provenance.
    const sent = saveRequest({ title: 'Dune', author: 'Frank Herbert' }, 'now') as Record<
      string,
      unknown
    >;
    expect(Object.keys(sent).sort()).toEqual(['book', 'intent', 'type']);
    expect(sent.source).toBeUndefined();
    expect(sent.shot).toBeUndefined();
  });

  it('carries no shot, so the shelf falls back to catalogue art or a cloth', () => {
    const sent = saveRequest({ title: 'Dune', author: 'Frank Herbert' }, 'someday');
    expect('shot' in sent).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/extension/manualAdd.test.ts`
Expected: FAIL — `saveRequest is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/extension/manualAdd.ts`:

```ts
/**
 * The exact message a pick sends, and the exact SHAPE it must keep.
 *
 * This function looks too thin to earn a module until you read what its test asserts: the
 * complement. A manual add must carry no `source` and no `shot`, because there is no post
 * and no photograph. The next person to touch this will reasonably think filling `source`
 * with the active tab's URL is helpful; it would print somebody's own popup as "the post
 * that sold you" on the one surface whose entire job is saying where a book came from.
 */
export function saveRequest(
  book: Book,
  intent: Intent,
): { type: 'saveBook'; book: Book; intent: Intent } {
  return { type: 'saveBook', book, intent };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/extension/manualAdd.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/extension/manualAdd.ts src/extension/manualAdd.test.ts
git commit -m "feat: a hand-added book carries no source and no shot"
```

---

### Task 5: The worker handler

**Files:**
- Create: `src/extension/searchBooks.ts`
- Create: `src/extension/searchBooks.test.ts`
- Modify: `src/extension/messages.ts`

- [ ] **Step 1: Add the message and the response type**

In `src/extension/messages.ts`, add to the `BackgroundRequest` union, immediately after the
`{ type: 'removeBook'; savedId: string }` member:

```ts
  /**
   * Search the catalogue by title, for a book being added by hand rather than caught.
   *
   * It goes through the worker for the same reason every shelf write does: the worker
   * owns the one OpenLibrary client and the one `catalogue` breaker. A client built in
   * the popup would fetch the same host with no breaker in front of it, so a catalogue
   * outage would trip recognition and leave this path hammering it.
   *
   * `seq` is the popup's own request counter and comes back untouched. There is no
   * cancel message: a search is one cheap fetch, so the only hazard worth closing is a
   * slow answer painting over a faster newer one.
   */
  | { type: 'searchBooks'; query: string; seq: number }
```

At the end of the file, add:

```ts
/** Answer to a catalogue search. `seq` is echoed so the popup can drop a stale one. */
export type SearchResponse =
  | { ok: true; seq: number; books: Book[] }
  | { ok: false; seq: number; error: string };
```

- [ ] **Step 2: Write the failing test**

Create `src/extension/searchBooks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { handleSearchBooks } from './searchBooks';
import type { BooksDb } from '../recognizer/types';

const db = (books: { title: string; author: string }[]): BooksDb => ({
  lookupByIsbn: async () => null,
  search: async () => books,
});

const failing = (message: string): BooksDb => ({
  lookupByIsbn: async () => null,
  search: async () => {
    throw new Error(message);
  },
});

describe('the worker answers a catalogue search', () => {
  it('returns what the catalogue returned, with the sequence echoed', async () => {
    const answer = await handleSearchBooks(
      { type: 'searchBooks', query: 'dune', seq: 7 },
      () => db([{ title: 'Dune', author: 'Frank Herbert' }]),
    );
    expect(answer).toEqual({
      ok: true,
      seq: 7,
      books: [{ title: 'Dune', author: 'Frank Herbert' }],
    });
  });

  it('searches on the TRIMMED query', async () => {
    let asked: { title: string } | undefined;
    await handleSearchBooks({ type: 'searchBooks', query: '  dune  ', seq: 1 }, () => ({
      lookupByIsbn: async () => null,
      search: async (q) => {
        asked = q;
        return [];
      },
    }));
    expect(asked).toEqual({ title: 'dune' });
  });

  it('refuses a query below the minimum without touching the catalogue', async () => {
    // The popup guards this too. Guarding it BOTH sides matters because the worker is
    // reachable by anything that can send a message, and a one-character query is a
    // request against the breaker recognition shares.
    let called = false;
    const answer = await handleSearchBooks({ type: 'searchBooks', query: 'd', seq: 2 }, () => {
      called = true;
      return db([]);
    });
    expect(called).toBe(false);
    expect(answer).toEqual({ ok: true, seq: 2, books: [] });
  });

  it('turns a thrown catalogue error into a refusal that keeps its sequence', async () => {
    const answer = await handleSearchBooks(
      { type: 'searchBooks', query: 'dune', seq: 3 },
      () => failing('OpenLibrary did not answer within 6s'),
    );
    expect(answer).toEqual({
      ok: false,
      seq: 3,
      error: 'OpenLibrary did not answer within 6s',
    });
  });

  it('never lets a rejection escape to the listener', async () => {
    // The listener calls this and hands the result straight to sendResponse. An escaping
    // rejection there is an unanswered message, which the popup sees as a sheet that
    // never stops loading.
    await expect(
      handleSearchBooks({ type: 'searchBooks', query: 'dune', seq: 4 }, () => failing('boom')),
    ).resolves.toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/extension/searchBooks.test.ts`
Expected: FAIL — `Failed to resolve import "./searchBooks"`.

- [ ] **Step 4: Write minimal implementation**

Create `src/extension/searchBooks.ts`:

```ts
import type { BooksDb } from '../recognizer/types';
import type { BackgroundRequest, SearchResponse } from './messages';
import { MIN_QUERY } from './manualAdd';

export type SearchBooksRequest = Extract<BackgroundRequest, { type: 'searchBooks' }>;

/**
 * Its own module, because `background.ts` says so at its listener:
 *
 *   "Keep this adapter thin, and give the next message type its own handler rather than
 *    inlining one here."
 *
 * The reason is on record: an inline `saveBook` passed a `?raw` guard with the call in
 * dead code AND with its arguments reversed. A handler that a test can import is a
 * handler a test can actually check.
 *
 * `books` is a factory rather than an instance so the caller decides the fetch and the
 * breaker, and the test decides neither.
 */
export async function handleSearchBooks(
  msg: SearchBooksRequest,
  books: () => BooksDb,
): Promise<SearchResponse> {
  const title = msg.query.trim();

  // Guarded on BOTH sides. The popup will not send a short query, and the worker is
  // reachable by anything that can post a message to it.
  if (title.length < MIN_QUERY) return { ok: true, seq: msg.seq, books: [] };

  try {
    return { ok: true, seq: msg.seq, books: await books().search({ title }) };
  } catch (err) {
    // The catalogue's own words. `OpenLibrary did not answer within 6s` tells somebody
    // whether to try again; "something went wrong" does not. docs/brand.md, Voice.
    return { ok: false, seq: msg.seq, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/extension/searchBooks.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/extension/searchBooks.ts src/extension/searchBooks.test.ts src/extension/messages.ts
git commit -m "feat: the worker answers a catalogue search"
```

---

### Task 6: Wire the handler into the worker

**Files:**
- Modify: `src/extension/background.ts`

- [ ] **Step 1: Add the import**

At the top of `src/extension/background.ts`, beside the existing `handleSaveBook` import:

```ts
import { handleSearchBooks } from './searchBooks';
```

- [ ] **Step 2: Add the dispatch**

In the `chrome.runtime.onMessage.addListener` callback, immediately after the
`if (msg?.type === 'removeBook') { ... }` block, add:

```ts
  // Same client and the SAME breaker recognition uses, so one failing catalogue backs
  // both paths off together instead of this one hammering a host that is already down.
  if (msg?.type === 'searchBooks') {
    void handleSearchBooks(msg, () =>
      withBreaker(createOpenLibraryClient({ fetch: (url, init) => fetch(url, init) }), catalogue),
    ).then(sendResponse);
    return true; // async response
  }
```

- [ ] **Step 3: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: exit 0.

If `catalogue` or `withBreaker` is not in scope at the listener, move the import or hoist
the binding — do **not** create a second breaker. Two breakers means neither sees the whole
picture, which is the same class of bug as two OpenLibrary clients.

- [ ] **Step 4: Build**

Run: `node build.mjs`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/extension/background.ts
git commit -m "feat: dispatch searchBooks to its own handler"
```

---

### Task 7: The `+` in the masthead

**Files:**
- Modify: `popup.html`

- [ ] **Step 1: Add the button**

In `popup.html`, inside `<header>`, immediately **before** the
`<button class="settings" type="button" id="settings">Settings</button>` line:

```html
      <!-- ADDING A BOOK BY HAND. It lives in the header and not in the search row because
           `paint()` calls `renderEmpty()` and returns BEFORE the search row exists, so a
           control down there is invisible to exactly the new user with an empty shelf who
           needs it most. The header is the only chrome that renders in every state.

           Icon only, at the theme toggle's weight rather than Settings'. Buki sells
           recognition; a loud "Add a book" would advertise typing over the thing that
           earns the money. -->
      <button class="add" type="button" id="add" aria-label="Add a book by hand">
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" />
        </svg>
      </button>
```

- [ ] **Step 2: Add the styles**

In `popup.html`'s `<style>` block, immediately after the `.settings` rule:

```css
      /* Pinned out of the flow exactly as `.settings` is, so the mark and the count stay
         centred. Sitting it in the flow shifts them, which is the thing the comment on
         `.settings` exists to prevent. */
      .add {
        position: absolute; right: 84px; top: 50%; transform: translateY(-50%);
        display: grid; place-items: center;
        width: 28px; height: 28px; padding: 0;
        border: 0; border-radius: 8px; background: transparent;
        color: var(--muted); cursor: pointer;
        transition: background 140ms ease, color 140ms ease;
      }
      .add:hover { background: var(--board); color: var(--ink); }
      .add:active { transform: translateY(-50%) scale(0.94); }
      .add:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
```

> **`right: 84px` is a guess until you look.** Open the popup and check the `+` clears
> `Settings` without crowding it. If `.settings` is not absolutely positioned, match
> whatever it actually does instead of adding a second scheme.

- [ ] **Step 3: Build and look**

Run: `node build.mjs`
Expected: exit 0. Load the unpacked extension, open the popup, and confirm the mark and
the count are still centred with the `+` present.

- [ ] **Step 4: Commit**

```bash
git add popup.html
git commit -m "feat: a + in the masthead for adding a book by hand"
```

---

### Task 8: The sheet

**Files:**
- Modify: `src/extension/popup.ts`

- [ ] **Step 1: Add the imports**

At the top of `src/extension/popup.ts`:

```ts
import { candidatesFor, isCurrent, saveRequest, shouldSearch } from './manualAdd';
import type { SearchResponse } from './messages';
```

- [ ] **Step 2: Add the sheet opener**

Add this function next to `openSheet` in `src/extension/popup.ts`:

```ts
/** The popup's own request counter. Only the newest answer is painted. See `isCurrent`. */
let searchSeq = 0;

/**
 * Search the catalogue and put a book on a pile without catching it from a picture.
 *
 * Reuses `openSheet`'s furniture rather than growing a second overlay. popup.ts's
 * "this popup has no dialog and should not grow one" is about CONFIRMS: it argues for an
 * undo strip over a confirm box. The sheet already sets role="dialog".
 */
function openAddSheet(): void {
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
  card.setAttribute('aria-label', 'Add a book by hand');

  const shut = document.createElement('button');
  shut.className = 'shut';
  shut.textContent = '×';
  shut.setAttribute('aria-label', 'Close');
  shut.addEventListener('click', closeSheet);

  const field = document.createElement('input');
  field.type = 'search';
  field.className = 'addfind';
  field.placeholder = 'Title, or title and author';
  field.setAttribute('aria-label', 'Search for a book to add');

  const results = document.createElement('div');
  results.className = 'addrows';

  const tell = (text: string): void => {
    const line = document.createElement('p');
    line.className = 'empty';
    line.textContent = text;
    results.replaceChildren(line);
  };

  tell('Search the catalogue and pick a pile. Nothing is saved until you do.');

  let timer: number | undefined;
  field.addEventListener('input', () => {
    window.clearTimeout(timer);
    const typed = field.value;
    if (!shouldSearch(typed)) {
      tell('Search the catalogue and pick a pile. Nothing is saved until you do.');
      return;
    }
    // 300ms: long enough that a typed word is one request, short enough that the pause
    // before results is not read as nothing happening.
    timer = window.setTimeout(() => void run(typed), 300);
  });

  const run = async (typed: string): Promise<void> => {
    const seq = ++searchSeq;
    tell('Looking...');
    const answer = (await chrome.runtime.sendMessage({
      type: 'searchBooks',
      query: typed,
      seq,
    })) as SearchResponse | undefined;

    if (!answer || !isCurrent(answer.seq, searchSeq)) return;
    if (!answer.ok) return tell(answer.error);
    if (!answer.books.length) return tell(`No book called "${typed.trim()}".`);

    results.replaceChildren(
      ...candidatesFor(answer.books, shelf).map((row) => addRow(row)),
    );
  };

  card.append(shut, field, results);
  sheet.replaceChildren(scrim, card);
  sheet.hidden = false;
  requestAnimationFrame(() => {
    sheet.dataset.in = 'true';
    field.focus();
  });
}
```

- [ ] **Step 3: Add the row renderer**

Add beside `openAddSheet`:

```ts
/** One catalogue result: the book, and the three piles it can go on. */
function addRow(row: ReturnType<typeof candidatesFor>[number]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'addrow';

  const title = document.createElement('div');
  title.className = 'addtitle';
  title.textContent = row.book.title;

  const by = document.createElement('div');
  by.className = 'by';
  by.textContent = row.book.author;

  wrap.append(title, by);

  if (row.held) {
    // Says where it already is. The pile buttons below still work, as a MOVE, because a
    // person who searched for a book they own usually wants it somewhere else.
    const where = document.createElement('span');
    where.className = 'held-in';
    where.textContent = `on your shelf · ${PILE_LABEL[row.held]}`;
    wrap.append(where);
  }

  const piles = document.createElement('div');
  piles.className = 'addpiles';
  for (const each of ['now', 'next', 'someday'] as const) {
    const press = document.createElement('button');
    press.type = 'button';
    press.textContent = `Read ${each}`;
    press.disabled = row.held === each;
    press.addEventListener('click', () => {
      void (async () => {
        try {
          await writeShelf(saveRequest(row.book, each));
          closeSheet();
          await refresh();
        } catch (err) {
          console.error('[Buki] could not add the book', err);
        }
      })();
    });
    piles.appendChild(press);
  }
  wrap.appendChild(piles);
  return wrap;
}
```

- [ ] **Step 4: Bind the button**

Where the other header controls are bound (search for `getElementById('settings')`), add:

```ts
  document.getElementById('add')?.addEventListener('click', openAddSheet);
```

- [ ] **Step 5: Typecheck and build**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: exit 0. If `shelf`, `lastPicked`, `refresh` or `PILE_LABEL` are not in scope at
your insertion point, move `openAddSheet` below their declarations rather than duplicating
any of them.

Run: `node build.mjs`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/extension/popup.ts
git commit -m "feat: the add-a-book sheet"
```

---

### Task 9: The empty state names the third route

**Files:**
- Modify: `src/extension/popup.ts`

- [ ] **Step 1: Rewrite `renderEmpty`'s sentence**

Replace the `document.createTextNode(...)` argument inside `renderEmpty` with:

```ts
    document.createTextNode(
      'Press the Buki button on a post, right-click any cover image, or use + above to add one by hand.',
    ),
```

- [ ] **Step 2: Build**

Run: `node build.mjs`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/extension/popup.ts
git commit -m "copy: the empty shelf names all three ways to fill it"
```

---

### Task 10: The single-purpose statement, and the mutation pass

**Files:**
- Modify: `docs/store/listing.md`

- [ ] **Step 1: Rewrite the statement**

In `docs/store/listing.md`, under `## Single purpose (required)`, replace the fenced block:

```
Buki identifies books from pictures on web pages, and keeps them on a reading list stored
in the user's own browser.
```

Then add beneath the existing explanation:

> **Widened 2026-08-26, before submission and on purpose.** Adding a book by hand involves
> no picture and no web page, so the previous sentence would have been **narrower than the
> product**, which is the exact mismatch that made the version before it likely to fail
> review. The purpose is the reading list; identifying is what it is *for*. Store copy
> cannot be edited after submission without another review cycle, which is why this landed
> with the feature rather than after it.

- [ ] **Step 2: Run the mutation pass**

Every guard written in Tasks 1 to 5 must be watched to fail. Apply each mutation, run the
suite, restore, and record the result. **Compare the TOTAL, not the failure count.**

| # | Mutation | Must break |
| --- | --- | --- |
| 1 | `MIN_QUERY = 3` → `1` | Task 1 |
| 2 | `shouldSearch` drops `.trim()` | Task 1's whitespace test |
| 3 | `isCurrent` uses `>=` instead of `===` | Task 2's future test |
| 4 | `candidatesFor` matches on `book.title` instead of `identityOf` | Task 3's identity test |
| 5 | `saveRequest` adds `source: { url: 'x', kind: 'page' }` | Task 4's complement test |
| 6 | `handleSearchBooks` drops the `MIN_QUERY` check | Task 5's refusal test |
| 7 | `handleSearchBooks` lets the throw escape (delete the try/catch) | Task 5's rejection test |

Any mutation that survives is a hole in the test, not a spare mutation. Fix the test.

- [ ] **Step 3: Full verification**

```bash
./node_modules/.bin/vitest run
node node_modules/typescript/bin/tsc --noEmit
node build.mjs
```

Expected: all green, tsc 0, build 0.

- [ ] **Step 4: The two checks no test can make**

Both are by hand, in a real Chrome, on an unpacked build:

1. **Open the popup with an empty shelf.** The `+` must be present and the empty state must
   name it. This is the cold-start case the whole placement decision was made for.
2. **Add a book you already own.** The row must say which pile it is in, and pressing a
   different pile must MOVE it rather than creating a second copy.

- [ ] **Step 5: Commit**

```bash
git add docs/store/listing.md
git commit -m "feat: adding a book by hand, and the single purpose that now covers it"
```

---

## Self-review

**Spec coverage.** Control placement → Task 7. The four states → Tasks 5 and 8. The protocol
→ Task 5. `seq` → Task 2. Already-on-the-shelf → Tasks 3 and 8. Pile picker mandatory →
Task 8 (no save path except a pile button). Testability → Tasks 1 to 5. `renderEmpty` →
Task 9. Single purpose → Task 10. **Provenance: no task, correctly — the field was cut at
spec review and `SavedBook` is untouched.**

**Placeholders.** One marked uncertainty survives on purpose: `right: 84px` in Task 7, which
is flagged in the plan as needing a look rather than presented as known. Everything else
carries its code.

**Type consistency.** `MIN_QUERY`, `shouldSearch`, `isCurrent`, `Candidate`, `candidatesFor`,
`saveRequest` are named identically in every task that uses them. `SearchResponse` is defined
in Task 5 and consumed in Task 8 under the same name. `handleSearchBooks(msg, books)` takes a
**factory**, and Task 6 passes one.
