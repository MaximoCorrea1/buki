# The catch tray — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `ultra-powers:subagent-driven-development`
> or `ultra-powers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make a catch something you *decide*, not something that happens to you — the
image is what gets read, one book is one book, and every catch waits on screen until you
say what it is.

**Architecture:** The current design treats a catch as a transaction to complete as fast as
possible: auto-save on high confidence, a toast that lives 2.8 seconds, a picker that is a
separate surface. But recognition is fallible *by design* — that is why there is a
kept-rate — and the shelf is a curated list. Speed without review makes every entry
suspect, which is the exact failure the confidence tiering was built to prevent and which
the UI then undid. So: one surface (the tray), one card per catch, nothing saved without a
click, nothing removed by a timer except errors.

**Tech Stack:** TypeScript, vitest 3 (node env, no DOM), esbuild, MV3.

## Global Constraints

- **Never rename a `chrome.storage.local` key.** `savedBooks`, `recognitionLog`,
  `visionSettings` are frozen. **Changing how identity is COMPUTED is allowed; changing
  where books are STORED is not.**
- **The background worker is the only writer** of `savedBooks` and `recognitionLog`.
- **A log or cover failure must never fail a save.**
- **The vision client must stay lazily constructed** — no key must still mean link and
  text paths work.
- **The affiliate disclosure stays** in popup, options and privacy policy.
- Chrome **116+** (`AbortSignal.any`). Keep `manifest.json` and README in step.
- Build/test from Git Bash: `node build.mjs`, `./node_modules/.bin/vitest run`,
  `node node_modules/typescript/bin/tsc --noEmit`.

## The four reported problems, and what each turned out to be

| # | Reported | Actual cause |
| --- | --- | --- |
| 1 | Both flows should read the IMAGE, not the text | `llmVision.ts:118` sends only `imageUrls[0]`; `recognizer.ts:22` lets a retailer link short-circuit *before* vision; `recognizer.ts:62` can return a book that was never in the image |
| 4 | It saved a book I already saved | `storage.ts:33` keys identity on ISBN **when present, else** title+author — so two editions, or one path with an ISBN and one without, are two different books |
| 3 | Auto-saves, shows for a second | By design (`background.ts`, `confidence === 'high'`) plus `LINGER_MS = 2800`. Both go. |
| 2 | Toasts / queue / found-UI are bad | Two surfaces doing one job. Replaced by the tray. |

---

## File structure

| File | Responsibility | Task |
| --- | --- | --- |
| `src/extension/bookIdentity.ts` | **New.** What makes two books the same book. | 1 |
| `src/extension/bookIdentity.test.ts` | **New.** | 1 |
| `src/extension/storage.ts` | **Modified:** dedupe via `bookKey`; `identityOf` re-exported from the new module. | 1 |
| `src/recognizer/llmVision.ts` | **Modified:** send every image, not the first. | 2 |
| `src/recognizer/recognizer.ts` | **Modified:** the image decides; link corroborates or covers a no-image post; text only on request. | 2 |
| `src/recognizer/types.ts` | **Modified:** `RecognitionResult.source` gains `'none'` semantics + a `fromText` request flag. | 2 |
| `src/extension/catchTray.ts` | **New.** Card states and transitions. Replaces `toastStack` + `pickerQueue`. | 3 |
| `src/extension/catchTray.test.ts` | **New.** | 3 |
| `src/extension/pickerQueue.ts`, `toastStack.ts` (+ tests) | **Deleted.** Both jobs move into the tray. | 3 |
| `src/extension/content.ts` | **Modified:** renders the tray; no auto-dismiss for a found book. | 3, 4 |
| `src/extension/background.ts` | **Modified:** no auto-save; answers a `groundFromText` request. | 2, 3 |

---

## Task 1: One book is one book

**Files:** Create `src/extension/bookIdentity.ts`, `src/extension/bookIdentity.test.ts`;
modify `src/extension/storage.ts`.

**Interfaces:**
- Produces: `bookKey(book: Book): string` — the normalized title+author key. Stable.
- Produces: `sameBook(a: Book, b: Book): boolean` — ISBN equality OR key equality.

- [ ] **Step 1: Write the failing tests**

Create `src/extension/bookIdentity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { bookKey, sameBook } from './bookIdentity';

describe('sameBook', () => {
  it('matches two editions that resolved to different ISBNs', () => {
    // The reported bug. The link path and the cover path resolve different editions of
    // one book, so ISBN-keyed identity filed them as two books.
    expect(
      sameBook(
        { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' },
        { title: 'Dune', author: 'Frank Herbert', isbn: '9780340960196' },
      ),
    ).toBe(true);
  });

  it('matches when one path found an ISBN and the other did not', () => {
    expect(
      sameBook(
        { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' },
        { title: 'Dune', author: 'Frank Herbert' },
      ),
    ).toBe(true);
  });

  it('matches the same ISBN even when the titles are written differently', () => {
    expect(
      sameBook(
        { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' },
        { title: 'Dune: Special Edition', author: 'F. Herbert', isbn: '9780441013593' },
      ),
    ).toBe(true);
  });

  it('keeps two different books apart', () => {
    expect(
      sameBook({ title: 'Dune', author: 'Frank Herbert' }, { title: 'Ubik', author: 'P. K. Dick' }),
    ).toBe(false);
  });

  it('does not merge a sequel into its predecessor', () => {
    expect(
      sameBook(
        { title: 'Dune', author: 'Frank Herbert' },
        { title: 'Dune Messiah', author: 'Frank Herbert' },
      ),
    ).toBe(false);
  });
});

describe('bookKey', () => {
  it('ignores case, spacing and punctuation', () => {
    expect(bookKey({ title: '  The  Dispossessed! ', author: 'Ursula K. Le Guin' })).toBe(
      bookKey({ title: 'the dispossessed', author: 'ursula k le guin' }),
    );
  });

  it('ignores a subtitle after a colon', () => {
    // OpenLibrary returns "Sapiens: A Brief History of Humankind" from one query and
    // "Sapiens" from another. They are the same book.
    expect(bookKey({ title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari' }))
      .toBe(bookKey({ title: 'Sapiens', author: 'Yuval Noah Harari' }));
  });

  it('ignores a leading article', () => {
    expect(bookKey({ title: 'The Hobbit', author: 'J. R. R. Tolkien' })).toBe(
      bookKey({ title: 'Hobbit', author: 'J R R Tolkien' }),
    );
  });

  it('matches an author given as initials against the same author spelled out', () => {
    // The model answers "Ursula K. Le Guin"; OpenLibrary sometimes has "Le Guin, Ursula K."
    expect(bookKey({ title: 'The Dispossessed', author: 'Ursula K. Le Guin' })).toBe(
      bookKey({ title: 'The Dispossessed', author: 'Le Guin, Ursula K.' }),
    );
  });

  it('strips accents so one spelling does not become two books', () => {
    expect(bookKey({ title: 'Rayuela', author: 'Julio Cortázar' })).toBe(
      bookKey({ title: 'Rayuela', author: 'Julio Cortazar' }),
    );
  });
});
```

- [ ] **Step 2: Stub, then run to see assertion failures**

Create `src/extension/bookIdentity.ts`:

```ts
import type { Book } from '../recognizer/types';

export function bookKey(_book: Book): string {
  return '';
}

export function sameBook(_a: Book, _b: Book): boolean {
  return false;
}
```

Run: `./node_modules/.bin/vitest run src/extension/bookIdentity.test.ts`
Expected: the four `sameBook` true-cases fail (`expected false to be true`); the two
"keeps apart" cases pass vacuously; `bookKey` equality cases pass vacuously and only the
inequality-free ones matter — so ALSO watch that the "keeps apart" cases FAIL once
implemented incorrectly (Step 5 plants that).

- [ ] **Step 3: Implement**

```ts
import type { Book } from '../recognizer/types';

/**
 * What makes two books the same book.
 *
 * Identity used to be "the ISBN if there is one, otherwise title+author", which files two
 * editions of Dune as two books - and files an ISBN-carrying result and an ISBN-less one
 * as two books even when they are letter-for-letter identical. Both happen constantly:
 * the retailer-link path resolves one edition and the cover path resolves another.
 *
 * So identity is the WORK, not the edition: normalized title plus author. An ISBN is an
 * additional way to be the same, never the only way.
 */
const ARTICLES = /^(the|a|an|el|la|los|las|un|una|le|les|der|die|das)\s+/;

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Cortázar and Cortazar are one author
    .toLowerCase();
}

function normTitle(title: string): string {
  // A subtitle is how one catalogue writes what another leaves out: "Sapiens" and
  // "Sapiens: A Brief History of Humankind" are the same book.
  const main = fold(title).split(':')[0] ?? '';
  return main
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(ARTICLES, '');
}

/**
 * Surname plus first initial. Catalogues disagree on order and on how much of a first
 * name to keep - "Ursula K. Le Guin" and "Le Guin, Ursula K." are one person - and the
 * surname is the part that never moves.
 */
function normAuthor(author: string): string {
  const words = fold(author)
    .replace(/[^\p{L}\p{N} ,]+/gu, ' ')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!words.length) return '';
  const sorted = [...words].sort();
  const initials = sorted.map((w) => w[0]).join('');
  const longest = sorted.reduce((a, b) => (b.length > a.length ? b : a));
  return `${longest}:${initials}`;
}

export function bookKey(book: Book): string {
  return `${normTitle(book.title)}|${normAuthor(book.author)}`;
}

export function sameBook(a: Book, b: Book): boolean {
  if (a.isbn && b.isbn && a.isbn === b.isbn) return true;
  return bookKey(a) === bookKey(b);
}
```

- [ ] **Step 4: Run and watch pass**

Run: `./node_modules/.bin/vitest run src/extension/bookIdentity.test.ts`
Expected: PASS, 10 cases.

- [ ] **Step 5: Prove the tests discriminate**

Temporarily change `sameBook`'s last line to `return true;`. Re-run. Expected: the two
"keeps apart" / "does not merge a sequel" cases FAIL. Restore and re-run to green.

- [ ] **Step 6: Point the shelf at it**

In `src/extension/storage.ts`, delete the local `identityOf` body and re-export:

```ts
import { bookKey, sameBook } from './bookIdentity';

/** Kept as the name other modules already import. Identity is the WORK, not the edition. */
export const identityOf = bookKey;
```

and in `add`, replace the `previous` lookup:

```ts
        const previous = existing.find((s) => sameBook(s.book, book));
```

- [ ] **Step 7: Full suite, typecheck, build, commit**

```bash
./node_modules/.bin/vitest run && node node_modules/typescript/bin/tsc --noEmit && node build.mjs
git add -A && git commit -m "fix: one book is one book, whatever edition each path resolved"
```

---

## Task 2: The image decides

**Files:** modify `src/recognizer/llmVision.ts`, `src/recognizer/recognizer.ts`,
`src/recognizer/types.ts`.

- [ ] **Step 1: Failing test — every image is sent, not just the first**

Add to `src/recognizer/llmVision.test.ts`:

```ts
  it('shows the model every image in the post, not just the first', async () => {
    // A post with four photos had three of them ignored, so a book that was not the
    // first attachment could not be read at all.
    let body: any;
    const fetch = async (_url: string, init?: { body?: string }) => {
      body = JSON.parse(init?.body ?? '{}');
      return { ok: true, status: 200, json: async () => ({ choices: [] }) };
    };
    const vision = createLlmVision({ fetch, config: { ...GEMINI, apiKey: 'k' } });

    await vision.guessBook({ imageUrls: ['https://a.test/1.jpg', 'https://a.test/2.jpg'], text: '' });

    const parts = body.messages.at(-1).content.filter((p: any) => p.type === 'image_url');
    expect(parts).toHaveLength(2);
  });

  it('does not send more images than a post can usefully carry', async () => {
    let body: any;
    const fetch = async (_url: string, init?: { body?: string }) => {
      body = JSON.parse(init?.body ?? '{}');
      return { ok: true, status: 200, json: async () => ({ choices: [] }) };
    };
    const vision = createLlmVision({ fetch, config: { ...GEMINI, apiKey: 'k' } });

    await vision.guessBook({
      imageUrls: Array.from({ length: 9 }, (_, i) => `https://a.test/${i}.jpg`),
      text: '',
    });

    const parts = body.messages.at(-1).content.filter((p: any) => p.type === 'image_url');
    expect(parts).toHaveLength(4); // X allows four attachments
  });
```

- [ ] **Step 2: Run, watch fail** (`expected 1 to be 2`).

- [ ] **Step 3: Send every image, and make the prompt image-first**

In `src/recognizer/llmVision.ts`, replace `const image = imageUrls[0]` and the content
array so every image up to `MAX_IMAGES` becomes its own `image_url` part:

```ts
/** X allows four attachments; beyond that we are paying for someone else's gallery. */
export const MAX_IMAGES = 4;
```

```ts
      const images = imageUrls.slice(0, MAX_IMAGES);
      if (!images.length) return null; // nothing to look at - don't spend a request
```

and build content as `[{ type: 'text', text: prompt }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))]`.

Replace `INSTRUCTION` so the caption cannot lead:

```ts
const INSTRUCTION = [
  'You identify books from photographs.',
  'Identify the book shown IN THE IMAGES. There may be more than one image; use whichever actually shows a book.',
  'The post text is context only. Use it to disambiguate a cover you can partly read - never to name a book you cannot see.',
  'If the images show no book, reply with null for both fields, even if the text names a book.',
  'Reply with ONLY a JSON object: {"title": string|null, "author": string|null}.',
].join(' ');
```

- [ ] **Step 4: Run, watch pass.**

- [ ] **Step 5: Failing test — the image beats the link**

Add to `src/recognizer/recognizer.test.ts`:

```ts
  it('reads the cover rather than trusting a link to a different book', async () => {
    // A post that shows one book and links to another used to return the LINK's book,
    // because the link short-circuited before the model ever saw the photo.
    const books = {
      lookupByIsbn: async () => ({ title: 'Linked Book', author: 'Someone Else', isbn: '9780441013593' }),
      search: async () => [{ title: 'Dune', author: 'Frank Herbert' }],
    };
    const vision = { guessBook: async () => ({ title: 'Dune', author: 'Frank Herbert' }) };

    const result = await recognizeBook(
      { text: '', imageUrls: ['https://a.test/cover.jpg'], links: ['https://amazon.com/dp/0441013597'] },
      { vision, books },
    );

    expect(result.candidates[0]?.title).toBe('Dune');
    expect(result.source).toBe('vision');
  });

  it('still uses the link when the post has no image to read', async () => {
    const books = {
      lookupByIsbn: async () => ({ title: 'Linked Book', author: 'Someone', isbn: '9780441013593' }),
      search: async () => [],
    };
    const vision = { guessBook: async () => null };

    const result = await recognizeBook(
      { text: '', imageUrls: [], links: ['https://amazon.com/dp/0441013597'] },
      { vision, books },
    );

    expect(result.source).toBe('link');
  });

  it('does not fall back to the post text unless asked', async () => {
    // Text alone produced books that were never in the image, and nothing on screen said
    // so. It is now an explicit action from the card, not a silent fallback.
    const books = {
      lookupByIsbn: async () => null,
      search: async () => [{ title: 'Some Book From The Words', author: 'Anyone' }],
    };
    const vision = { guessBook: async () => null };

    const result = await recognizeBook(
      { text: 'Some Book From The Words', imageUrls: ['https://a.test/x.jpg'], links: [] },
      { vision, books },
    );

    expect(result.candidates).toEqual([]);
    expect(result.source).toBe('none');
  });
```

- [ ] **Step 6: Run, watch fail.**

- [ ] **Step 7: Reorder `recognizeBook`**

Signature gains an option; the body becomes: **images → vision**; then **link**; then
**text only if `fromText`**:

```ts
export async function recognizeBook(
  tweet: Tweet,
  deps: { vision: VisionClient; books: BooksDb },
  opts: { fromText?: boolean } = {},
): Promise<RecognitionResult> {
  // The image is the evidence. A post that shows one book and links to another is
  // common, and the link used to win without the cover ever being looked at.
  if (tweet.imageUrls.length) {
    const guess = await deps.vision.guessBook({
      imageUrls: tweet.imageUrls,
      text: tweet.text,
      altText: tweet.altText,
    });
    if (guess) {
      const ranked = rank(
        `${guess.title} ${guess.author}`,
        await deps.books.search({ title: guess.title, author: guess.author }),
      );
      const top = ranked[0];
      if (top) {
        return {
          candidates: ranked.slice(0, 3).map((s) => s.book),
          confidence: top.score >= 2 ? 'high' : 'medium',
          source: 'vision',
        };
      }
    }
  }

  // No image, or nothing readable in it: a retailer link is the next best evidence.
  const isbn = extractIsbnFromLinks(tweet.links);
  if (isbn) {
    const book = await deps.books.lookupByIsbn(isbn);
    if (book) return { candidates: [book], confidence: 'high', source: 'link' };
  }

  // The post's own words, ONLY when the card asked for it. As a silent fallback this
  // produced books that were never in the image, with nothing on screen saying so.
  if (opts.fromText) {
    const grounded = await groundText(tweet.text, deps.books);
    if (grounded.length) {
      return {
        candidates: grounded.slice(0, 3).map((s) => s.book),
        confidence: 'medium',
        source: 'text',
      };
    }
  }

  return { candidates: [], confidence: 'low', source: 'none' };
}
```

- [ ] **Step 8: Run the whole recognizer suite.** Existing tests that relied on the link
winning or on silent text fallback must be UPDATED, not deleted — each one is a decision
being reversed on purpose, so change the assertion and leave a comment saying why.

- [ ] **Step 9: Thread `fromText` through** `background.ts` (`recognize(tweet, job, opts)`)
and `messages.ts` (`{ type: 'recognize'; tweet: Tweet; job: string; fromText?: boolean }`).

- [ ] **Step 10: Commit**

```bash
git commit -am "fix: the image decides what book this is, and text is never a silent fallback"
```

---

## Task 3: The catch tray

Replaces `toastStack` **and** `pickerQueue` with one model. Fixes #2 and #3.

**Card states**

| State | Shows | Leaves when |
| --- | --- | --- |
| `looking` | thumbnail of the image being read, "Reading the cover…", stop | it resolves, or you stop it |
| `found` | cover, title, author, where it came from, **Now / Next / Someday**, "not this book" | you pick, or dismiss |
| `have` | "Already on your shelf — in Up next", move buttons, dismiss | you pick, or dismiss |
| `none` | "No book on that cover", **Try the post's words**, dismiss | you act, or dismiss |
| `error` | what went wrong, dismiss | 6s, or dismiss |

**Rules, and they are the point:**
- **Nothing saves without a click.** The `confidence === 'high'` auto-save is removed.
- **Only `error` and `stopped` leave on a timer.** A `found` card waits as long as it takes.
- Cards stack; the tray scrolls; each dismisses independently.

**Files:** create `src/extension/catchTray.ts` + test; delete `pickerQueue.*` and
`toastStack.*`; modify `content.ts`, `background.ts`.

- [ ] **Step 1: Write the failing tests** — `src/extension/catchTray.test.ts` covering:
  `open()` adds a `looking` card; `resolve()` turns that card into `found` **in place**
  (same id, same position); `resolve()` with an already-shelved book gives `have`;
  `resolve()` with no candidates gives `none`; `fail()` gives `error`; `dismiss()` removes
  one card and leaves siblings; two catches at once hold two independent cards; a card is
  never auto-removed unless `card.transient` is true; `stop()` moves a `looking` card to
  `error` with "Stopped looking."

- [ ] **Step 2: Run, watch fail against a stub.**

- [ ] **Step 3: Implement `catchTray.ts`** — a list of
  `{ id, state, text, book?, candidates?, source?, shelvedIn?, transient }` with
  `open/resolve/fail/stop/dismiss/list`, all pure.

- [ ] **Step 4: Run, watch pass. Plant `resolve()` appending instead of replacing and
  confirm the in-place test fails.**

- [ ] **Step 5: Render it in `content.ts`** — one `paintTray()` reconciling by card id;
  delete `paintToasts`, `toast`, `progress`, `buildPanel`, `queuePick`, `mountPicker`,
  `closePanel`. The intent buttons live on the card.

- [ ] **Step 6: Remove the auto-save** in `background.ts` — the `confidence === 'high'`
  branch that calls `library.add` goes; every catch is sent to the tray instead.

- [ ] **Step 7: Delete `pickerQueue.ts`, `toastStack.ts` and their tests.**

- [ ] **Step 8: Full suite, typecheck, build, commit.**

---

## Task 4: The tray looks like the rest of it

- [ ] **Step 1: Style the card** in the room palette (`#14101c`, `#221a30`, `#332a45`,
  `#f0eaf6`, `#a396b8`, lamp `#ffcf8a`), cloth spine down the left edge as the popup rows
  already do, cover thumb 30×44, intent buttons in the mono utility face.
- [ ] **Step 2: Motion, rationed.** The card fades and lifts in once (180ms,
  `cubic-bezier(.23,1,.32,1)`). The `looking → found` change is a blur-swap, not a
  re-entry. No animation on dismissal beyond the existing fade. Respect
  `prefers-reduced-motion`.
- [ ] **Step 3: Verify by screenshot.** Build a harness with three cards — one `looking`,
  one `found`, one `have` — render at 500×700 in headless Chrome, and LOOK at it.
  Headless clamps `--window-size` to 500px minimum.
- [ ] **Step 4: Commit.**

---

## Self-review

**Coverage.** #1 → Task 2. #2 → Tasks 3 and 4. #3 → Task 3 (Steps 3, 6). #4 → Task 1.

**Type consistency.** `bookKey`/`sameBook` are defined in Task 1 and consumed by
`storage.ts` in Task 1 Step 6; `identityOf` keeps its name so `background.ts` and
`content.ts` need no change. `fromText` is added to `recognizeBook` in Task 2 Step 7 and
threaded in Step 9. `catchTray`'s card shape is defined in Task 3 Step 3 and rendered in
Step 5.

**Deliberately out of scope.**
- Multiple books in ONE picture. The tray makes it *possible* (a card could hold several
  found books), but the recognizer still treats candidates as competing guesses for one
  book. Its own spec.
- The right-click flow still does not share the lookup memo.
- `groundText`'s per-line search stays as it is; it just stops running unasked.
