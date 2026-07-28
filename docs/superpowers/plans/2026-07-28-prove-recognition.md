# Prove Recognition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Book Catcher's behaviour follow the strength of its evidence, and measure how often it gets the book right, so the next cycle is decidable from data rather than guesswork.

**Architecture:** The match score `groundText` already computes is carried outward instead of being discarded, so `recognizeBook` can derive a confidence tier and the right-click flow can ask instead of auto-saving on weak evidence. Every attempt appends one bounded, local-only event to a recognition log; the background service worker is the log's **only writer**, with other contexts sending it completed events. The popup reads that log for a one-line kept-rate stat.

**Tech Stack:** TypeScript 5.9, MV3 (service worker + content script + popup + options page), vitest 3.2.7, esbuild. No new dependencies.

Source spec: `docs/superpowers/specs/2026-07-28-prove-recognition-design.md`

## Global Constraints

- **Run tests with `./node_modules/.bin/vitest run`.** `npm test` hands the script to `cmd.exe`, which fails from Git Bash with `"node" is not recognized`. From PowerShell `npm test` also works.
- **Build with `node build.mjs`.** It typechecks first and refuses to bundle on a type error.
- **No new npm dependencies.** The extension is 68 KB and stays that way.
- **The log is diagnostics; the shelf is the product.** A log write that fails must never block or fail a save — wrap and swallow with a `console.error`.
- **Local only.** The log is never transmitted. It is bounded to the most recent **200** events and clearable from the options page.
- **The background service worker is the log's only writer.** Content script, popup, and options page send it messages. This is stricter than the spec's "same write queue as the shelf" — see Task 4's note for why.
- **Post text alone never reaches `high` confidence.** A post listing ten books can ground the wrong line to a real book, and that failure is invisible.
- **All shelf writes go through `createLibrary`.** Never write the `savedBooks` key directly.
- All logging is prefixed `[BookCatcher]`.

## Confidence table (the rule this plan implements)

| Evidence | Confidence |
| --- | --- |
| Retailer link resolved an ISBN | `high` |
| Vision guess, top candidate scores >= 2 | `high` |
| Vision guess, top candidate scores exactly 1 | `medium` |
| Post text only (no image evidence) | `medium` |
| No candidates | `low` |

"Score" is `groundText`'s existing match score: the number of words of four or more characters shared between the query and the candidate's title plus author.

Right-click + `high` → save immediately. Right-click + `medium`/`low` → show the picker. The tweet button already shows the picker every time, so confidence changes nothing there.

## File structure

| File | Responsibility | Change |
| --- | --- | --- |
| `src/extension/writeQueue.ts` | Serialize read-modify-write jobs against one storage key | **Create** |
| `src/extension/writeQueue.test.ts` | Ordering + failure recovery | **Create** |
| `src/extension/storage.ts` | The shelf | Use the extracted queue |
| `src/recognizer/types.ts` | Shared shapes | Add `GroundedBook`, `RecognitionSource` |
| `src/recognizer/groundText.ts` | Ground text line-by-line, score matches | Return `GroundedBook[]`, export `rank` |
| `src/recognizer/recognizer.ts` | Pick the cheapest signal, derive confidence | Derive confidence from score |
| `src/extension/recognitionLog.ts` | The bounded log + its analysis | **Create** |
| `src/extension/recognitionLog.test.ts` | Ring buffer, wrong-window, kept rate | **Create** |
| `src/extension/messages.ts` | Cross-context contracts | New `pick`, `logEvent`, `markWrong`, `clearLog` |
| `src/extension/background.ts` | Recognition + the log's only writer | Confidence routing, log writes |
| `src/extension/content.ts` | In-page surfaces | Picker from right-click, outcome reporting |
| `src/extension/popup.ts` + `popup.html` | The shelf UI | Stats line, mark-wrong on remove |
| `src/extension/options.ts` + `options.html` | Setup | Clear the log |

---

### Task 1: Extract the write queue

The shelf's promise queue is about to have a second user. Extracting it first means the subtle part — `queue = run.catch(() => undefined)`, without which one failed write wedges every later write forever — exists once instead of twice.

**Files:**
- Create: `src/extension/writeQueue.ts`
- Create: `src/extension/writeQueue.test.ts`
- Modify: `src/extension/storage.ts:46-53`

**Interfaces:**
- Consumes: nothing.
- Produces: `createWriteQueue(): <T>(job: () => Promise<T>) => Promise<T>` from `src/extension/writeQueue.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/extension/writeQueue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createWriteQueue } from './writeQueue';

describe('createWriteQueue', () => {
  it('runs jobs one at a time, in the order they were queued', async () => {
    const serialize = createWriteQueue();
    const events: string[] = [];

    const job = (name: string, delay: number) => async () => {
      events.push(`${name}:start`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      events.push(`${name}:end`);
    };

    // The slow job is queued first: without serialization "b" would start and finish
    // inside "a", which is exactly how the shelf lost a book.
    await Promise.all([serialize(job('a', 20)), serialize(job('b', 0))]);

    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('keeps running after a job throws, and still rejects that job', async () => {
    const serialize = createWriteQueue();

    await expect(
      serialize(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(serialize(async () => 'ok')).resolves.toBe('ok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run src/extension/writeQueue.test.ts`
Expected: FAIL — `Failed to resolve import "./writeQueue"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/extension/writeQueue.ts`:

```ts
/**
 * Serializes async jobs so read-modify-write cycles against one storage key cannot
 * interleave. Two overlapping saves would otherwise both read the same base list and
 * the last write would silently drop the other's book - reproduced as real data loss.
 *
 * One queue per storage key. Separate keys want separate queues: `storage.set` replaces
 * only the keys it is given, so a shelf write and a log write cannot clobber each other,
 * and sharing a queue would only make diagnostics wait on the shelf.
 */
export function createWriteQueue(): <T>(job: () => Promise<T>) => Promise<T> {
  let queue: Promise<unknown> = Promise.resolve();

  return function serialize<T>(job: () => Promise<T>): Promise<T> {
    const run = queue.then(job);
    queue = run.catch(() => undefined); // a failed write must not wedge the queue
    return run;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run src/extension/writeQueue.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Use it in the shelf**

In `src/extension/storage.ts`, add to the imports at the top of the file:

```ts
import { createWriteQueue } from './writeQueue';
```

Then replace lines 46-53 (the `let queue` declaration and the `serialize` function) with:

```ts
  const serialize = createWriteQueue();
```

Leave the `createLibrary` doc comment above it unchanged — it still explains *why* the queue exists.

- [ ] **Step 6: Run the whole suite**

Run: `./node_modules/.bin/vitest run`
Expected: PASS — 28 tests. In particular `keeps both books when two saves overlap (no lost update)` still passes; that test is what proves the extraction was behaviour-preserving.

- [ ] **Step 7: Commit**

```bash
git add src/extension/writeQueue.ts src/extension/writeQueue.test.ts src/extension/storage.ts
git commit -m "refactor: extract the write queue so the recognition log can reuse it"
```

---

### Task 2: Carry the match score out of groundText

`groundText` computes a score per candidate and throws it away. Confidence has to come from somewhere; this is the evidence.

**Files:**
- Modify: `src/recognizer/types.ts` (add `GroundedBook`, `RecognitionSource`)
- Modify: `src/recognizer/groundText.ts:56-78`
- Modify: `src/recognizer/groundText.test.ts` (assertions move from `.title` to `.book.title`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface GroundedBook { book: Book; score: number }` from `src/recognizer/types.ts`
  - `type RecognitionSource = 'link' | 'vision' | 'text' | 'none'` from `src/recognizer/types.ts`
  - `rank(query: string, results: Book[]): GroundedBook[]` from `src/recognizer/groundText.ts` — filters score 0, sorts best first
  - `groundText(ocrText: string, books: BooksDb): Promise<GroundedBook[]>`

- [ ] **Step 1: Write the failing tests**

In `src/recognizer/groundText.test.ts`, change the import on line 2 to:

```ts
import { groundText, rank, MAX_QUERIES } from './groundText';
```

Then append this block inside the existing `describe('groundText', ...)`, after the last test:

```ts
  it('reports how many words each match shares with the query', async () => {
    // The score is the evidence confidence is derived from, so it has to survive the
    // trip out of here rather than being computed and dropped.
    const { books } = fakeBooks({
      'Signals and Systems': [
        { title: 'Signals and Systems', author: 'Alan V. Oppenheim' },
        { title: 'Systems Engineering', author: 'Someone Else' },
      ],
    });

    const result = await groundText('Signals and Systems', books);

    expect(result[0]?.book.title).toBe('Signals and Systems');
    expect(result[0]?.score).toBe(2); // "signals" + "systems"
    expect(result[1]?.score).toBe(1); // "systems" only
  });
```

And add a second `describe` block at the end of the file:

```ts
describe('rank', () => {
  it('drops results that share no real word with the query', () => {
    const ranked = rank('Signals and Systems', [
      { title: 'The Wings of the Dove', author: 'Henry James' },
    ]);

    expect(ranked).toEqual([]);
  });

  it('orders by how much of the query each result accounts for', () => {
    const ranked = rank('Dune Frank Herbert', [
      { title: 'Dune Messiah', author: 'Nobody' },
      { title: 'Dune', author: 'Frank Herbert' },
    ]);

    expect(ranked.map((r) => r.book.title)).toEqual(['Dune', 'Dune Messiah']);
    expect(ranked[0]?.score).toBe(3);
  });
});
```

Finally, update the four existing assertions that read a `Book` directly:

- line 34: `expect(result[0]?.author).toBe('Abelson, Sussman');` → `expect(result[0]?.book.author).toBe('Abelson, Sussman');`
- line 78: `expect(result[0]?.title).toBe('Economics in One Lesson');` → `expect(result[0]?.book.title).toBe('Economics in One Lesson');`
- line 92: `expect(result[0]?.title).toBe('Signals and Systems');` → `expect(result[0]?.book.title).toBe('Signals and Systems');`
- line 93: `expect(result[0]?.author).toBe('Alan V. Oppenheim');` → `expect(result[0]?.book.author).toBe('Alan V. Oppenheim');`

The two `toEqual([])` assertions (lines 40 and 47) need no change — an empty array is still an empty array.

- [ ] **Step 2: Run tests to verify they fail**

Run: `./node_modules/.bin/vitest run src/recognizer/groundText.test.ts`
Expected: FAIL — `rank` is not exported (`does not provide an export named 'rank'`).

- [ ] **Step 3: Add the types**

In `src/recognizer/types.ts`, replace the `RecognitionResult` block (lines 28-35) with:

```ts
export type Confidence = 'high' | 'medium' | 'low';

/** Where a result came from. `none` means nothing resolved at all. */
export type RecognitionSource = 'link' | 'vision' | 'text' | 'none';

/**
 * A book plus the evidence behind it: how many words of four or more characters it
 * shares with the query that found it. 0 means the books DB just fuzzy-matched
 * something unrelated, which is why 0 never survives ranking.
 */
export interface GroundedBook {
  book: Book;
  score: number;
}

/** What the recognizer hands back. `candidates` is ordered best-first. */
export interface RecognitionResult {
  candidates: Book[];
  confidence: Confidence;
  source: RecognitionSource;
}
```

- [ ] **Step 4: Write minimal implementation**

In `src/recognizer/groundText.ts`, change the import on line 1 to:

```ts
import type { Book, BooksDb, GroundedBook } from './types';
```

Then replace `groundText` (lines 47-78) with:

```ts
/**
 * Score every result against the query, drop the ones that share nothing with it, and
 * put the closest first.
 *
 * OpenLibrary does relevance search over tens of millions of works, so a short
 * incidental word ("HOME" on a meme) reliably returns *some* real book. Filtering at 0
 * is the invariant that stops those becoming silent saves.
 */
export function rank(query: string, results: Book[]): GroundedBook[] {
  return results
    .map((book) => ({ book, score: matchScore(query, book) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Turn noisy text into grounded books using "ground-as-filter": try each cleaned line
 * (then the whole text) as a search query and return the first that resolves to a
 * plausible book. We don't guess which line is the title - the books DB decides, and
 * garbage lines simply don't match anything.
 *
 * Lines are tried in document order (a cover's title sits near the top) rather than
 * longest-first, which would favour back-cover blurb text over the title.
 *
 * Scores come back with the books: the caller needs them to decide how much to trust
 * the result, and recomputing them there would mean two definitions of "match".
 */
export async function groundText(ocrText: string, books: BooksDb): Promise<GroundedBook[]> {
  const lines = ocrText.split('\n').map(cleanLine).filter((l) => l.length >= 4);

  // Each line first, then the whole thing as a last resort (catches a title that OCR
  // split across lines). Deduped so a single-line cover costs exactly one request.
  const queries = [...new Set([...lines, lines.join(' ')])]
    .filter(Boolean)
    .slice(0, MAX_QUERIES);

  for (const q of queries) {
    const ranked = rank(q, await books.search({ title: q }));
    if (ranked.length) return ranked.slice(0, 3);
  }
  return [];
}
```

Also update `matchScore`'s doc comment (lines 28-36) — its second paragraph now describes `rank`, so trim it to:

```ts
/**
 * How many real words this result shares with the query. 0 means the books DB just
 * fuzzy-matched something unrelated. Used by `rank` to both reject unrelated hits and
 * decide which result gets saved.
 */
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/recognizer/groundText.test.ts`
Expected: PASS — 10 tests.

The whole suite will NOT pass yet: `src/extension/background.ts:56` returns `groundText(...)` where `Book[]` is expected. Task 3 and Task 6 close that. Verify with:

Run: `npx tsc --noEmit`
Expected: exactly one error, in `src/extension/background.ts`, about `GroundedBook[]` not being assignable to `Book[]`.

- [ ] **Step 6: Commit**

```bash
git add src/recognizer/types.ts src/recognizer/groundText.ts src/recognizer/groundText.test.ts
git commit -m "feat: carry the match score out of groundText as evidence"
```

---

### Task 3: Derive confidence from the top score, and own the whole pipeline

The post-text fallback currently lives in `background.ts`, which no test imports. Moving it into `recognizeBook` puts every row of the confidence table behind a unit test and leaves the worker with one call instead of a second pipeline it has to keep in step.

**Files:**
- Modify: `src/recognizer/recognizer.ts:31-52`
- Modify: `src/recognizer/recognizer.test.ts:68` (an existing assertion changes — see Step 1)

**Interfaces:**
- Consumes: `rank`, `groundText` and `GroundedBook` from Task 2.
- Produces: `recognizeBook(tweet, deps): Promise<RecognitionResult>` — unchanged signature, but `confidence` now follows the table, the post-text fallback happens inside it, and `source` is `'none'` when nothing resolved.

- [ ] **Step 1: Write the failing tests**

In `src/recognizer/recognizer.test.ts`, **change the existing assertion on line 68** from:

```ts
    expect(result.confidence).toBe('medium');
```

to:

```ts
    expect(result.confidence).toBe('high');
```

This is a deliberate behaviour change, not a test being bent to fit. The guess is `Dune / Frank Herbert` and the match is `Dune / Frank Herbert`: three shared words, which is the strongest evidence the vision path can produce. Under the old rule every vision result was capped at `medium` regardless of how good it was, which is the thing this cycle exists to fix.

Then append these tests inside the same `describe`:

```ts
  it('drops to medium when the match shares only one word with the guess', async () => {
    // One shared word is a real match but a weak one - the model could have read the
    // author and invented the title. Weak evidence asks instead of deciding.
    const vision: VisionClient = {
      async guessBook() {
        return { title: 'Ficciones', author: 'Borges', confidence: 0.6 };
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        return [{ title: 'Labyrinths', author: 'Jorge Luis Borges' }];
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/b.jpg'], links: [] },
      { vision, books },
    );

    expect(result.confidence).toBe('medium');
    expect(result.candidates[0]?.title).toBe('Labyrinths');
  });

  it('reports nothing rather than a fuzzy match that shares no word with the guess', async () => {
    const vision: VisionClient = {
      async guessBook() {
        return { title: 'Ficciones', author: 'Borges', confidence: 0.6 };
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        return [{ title: 'The Wings of the Dove', author: 'Henry James' }];
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/c.jpg'], links: [] },
      { vision, books },
    );

    expect(result.candidates).toEqual([]);
    expect(result.confidence).toBe('low');
    expect(result.source).toBe('none');
  });

  it('ranks the closest match first rather than trusting the API order', async () => {
    const vision: VisionClient = {
      async guessBook() {
        return { title: 'Dune', author: 'Frank Herbert', confidence: 0.9 };
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        return [
          { title: 'Dune Messiah', author: 'Nobody' },
          { title: 'Dune', author: 'Frank Herbert' },
        ];
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/d.jpg'], links: [] },
      { vision, books },
    );

    expect(result.candidates[0]?.title).toBe('Dune');
    expect(result.confidence).toBe('high');
  });

  it('falls back to the post text when the image gives nothing', async () => {
    const vision: VisionClient = {
      async guessBook() {
        return null;
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search({ title }) {
        return title === '1 Economics in One Lesson'
          ? [{ title: 'Economics in One Lesson', author: 'Henry Hazlitt' }]
          : [];
      },
    };

    const result = await recognizeBook(
      { text: '10 books:\n\n1) Economics in One Lesson', imageUrls: [], links: [] },
      { vision, books },
    );

    expect(result.source).toBe('text');
    expect(result.candidates[0]?.title).toBe('Economics in One Lesson');
  });

  it('never lets the post text alone reach high confidence', async () => {
    // A post listing ten books can ground the wrong line to a real book, and that
    // failure is invisible - so text-only evidence always asks, however well it scores.
    const vision: VisionClient = {
      async guessBook() {
        return null;
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search({ title }) {
        return title === 'Structure and Interpretation of Computer Programs'
          ? [{ title: 'Structure and Interpretation of Computer Programs', author: 'Abelson' }]
          : [];
      },
    };

    const result = await recognizeBook(
      { text: 'Structure and Interpretation of Computer Programs', imageUrls: [], links: [] },
      { vision, books },
    );

    // Four shared words - as strong as text evidence ever gets, and still medium.
    expect(result.confidence).toBe('medium');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./node_modules/.bin/vitest run src/recognizer/recognizer.test.ts`
Expected: FAIL — 5 failures. The `medium`/`high` assertions fail because every vision result is currently hard-coded to `medium`; `source` is `'vision'` where `'none'` and `'text'` are expected, because the text fallback still lives in `background.ts`.

- [ ] **Step 3: Write minimal implementation**

In `src/recognizer/recognizer.ts`, change the imports (lines 1-2) to:

```ts
import { extractIsbnFromLinks } from './isbn';
import { groundText, rank } from './groundText';
import type { Tweet, RecognitionResult, VisionClient, BooksDb } from './types';
```

Then replace the vision block and the final return (lines 31-52) with:

```ts
  // Step 3 - vision fallback. Ask the model to name the book from the image + text,
  // then GROUND that guess against the books DB (canonical title/cover/ISBN, and a
  // hallucination filter).
  // (Step 2, the free "Title by Author" text pre-check, slots in here later - it just
  //  saves a vision call when the title is already written in the tweet.)
  const guess = await deps.vision.guessBook({
    imageUrls: tweet.imageUrls,
    text: tweet.text,
    altText: tweet.altText,
  });
  if (guess) {
    const matches = await deps.books.search({ title: guess.title, author: guess.author });

    // Score against the model's own words. Two shared words means the DB and the model
    // independently agree on a book; one means they overlap on a single token, which a
    // common surname or series word produces by accident.
    const ranked = rank(`${guess.title} ${guess.author}`, matches);
    const top = ranked[0];
    if (top) {
      return {
        candidates: ranked.slice(0, 3).map((scored) => scored.book),
        confidence: top.score >= 2 ? 'high' : 'medium',
        source: 'vision',
      };
    }
  }

  // Step 4 - the post's own words, grounded line by line. A post listing ten books has
  // its titles on separate lines, so searching the whole blob finds nothing while
  // searching each line finds plenty.
  const grounded = await groundText(tweet.text, deps.books);
  if (grounded.length) {
    return {
      candidates: grounded.slice(0, 3).map((scored) => scored.book),
      // Text alone never reaches `high`, however well it scores. A post listing ten
      // books can ground the wrong line to a real book, and that failure is invisible:
      // you never learn to distrust a shelf entry you had no reason to doubt.
      confidence: 'medium',
      source: 'text',
    };
  }

  // No link, no confirmed guess, nothing in the words: nothing to save.
  return { candidates: [], confidence: 'low', source: 'none' };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/recognizer/recognizer.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/recognizer/recognizer.ts src/recognizer/recognizer.test.ts
git commit -m "feat: derive confidence from how well the match backs the guess"
```

`npx tsc --noEmit` still reports the one `background.ts` error from Task 2 — the worker keeps its own now-redundant `groundText` call until Task 6 removes it.

---

### Task 4: The recognition log — append and bound

**Files:**
- Create: `src/extension/recognitionLog.ts`
- Create: `src/extension/recognitionLog.test.ts`

**Note on "the same write queue as the shelf".** The spec says to serialize log writes through the shelf's queue. This plan uses a *separate* `createWriteQueue()` instance in the log module instead, because `chrome.storage.local.set({ [key]: value })` replaces only the keys it is given: a write to `recognitionLog` cannot clobber `savedBooks`, so the two do not contend. Sharing one queue would only make the log's writes wait behind the shelf's. What the spec is actually protecting against — an unserialized read-modify-write — is fully covered, and Task 6 adds the stronger guarantee that only one *context* ever writes the log.

**Interfaces:**
- Consumes: `createWriteQueue` (Task 1), `StorageArea` from `./storage`, `Confidence` and `RecognitionSource` from `../recognizer/types`.
- Produces, from `src/extension/recognitionLog.ts`:
  - `interface RecognitionEvent { at, ms, flow, source, confidence, guess?, outcome, savedId?, wrong? }`
  - `type PendingEvent = Omit<RecognitionEvent, 'at' | 'wrong'>`
  - `type AttemptDraft = Omit<PendingEvent, 'outcome' | 'savedId'>`
  - `const MAX_EVENTS = 200`
  - `createRecognitionLog(deps): { record(e: PendingEvent): Promise<void>; list(): Promise<RecognitionEvent[]>; clear(): Promise<void> }`

- [ ] **Step 1: Write the failing tests**

Create `src/extension/recognitionLog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRecognitionLog, MAX_EVENTS, type PendingEvent } from './recognitionLog';
import type { StorageArea } from './storage';

function fakeStorage(): StorageArea {
  const store: Record<string, unknown> = {};
  return {
    async get(key) {
      return { [key]: store[key] };
    },
    async set(items) {
      Object.assign(store, items);
    },
  };
}

function makeLog() {
  let clock = 1_000_000;
  return createRecognitionLog({ storage: fakeStorage(), now: () => (clock += 1000) });
}

const attempt = (over: Partial<PendingEvent> = {}): PendingEvent => ({
  ms: 1200,
  flow: 'contextmenu',
  source: 'vision',
  confidence: 'high',
  guess: { title: 'Dune', author: 'Frank Herbert' },
  outcome: 'auto-saved',
  ...over,
});

describe('createRecognitionLog', () => {
  it('records an attempt with the time it landed', async () => {
    const log = makeLog();

    await log.record(attempt({ savedId: 'id-1' }));

    const events = await log.list();
    expect(events).toHaveLength(1);
    expect(events[0]?.outcome).toBe('auto-saved');
    expect(events[0]?.savedId).toBe('id-1');
    expect(events[0]?.ms).toBe(1200);
    expect(events[0]?.at).toBeGreaterThan(0);
  });

  it('records a miss, so the miss rate is visible rather than silently absent', async () => {
    const log = makeLog();

    await log.record(attempt({ outcome: 'no-match', source: 'none', confidence: 'low' }));

    expect((await log.list())[0]?.outcome).toBe('no-match');
  });

  it('keeps only the most recent 200 events', async () => {
    const log = makeLog();

    for (let i = 0; i < MAX_EVENTS + 5; i++) {
      await log.record(attempt({ guess: { title: `Book ${i}`, author: 'A' } }));
    }

    const events = await log.list();
    expect(events).toHaveLength(MAX_EVENTS);
    // The oldest five fell off the front, not the newest off the back.
    expect(events[0]?.guess?.title).toBe('Book 5');
    expect(events[MAX_EVENTS - 1]?.guess?.title).toBe(`Book ${MAX_EVENTS + 4}`);
  });

  it('does not drop an event when two are recorded at once', async () => {
    const log = makeLog();

    await Promise.all([
      log.record(attempt({ guess: { title: 'A', author: 'A' } })),
      log.record(attempt({ guess: { title: 'B', author: 'B' } })),
    ]);

    expect((await log.list()).map((e) => e.guess?.title).sort()).toEqual(['A', 'B']);
  });

  it('empties on clear', async () => {
    const log = makeLog();
    await log.record(attempt());

    await log.clear();

    expect(await log.list()).toEqual([]);
  });

  it('reads an empty log before anything has been written', async () => {
    expect(await makeLog().list()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./node_modules/.bin/vitest run src/extension/recognitionLog.test.ts`
Expected: FAIL — `Failed to resolve import "./recognitionLog"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/extension/recognitionLog.ts`:

```ts
import type { Confidence, RecognitionSource } from '../recognizer/types';
import type { StorageArea } from './storage';
import { createWriteQueue } from './writeQueue';

/**
 * One record per recognition attempt. Local only, never transmitted: this exists so the
 * recognizer can be judged on real use instead of on how it feels, and grading a week of
 * catches by hand is exactly the kind of homework that stops getting done.
 */
export interface RecognitionEvent {
  at: number;
  /** Wall-clock cost of the whole attempt. Without this the latency bar is unmeasurable. */
  ms: number;
  flow: 'button' | 'contextmenu';
  source: RecognitionSource;
  confidence: Confidence;
  guess?: { title: string; author: string };
  outcome: 'auto-saved' | 'confirmed' | 'dismissed' | 'no-match';
  /** Links this attempt to its `SavedBook`, so a later delete can mark it wrong. */
  savedId?: string;
  wrong?: boolean;
}

/** An event minus what only the log knows (when it landed) or infers later (`wrong`). */
export type PendingEvent = Omit<RecognitionEvent, 'at' | 'wrong'>;

/**
 * The evidence half of an event, carried between contexts while the user decides.
 * The background stamps this and hands it to whoever finishes the attempt, so a pending
 * attempt never lives in the worker's memory - service workers are terminated after
 * ~30s idle, which would lose every event whose picker stayed open.
 */
export type AttemptDraft = Omit<PendingEvent, 'outcome' | 'savedId'>;

const KEY = 'recognitionLog';

/**
 * A ring buffer, not a journal. An unbounded log in `chrome.storage.local` is a slow
 * quota failure, and 200 attempts is already several weeks of normal use.
 */
export const MAX_EVENTS = 200;

export function createRecognitionLog(deps: { storage: StorageArea; now: () => number }) {
  const serialize = createWriteQueue();

  async function read(): Promise<RecognitionEvent[]> {
    const got = await deps.storage.get(KEY);
    const raw = got[KEY];
    return Array.isArray(raw) ? (raw as RecognitionEvent[]) : [];
  }

  return {
    async record(event: PendingEvent): Promise<void> {
      return serialize(async () => {
        const existing = await read();
        const next = [...existing, { ...event, at: deps.now() }].slice(-MAX_EVENTS);
        await deps.storage.set({ [KEY]: next });
      });
    },

    /** Oldest first, so the newest event is the last one. */
    async list(): Promise<RecognitionEvent[]> {
      return read();
    },

    async clear(): Promise<void> {
      return serialize(async () => {
        await deps.storage.set({ [KEY]: [] });
      });
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/extension/recognitionLog.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/extension/recognitionLog.ts src/extension/recognitionLog.test.ts
git commit -m "feat: add a bounded, local-only recognition log"
```

---

### Task 5: Infer wrong matches, and compute the kept rate

Deleting a wrong match is both the fix and the measurement — that's the whole trick that keeps dogfooding from becoming grading homework.

**Files:**
- Modify: `src/extension/recognitionLog.ts`
- Modify: `src/extension/recognitionLog.test.ts`

**Interfaces:**
- Consumes: Task 4's module.
- Produces:
  - `const WRONG_WINDOW_MS = 600_000`
  - `const MIN_FOR_RATE = 5`
  - `markWrong(savedId: string): Promise<void>` on the object returned by `createRecognitionLog`
  - `summarize(events: RecognitionEvent[]): { caught: number; keptPct: number | null }` — a standalone export, pure

- [ ] **Step 1: Write the failing tests**

In `src/extension/recognitionLog.test.ts`, change the import on line 2 to:

```ts
import {
  createRecognitionLog,
  summarize,
  MAX_EVENTS,
  MIN_FOR_RATE,
  WRONG_WINDOW_MS,
  type PendingEvent,
  type RecognitionEvent,
} from './recognitionLog';
```

Add a controllable clock helper below `makeLog`:

```ts
/** A log whose clock only moves when the test says so. */
function makeClockedLog() {
  let clock = 1_000_000;
  const log = createRecognitionLog({ storage: fakeStorage(), now: () => clock });
  return { log, advance: (ms: number) => (clock += ms) };
}
```

Then append inside the existing `describe('createRecognitionLog', ...)`:

```ts
  it('marks a match wrong when its book is deleted soon after saving', async () => {
    const { log, advance } = makeClockedLog();
    await log.record(attempt({ savedId: 'id-1' }));

    advance(WRONG_WINDOW_MS - 1000);
    await log.markWrong('id-1');

    expect((await log.list())[0]?.wrong).toBe(true);
  });

  it('treats a later deletion as changing your mind, not a bad match', async () => {
    const { log, advance } = makeClockedLog();
    await log.record(attempt({ savedId: 'id-1' }));

    advance(WRONG_WINDOW_MS + 1000);
    await log.markWrong('id-1');

    expect((await log.list())[0]?.wrong).toBeUndefined();
  });

  it('ignores a deletion of a book that has no event', async () => {
    const { log } = makeClockedLog();
    await log.record(attempt({ savedId: 'id-1' }));

    await log.markWrong('id-does-not-exist');

    expect((await log.list())[0]?.wrong).toBeUndefined();
  });
});

describe('summarize', () => {
  const event = (over: Partial<RecognitionEvent>): RecognitionEvent => ({
    at: 1,
    ms: 1000,
    flow: 'contextmenu',
    source: 'vision',
    confidence: 'high',
    outcome: 'auto-saved',
    ...over,
  });

  it('counts only attempts that put a book on the shelf', () => {
    const { caught } = summarize([
      event({ outcome: 'auto-saved' }),
      event({ outcome: 'confirmed' }),
      event({ outcome: 'dismissed' }),
      event({ outcome: 'no-match' }),
    ]);

    expect(caught).toBe(2);
  });

  it('hides the rate until there are enough catches to mean anything', () => {
    const events = Array.from({ length: MIN_FOR_RATE - 1 }, () => event({}));

    expect(summarize(events).keptPct).toBeNull();
  });

  it('reports the share of catches that survived', () => {
    const events = [
      ...Array.from({ length: 8 }, () => event({})),
      ...Array.from({ length: 2 }, () => event({ wrong: true })),
    ];

    expect(summarize(events)).toEqual({ caught: 10, keptPct: 80 });
  });

  it('reports nothing at all for an empty log', () => {
    expect(summarize([])).toEqual({ caught: 0, keptPct: null });
  });
```

Note the placement: the three `markWrong` tests go **inside** the existing describe, then that describe closes with `});` and `describe('summarize', ...)` opens. The final `});` already at the end of the file closes the new describe.

- [ ] **Step 2: Run tests to verify they fail**

Run: `./node_modules/.bin/vitest run src/extension/recognitionLog.test.ts`
Expected: FAIL — `does not provide an export named 'summarize'`.

- [ ] **Step 3: Write minimal implementation**

In `src/extension/recognitionLog.ts`, add below `MAX_EVENTS`:

```ts
/**
 * How long after a save a deletion still counts as "that was the wrong book". Past this
 * you are changing your mind about reading it, which says nothing about the recognizer.
 */
export const WRONG_WINDOW_MS = 10 * 60 * 1000;

/** Below this many catches a percentage is noise, so no rate is shown at all. */
export const MIN_FOR_RATE = 5;
```

Add `markWrong` to the returned object, after `record`:

```ts
    /**
     * Deleting a wrong match is both the fix and the measurement - it is the only
     * signal this log gets for free, which is why dogfooding doesn't need a grading step.
     */
    async markWrong(savedId: string): Promise<void> {
      return serialize(async () => {
        const existing = await read();
        const now = deps.now();
        let changed = false;

        const next = existing.map((event) => {
          if (event.savedId !== savedId || event.wrong) return event;
          if (now - event.at > WRONG_WINDOW_MS) return event;
          changed = true;
          return { ...event, wrong: true };
        });

        if (changed) await deps.storage.set({ [KEY]: next });
      });
    },
```

Add `summarize` at the end of the file, outside `createRecognitionLog`:

```ts
/**
 * The one number worth watching: of the books this put on your shelf, how many did you
 * keep? Pure, so the popup renders it and the tests check the maths without storage.
 */
export function summarize(events: RecognitionEvent[]): { caught: number; keptPct: number | null } {
  const saved = events.filter((e) => e.outcome === 'auto-saved' || e.outcome === 'confirmed');
  const kept = saved.filter((e) => !e.wrong).length;

  return {
    caught: saved.length,
    keptPct: saved.length < MIN_FOR_RATE ? null : Math.round((kept / saved.length) * 100),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/extension/recognitionLog.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/extension/recognitionLog.ts src/extension/recognitionLog.test.ts
git commit -m "feat: infer wrong matches from quick deletes and compute the kept rate"
```

---

### Task 6: Message contracts and the background worker

This is chrome-glue, verified by hand rather than unit-tested — consistent with the existing decision not to build a fake-chrome harness for a solo project. The typecheck is the gate here.

**Files:**
- Modify: `src/extension/messages.ts` (whole file)
- Modify: `src/extension/background.ts`

**Interfaces:**
- Consumes: `RecognitionResult`/`RecognitionSource` (Task 2), `recognizeBook` (Task 3), `PendingEvent`/`AttemptDraft`/`createRecognitionLog` (Tasks 4-5).
- Produces:
  - `ContentRequest` gains `{ type: 'pick'; candidates: Book[]; srcUrl: string; permalink: string | null; draft: AttemptDraft }`, answered with `{ shown: boolean }`
  - `BackgroundRequest` becomes a union including `{ type: 'logEvent'; event: PendingEvent }`, `{ type: 'markWrong'; savedId: string }`, `{ type: 'clearLog' }`
  - `BackgroundResponse` success case becomes `{ ok: true; result: RecognitionResult; draft: AttemptDraft }`

- [ ] **Step 1: Rewrite the message contracts**

Replace the whole of `src/extension/messages.ts` with:

```ts
import type { Book, RecognitionResult, Tweet } from '../recognizer/types';
import type { AttemptDraft, PendingEvent } from './recognitionLog';

/**
 * The message contracts between the extension's contexts, in one place.
 *
 * These were once untyped object literals duplicated across files:
 * `chrome.runtime.sendMessage` defaults its response to `any`, so a renamed field
 * compiled clean on both sides and broke only at runtime - reported as a misleading
 * "OCR failed".
 */

/** What the content script can tell us about the tweet around an image. */
export interface TweetContext {
  permalink: string | null;
  text: string;
  links: string[];
}

/** background -> content script */
export type ContentRequest =
  /** `sticky` marks an in-progress stage: it stays until the next update replaces it. */
  | { type: 'toast'; text: string; sticky?: boolean }
  /** "which tweet holds this image?" - so a save records the tweet, not the feed URL */
  | { type: 'tweetContextFor'; srcUrl: string }
  /**
   * "I recognized something, but not confidently enough to decide for you." The panel
   * anchors to the image that was right-clicked, so it appears at the thing being
   * pointed at. Answered with `{ shown }` - the background must know whether anyone
   * took ownership of the outcome.
   */
  | {
      type: 'pick';
      candidates: Book[];
      srcUrl: string;
      permalink: string | null;
      draft: AttemptDraft;
    };

/** content script / popup / options -> background */
export type BackgroundRequest =
  | { type: 'recognize'; tweet: Tweet }
  /** The background is the log's only writer; everyone else hands it finished events. */
  | { type: 'logEvent'; event: PendingEvent }
  | { type: 'markWrong'; savedId: string }
  | { type: 'clearLog' };

export type BackgroundResponse =
  | { ok: true; result: RecognitionResult; draft: AttemptDraft }
  | { ok: false; needsKey: boolean; error: string };
```

- [ ] **Step 2: Rewrite the background worker**

Replace the whole of `src/extension/background.ts` with:

```ts
// Background service worker. Owns recognition for both flows, so the tweet button and
// the right-click menu resolve books exactly the same way - and so cross-origin calls
// happen where host_permissions apply, rather than from a content script.
//
// It is also the recognition log's ONLY writer. Every other context sends it a finished
// event. One writer means no cross-context race, and it means the right-click flow still
// records an attempt on a tab whose content script never loaded.
import { createOpenLibraryClient } from '../recognizer/openLibrary';
import { createLlmVision } from '../recognizer/llmVision';
import { recognizeBook } from '../recognizer/recognizer';
import type { RecognitionResult, Tweet } from '../recognizer/types';
import { readSettings, toVisionConfig } from './settings';
import { createLibrary, type SavedSource, type StorageArea } from './storage';
import {
  createRecognitionLog,
  type AttemptDraft,
  type PendingEvent,
} from './recognitionLog';
import type { BackgroundRequest, BackgroundResponse, ContentRequest, TweetContext } from './messages';

const MENU_ID = 'bookcatcher-save-image';

/** The only surfaces we can give feedback on - the content script lives here. */
const SUPPORTED_PAGES = ['https://twitter.com/*', 'https://x.com/*'];

const storage: StorageArea = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
};
const library = createLibrary({
  storage,
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
});
const log = createRecognitionLog({ storage, now: () => Date.now() });
const books = createOpenLibraryClient({ fetch: (url, init) => fetch(url, init) });

class NoKeyError extends Error {}

/** The shelf is the product; the log is diagnostics. A log failure never breaks a save. */
function note(event: PendingEvent): void {
  void log.record(event).catch((err) => console.error('[BookCatcher] log write failed', err));
}

/** Settings are read per call, so a newly saved key takes effect without a reload. */
async function visionClient() {
  const settings = await readSettings();

  // A blank key is legitimate against a proxy holding its own credential, but against a
  // public provider it just means setup is unfinished - worth saying so rather than
  // firing a request that can only 401.
  const providerNeedsKey = /googleapis\.com|openai\.com|openrouter\.ai/.test(settings.endpoint);
  if (!settings.apiKey && providerNeedsKey) throw new NoKeyError('no key');

  return createLlmVision({
    fetch: (url, init) => fetch(url, init),
    config: toVisionConfig(settings),
  });
}

/**
 * The whole pipeline lives in `recognizeBook`; this only supplies the vision client,
 * which is the one dependency that needs the worker's settings and host permissions.
 */
async function recognize(tweet: Tweet): Promise<RecognitionResult> {
  const vision = await visionClient();
  return recognizeBook(tweet, { vision, books });
}

/**
 * A failed attempt is still a miss. Recording it keeps the rate honest - a log that only
 * sees lookups that completed reports a quality the extension doesn't have.
 */
function noteFailure(ms: number, flow: AttemptDraft['flow']): void {
  note({ ms, flow, source: 'none', confidence: 'low', outcome: 'no-match' });
}

/** The evidence half of an event, ready to be finished by whoever learns the outcome. */
function draftFrom(result: RecognitionResult, ms: number, flow: AttemptDraft['flow']): AttemptDraft {
  const top = result.candidates[0];
  return {
    ms,
    flow,
    source: result.source,
    confidence: result.confidence,
    ...(top ? { guess: { title: top.title, author: top.author } } : {}),
  };
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: MENU_ID,
        title: 'Save book to shelf',
        contexts: ['image'],
        // Scoped deliberately: off these pages there is no content script, so a save
        // would run and mutate the shelf with no visible feedback at all.
        documentUrlPatterns: SUPPORTED_PAGES,
      },
      () => void chrome.runtime.lastError,
    );
  });
  // Recognition needs a key, so say so once rather than failing silently on first use.
  if (details.reason === 'install') void chrome.runtime.openOptionsPage();
});

async function tellTab<T>(tabId: number | undefined, msg: ContentRequest): Promise<T | undefined> {
  if (tabId == null) return undefined;
  try {
    return (await chrome.tabs.sendMessage(tabId, msg)) as T;
  } catch {
    return undefined; // content script not ready on this tab
  }
}

const toast = (tabId: number | undefined, text: string): Promise<unknown> =>
  tellTab(tabId, { type: 'toast', text });

/** An in-progress stage - stays on screen until the next update replaces it. */
const progress = (tabId: number | undefined, text: string): Promise<unknown> =>
  tellTab(tabId, { type: 'toast', text, sticky: true });

function sourceFrom(ctx: TweetContext | undefined, pageUrl: string | undefined): SavedSource | undefined {
  // `pageUrl` is the tab's URL (x.com/home), not the tweet - saving that would break
  // "the tweet that sold you", which is the point of keeping a source at all.
  if (ctx?.permalink) return { url: ctx.permalink, kind: 'tweet' };
  return pageUrl ? { url: pageUrl, kind: 'page' } : undefined;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl) return;
  const tabId = tab?.id;

  await progress(tabId, 'Reading the cover…');

  // The post's words are the best hint for a hard-to-read cover, so pull the whole
  // tweet around the clicked image rather than sending the picture on its own.
  const ctx = await tellTab<TweetContext>(tabId, {
    type: 'tweetContextFor',
    srcUrl: info.srcUrl,
  });

  const startedAt = Date.now();
  let result: RecognitionResult;
  try {
    result = await recognize({
      text: ctx?.text ?? '',
      imageUrls: [info.srcUrl],
      links: ctx?.links ?? [],
    });
  } catch (err) {
    if (err instanceof NoKeyError) {
      await toast(tabId, 'Add a recognition key in Book Catcher settings to read covers.');
      void chrome.runtime.openOptionsPage();
      return;
    }
    console.error('[BookCatcher] recognition failed', err);
    noteFailure(Date.now() - startedAt, 'contextmenu');
    await toast(tabId, "Couldn't read that cover — try again in a moment.");
    return;
  }

  const draft = draftFrom(result, Date.now() - startedAt, 'contextmenu');
  const book = result.candidates[0];

  if (!book) {
    note({ ...draft, outcome: 'no-match' });
    await toast(tabId, "Couldn't match that cover to a book.");
    return;
  }

  // Weak evidence asks instead of deciding. A confident wrong answer costs more than ten
  // misses, because it makes the whole shelf suspect.
  if (result.confidence !== 'high') {
    const shown = await tellTab<{ shown: boolean }>(tabId, {
      type: 'pick',
      candidates: result.candidates,
      srcUrl: info.srcUrl,
      permalink: ctx?.permalink ?? null,
      draft,
    });
    // The content script owns the outcome from here. If it never answered there is no
    // content script on this tab, so saving would mutate the shelf with zero feedback -
    // the exact thing the menu is scoped to x.com to avoid.
    if (!shown?.shown) note({ ...draft, outcome: 'dismissed' });
    return;
  }

  try {
    const saved = await library.add(book, 'someday', sourceFrom(ctx, info.pageUrl));
    note({ ...draft, outcome: 'auto-saved', savedId: saved.id });
    await toast(tabId, `Saved: ${book.title} → someday`);
  } catch (err) {
    console.error('[BookCatcher] save failed', err);
    await toast(tabId, "Couldn't save to your shelf.");
  }
});

// The tweet button asks the worker to recognize, so both flows share one pipeline and
// the cross-origin calls stay where host_permissions apply.
chrome.runtime.onMessage.addListener((msg: BackgroundRequest, _sender, sendResponse) => {
  if (msg?.type === 'logEvent') {
    note(msg.event);
    sendResponse({ ok: true });
    return false;
  }

  if (msg?.type === 'markWrong') {
    void log.markWrong(msg.savedId).catch((err) => {
      console.error('[BookCatcher] could not flag the match', err);
    });
    sendResponse({ ok: true });
    return false;
  }

  if (msg?.type === 'clearLog') {
    log
      .clear()
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) => {
        console.error('[BookCatcher] could not clear the log', err);
        sendResponse({ ok: false });
      });
    return true; // async response
  }

  if (msg?.type !== 'recognize') return false;

  const startedAt = Date.now();
  recognize(msg.tweet)
    .then((result) =>
      sendResponse({
        ok: true,
        result,
        draft: draftFrom(result, Date.now() - startedAt, 'button'),
      } satisfies BackgroundResponse),
    )
    .catch((err: unknown) => {
      // A missing key is unfinished setup, not a miss - logging it would make the
      // recognizer look bad for something it was never given a chance to do.
      if (!(err instanceof NoKeyError)) {
        console.error('[BookCatcher] recognition failed', err);
        noteFailure(Date.now() - startedAt, 'button');
      }
      sendResponse({
        ok: false,
        needsKey: err instanceof NoKeyError,
        error: String(err),
      } satisfies BackgroundResponse);
    });
  return true; // async response
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in `src/extension/content.ts` — it still reads `resp.candidates`, which no longer exists. Task 7 closes them. If any error names `background.ts` or `messages.ts`, fix it before moving on.

- [ ] **Step 4: Commit**

```bash
git add src/extension/messages.ts src/extension/background.ts
git commit -m "feat: route weak right-click matches to the picker and log every attempt"
```

---

### Task 7: The picker from the right-click flow

**Files:**
- Modify: `src/extension/content.ts` — `STYLE`, `recognize`, `openPicker`, `addButton`'s click handler, the `onMessage` listener

**Interfaces:**
- Consumes: the `pick` message and `BackgroundResponse` from Task 6.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Add the corner-anchored panel style**

In `src/extension/content.ts`, inside the `STYLE` template literal, add after the `.bc-panel.bc-in` rule (line 86):

```css
/* No anchor: the feed recycled the image away mid-recognition. Park the panel in the
   corner rather than dropping the result - losing a recognized book is the exact
   failure this extension exists to prevent. Clear of the status pill at bottom: 20px. */
.bc-panel.bc-corner {
  position: fixed; left: auto; top: auto; right: 20px; bottom: 72px;
  transform-origin: bottom right;
}
```

- [ ] **Step 2: Report outcomes to the background**

In `src/extension/content.ts`, change the imports (lines 4-11) to:

```ts
import type { Tweet, Book } from '../recognizer/types';
import { createLibrary, type Intent, type StorageArea } from './storage';
import type { AttemptDraft, PendingEvent } from './recognitionLog';
import type {
  BackgroundRequest,
  BackgroundResponse,
  ContentRequest,
  TweetContext,
} from './messages';
```

Then replace `recognize` (lines 179-194) with:

```ts
/**
 * Recognition happens in the background worker, not here: it owns the vision key, and
 * cross-origin calls belong where host_permissions apply. It also means this button and
 * the right-click menu resolve books through exactly the same pipeline - including
 * reading the cover image, which this flow previously ignored.
 */
async function recognize(tweet: Tweet): Promise<{ candidates: Book[]; draft: AttemptDraft } | null> {
  const resp = (await chrome.runtime.sendMessage({
    type: 'recognize',
    tweet,
  } satisfies BackgroundRequest)) as BackgroundResponse | undefined;

  if (!resp) throw new Error('No response from the recognizer');
  if (!resp.ok) {
    if (resp.needsKey) {
      toast('Add a recognition key in Book Catcher settings to read covers.');
      return null;
    }
    throw new Error(resp.error);
  }
  return { candidates: resp.result.candidates, draft: resp.draft };
}

/**
 * Hand a finished event to the background, which is the log's only writer. Diagnostics:
 * a failure here must never surface as a failed save.
 */
function report(event: PendingEvent): void {
  void chrome.runtime
    .sendMessage({ type: 'logEvent', event } satisfies BackgroundRequest)
    .catch((err: unknown) => console.error('[BookCatcher] log write failed', err));
}
```

- [ ] **Step 3: Let the picker report its own outcome and survive a missing anchor**

Replace `openPicker` (lines 251-330) with:

```ts
/** What the user did with a panel. Exactly one of these fires per panel, ever. */
type PickOutcome = { outcome: 'confirmed'; savedId: string } | { outcome: 'dismissed' };

interface PickerOptions {
  source?: string;
  onOutcome?: (result: PickOutcome) => void;
}

function openPicker(
  anchor: HTMLElement | null,
  candidates: Book[],
  opts: PickerOptions = {},
): void {
  closePanel(); // only ever one picker; a second would strand the first

  const panel = document.createElement('div');
  panel.className = anchor ? 'bc-panel' : 'bc-panel bc-corner';

  // Every close path runs cleanup, and cleanup reports a dismissal - so the guard is
  // what stops a successful save being logged twice, once as confirmed and once as not.
  let settled = false;
  const settle = (result: PickOutcome): void => {
    if (settled) return;
    settled = true;
    opts.onOutcome?.(result);
  };

  if (!candidates.length) {
    const empty = document.createElement('div');
    empty.className = 'bc-none';
    empty.textContent = 'No book named here. Right-click the cover image to read it instead.';
    panel.appendChild(empty);
  } else {
    candidates.forEach((book) => {
      const row = document.createElement('div');
      row.className = 'bc-cand';
      row.style.setProperty('--cloth', clothFor(book));

      const title = document.createElement('div');
      title.className = 'bc-t';
      title.textContent = book.title;
      const author = document.createElement('div');
      author.className = 'bc-a';
      author.textContent = book.author;
      row.append(title, author);

      const btns = document.createElement('div');
      btns.className = 'bc-row';
      (['now', 'next', 'someday'] as Intent[]).forEach((intent) => {
        const b = document.createElement('button');
        b.className = 'bc-intent';
        b.textContent = intent;
        b.addEventListener('click', async () => {
          // Disable the whole row: a second click would re-enter the save and race
          // the storage write.
          btns.querySelectorAll('button').forEach((el) => (el.disabled = true));
          try {
            const saved = await library.add(
              book,
              intent,
              opts.source ? { url: opts.source, kind: 'tweet' } : undefined,
            );
            settle({ outcome: 'confirmed', savedId: saved.id });
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
    if (!anchor) return; // corner-anchored; the stylesheet holds it in place
    // The feed is virtualized; if the tweet was recycled away, close rather than
    // leave the panel pinned to a zeroed rect in the corner.
    if (!anchor.isConnected) return closePanel();

    const rect = anchor.getBoundingClientRect();
    // Below the anchor if it fits, above it if not. A tweet image is tall enough that
    // its bottom edge is often below the fold, and a panel rendered off-screen loses
    // the book just as surely as never showing one.
    const height = panel.offsetHeight || 120;
    const below = rect.bottom + 4;
    const top = below + height <= window.innerHeight ? below : Math.max(8, rect.top - height - 4);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 296));

    panel.style.left = `${left + window.scrollX}px`;
    panel.style.top = `${top + window.scrollY}px`;
  };
  place();
  document.body.appendChild(panel);
  place(); // again now it has a measurable height, so the flip-above check is real
  // Next frame, so it scales out of the trigger rather than appearing at full size.
  requestAnimationFrame(() => panel.classList.add('bc-in'));

  const onClickAway = (e: MouseEvent): void => {
    if (!panel.contains(e.target as Node) && e.target !== anchor) closePanel();
  };
  // One cleanup used by every close path, so listeners can't outlive the panel.
  const cleanup = (): void => {
    document.removeEventListener('click', onClickAway);
    window.removeEventListener('scroll', place, true);
    window.removeEventListener('resize', place);
    settle({ outcome: 'dismissed' }); // no-op if a pick already settled it
  };
  setTimeout(() => document.addEventListener('click', onClickAway), 0);
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);

  openPanel = { el: panel, cleanup };
}
```

- [ ] **Step 4: Update the button flow's call site**

In `addButton`'s click handler, replace the body of the `try` block (lines 361-375) with:

```ts
      const tweet = scrapeTweet(article);
      trace('clicked. scraped:', {
        text: tweet.text.slice(0, 60),
        images: tweet.imageUrls.length,
        links: tweet.links.length,
      });

      toast('Looking up the book…', { sticky: true });
      const recognized = await recognize(tweet);
      if (!recognized) return; // no key; recognize() already said so
      const { candidates, draft } = recognized;
      trace('lookup returned', candidates.length, 'candidate(s)', candidates);

      if (!article.isConnected) return trace('tweet scrolled away; dropping result');

      if (!candidates.length) {
        report({ ...draft, outcome: 'no-match' });
      }
      openPicker(btn, candidates, {
        source: tweetPermalink(article) ?? location.href,
        // A no-match panel has nothing to pick, so its outcome is already recorded.
        ...(candidates.length ? { onOutcome: (o) => report({ ...draft, ...o }) } : {}),
      });
      toast(candidates.length ? `Found ${candidates.length}` : 'No book found in this tweet');
      trace('picker opened');
```

- [ ] **Step 5: Handle the `pick` message**

In the `chrome.runtime.onMessage.addListener` at the bottom of `src/extension/content.ts`, add before the `tweetContextFor` branch:

```ts
  if (msg?.type === 'pick') {
    const { candidates, draft, permalink } = msg;
    // The same URL-path lookup that resolves the permalink also positions the panel, so
    // it opens at the image being pointed at.
    const img = Array.from(document.querySelectorAll('img')).find((i) =>
      sameImage(i.src, msg.srcUrl),
    );
    openPicker(img ?? null, candidates, {
      source: permalink ?? location.href,
      onOutcome: (o) => report({ ...draft, ...o }),
    });
    sendResponse({ shown: true });
    return true;
  }
```

- [ ] **Step 6: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no output (clean).

Run: `node build.mjs`
Expected: `Typecheck` passes and the bundle is written to `dist/`.

- [ ] **Step 7: Run the whole suite**

Run: `./node_modules/.bin/vitest run`
Expected: PASS — 49 tests.

- [ ] **Step 8: Commit**

```bash
git add src/extension/content.ts
git commit -m "feat: show the picker at the right-clicked image when evidence is weak"
```

---

### Task 8: The stats line, and flagging a wrong match

**Files:**
- Modify: `popup.html` (masthead `<span class="count">` semantics; no markup change needed)
- Modify: `src/extension/popup.ts`

**Interfaces:**
- Consumes: `createRecognitionLog`, `summarize` (Tasks 4-5); `BackgroundRequest` (Task 6).
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Read the log and send deletions to the background**

In `src/extension/popup.ts`, change the imports (line 1) to:

```ts
import { createLibrary, type StorageArea, type SavedBook, type Intent } from './storage';
import { createRecognitionLog, summarize, type RecognitionEvent } from './recognitionLog';
import type { BackgroundRequest } from './messages';
```

Add below the `library` declaration (after line 11):

```ts
/**
 * Reads only. Every write goes through the background worker so the log has exactly one
 * writer - see background.ts. Constructing the full object here just avoids a second way
 * to spell the storage key.
 */
const log = createRecognitionLog({ storage, now: () => Date.now() });
```

- [ ] **Step 2: Flag the match when a book is removed**

In `renderBook`'s remove handler, replace the line `await library.remove(saved.id);` with:

```ts
      await library.remove(saved.id);
      // Deleting a wrong match is both the fix and the measurement. The background
      // decides whether this was soon enough after saving to count against the
      // recognizer, rather than you simply changing your mind.
      void chrome.runtime
        .sendMessage({ type: 'markWrong', savedId: saved.id } satisfies BackgroundRequest)
        .catch((err: unknown) => console.error('[BookCatcher] could not flag the match', err));
```

- [ ] **Step 3: Render the stats line**

In `src/extension/popup.ts`, add above `render`:

```ts
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
    console.error('[BookCatcher] could not read the log', err);
  }

  const { caught, keptPct } = summarize(events);

  // A shelf that predates the log would otherwise read "0 caught" next to real books.
  if (!caught) {
    el.textContent = shelfCount ? `${shelfCount}` : '';
    return;
  }
  el.textContent = keptPct === null ? `${caught} caught` : `${caught} caught · ${keptPct}% kept`;
}
```

Then in `render`, replace:

```ts
  if (countEl) countEl.textContent = all.length ? `${all.length}` : '';
```

with:

```ts
  void renderStats(all.length);
```

and delete the now-unused `const countEl = document.getElementById('count');` on the line above `if (!app) return;`.

- [ ] **Step 4: Build and check the popup by hand**

Run: `node build.mjs`
Expected: clean.

Then reload the extension at `chrome://extensions` and open the popup. Expected: with an empty log and books on the shelf, the masthead shows the plain count exactly as before — the upgrade path, not a regression.

- [ ] **Step 5: Commit**

```bash
git add src/extension/popup.ts
git commit -m "feat: show caught and kept rate in the shelf masthead"
```

---

### Task 9: Clear the log from options, and update the docs

**Files:**
- Modify: `options.html` (add an `h2` style and a log section)
- Modify: `src/extension/options.ts`
- Modify: `README.md`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: `createRecognitionLog` (Task 4), `BackgroundRequest` (Task 6).
- Produces: nothing.

- [ ] **Step 1: Add the markup**

In `options.html`, add this rule to the `<style>` block, immediately after the `.lede` rule:

```css
      h2 {
        margin: 34px 0 8px;
        font: 500 10.5px/1 ui-monospace, "SF Mono", Menlo, monospace;
        letter-spacing: 0.13em;
        text-transform: uppercase;
        opacity: 0.5;
      }
```

Then add this immediately after the closing `</form>` tag:

```html
      <h2>Recognition log</h2>
      <p class="hint">
        Book Catcher keeps the last 200 recognition attempts on this computer, so the
        shelf can tell you how often it got the book right. It is never sent anywhere.
      </p>
      <div class="actions">
        <button class="ghost" type="button" id="clearLog">Clear the log</button>
        <span id="logStatus" role="status"></span>
      </div>
```

- [ ] **Step 2: Wire the button**

In `src/extension/options.ts`, change the imports (line 1) to:

```ts
import { readSettings, writeSettings, DEFAULT_SETTINGS } from './settings';
import { createRecognitionLog } from './recognitionLog';
import type { StorageArea } from './storage';
import type { BackgroundRequest } from './messages';
```

Add below the `$` helper:

```ts
const storage: StorageArea = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
};
/** Reads only - the background worker is the log's single writer. */
const log = createRecognitionLog({ storage, now: () => Date.now() });
```

Then inside `main`, after the `reset.addEventListener` block, add:

```ts
  const clearLog = $<HTMLButtonElement>('clearLog');
  const logStatus = $<HTMLElement>('logStatus');
  if (!clearLog || !logStatus) return;

  const showCount = async (): Promise<void> => {
    try {
      const events = await log.list();
      logStatus.textContent = events.length ? `${events.length} recorded` : 'Nothing recorded yet';
    } catch (err) {
      console.error('[BookCatcher] could not read the log', err);
    }
  };
  void showCount();

  clearLog.addEventListener('click', async () => {
    clearLog.disabled = true;
    try {
      await chrome.runtime.sendMessage({ type: 'clearLog' } satisfies BackgroundRequest);
      logStatus.textContent = 'Cleared';
    } catch (err) {
      console.error('[BookCatcher] could not clear the log', err);
      logStatus.textContent = "Couldn't clear it";
    } finally {
      clearLog.disabled = false;
    }
  });
```

Note: `logStatus` uses the `.hint` styling only if you give it that class; it is inside `.actions`, so leave it unstyled — it inherits the body font and reads as a quiet counter next to the button.

- [ ] **Step 3: Update the README**

`README.md` still describes Tesseract as the live recognizer in three places. Fix them:

- In **Two ways to catch a book**, replace the first paragraph with:

```markdown
**Right-click a cover image → "Save book to shelf."** The cover and the post's words go
to a vision model together, the guess is grounded against OpenLibrary, and a strong
match is saved outright. A weaker one opens the picker at the image so you decide.
```

- In **Scripts**, change the `node build.mjs` row's description from `Typechecks, bundles, and stages the Tesseract assets into dist/` to `Typechecks and bundles into dist/`.
- Delete the paragraph beginning `It downloads the English OCR model (~11 MB)`.
- In **Third-party**, delete the `OCR by tesseract.js` sentence, leaving the OpenLibrary attribution.
- In **Privacy**, add after the existing paragraph:

```markdown
Book Catcher also keeps the last 200 recognition attempts on your computer — what it
guessed, how confident it was, and whether you kept the book — so the shelf can show how
often it gets it right. That log is never transmitted, and you can clear it from the
options page.
```

- [ ] **Step 4: Update DESIGN.md**

Append a section at the end of `DESIGN.md`:

```markdown
## Confidence-tiered save + recognition log (2026-07-28)

Spec: `docs/superpowers/specs/2026-07-28-prove-recognition-design.md`.
Plan: `docs/superpowers/plans/2026-07-28-prove-recognition.md`.

The match score `groundText` already computed was being discarded, so every vision
result was treated identically no matter how well the books DB backed it. It is now
carried out as `GroundedBook { book, score }`, and confidence follows it: two or more
shared words is `high` and auto-saves from the right-click menu; one word, or text-only
evidence, opens the picker instead.

Text alone never reaches `high` however well it scores. A post listing ten books can
ground the wrong line to a real book, and that failure is invisible — you never learn to
distrust a shelf entry you had no reason to doubt.

Every attempt appends one event to a 200-entry ring buffer in `chrome.storage.local`.
The background worker is its **only writer**; the content script, popup, and options page
send it finished events. That is stricter than the spec asked for, and it buys two
things: no cross-context race, and a right-click attempt still gets recorded on a tab
whose content script never loaded. Nothing pending is held in worker memory, because a
service worker is terminated after ~30s idle and every open picker would lose its event.

`wrong` is inferred rather than asked for: deleting a book within ten minutes of saving
it marks its event wrong. Later deletions are changing your mind. That is what keeps
dogfooding from turning into grading homework.
```

- [ ] **Step 5: Build, test, typecheck**

Run: `node build.mjs`
Expected: clean.

Run: `./node_modules/.bin/vitest run`
Expected: PASS — 49 tests.

- [ ] **Step 6: Commit**

```bash
git add options.html src/extension/options.ts README.md DESIGN.md
git commit -m "feat: clear the recognition log from options; refresh the docs"
```

---

## Hand verification (after Task 9)

Not unit-tested, consistent with the existing decision not to build a fake-chrome harness. Do these in order at `chrome://extensions` → reload → open x.com. Watch all three consoles — content script (page), service worker (`chrome://extensions` → Book Catcher → "service worker"), and popup.

1. **A clear cover, right-clicked.** Expect: "Reading the cover…", then either a save toast or the picker at the image. **If this fails, stop and fix it** — everything below is meaningless until it passes.
2. **The same image after scrolling it off screen mid-recognition.** Expect: the panel in the bottom-right corner, not a dropped result.
3. **The 📚 button on a tweet that names a book.** Expect: the picker, as before.
4. **Dismiss a picker by clicking away.** Expect: one `dismissed` event.
5. **Open the popup.** Expect: `n caught` once there are catches, `n caught · x% kept` from the fifth.
6. **Delete a book you just caught.** Expect: the kept rate drops.
7. **Options → Clear the log.** Expect: "Cleared", and the popup masthead falls back to the plain shelf count.

Inspect the log directly at any point with, in the service worker console:

```js
chrome.storage.local.get('recognitionLog').then((r) => console.table(r.recognitionLog));
```

Then follow the spec's dogfood protocol: use it on the real feed for a week, delete wrong matches as they appear, and read the stats line at ~30 catches against the bars in the spec.
