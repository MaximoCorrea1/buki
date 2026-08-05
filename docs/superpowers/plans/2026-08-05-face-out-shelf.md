# The face-out shelf and the piles: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the popup from one scroll of rows grouped by heading into a face-out shelf
where each pile is a place you are in.

**Architecture:** Every decision that can be made without a DOM moves into `shelfView.ts`
and is tested; the DOM stays in `popup.ts` and is judged by screenshot. That split is
forced by the test setup, which is node with no DOM, and it is the right split anyway:
which books are in a pile, in what order, and grouped how, is logic. `generatedCover.ts`
already exists and is tested; this plan adds only the weave to it.

**Tech stack:** TypeScript, vitest 3 (node env, no DOM), esbuild IIFE into `dist/`,
`chrome.storage.local` read directly and written only through the background worker.

---

## What already exists, and must not be re-derived

- `src/extension/generatedCover.ts` — `bindingFor`, `deviceFor`, `titleStep`, `BINDING`,
  `RAMP`, `DEVICE_SIZE`. Committed in `2e9bf83`, 14 tests.
- `src/extension/cloth.ts` — `clothFor`, `hashOf`, `CLOTH`.
- `src/extension/storage.ts` — `SavedBook`, `Intent`, `matchesFilter`, `createLibrary`.
  **Read-only from the popup.** Every write is `chrome.runtime.sendMessage`.
- `src/extension/coverCache.ts` — `cachedCover`, `rememberCover`, `pruneCovers`.
- `docs/brand.md` — the tokens. Paper for this surface, plus the new Bindings table.

## Two constraints that will bite

1. **The background worker is the only writer of `savedBooks`.** Moving a book between
   piles is `{ type: 'saveBook', book, intent }`, which upserts on `sameBook`. There is no
   new message to add. Do not call `library.add` from the popup.
2. **`saveBook` sets `savedAt` to now.** So a move re-dates the book. That is correct for
   Read, where the date IS the finish date, and it reorders the other piles, which are
   newest-first anyway. Accept it; do not add a second timestamp field to storage.

## File structure

| File | Responsibility |
| --- | --- |
| `src/extension/shelfView.ts` | **new.** Piles, ordering, chunking into shelves, search across piles, the Read grouping. Pure. Tested. |
| `src/extension/shelfView.test.ts` | **new.** |
| `src/extension/generatedCover.ts` | modify: add `weaveOf`. |
| `src/extension/cover.ts` | **new.** Builds the cover element: real art if there is any, the drawn board if not. DOM. |
| `src/extension/popup.ts` | rewrite the render half. Keeps load/state/paint and the write round trips. |
| `popup.html` | rewrite the style block. 560px, shelf, segmented control, sheet. |

---

### Task 1: The weave

The cover module draws one 7x7 tile. The board needs it repeated, half-dropped, and it
must be one DOM node rather than six hundred, so the tiling produces lines of text for a
`<pre>` rather than a grid of cells.

**Files:**
- Modify: `src/extension/generatedCover.ts`
- Test: `src/extension/generatedCover.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/extension/generatedCover.test.ts`, and add `weaveOf` to the import on
line 2:

```typescript
describe('weaveOf', () => {
  const book = { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' };

  it('fills exactly the rows and columns asked for', () => {
    const cloth = weaveOf(book, 11, 4);
    expect(cloth).toHaveLength(4);
    for (const line of cloth) expect([...line]).toHaveLength(11);
  });

  it('repeats the book its own tile', () => {
    // The first tile-width of the first row IS the device's first row: the cloth and
    // the mark are the same hash seen at two scales, not two ideas.
    const tile = deviceFor(book);
    expect(weaveOf(book, DEVICE_SIZE, 1)[0]).toBe(tile[0]);
  });

  it('half-drops alternate tile rows, so the repeat is not corduroy', () => {
    // Stacked square, the seams line up into vertical ribbing - visible at 118px and
    // the reason this takes an offset at all.
    const tile = deviceFor(book);
    const cloth = weaveOf(book, DEVICE_SIZE, DEVICE_SIZE * 2);
    expect(cloth[DEVICE_SIZE]).not.toBe(tile[0]);
    // ...and it is the same row, rotated, rather than a different row.
    expect([...cloth[DEVICE_SIZE]!].sort().join('')).toBe([...tile[0]!].sort().join(''));
  });

  it('draws only glyphs from the ramp', () => {
    for (const line of weaveOf(book, 24, 30)) {
      for (const glyph of line) expect(RAMP).toContain(glyph);
    }
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `./node_modules/.bin/vitest run src/extension/generatedCover.test.ts`
Expected: FAIL, `weaveOf is not a function` (or a transform error naming the missing
export). If it fails for any other reason, fix that first.

- [ ] **Step 3: Implement**

Append to `src/extension/generatedCover.ts`:

```typescript
/** How far alternate tile rows shift. Coprime with DEVICE_SIZE so the offset never
 *  lands back on the seam it is hiding. */
const HALF_DROP = 3;

/**
 * The board's cloth: the book's own tile, repeated to fill.
 *
 * Returned as lines of text rather than cells because this is texture, where a mono
 * font's metrics do not matter, and because a board covered in cells is six hundred DOM
 * nodes per book. A shelf of twenty would be twelve thousand.
 *
 * Alternate tile rows shift sideways. Stacked square the seams line up into vertical
 * corduroy, which is visible at 118px; a half-drop is how a real textile repeat hides
 * the same seam.
 */
export function weaveOf(book: Book, cols: number, rows: number): string[] {
  const tile = deviceFor(book);
  return Array.from({ length: rows }, (_, row) => {
    const shift = Math.floor(row / DEVICE_SIZE) % 2 ? HALF_DROP : 0;
    const source = tile[row % DEVICE_SIZE]!;
    let line = '';
    for (let col = 0; col < cols; col++) line += source[(col + shift) % DEVICE_SIZE];
    return line;
  });
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `./node_modules/.bin/vitest run src/extension/generatedCover.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Prove the half-drop test discriminates**

Temporarily change `HALF_DROP` to `0`, re-run, and confirm ONLY
`half-drops alternate tile rows` fails. Change it back. A test that passes either way is
not a test.

- [ ] **Step 6: Commit**

```bash
git add src/extension/generatedCover.ts src/extension/generatedCover.test.ts
git commit -m "feat: the cover's mark, repeated, becomes its cloth"
```

---

### Task 2: Piles, ordering, and shelves

**Files:**
- Create: `src/extension/shelfView.ts`
- Test: `src/extension/shelfView.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { PILES, PILE_LABEL, countByPile, booksIn, shelvesOf } from './shelfView';
import type { SavedBook } from './storage';

const book = (id: string, intent: SavedBook['intent'], savedAt: number): SavedBook => ({
  id,
  intent,
  savedAt,
  book: { title: `Book ${id}`, author: 'A. Author' },
});

const SHELF: SavedBook[] = [
  book('1', 'now', 500),
  book('2', 'someday', 400),
  book('3', 'now', 900),
  book('4', 'read', 300),
  book('5', 'next', 200),
];

describe('PILES', () => {
  it('runs from what you are doing to what you have done', () => {
    expect(PILES).toEqual(['now', 'next', 'someday', 'read']);
  });

  it('labels every pile', () => {
    for (const pile of PILES) expect(PILE_LABEL[pile]).toBeTruthy();
  });
});

describe('countByPile', () => {
  it('counts each pile, including the empty ones', () => {
    expect(countByPile(SHELF)).toEqual({ now: 2, next: 1, someday: 1, read: 1 });
  });

  it('reports zero rather than nothing for an empty shelf', () => {
    expect(countByPile([])).toEqual({ now: 0, next: 0, someday: 0, read: 0 });
  });
});

describe('booksIn', () => {
  it('returns only that pile, newest catch first', () => {
    expect(booksIn(SHELF, 'now').map((s) => s.id)).toEqual(['3', '1']);
  });

  it('does not reorder the caller its own array', () => {
    // booksIn sorts, and sort mutates. The shelf is module state in the popup and is
    // painted from on every keystroke, so sorting it in place reorders the world.
    const input = [...SHELF];
    booksIn(input, 'now');
    expect(input.map((s) => s.id)).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('shelvesOf', () => {
  it('breaks a pile into shelves of four', () => {
    expect(shelvesOf([1, 2, 3, 4, 5, 6], 4)).toEqual([[1, 2, 3, 4], [5, 6]]);
  });

  it('gives an exact fit one shelf and no empty second one', () => {
    expect(shelvesOf([1, 2], 2)).toEqual([[1, 2]]);
  });

  it('has no shelves at all when there are no books', () => {
    expect(shelvesOf([], 4)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `./node_modules/.bin/vitest run src/extension/shelfView.test.ts`
Expected: FAIL, `Cannot find module './shelfView'`.

- [ ] **Step 3: Implement**

Create `src/extension/shelfView.ts`:

```typescript
import type { Intent, SavedBook } from './storage';

/**
 * What the popup shows, decided without a DOM.
 *
 * The tests here run in node with no document, which is the constraint that put this
 * file on its own: which books are in a pile, in what order, and grouped how, is logic
 * and gets tested. Turning that into elements is popup.ts's job and is judged by looking.
 */

/** In the order they appear in the control: what you are doing, then what you have done. */
export const PILES: Intent[] = ['now', 'next', 'someday', 'read'];

/** Short, because these are places you go rather than sentences about a book. */
export const PILE_LABEL: Record<Intent, string> = {
  now: 'Now',
  next: 'Next',
  someday: 'Someday',
  read: 'Read',
};

export function countByPile(shelf: SavedBook[]): Record<Intent, number> {
  const counts: Record<Intent, number> = { now: 0, next: 0, someday: 0, read: 0 };
  for (const saved of shelf) counts[saved.intent]++;
  return counts;
}

/** One pile, newest catch first. Copied before sorting: the caller's array is state. */
export function booksIn(shelf: SavedBook[], pile: Intent): SavedBook[] {
  return shelf.filter((s) => s.intent === pile).sort((a, b) => b.savedAt - a.savedAt);
}

/** A pile, broken into the rows that sit on a board. */
export function shelvesOf<T>(books: T[], per: number): T[][] {
  const shelves: T[][] = [];
  for (let i = 0; i < books.length; i += per) shelves.push(books.slice(i, i + per));
  return shelves;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `./node_modules/.bin/vitest run src/extension/shelfView.test.ts`
Expected: PASS, 9 tests. If `does not reorder the caller its own array` fails, `filter`
already copied and `sort` is safe; keep the test, it guards the next person who
reorders these two calls.

- [ ] **Step 5: Commit**

```bash
git add src/extension/shelfView.ts src/extension/shelfView.test.ts
git commit -m "feat: a pile is a place, and it comes in shelves of four"
```

---

### Task 3: Search across every pile

Finding a book is a different job from browsing a pile, and it must not require guessing
which pile you filed it in.

**Files:**
- Modify: `src/extension/shelfView.ts`
- Test: `src/extension/shelfView.test.ts`

- [ ] **Step 1: Write the failing tests**

Append, and add `searchAll` to the import:

```typescript
describe('searchAll', () => {
  const named = (id: string, intent: SavedBook['intent'], title: string, author: string) =>
    ({ id, intent, savedAt: Number(id), book: { title, author } }) as SavedBook;

  const MIXED: SavedBook[] = [
    named('1', 'now', 'Dune', 'Frank Herbert'),
    named('2', 'read', 'Dune Messiah', 'Frank Herbert'),
    named('3', 'someday', 'Ubik', 'Philip K. Dick'),
  ];

  it('crosses every pile, so a book is found wherever it was filed', () => {
    expect(searchAll(MIXED, 'dune').map((hit) => hit.saved.id).sort()).toEqual(['1', '2']);
  });

  it('says which pile each hit is in, because that is the answer', () => {
    const [hit] = searchAll(MIXED, 'ubik');
    expect(hit?.pile).toBe('someday');
  });

  it('matches the author too', () => {
    expect(searchAll(MIXED, 'philip')).toHaveLength(1);
  });

  it('returns nothing for an empty query rather than the whole shelf', () => {
    // An empty box means "not searching", and the caller shows the pile instead. Handing
    // back everything would render the whole shelf as one undifferentiated result page.
    expect(searchAll(MIXED, '   ')).toEqual([]);
  });

  it('orders hits newest first, like a pile', () => {
    expect(searchAll(MIXED, 'herbert').map((hit) => hit.saved.id)).toEqual(['2', '1']);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `./node_modules/.bin/vitest run src/extension/shelfView.test.ts -t searchAll`
Expected: FAIL, `searchAll is not a function`.

- [ ] **Step 3: Implement**

Add to `src/extension/shelfView.ts`, with `matchesFilter` added to the storage import:

```typescript
export interface Hit {
  saved: SavedBook;
  pile: Intent;
}

/**
 * Every pile at once. An empty query is NOT "everything": it means the user is not
 * searching, and the caller shows the pile they are standing in instead.
 */
export function searchAll(shelf: SavedBook[], query: string): Hit[] {
  if (!query.trim()) return [];
  return shelf
    .filter((saved) => matchesFilter(saved, query))
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((saved) => ({ saved, pile: saved.intent }));
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `./node_modules/.bin/vitest run src/extension/shelfView.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/extension/shelfView.ts src/extension/shelfView.test.ts
git commit -m "feat: finding a book does not mean guessing which pile it is in"
```

---

### Task 4: Read is a receipt, not a pile

**Files:**
- Modify: `src/extension/shelfView.ts`
- Test: `src/extension/shelfView.test.ts`

- [ ] **Step 1: Write the failing tests**

Append, and add `finishedBooks` and `finishedHead` to the import:

```typescript
describe('finished', () => {
  // Fixed instants, not Date.now(): a test that drifts with the calendar is a test that
  // fails one morning for no reason.
  const JUL_2026 = Date.UTC(2026, 6, 14);
  const AUG_2026 = Date.UTC(2026, 7, 2);
  const NOV_2025 = Date.UTC(2025, 10, 30);

  const done = (id: string, at: number): SavedBook => ({
    id,
    intent: 'read',
    savedAt: at,
    book: { title: `Book ${id}`, author: 'A. Author' },
  });

  const READ: SavedBook[] = [
    done('jul', JUL_2026),
    done('aug', AUG_2026),
    done('nov', NOV_2025),
    { ...done('open', AUG_2026), intent: 'now' },
  ];

  it('takes only finished books, newest first', () => {
    expect(finishedBooks(READ).map((f) => f.saved.id)).toEqual(['aug', 'jul', 'nov']);
  });

  it('dates each one by the month it was finished', () => {
    expect(finishedBooks(READ)[0]?.month).toBe('Aug 2026');
  });

  it('heads the year when everything was finished in one', () => {
    expect(finishedHead([done('a', JUL_2026), done('b', AUG_2026)])).toBe('2 books, 2026');
  });

  it('heads a span when they were not', () => {
    expect(finishedHead(READ)).toBe('3 books since 2025');
  });

  it('counts one book as one book', () => {
    expect(finishedHead([done('a', AUG_2026)])).toBe('1 book, 2026');
  });

  it('says nothing at all about an empty Read', () => {
    expect(finishedHead([])).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `./node_modules/.bin/vitest run src/extension/shelfView.test.ts -t finished`
Expected: FAIL, `finishedBooks is not a function`.

- [ ] **Step 3: Implement**

Add to `src/extension/shelfView.ts`:

```typescript
/** Spelled out rather than taken from `toLocaleString`, so a test does not depend on
 *  which locale data the runtime shipped with. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Finished {
  saved: SavedBook;
  month: string;
}

/**
 * Read is not a fifth pile of books you are not going to open. It is the one view that
 * can show something the others cannot: when. So a finished book carries its month and
 * nothing else - no move controls, no buy link. A record is not an inbox item.
 */
export function finishedBooks(shelf: SavedBook[]): Finished[] {
  return booksIn(shelf, 'read').map((saved) => {
    const when = new Date(saved.savedAt);
    return { saved, month: `${MONTHS[when.getMonth()]} ${when.getFullYear()}` };
  });
}

/** `7 books, 2026`, or `7 books since 2025` when they do not share a year. */
export function finishedHead(shelf: SavedBook[]): string {
  const done = booksIn(shelf, 'read');
  if (!done.length) return '';
  const years = done.map((saved) => new Date(saved.savedAt).getFullYear());
  const count = `${done.length} book${done.length === 1 ? '' : 's'}`;
  const earliest = Math.min(...years);
  return earliest === Math.max(...years)
    ? `${count}, ${earliest}`
    : `${count} since ${earliest}`;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `./node_modules/.bin/vitest run src/extension/shelfView.test.ts`
Expected: PASS, 20 tests.

Note: `new Date(...).getMonth()` is local time and the fixtures are UTC. If a test fails
by one month, the machine is far enough west that `Date.UTC(2026, 7, 2)` is still July
locally. Move the fixture to mid-month (`Date.UTC(2026, 7, 15)`) rather than switching to
`getUTCMonth`, because the user's own months are local ones.

- [ ] **Step 5: Commit**

```bash
git add src/extension/shelfView.ts src/extension/shelfView.test.ts
git commit -m "feat: finished stops being a dumping ground and becomes a receipt"
```

---

### Task 5: The cover element

**Files:**
- Create: `src/extension/cover.ts`
- Modify: `src/extension/popup.ts` (delete `blankCover`, `coverFor`, `applyCover`,
  `localSrc`, lines 58-110, and import from `cover.ts` instead)

No unit test: this returns an `HTMLElement` and the test runner has no DOM. It is verified
by screenshot in Task 6, against a shelf that deliberately contains books both with and
without art.

- [ ] **Step 1: Create the module**

```typescript
import type { SavedBook } from './storage';
import { bindingFor, titleStep, weaveOf } from './generatedCover';
import { cachedCover, rememberCover, type CoverDeps } from './coverCache';

/**
 * A cover, face out.
 *
 * Real art when the catalogue has any, and a drawn board when it does not - which is a
 * large share of books, and was ALL of them for several hours on 2026-08-04 when
 * OpenLibrary stopped answering. A shelf where a third of the covers are missing looks
 * broken, so the drawn board is not a fallback so much as the other half of the design.
 */

/** Cells across and down the board. 24 x 30 at a 5px cell covers 118 x 177. */
const WEAVE_COLS = 24;
const WEAVE_ROWS = 30;

/**
 * Object URLs minted this session, reused across repaints. The search box repaints on
 * every keystroke, so a fresh one per draw would leak one per character typed.
 */
const localSrc = new Map<string, string>();

/** Draw from the local copy if we have it, otherwise the network, and keep what comes
 *  back. See coverCache.ts: the network path measured 1-4 seconds per cover. */
async function applyCover(img: HTMLImageElement, url: string, covers: CoverDeps): Promise<void> {
  const already = localSrc.get(url);
  if (already) {
    img.src = already;
    return;
  }
  const blob = await cachedCover(url, covers);
  if (!blob) {
    img.src = url;
    void rememberCover(url, covers);
    return;
  }
  const objectUrl = URL.createObjectURL(blob);
  localSrc.set(url, objectUrl);
  img.src = objectUrl;
}

/**
 * The board Buki draws: a deep binding, two stamped rules, the book's own cloth, and the
 * title. What a book looks like with its jacket gone, which is a real object - so it
 * cannot read as art that failed to load.
 */
export function drawnCover(saved: SavedBook): HTMLElement {
  const board = document.createElement('div');
  board.className = 'board';
  board.style.setProperty('--binding', bindingFor(saved.book));

  const cloth = document.createElement('pre');
  cloth.className = 'cloth';
  cloth.setAttribute('aria-hidden', 'true');
  cloth.textContent = weaveOf(saved.book, WEAVE_COLS, WEAVE_ROWS).join('\n');

  const rules = document.createElement('div');
  rules.className = 'rules';

  const title = document.createElement('div');
  title.className = `stamp ${titleStep(saved.book.title)}`;
  title.textContent = saved.book.title;

  board.append(cloth, rules, title);
  return board;
}

/** The cover for one book: its art, or the board we draw when there is none. */
export function coverFor(saved: SavedBook, covers: CoverDeps): HTMLElement {
  if (!saved.book.coverUrl) return drawnCover(saved);

  const img = document.createElement('img');
  img.className = 'art';
  img.alt = '';
  img.loading = 'lazy'; // a hundred books must not fire a hundred requests at once
  // Art that 404s becomes the drawn board, never a broken-image glyph.
  img.addEventListener('error', () => img.replaceWith(drawnCover(saved)));
  void applyCover(img, saved.book.coverUrl, covers);
  return img;
}
```

- [ ] **Step 2: Delete the old cover code from `popup.ts`**

Remove `blankCover`, the `localSrc` map, `applyCover`, and `coverFor` (currently lines
58-110), plus the now-unused `cachedCover`/`rememberCover` names from the import on
line 11. Keep `pruneCovers` and `liveCoverDeps`. Add:

```typescript
import { coverFor } from './cover';
```

- [ ] **Step 3: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: errors only where `popup.ts` still calls `coverFor(saved)` with one argument.
Leave them; Task 6 rewrites that call site.

- [ ] **Step 4: Commit**

```bash
git add src/extension/cover.ts src/extension/popup.ts
git commit -m "feat: a cover is art when there is art and a drawn board when there is not"
```

---

### Task 6: The shelf

The visible change: 560px, four covers to a row, resting on a board, captioned.

**Files:**
- Modify: `popup.html` (the whole `<style>` block and the `<body>`)
- Modify: `src/extension/popup.ts` (`renderBook` becomes `renderSlot`; `paint` renders
  shelves)

- [ ] **Step 1: Widen the popup and add the shelf styles**

In `popup.html`, change `body { width: 360px; ... }` to `width: 560px;` and add, after
the `--ease-out` line in `:root`:

```css
        /* Bindings. The deep value of each cloth, for a whole board rather than an
           edge. See docs/brand.md; cream on bright cloth is 1.9:1 and unreadable. */
        --stamp: #faf7f2;
        --stamp-dim: #d6cec2;
        --serif: ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
        --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
```

Then replace the `.spine`, `.edge`, `.cover`, `.cover.blank`, `.meta`, `.title`,
`.author`, `.links`, `.src`, `.buy` and `.actions` rules with:

```css
      /* --- the shelf ------------------------------------------------------ */
      .shelf {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
        align-items: end;
        padding: 0 20px;
      }
      /* The board. Two solid rules, because a shadow under a hairline is a blend and
         the flat rule forbids it. */
      .plank {
        height: 3px;
        margin: 9px 20px 20px;
        background: var(--board);
        border-bottom: 1px solid #d5cbbf;
      }

      .slot { min-width: 0; }
      .pick {
        display: block;
        width: 100%;
        padding: 0;
        border: 0;
        background: none;
        text-align: left;
        cursor: pointer;
        transition: transform 140ms var(--ease-out);
      }
      .pick:active { transform: scale(0.97); }
      .pick:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }

      .board, .art {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 100%;
        aspect-ratio: 2 / 3;
        border-radius: 2px 3px 3px 2px;
        overflow: hidden;
      }
      .art { object-fit: cover; display: block; background: var(--sunk); }
      .board { padding: 11px; background: var(--binding); }

      /* The cloth: the book's own mark, repeated. One node, not six hundred. */
      .cloth {
        position: absolute;
        inset: 0;
        margin: 0;
        font: 5px/5px var(--mono);
        letter-spacing: 0;
        color: #ffffff;
        opacity: 0.095;
        pointer-events: none;
      }

      /* The signature: the two cords, seen face-on. */
      .rules {
        position: relative;
        flex: none;
        height: 5px;
        border-top: 1px solid var(--stamp-dim);
        border-bottom: 1px solid var(--stamp-dim);
      }

      .stamp {
        position: relative;
        margin-top: auto;
        font-family: var(--serif);
        color: var(--stamp);
        letter-spacing: -0.015em;
        overflow-wrap: anywhere;
      }
      .stamp.large { font-size: 21px; line-height: 1.02; }
      .stamp.medium { font-size: 15px; line-height: 1.08; }
      .stamp.small { font-size: 11.5px; line-height: 1.14; }

      .cap { margin-top: 9px; }
      .cap .t {
        font: 600 11.5px/1.22 var(--serif);
        color: var(--ink);
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      .cap .a {
        margin-top: 2px;
        font: 9.5px/1.3 var(--mono);
        color: var(--muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
```

**The cloth uses `opacity`, which is the one blend `brand.md` allows here**: opacity on a
white text layer over one solid ground produces one solid value, and computing five tints
in CSS is not possible without `color-mix`. If review objects, replace with a
`--cloth-ink` custom property set per book from `lighten(binding, 0.095)` in `cover.ts`.

- [ ] **Step 2: Render shelves instead of rows in `popup.ts`**

Replace `renderBook` with:

```typescript
function renderSlot(saved: SavedBook, onOpen: (saved: SavedBook) => void): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'slot';

  const pick = document.createElement('button');
  pick.className = 'pick';
  pick.setAttribute('aria-label', `${saved.book.title} by ${saved.book.author}`);
  pick.addEventListener('click', () => onOpen(saved));
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

  slot.append(pick, cap);
  return slot;
}

/** One pile, as boards with four books resting on each. */
function renderShelves(
  app: HTMLElement,
  books: SavedBook[],
  onOpen: (saved: SavedBook) => void,
): void {
  for (const row of shelvesOf(books, PER_SHELF)) {
    const shelf = document.createElement('div');
    shelf.className = 'shelf';
    for (const saved of row) shelf.appendChild(renderSlot(saved, onOpen));
    const plank = document.createElement('div');
    plank.className = 'plank';
    app.append(shelf, plank);
  }
}
```

Add near the other constants:

```typescript
/** Four across at 560px is a 118px cover, which is the smallest a title reads at. */
const PER_SHELF = 4;
```

and to the imports:

```typescript
import { PILES, PILE_LABEL, countByPile, booksIn, shelvesOf } from './shelfView';
```

In `paint`, replace the `for (const intent of INTENTS)` block with:

```typescript
  renderShelves(app, booksIn(shelf, 'now'), openSheet);
```

(A placeholder until Task 7 adds the control. `openSheet` is stubbed as
`function openSheet(_saved: SavedBook): void {}` and filled in by Task 8.)

Delete the now-unused `INTENTS`, `LABELS`, `SOURCE_LABEL`, `FILTER_FROM`, `link` and
`buyLink`/`Store` imports; Task 8 reintroduces them inside the sheet.

- [ ] **Step 3: Build and look at it**

```bash
node build.mjs
```

Then, with the dev server running, screenshot the populated popup:

```bash
"/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" --headless --disable-gpu \
  --hide-scrollbars --force-device-scale-factor=2 --window-size=600,900 \
  --screenshot=<scratch>/shelf.png "http://localhost:5050/popup.html?demo"
```

Expected: three or four covers across, resting on a rule, captioned. **Look at the PNG.**
The `?demo` stub only holds five books; widen it in `serve.mjs` to fifteen so a second and
third shelf actually appear, and so at least two books carry a `coverUrl` and the rest do
not.

- [ ] **Step 4: Commit**

```bash
git add popup.html src/extension/popup.ts
git commit -m "design: books stand face out on a board, four to a shelf"
```

---

### Task 7: The piles become places

**Files:**
- Modify: `popup.html` (styles + the masthead)
- Modify: `src/extension/popup.ts`

- [ ] **Step 1: Add the segmented control styles**

```css
      /* --- the piles ------------------------------------------------------ */
      .piles {
        display: flex;
        gap: 2px;
        margin: 11px auto 0;
        padding: 2px;
        background: var(--sunk);
        border: 1px solid var(--board);
        border-radius: 9px;
      }
      .pile {
        display: flex;
        align-items: baseline;
        gap: 5px;
        padding: 6px 12px;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        font: 700 10.5px/1 var(--mono);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        transition: background-color 140ms ease, color 140ms ease;
      }
      .pile .n { font-size: 9.5px; letter-spacing: 0.02em; opacity: 0.75; }
      .pile[aria-selected='true'] { background: var(--card); color: var(--ink); }
      .pile:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
      @media (hover: hover) and (pointer: fine) {
        .pile:not([aria-selected='true']):hover { color: var(--ink); }
      }
```

- [ ] **Step 2: Render it**

Add to `popup.ts`, above `paint`:

```typescript
/** Which pile you are standing in. Not persisted: opening the popup means starting from
 *  what you are reading now. */
let pile: Intent = 'now';

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
```

and in `paint`, before the shelves:

```typescript
  renderPiles(app);
  renderShelves(app, booksIn(shelf, pile), openSheet);
```

Wrap `.piles` in a centred container: add `.piles { width: fit-content; }` so it sits on
the page's axis per `brand.md`.

- [ ] **Step 3: Empty piles need a sentence, not a blank**

After `renderShelves`, add:

```typescript
  if (!booksIn(shelf, pile).length) {
    const none = document.createElement('p');
    none.className = 'empty';
    none.textContent = EMPTY_PILE[pile];
    app.appendChild(none);
  }
```

with:

```typescript
/** An empty state is an invitation, so each one says what puts a book here. */
const EMPTY_PILE: Record<Intent, string> = {
  now: 'Nothing on the go. Open a book from Next and it moves here.',
  next: 'Nothing queued. Books you catch land here unless you say otherwise.',
  someday: 'Nothing parked here yet.',
  read: "You haven't finished a book yet. Books you mark as read become a record here.",
};
```

- [ ] **Step 4: Build, screenshot, look**

Same command as Task 6 Step 3. Check: four segments, the count beside each, the selected
one lifted onto the card colour, and clicking one changes the shelf below.

- [ ] **Step 5: Commit**

```bash
git add popup.html src/extension/popup.ts
git commit -m "feat: a pile is somewhere you are, not a heading you scroll past"
```

---

### Task 8: Picking a book up

**Files:**
- Modify: `popup.html` (sheet styles + a `<div id="sheet" hidden>`)
- Modify: `src/extension/popup.ts`

- [ ] **Step 1: Styles**

```css
      /* --- the sheet ------------------------------------------------------ */
      #scrim {
        position: fixed;
        inset: 0;
        z-index: 8;
        background: rgba(20, 16, 14, 0.38);
        transition: opacity 180ms var(--ease-out);
      }
      #sheet {
        position: fixed;
        inset: 0;
        z-index: 9;
        display: grid;
        place-items: center;
        padding: 18px;
      }
      .card {
        position: relative;
        width: 100%;
        padding: 20px;
        background: var(--card);
        border: 1px solid var(--board);
        border-radius: 13px;
        /* A modal is not anchored to a trigger, so it scales from its own centre. */
        transform-origin: center;
        transition: transform 180ms var(--ease-out), opacity 180ms var(--ease-out);
      }
      #sheet[data-in='false'] .card { transform: scale(0.96); opacity: 0; }
      #sheet[data-in='false'] #scrim { opacity: 0; }

      .card .top { display: flex; gap: 15px; }
      .card .top .pick { width: 96px; flex: none; cursor: default; }
      .card h3 { margin: 0; font: 700 17px/1.2 var(--serif); }
      .card .by { margin-top: 3px; font-size: 12.5px; color: var(--muted); }
      .card .links { display: flex; flex-direction: column; gap: 5px; margin-top: 10px;
                     font-size: 11.5px; font-weight: 600; }
      .card .links a { text-decoration: none; color: var(--muted); }
      .card .links a:hover { color: var(--accent); text-decoration: underline; }
      .card .piles { margin: 18px auto 0; }
      .shut {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--muted);
        font-size: 15px;
        cursor: pointer;
      }
      .drop {
        display: block;
        margin: 16px auto 0;
        padding: 7px 14px;
        border: 1px solid var(--board);
        border-radius: 8px;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        font: 600 11.5px/1 system-ui, sans-serif;
      }
      .drop:hover { color: var(--ink); border-color: var(--muted); }

      @media (prefers-reduced-motion: reduce) {
        .card, #scrim { transition-duration: 1ms; }
      }
```

`Remove from shelf` is deliberately not red. Red is for danger; removing a book you chose
to save is a decision.

- [ ] **Step 2: Add the mount point**

In `popup.html`, before `<script>`:

```html
    <div id="sheet" hidden data-in="false"></div>
```

- [ ] **Step 3: Build the sheet**

Replace the `openSheet` stub in `popup.ts`:

```typescript
let lastPicked: HTMLElement | null = null;

function closeSheet(): void {
  const sheet = document.getElementById('sheet');
  if (!sheet) return;
  sheet.dataset.in = 'false';
  // Exit is never slower than entrance: the system responding must not feel slower
  // than the system arriving.
  setTimeout(() => {
    sheet.hidden = true;
    sheet.replaceChildren();
  }, 150);
  lastPicked?.focus();
}

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

  const top = document.createElement('div');
  top.className = 'top';
  const art = document.createElement('div');
  art.className = 'pick';
  art.appendChild(coverFor(saved, covers));
  const meta = document.createElement('div');

  const title = document.createElement('h3');
  title.textContent = saved.book.title;
  meta.appendChild(title);
  if (saved.book.author) {
    const by = document.createElement('div');
    by.className = 'by';
    by.textContent = saved.book.author;
    meta.appendChild(by);
  }

  const links = document.createElement('div');
  links.className = 'links';
  // Only http(s): keeps a future paste/import path from putting a javascript: URL here.
  if (saved.source && /^https?:\/\//i.test(saved.source.url)) {
    links.appendChild(link(saved.source.url, SOURCE_LABEL[saved.source.kind], 'src'));
  }
  const buy = buyLink(saved.book, store);
  if (buy) links.appendChild(link(buy, 'Buy', 'buy'));
  if (links.childElementCount) meta.appendChild(links);

  top.append(art, meta);
  card.append(shut, top, movePiles(saved), removeButton(saved));
  sheet.replaceChildren(scrim, card);
  sheet.hidden = false;
  // Two frames: the element has to be laid out at its start state before the
  // transition has anything to travel from.
  requestAnimationFrame(() => requestAnimationFrame(() => { sheet.dataset.in = 'true'; }));
  shut.focus();
}
```

- [ ] **Step 4: The move control**

```typescript
/**
 * The same control that says where a book is, is the one that moves it. One idea to
 * learn instead of two, and it answers "promoting Someday to Now means re-catching the
 * book" without adding a menu.
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
      bar.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
      try {
        // saveBook upserts on sameBook, so this IS the move. The worker owns the shelf.
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
        bar.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = false));
      }
    });
    bar.appendChild(to);
  }
  return bar;
}

function removeButton(saved: SavedBook): HTMLElement {
  const drop = document.createElement('button');
  drop.className = 'drop';
  drop.textContent = 'Remove from shelf';
  drop.addEventListener('click', async () => {
    drop.disabled = true;
    try {
      // One round trip removes the book AND flags the recognition, so the kept rate is
      // fresh by the time this resolves.
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
```

- [ ] **Step 5: Escape closes it**

At the bottom of `popup.ts`, above `void refresh()`:

```typescript
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !document.getElementById('sheet')?.hidden) closeSheet();
});
```

- [ ] **Step 6: Restore the deleted imports**

```typescript
import { buyLink, type Store } from './buyLink';
```

and re-add `SOURCE_LABEL` and `link` from the old `popup.ts` (lines 53 and 112-120).

- [ ] **Step 7: Build, screenshot with the sheet open, look**

`node build.mjs`, then temporarily call `openSheet(shelf[0]!)` at the end of `refresh()`,
screenshot, look, and remove the call.

- [ ] **Step 8: Commit**

```bash
git add popup.html src/extension/popup.ts
git commit -m "feat: taking a book off the shelf, and putting it in another pile"
```

---

### Task 9: Search across the piles

**Files:**
- Modify: `popup.html` (style `#find`)
- Modify: `src/extension/popup.ts`

- [ ] **Step 1: Style the box**

```css
      #find {
        width: calc(100% - 40px);
        margin: 10px 20px 0;
        padding: 8px 11px;
        background: var(--sunk);
        color: var(--ink);
        border: 1px solid var(--board);
        border-radius: 8px;
        font: 13px/1.3 system-ui, sans-serif;
      }
      #find::placeholder { color: var(--muted); }
      #find:focus { outline: 2px solid var(--ink); outline-offset: 1px; border-color: transparent; }
      .from {
        margin-top: 4px;
        font: 700 8.5px/1 var(--mono);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }
```

- [ ] **Step 2: Render it, and let it take over the view**

In `paint`, after `renderPiles(app)`:

```typescript
  const find = document.createElement('input');
  find.id = 'find';
  find.type = 'search';
  find.placeholder = `Find among ${shelf.length} books`;
  find.value = query;
  find.addEventListener('input', () => {
    query = find.value;
    paint(); // synchronous: no storage read, no await, no render race
  });
  app.appendChild(find);

  const hits = searchAll(shelf, query);
  if (query.trim()) {
    // Searching leaves the pile you were in and crosses all of them, then puts you back
    // where you were when the box is cleared.
    renderShelves(app, hits.map((hit) => hit.saved), openSheet, (saved) => PILE_LABEL[saved.intent]);
    if (!hits.length) {
      const none = document.createElement('p');
      none.className = 'empty';
      none.textContent = `Nothing matches "${query.trim()}".`;
      app.appendChild(none);
    }
    restoreFocus();
    return;
  }
```

Add `let query = '';` beside `let pile`, and extend `renderSlot`/`renderShelves` with an
optional fourth argument that appends a pile tag under the caption:

```typescript
function renderSlot(
  saved: SavedBook,
  onOpen: (saved: SavedBook) => void,
  tag?: (saved: SavedBook) => string,
): HTMLElement {
  /* ...as Task 6, and before `slot.append(pick, cap)`: */
  if (tag) {
    const from = document.createElement('div');
    from.className = 'from';
    from.textContent = tag(saved);
    cap.appendChild(from);
  }
```

- [ ] **Step 3: Keep the caret where it was**

Move `popup.ts`'s existing focus snapshot (lines 296-298 and 353-358) into
`restoreFocus()`, keyed on `#find` rather than `#filter`. Without the
`setSelectionRange` the caret jumps to the start of the box on every keystroke.

- [ ] **Step 4: Build, screenshot mid-search, look**

- [ ] **Step 5: Commit**

```bash
git add popup.html src/extension/popup.ts
git commit -m "feat: search crosses every pile and says which one each book is in"
```

---

### Task 10: The Read view

**Files:**
- Modify: `popup.html`
- Modify: `src/extension/popup.ts`

- [ ] **Step 1: Style the head and the month**

```css
      .record {
        margin: 16px 20px 4px;
        text-align: center;
        font: 700 11px/1 var(--mono);
        letter-spacing: 0.13em;
        text-transform: uppercase;
        color: var(--muted);
      }
```

- [ ] **Step 2: Branch on the pile**

In `paint`, replace the single `renderShelves` call with:

```typescript
  if (pile === 'read') {
    const head = document.createElement('p');
    head.className = 'record';
    head.textContent = finishedHead(shelf);
    if (head.textContent) app.appendChild(head);
    const done = finishedBooks(shelf);
    renderShelves(app, done.map((f) => f.saved), openSheet, (saved) =>
      done.find((f) => f.saved.id === saved.id)?.month ?? '');
  } else {
    renderShelves(app, booksIn(shelf, pile), openSheet);
  }
```

- [ ] **Step 3: A finished book offers no move and no buy**

In `openSheet`, guard both:

```typescript
  // A record is not an inbox item: no buy link and no move controls on a finished book.
  const buy = saved.intent === 'read' ? null : buyLink(saved.book, store);
  ...
  card.append(shut, top);
  if (saved.intent !== 'read') card.appendChild(movePiles(saved));
  card.appendChild(removeButton(saved));
```

**Note the tension:** with no move control, a book marked Read by mistake can only be
removed. Keep one way back: render `movePiles` for `read` too, and let the spec's "no move
controls" mean the four-way control is the ONLY control, rather than none. Implement it
that way and record the deviation in the spec.

- [ ] **Step 4: Build, screenshot the Read pile, look**

- [ ] **Step 5: Commit**

```bash
git add popup.html src/extension/popup.ts
git commit -m "feat: Read shows when, which is the one thing the other piles cannot"
```

---

### Task 11: Close the loop

**Files:**
- Modify: `docs/brand.md`
- Modify: `docs/superpowers/specs/2026-08-05-shelf-and-piles-design.md`
- Modify: `options.html` if any token changed

- [ ] **Step 1: Run everything**

```bash
./node_modules/.bin/vitest run
node node_modules/typescript/bin/tsc --noEmit
node build.mjs
```

Expected: all green. Paste the counts into the commit message rather than describing them.

- [ ] **Step 2: Walk `brand.md`'s pre-ship checklist against the popup**

Every line, honestly. In particular: body text at 7:1 (the caption's `--muted` on
`--paper` is 7.2:1, and the pile tag at 8.5px is a label, not body); focus visible on the
cover button, every pile tag, the search box, and both sheet controls;
`prefers-reduced-motion`; no em-dash in any new string.

- [ ] **Step 3: Record what changed from the spec**

At minimum: the Read view keeps its move control (Task 10 Step 3), and whether 560px
survived a real Chrome popup. **That last one cannot be checked here** - a headless page
at 560px is not a popup frame. Leave it as the one open item for Maximo, and keep the
width a single declaration so it is a one-line change.

- [ ] **Step 4: Commit**

```bash
git add docs/ popup.html options.html
git commit -m "docs: the shelf as built, and what it cost"
```

---

## Self-review against the spec

| Spec section | Task |
| --- | --- |
| 560px, four per shelf, board, captions | 6 |
| Title and author under the cover, not on it | 6 (both; the drawn board also stamps the title, see the note in the spec) |
| Piles as a segmented control | 7 |
| Search across every pile with a pile tag | 3, 9 |
| Read as a receipt: count, year, month, no buy | 4, 10 |
| Detail sheet, move controls, remove not red | 8 |
| Order within a pile: newest first, no drag | 2 |
| Generated cover | done in `2e9bf83`, weave in 1 |
| Storage shape unchanged | enforced: no new message, no new field |
| Catch card and landing untouched | no task touches `content.ts` or `docs/index.html` |

**Known gap, deliberately not planned:** the spec's masthead sketch shows the count and
the search box beside the segmented control. At 560px that is four segments plus a box on
one line, which the spec's own risk list flags. This plan stacks them instead: piles on
one line, search on the next. If it feels loose when rendered, collapse search to an icon
that expands, as the spec suggests.
