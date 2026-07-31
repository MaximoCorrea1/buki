# Extension polish — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `ultra-powers:subagent-driven-development`
> (recommended) or `ultra-powers:executing-plans` to implement this task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rapid catching feel deliberate — every book gets its own toast that grows in
place when it resolves, a lookup can be called off, the same post is never looked up twice,
a book already on the shelf says so, and the whole extension wears the landing page's room.

**Architecture:** Three of the six items are already-solved problems in the wrong place.
Toast completion becomes an in-place replacement rather than remove-and-append, which is
what removes the reflow jump. Cancellation goes in as a per-job `fetch` wrapper so neither
`BooksDb` nor `VisionClient` changes shape. De-duplication of lookups is a small memo with
in-flight sharing, kept pure and tested. Only the design task touches many files, so it
goes last.

**Tech Stack:** TypeScript, vitest 3 (node environment — no DOM), esbuild, MV3.

## Global Constraints

- **Never rename a `chrome.storage.local` key.** `savedBooks`, `recognitionLog`,
  `visionSettings` are frozen forever.
- **The background worker is the only writer** of `savedBooks` and `recognitionLog`.
- **A log failure must never block or fail a shelf save.** Same for a cover fetch.
- **The vision client must stay lazily constructed** — an API key must not become mandatory
  for the free retailer-link and post-text paths.
- **Only a resolved ISBN link, or a vision guess whose top match shares ≥2 significant
  words, may auto-save.** Text-only evidence never reaches `high`.
- **The affiliate disclosure must remain in the popup footer, the options page and the
  privacy policy.** Store policy permits affiliate links only when disclosed.
- Build/test from Git Bash: `node build.mjs`, `./node_modules/.bin/vitest run`,
  `node node_modules/typescript/bin/tsc --noEmit`. `npm run` and `npx` fail there.
- Tests run in the **node** environment. There is no `document`. Keep DOM out of the
  modules under test; `content.ts` renders, the modules decide.

---

## File structure

| File | Responsibility | Task |
| --- | --- | --- |
| `src/extension/toastStack.ts` | Which pills exist and what they say. **Modified:** `done()` replaces in place; cap becomes optional. | 1 |
| `src/extension/toastStack.test.ts` | **Modified:** new cases for in-place completion and no cap. | 1 |
| `src/extension/content.ts` | Renders toasts and panels; owns the buttons. **Modified** in every task. | 1–5 |
| `src/extension/lookupMemo.ts` | **New.** One lookup per post: shares an in-flight promise, remembers the answer briefly. | 2 |
| `src/extension/lookupMemo.test.ts` | **New.** | 2 |
| `src/extension/cancellable.ts` | **New.** Wraps a `FetchLike` so every request it makes also obeys a job's signal. | 3 |
| `src/extension/cancellable.test.ts` | **New.** | 3 |
| `src/extension/background.ts` | **Modified:** per-job `AbortController`, `cancelRecognize` handler, per-job clients. | 3, 4 |
| `src/extension/messages.ts` | **Modified:** `cancelRecognize` request; `alreadySaved` on the recognize response. | 3, 4 |
| `src/extension/storage.ts` | **Modified:** export `identityOf` so other modules can ask "is this already mine?". | 4 |
| `popup.html`, `options.html` | **Modified:** the room palette. | 5 |

---

## Task 1: Toasts grow in place, and stack as far as you catch

Fixes reported items **#6** (the found toast overlapping the in-progress ones) and **#3**
(hard cap of three).

**Root cause of #6:** `done()` deletes the job's pill and pushes a new one at the end. The
renderer therefore removes a node from the middle (deferred 220 ms so it can fade) *and*
appends a taller node at the bottom. For those 220 ms the column holds an extra box, then
snaps shorter when it is finally removed — flex reflow is instant and cannot be
transitioned, so it reads as a jump and an overlap. Replacing the pill **in place** means
no node is added or removed at all: the same box changes its text and grows.

**Files:**
- Modify: `src/extension/toastStack.ts`
- Modify: `src/extension/toastStack.test.ts`
- Modify: `src/extension/content.ts` (the `toast()` helper and the `.buki-stack` CSS)

**Interfaces:**
- Produces: `done(job: string | null, text: string): Pill` — now **returns** the resulting
  pill, because it is no longer guaranteed to be last and the caller needs its id for the
  dismissal timer.
- Produces: `createToastStack(max?: number)` — `max` now defaults to `Infinity`.

- [ ] **Step 1: Write the failing tests**

Add to `src/extension/toastStack.test.ts`, inside `describe('toastStack')`:

```ts
  it('turns a book\'s own progress pill into its result, in place', () => {
    // Not remove-and-append: the renderer would drop a node from the middle and add a
    // taller one at the end, and the 220ms fade plus instant flex reflow reads as the
    // result overlapping the pills still working.
    const stack = createToastStack();
    stack.stage('a', 'Looking up A…');
    stack.stage('b', 'Looking up B…');
    stack.stage('c', 'Looking up C…');

    stack.done('a', 'Found 2 — Dune');

    expect(texts(stack)).toEqual(['Found 2 — Dune', 'Looking up B…', 'Looking up C…']);
  });

  it('keeps the same pill id when a book resolves, so nothing is redrawn', () => {
    const stack = createToastStack();
    stack.stage('a', 'Looking up A…');
    const before = stack.list()[0]!.id;

    const after = stack.done('a', 'Found 2');

    expect(after.id).toBe(before);
  });

  it('hands back the pill it settled so the caller can time its dismissal', () => {
    const stack = createToastStack();

    const pill = stack.done(null, 'Saved: Dune');

    expect(pill.text).toBe('Saved: Dune');
    expect(stack.list().map((p) => p.id)).toContain(pill.id);
  });

  it('stacks as many books as were caught when no cap is set', () => {
    const stack = createToastStack();

    for (let i = 0; i < 9; i++) stack.stage(`job${i}`, `Looking up ${i}…`);

    expect(stack.list()).toHaveLength(9);
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `./node_modules/.bin/vitest run src/extension/toastStack.test.ts`

Expected: 4 failures. The in-place test fails with the result at the END of the array
(`['Looking up B…', 'Looking up C…', 'Found 2 — Dune']`), the id test fails because a new
id was minted, the return test fails on `pill.text` being undefined, and the nine-pill test
reports a length of 3.

- [ ] **Step 3: Make `done` replace in place and drop the default cap**

In `src/extension/toastStack.ts`, change the `ToastStack` interface entry for `done` and
the `createToastStack` signature, then replace the `done` implementation:

```ts
export interface ToastStack {
  list(): Pill[];
  stage(job: string, text: string): void;
  /** `job` is over. Its progress pill becomes this message, keeping its place. */
  done(job: string | null, text: string): Pill;
  dismiss(id: number): void;
}

/** No cap by default: three books caught means three confirmations, and so on. */
export function createToastStack(max: number = Infinity): ToastStack {
```

```ts
    done(job, text) {
      const mine = job === null ? -1 : pills.findIndex((p) => p.job === job);
      if (mine !== -1) {
        // In place, keeping the id. The renderer sees only a text change, so the pill
        // grows where it already is instead of a node leaving the middle of the column
        // while a taller one appears at the end.
        const settled: Pill = { id: (pills[mine] as Pill).id, job: null, text };
        pills[mine] = settled;
        return settled;
      }
      const settled: Pill = { id: ++seq, job: null, text };
      pills.push(settled);
      trim();
      return settled;
    },
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `./node_modules/.bin/vitest run src/extension/toastStack.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Prove the tests discriminate**

Temporarily restore the old behaviour — replace the `mine !== -1` branch body with
`pills = pills.filter((p) => p.job !== job);` and fall through to the push. Re-run.
Expected: the in-place and id tests FAIL. Restore the correct code and re-run to green.

- [ ] **Step 6: Use the returned pill for the dismissal timer**

In `src/extension/content.ts`, replace the body of `toast()`:

```ts
function toast(msg: string, job: string | null = null): void {
  const settled = toasts.done(job, msg);
  paintToasts();
  setTimeout(() => {
    toasts.dismiss(settled.id);
    paintToasts();
  }, LINGER_MS);
}
```

`toasts.list().at(-1)` was correct only while completion appended. It would now dismiss an
unrelated pill.

- [ ] **Step 7: Let the column grow up the screen and clip at the top**

In `src/extension/content.ts`, replace the `.buki-stack` rule inside `STYLE`:

```css
.buki-stack {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  display: flex; flex-direction: column; align-items: flex-end;
  justify-content: flex-end; gap: 8px;
  /* Unlimited by count, bounded by the screen. Growing upward with the overflow hidden
     means the oldest scrolls off the top and the newest is always the one you can see. */
  max-height: calc(100vh - 40px); overflow: hidden;
  pointer-events: none;
}
```

- [ ] **Step 8: Full suite, typecheck, build**

```bash
./node_modules/.bin/vitest run
node node_modules/typescript/bin/tsc --noEmit
node build.mjs
```
Expected: all tests pass, tsc silent, build writes four bundles.

- [ ] **Step 9: Commit**

```bash
git add src/extension/toastStack.ts src/extension/toastStack.test.ts src/extension/content.ts
git commit -m "fix: a book's toast grows in place, and the stack is no longer capped at three"
```

---

## Task 2: Never look up the same post twice

Fixes reported item **#4**.

Two distinct cases, one mechanism. Clicking 📚 twice **while the first is running** should
join the first lookup rather than start a second. Clicking again **after** it finished
should reuse the answer instead of paying the model again. The right-click menu has no
`disabled` guard at all, so it is the worse offender.

**Files:**
- Create: `src/extension/lookupMemo.ts`
- Create: `src/extension/lookupMemo.test.ts`
- Modify: `src/extension/content.ts`

**Interfaces:**
- Produces: `createLookupMemo<T>(deps: { now: () => number; ttlMs?: number })` returning
  `{ run(key: string, work: () => Promise<T>): Promise<T>; forget(key: string): void }`.
- Produces: `postKey(tweet: { text: string; imageUrls: string[] }): string`.

- [ ] **Step 1: Write the failing tests**

Create `src/extension/lookupMemo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createLookupMemo, postKey } from './lookupMemo';

describe('createLookupMemo', () => {
  it('joins a lookup already running instead of starting a second', async () => {
    let started = 0;
    let release: (v: string) => void = () => undefined;
    const memo = createLookupMemo<string>({ now: () => 0 });
    const work = () => {
      started++;
      return new Promise<string>((resolve) => (release = resolve));
    };

    const first = memo.run('post-1', work);
    const second = memo.run('post-1', work);
    release('Dune');

    expect(await first).toBe('Dune');
    expect(await second).toBe('Dune');
    expect(started).toBe(1);
  });

  it('reuses the answer for a little while after it lands', async () => {
    let started = 0;
    const memo = createLookupMemo<string>({ now: () => 0 });
    const work = async () => {
      started++;
      return 'Dune';
    };

    await memo.run('post-1', work);
    await memo.run('post-1', work);

    expect(started).toBe(1);
  });

  it('looks again once the answer is stale', async () => {
    let started = 0;
    let clock = 0;
    const memo = createLookupMemo<string>({ now: () => clock, ttlMs: 1000 });
    const work = async () => {
      started++;
      return 'Dune';
    };

    await memo.run('post-1', work);
    clock = 1001;
    await memo.run('post-1', work);

    expect(started).toBe(2);
  });

  it('keeps different posts apart', async () => {
    let started = 0;
    const memo = createLookupMemo<string>({ now: () => 0 });
    const work = async () => {
      started++;
      return 'x';
    };

    await memo.run('post-1', work);
    await memo.run('post-2', work);

    expect(started).toBe(2);
  });

  it('does not remember a failure', async () => {
    // A lookup that failed because the network blipped must be retryable immediately.
    let started = 0;
    const memo = createLookupMemo<string>({ now: () => 0 });
    const work = async (): Promise<string> => {
      started++;
      throw new Error('offline');
    };

    await expect(memo.run('post-1', work)).rejects.toThrow('offline');
    await expect(memo.run('post-1', work)).rejects.toThrow('offline');

    expect(started).toBe(2);
  });

  it('forgets a post on request, so a cancelled lookup can be retried', async () => {
    let started = 0;
    const memo = createLookupMemo<string>({ now: () => 0 });
    const work = async () => {
      started++;
      return 'Dune';
    };

    await memo.run('post-1', work);
    memo.forget('post-1');
    await memo.run('post-1', work);

    expect(started).toBe(2);
  });
});

describe('postKey', () => {
  it('treats the same post as the same post', () => {
    const a = postKey({ text: 'read this', imageUrls: ['https://pbs.twimg.com/media/x.jpg'] });
    const b = postKey({ text: 'read this', imageUrls: ['https://pbs.twimg.com/media/x.jpg'] });

    expect(a).toBe(b);
  });

  it('tells two different posts apart', () => {
    const a = postKey({ text: 'read this', imageUrls: ['https://pbs.twimg.com/media/x.jpg'] });
    const b = postKey({ text: 'read this', imageUrls: ['https://pbs.twimg.com/media/y.jpg'] });

    expect(a).not.toBe(b);
  });

  it('ignores the size variant Twitter happens to serve', () => {
    // The same media comes back under several ?format=&name= query strings, and the
    // right-click menu reports a different one than the DOM holds.
    const a = postKey({ text: 't', imageUrls: ['https://pbs.twimg.com/media/x.jpg?name=small'] });
    const b = postKey({ text: 't', imageUrls: ['https://pbs.twimg.com/media/x.jpg?name=large'] });

    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `./node_modules/.bin/vitest run src/extension/lookupMemo.test.ts`
Expected: the file fails to load — `Failed to load url ./lookupMemo`. Create the module as
a stub first (Step 3) so the failures become assertions rather than a missing import.

- [ ] **Step 3: Create a stub and re-run to see real assertion failures**

Create `src/extension/lookupMemo.ts`:

```ts
export function createLookupMemo<T>(_deps: { now: () => number; ttlMs?: number }) {
  return {
    run: (_key: string, work: () => Promise<T>): Promise<T> => work(),
    forget: (_key: string): void => undefined,
  };
}

export function postKey(_post: { text: string; imageUrls: string[] }): string {
  return '';
}
```

Run: `./node_modules/.bin/vitest run src/extension/lookupMemo.test.ts`
Expected: assertion failures — `expected 2 to be 1` for the sharing cases, and
`expected '' not to be ''` for `postKey` telling posts apart.

- [ ] **Step 4: Implement**

Replace `src/extension/lookupMemo.ts`:

```ts
/**
 * One lookup per post.
 *
 * Pressing 📚 twice on the same post used to run recognition twice - two vision calls,
 * two sets of OpenLibrary queries, two pickers - and the right-click menu had no guard at
 * all. A second press while the first is running now joins it, and a press shortly after
 * it finished reuses the answer.
 *
 * A failure is never remembered: a lookup that died because the network blipped has to be
 * retryable straight away.
 */
interface Entry<T> {
  at: number;
  value: Promise<T>;
  settled: boolean;
}

/** Long enough to cover a double-press and a change of mind, short enough to re-ask. */
export const DEFAULT_TTL_MS = 120_000;

export function createLookupMemo<T>(deps: { now: () => number; ttlMs?: number }) {
  const ttl = deps.ttlMs ?? DEFAULT_TTL_MS;
  const entries = new Map<string, Entry<T>>();

  return {
    run(key: string, work: () => Promise<T>): Promise<T> {
      const held = entries.get(key);
      // An unsettled entry is a lookup still in flight - join it regardless of age.
      if (held && (!held.settled || deps.now() - held.at < ttl)) return held.value;

      const entry: Entry<T> = { at: deps.now(), value: work(), settled: false };
      entries.set(key, entry);
      entry.value.then(
        () => {
          entry.settled = true;
          entry.at = deps.now();
        },
        () => {
          entries.delete(key);
        },
      );
      return entry.value;
    },

    forget(key: string): void {
      entries.delete(key);
    },
  };
}

/**
 * What makes two presses "the same post". The image identity is the URL *path*: Twitter
 * serves the same media under several `?format=&name=` query strings, and the right-click
 * menu reports a different variant than the one sitting in the DOM.
 */
export function postKey(post: { text: string; imageUrls: string[] }): string {
  const media = post.imageUrls
    .map((url) => {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    })
    .sort()
    .join(',');
  return `${post.text.trim()}|${media}`;
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `./node_modules/.bin/vitest run src/extension/lookupMemo.test.ts`
Expected: PASS, 9 cases.

- [ ] **Step 6: Wire it into the button flow**

In `src/extension/content.ts`, add to the imports:

```ts
import { createLookupMemo, postKey } from './lookupMemo';
```

Add beside the other module state (near `let jobSeq = 0;`):

```ts
/** One recognition per post, however many times the button is pressed. */
const lookups = createLookupMemo<{ candidates: Book[]; draft: AttemptDraft } | null>({
  now: () => Date.now(),
});
```

In the 📚 click handler, replace the recognition call:

```ts
      progress(job, 'Looking up the book…');
      const key = postKey(tweet);
      const recognized = await lookups.run(key, () => recognize(tweet, job));
```

- [ ] **Step 7: Full suite, typecheck, build**

```bash
./node_modules/.bin/vitest run
node node_modules/typescript/bin/tsc --noEmit
node build.mjs
```

- [ ] **Step 8: Commit**

```bash
git add src/extension/lookupMemo.ts src/extension/lookupMemo.test.ts src/extension/content.ts
git commit -m "perf: one lookup per post, however many times it is clicked"
```

---

## Task 3: Call off a lookup

Fixes reported item **#2**.

The fetches happen in the background worker, so a cancel is a message, not a local abort.
Both `createOpenLibraryClient` and `createLlmVision` already bake `AbortSignal.timeout`
into their own requests and take an injected `fetch`. Rather than thread a signal through
`BooksDb` and `VisionClient` — two interfaces, four call sites, and a lot of churn — the
worker wraps the `fetch` it hands them so every request they make also obeys the job's
signal. Neither interface changes.

**Files:**
- Create: `src/extension/cancellable.ts`
- Create: `src/extension/cancellable.test.ts`
- Modify: `src/extension/messages.ts`
- Modify: `src/extension/background.ts`
- Modify: `src/extension/content.ts`

**Interfaces:**
- Produces: `withSignal(base: FetchLike, signal: AbortSignal): FetchLike`.
- Produces: `BackgroundRequest` gains `{ type: 'cancelRecognize'; job: string }`.

- [ ] **Step 1: Write the failing tests**

Create `src/extension/cancellable.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { withSignal } from './cancellable';

describe('withSignal', () => {
  it('passes the job signal to a client that sends none of its own', async () => {
    const control = new AbortController();
    let seen: AbortSignal | undefined;
    const base = async (_url: string, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return new Response('ok');
    };

    await withSignal(base, control.signal)('https://example.test');

    expect(seen).toBeDefined();
    expect(seen?.aborted).toBe(false);
  });

  it('aborts the request when the job is cancelled', async () => {
    const control = new AbortController();
    let seen: AbortSignal | undefined;
    const base = async (_url: string, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return new Response('ok');
    };

    await withSignal(base, control.signal)('https://example.test');
    control.abort();

    expect(seen?.aborted).toBe(true);
  });

  it('keeps the client\'s own timeout as well as the job signal', async () => {
    // openLibrary and llmVision both set AbortSignal.timeout themselves. Replacing it
    // would remove the only guard against a request that hangs forever.
    const control = new AbortController();
    const ownTimeout = AbortController.prototype ? new AbortController() : null;
    let seen: AbortSignal | undefined;
    const base = async (_url: string, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return new Response('ok');
    };

    await withSignal(base, control.signal)('https://example.test', {
      signal: ownTimeout!.signal,
    });
    ownTimeout!.abort();

    expect(seen?.aborted).toBe(true);
  });

  it('leaves the rest of the request untouched', async () => {
    const control = new AbortController();
    let seenInit: RequestInit | undefined;
    const base = async (_url: string, init?: RequestInit) => {
      seenInit = init;
      return new Response('ok');
    };

    await withSignal(base, control.signal)('https://example.test', {
      method: 'POST',
      body: '{"a":1}',
    });

    expect(seenInit?.method).toBe('POST');
    expect(seenInit?.body).toBe('{"a":1}');
  });
});
```

- [ ] **Step 2: Create a stub, then run to see assertion failures**

Create `src/extension/cancellable.ts`:

```ts
import type { FetchLike } from '../recognizer/types';

export function withSignal(base: FetchLike, _signal: AbortSignal): FetchLike {
  return base;
}
```

Run: `./node_modules/.bin/vitest run src/extension/cancellable.test.ts`
Expected: the first three fail (`expected undefined to be defined`, then
`expected undefined to be true` twice). The fourth passes against the stub — it is a guard,
not a discriminator.

- [ ] **Step 3: Implement**

Replace `src/extension/cancellable.ts`:

```ts
import type { FetchLike } from '../recognizer/types';

/**
 * Make every request a client sends also obey a job's signal.
 *
 * `createOpenLibraryClient` and `createLlmVision` each set their own
 * `AbortSignal.timeout`, which is the only thing stopping a hung request from pinning a
 * catch open forever - so the job's signal is combined with theirs rather than replacing
 * it. Wrapping `fetch` this way is why cancellation needed no change to `BooksDb` or
 * `VisionClient`.
 */
export function withSignal(base: FetchLike, signal: AbortSignal): FetchLike {
  return (url, init) => {
    const own = init?.signal;
    return base(url, {
      ...init,
      signal: own ? AbortSignal.any([own, signal]) : signal,
    });
  };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `./node_modules/.bin/vitest run src/extension/cancellable.test.ts`
Expected: PASS, 4 cases.

- [ ] **Step 5: Add the cancel message**

In `src/extension/messages.ts`, add to `BackgroundRequest`:

```ts
  /**
   * Call off a recognition the user no longer wants. The fetches live in the worker, so
   * this is a message rather than a local abort. Unknown or already-finished jobs are
   * ignored - a cancel arriving late is normal, not an error.
   */
  | { type: 'cancelRecognize'; job: string }
```

And add `job` to the recognize request so the worker can address the controller:

```ts
  | { type: 'recognize'; tweet: Tweet; job: string }
```

- [ ] **Step 6: Give the worker a controller per job**

In `src/extension/background.ts`, add the import and the registry near the top of the
module scope:

```ts
import { withSignal } from './cancellable';

/**
 * One controller per in-flight recognition. Entries are removed in a `finally`, which is
 * also what stops a finished job's still-running sibling requests - the "cancel when it
 * finds it" half of the same mechanism.
 */
const running = new Map<string, AbortController>();
```

Change `recognize` to take a job and build its clients against the wrapped fetch:

```ts
async function recognize(
  tweet: Tweet,
  job: string,
): Promise<{ result: RecognitionResult; model: string }> {
  const settings = await readSettings();
  const control = new AbortController();
  running.set(job, control);
  const net = withSignal((url, init) => fetch(url, init), control.signal);
  let keyWasMissing = false;
  const vision: VisionClient = {
    async guessBook(input) {
      try {
        return await visionFor(settings, net).guessBook(input);
      } catch (err) {
        if (!(err instanceof NoKeyError)) throw err;
        keyWasMissing = true;
        return null;
      }
    },
  };
  try {
    const full: Tweet = { ...tweet, imageUrls: tweet.imageUrls.map(bestQuality) };
    const result = await recognizeBook(full, {
      vision,
      books: createOpenLibraryClient({ fetch: net }),
    });
    if (keyWasMissing && !result.candidates.length) throw new NoKeyError('no key');
    return { result, model: settings.model };
  } finally {
    // Whether it resolved, failed or was cancelled, nothing else for this job should
    // still be talking to the network.
    control.abort();
    running.delete(job);
  }
}
```

`visionFor(settings)` must now accept the wrapped fetch. Change its signature to
`visionFor(settings: Settings, net: FetchLike)` and pass `net` where it currently passes
the global `fetch`. Keep it lazily constructed — building it eagerly makes a key mandatory
for the free paths.

- [ ] **Step 7: Handle the cancel message**

In `src/extension/background.ts`, inside `chrome.runtime.onMessage.addListener`, before the
`recognize` branch:

```ts
  if (msg?.type === 'cancelRecognize') {
    // A cancel for a job that already finished is normal, not an error.
    running.get(msg.job)?.abort();
    running.delete(msg.job);
    sendResponse({ ok: true });
    return false;
  }
```

Update the `recognize` branch to pass `msg.job` through to `recognize(...)`, and the
context-menu handler to pass its own `job`.

- [ ] **Step 8: Put a cancel control on the in-progress pill**

In `src/extension/content.ts`, add to `STYLE`:

```css
.buki-pill { pointer-events: auto; display: flex; align-items: center; gap: 10px; }
.buki-x {
  flex: none; cursor: pointer; border: 0; border-radius: 6px; padding: 2px 6px;
  background: transparent; color: inherit; opacity: .5; font: 15px/1 system-ui, sans-serif;
  transition: opacity 140ms ease, background-color 140ms ease;
}
.buki-x:hover { opacity: 1; background: rgba(255,255,255,.09); }
.buki-x:focus-visible { outline: 2px solid #ffcf8a; outline-offset: 1px; opacity: 1; }
```

Give `Pill` an optional `onCancel` at the render layer only — the stack stays pure. In
`paintToasts`, when creating a node for a pill whose `job` is not null, append a button:

```ts
    const el = document.createElement('div');
    el.className = 'buki-pill';
    el.setAttribute('role', 'status');
    const label = document.createElement('span');
    label.textContent = pill.text;
    el.appendChild(label);
    if (pill.job) {
      const stop = document.createElement('button');
      stop.className = 'buki-x';
      stop.textContent = '×';
      stop.title = 'Stop looking';
      stop.setAttribute('aria-label', 'Stop looking for this book');
      stop.addEventListener('click', () => cancelJob(pill.job as string));
      el.appendChild(stop);
    }
```

`paintToasts` currently writes `existing.textContent`; change the text comparison and the
swap to operate on `el.querySelector('span')` so the button is not wiped out by a text
update.

Add the cancel itself:

```ts
/** Stop a lookup the user no longer wants, and let the same post be tried again. */
function cancelJob(job: string): void {
  void chrome.runtime
    .sendMessage({ type: 'cancelRecognize', job } satisfies BackgroundRequest)
    .catch(() => undefined); // an orphaned page cannot cancel; the toast still clears
  lookups.forget(jobPosts.get(job) ?? '');
  jobPosts.delete(job);
  toast('Stopped looking.', job);
}
```

Track which post a job belongs to so `forget` can undo the memo — otherwise a cancelled
lookup would be "remembered" as in flight and never retried. Beside `lookups`:

```ts
/** job -> postKey, so cancelling a lookup also forgets it. */
const jobPosts = new Map<string, string>();
```

Set it in the click handler right after computing `key`:

```ts
      const key = postKey(tweet);
      jobPosts.set(job, key);
```

- [ ] **Step 9: Full suite, typecheck, build**

```bash
./node_modules/.bin/vitest run
node node_modules/typescript/bin/tsc --noEmit
node build.mjs
```

- [ ] **Step 10: Commit**

```bash
git add src/extension/cancellable.ts src/extension/cancellable.test.ts \
        src/extension/messages.ts src/extension/background.ts src/extension/content.ts
git commit -m "feat: a lookup can be called off, and a finished one stops its siblings"
```

---

## Task 4: Say when a book is already on the shelf

Fixes reported item **#1**.

**The data is already safe.** `createLibrary.add` (`src/extension/storage.ts:60`) resolves
identity by ISBN, else normalized title+author, and updates the existing entry in place —
duplicates have never been possible. What is missing is that nothing *says so*: the picker
offers a book you already have as though it were new, and the confirmation reads "Saved"
when it was really "moved".

**Files:**
- Modify: `src/extension/storage.ts` (export `identityOf`)
- Modify: `src/extension/messages.ts`
- Modify: `src/extension/background.ts`
- Modify: `src/extension/content.ts`

**Interfaces:**
- Produces: `identityOf(book: Book): string` — exported.
- Produces: `BackgroundResponse` success shape gains `alreadySaved: string[]` — the
  identities, of the returned candidates, that are already on the shelf.
- Produces: `ShelfResponse` success shape gains `moved?: boolean`.

- [ ] **Step 1: Write the failing tests**

Add to `src/extension/storage.test.ts`:

```ts
import { createLibrary, matchesFilter, identityOf } from './storage';

describe('identityOf', () => {
  it('treats the same ISBN as the same book whatever it is called', () => {
    const a = identityOf({ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' });
    const b = identityOf({ title: 'DUNE (1965)', author: 'F. Herbert', isbn: '9780441013593' });

    expect(a).toBe(b);
  });

  it('falls back to title and author when there is no ISBN', () => {
    const a = identityOf({ title: 'Dune', author: 'Frank Herbert' });
    const b = identityOf({ title: '  dune ', author: 'FRANK HERBERT' });

    expect(a).toBe(b);
  });

  it('keeps two different books apart', () => {
    const a = identityOf({ title: 'Dune', author: 'Frank Herbert' });
    const b = identityOf({ title: 'Ubik', author: 'Philip K. Dick' });

    expect(a).not.toBe(b);
  });
});
```

Add to the existing `describe('createLibrary')`:

```ts
  it('reports that a re-saved book was moved rather than added', async () => {
    const lib = createLibrary(fresh());
    const book = { title: 'Dune', author: 'Frank Herbert' };
    await lib.add(book, 'someday');

    const again = await lib.add(book, 'now');

    expect(again.moved).toBe(true);
    expect((await lib.list())).toHaveLength(1);
  });

  it('does not claim a brand new book was moved', async () => {
    const lib = createLibrary(fresh());

    const saved = await lib.add({ title: 'Ubik', author: 'Philip K. Dick' }, 'now');

    expect(saved.moved).toBe(false);
  });
```

> `fresh()` is the existing helper in that file that builds a library over an in-memory
> `StorageArea`. Reuse it; do not add another.

- [ ] **Step 2: Run and watch them fail**

Run: `./node_modules/.bin/vitest run src/extension/storage.test.ts`
Expected: `identityOf is not a function` for the first three, and
`expected undefined to be true` for the moved cases.

- [ ] **Step 3: Export the identity and report the move**

In `src/extension/storage.ts`, change `function identityOf` to `export function identityOf`,
add `moved` to `SavedBook`, and set it in `add`:

```ts
export interface SavedBook {
  id: string;
  book: Book;
  intent: Intent;
  source?: SavedSource;
  savedAt: number;
  /** True when this replaced a book already on the shelf rather than adding one. */
  moved?: boolean;
}
```

```ts
        const saved: SavedBook = {
          id: previous?.id ?? deps.newId(),
          book,
          intent,
          source: source ?? previous?.source,
          savedAt: deps.now(),
          moved: Boolean(previous),
        };
```

- [ ] **Step 4: Run and watch them pass**

Run: `./node_modules/.bin/vitest run src/extension/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Tell the content script which candidates are already shelved**

In `src/extension/messages.ts`:

```ts
export type BackgroundResponse =
  | { ok: true; result: RecognitionResult; draft: AttemptDraft; alreadySaved: string[] }
  | { ok: false; needsSetup: boolean; error: string };
```

In `src/extension/background.ts`, in the `recognize` message branch, compute it from the
shelf the worker already owns:

```ts
    const shelved = new Set((await library.list()).map((s) => identityOf(s.book)));
    const alreadySaved = result.candidates
      .map(identityOf)
      .filter((id) => shelved.has(id));
```

and include `alreadySaved` in the response. Import `identityOf` from `./storage`.

- [ ] **Step 6: Mark it in the picker and say the right word**

In `src/extension/content.ts`, add to `STYLE`:

```css
.buki-have {
  margin-left: 6px; padding: 1px 6px; border-radius: 999px; vertical-align: 1px;
  background: rgba(47,184,138,.18); color: #6fe0b6;
  font: 600 10px/1.6 ui-monospace, Menlo, monospace; letter-spacing: .04em;
}
```

Thread `alreadySaved` into `PickerOptions`, and when building a candidate row, append the
tag to the title when that book's identity is in the set:

```ts
      if (opts.alreadySaved?.has(identityOf(book))) {
        const have = document.createElement('span');
        have.className = 'buki-have';
        have.textContent = 'on your shelf';
        title.appendChild(have);
      }
```

And in the intent-button handler, use the word the write actually earned:

```ts
            const saved = await saveBook(book, intent, opts.source);
            settle({ outcome: 'confirmed', savedId: saved.id });
            closePanel();
            toast(`${saved.moved ? 'Moved' : 'Saved'}: ${book.title} → ${intent}`);
```

`saveBook` must return the worker's `saved` object unchanged — it already does.

- [ ] **Step 7: Full suite, typecheck, build**

```bash
./node_modules/.bin/vitest run
node node_modules/typescript/bin/tsc --noEmit
node build.mjs
```

- [ ] **Step 8: Commit**

```bash
git add src/extension/storage.ts src/extension/storage.test.ts src/extension/messages.ts \
        src/extension/background.ts src/extension/content.ts
git commit -m "feat: say when a book is already on the shelf instead of silently moving it"
```

---

## Task 5: The extension wears the landing page's room

Fixes reported item **#5**. Last on purpose: it touches every surface cosmetically, and
doing it before the structural tasks would mean re-doing it.

The landing page (`docs/index.html`) commits to one look — a warm plum-black room with a
single lamp. The extension currently uses the older periwinkle-on-near-black set. Bring the
tokens across exactly; invent nothing new.

| Token | Value | Was |
| --- | --- | --- |
| `--paper` / surface | `#14101c` | `#17151f` |
| raised surface | `#221a30` | `#1f1c2b` |
| border | `#332a45` | `#2a2637` |
| text | `#f0eaf6` | `#f2f0fa` |
| muted text | `#a396b8` | `#9d98b8` |
| accent | `#ffcf8a` (lamp) | `#6c7bff` |

The five cloth colours (`#ff6352 #ffb020 #2fb88a #6c7bff #b265d9`) and the gilt `#fae636`
do **not** change — they are the product's identity and the landing page reuses them.

**Files:**
- Modify: `popup.html`
- Modify: `options.html`
- Modify: `src/extension/content.ts` (the `STYLE` constant)

- [ ] **Step 1: Swap the popup tokens**

In `popup.html`, update the `:root` custom properties to the table above. The popup is
currently light with a dark-mode override; commit to the dark room and set
`color-scheme: dark`, matching the landing page's reasoning — the shelf is the same object
in both places and should not change temperature between them.

- [ ] **Step 2: Swap the options tokens**

Same substitution in `options.html`. Keep the affiliate-disclosure paragraph and the
"Buki earns a small commission…" wording intact — it is required by store policy.

- [ ] **Step 3: Swap the injected panel and pill tokens**

In `src/extension/content.ts`, in `STYLE`: `#17151f` → `#14101c`, `#2a2637` → `#332a45`,
`#f2f0fa` → `#f0eaf6`, `#241f33` → `#221a30`. Change the focus-ring colour on
`.buki-intent:focus-visible` and `.buki-btn:focus-visible` from `#6c7bff` to `#ffcf8a`.
Leave `.buki-intent:hover`'s periwinkle fill — it is a cloth colour, and the hover state is
the one place the shelf's own palette should show through.

- [ ] **Step 4: Build and look at all three surfaces**

```bash
node build.mjs
```

Then render each and **open the PNGs** — reasoning about this CSS has missed a blank cover,
an invisible separator and a bar-chart icon in this project already:

```bash
CHROME="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
SCRATCH="$TEMP/buki-shots"; mkdir -p "$SCRATCH"
"$CHROME" --headless --disable-gpu --hide-scrollbars --virtual-time-budget=2500 \
  --screenshot="$SCRATCH/popup.png" --window-size=500,760 \
  "file:///E:/Projects%20VS/save-book-extension/popup.html"
"$CHROME" --headless --disable-gpu --hide-scrollbars --virtual-time-budget=2500 \
  --screenshot="$SCRATCH/options.png" --window-size=700,900 \
  "file:///E:/Projects%20VS/save-book-extension/options.html"
```

Expected: both render in the warm room, text is legible against the new surface, the jade
Buy pill and the cloth spine colours are unchanged, and no element sits on a background it
now matches. Headless Chrome clamps `--window-size` to a 500px minimum — a narrower number
silently gives a 500px layout cropped into a smaller image, which once looked exactly like
a horizontal-overflow bug that did not exist.

- [ ] **Step 5: Commit**

```bash
git add popup.html options.html src/extension/content.ts
git commit -m "design: the extension moves into the landing page's room"
```

---

## Self-review

**Spec coverage.** #1 → Task 4. #2 → Task 3. #3 → Task 1 (Steps 3, 7). #4 → Task 2.
#5 → Task 5. #6 → Task 1 (Steps 1–6). All six reported items have a task.

**Type consistency.** `done()` returns `Pill` in Task 1 and is consumed as `settled.id` in
Task 1 Step 6 — consistent. `postKey` and `createLookupMemo` are defined in Task 2 and used
by name in Task 3 Step 8 (`lookups.forget`) — consistent. `identityOf` is exported in Task 4
Step 3 and imported in Task 4 Steps 5 and 6 — consistent. `withSignal` is defined in Task 3
Step 3 and used in Task 3 Step 6 — consistent. `FetchLike` is the existing type from
`src/recognizer/types.ts`; no new type is introduced for it.

**Known gaps, deliberately not in scope.**
- The right-click flow does not share the button flow's memo, because its key would have to
  come from `info.srcUrl` in the worker rather than a scraped post. Task 2 leaves the worker
  alone; if repeated right-clicks turn out to matter, that is its own task.
- Task 1 makes a pill grow when it resolves, but the growth itself is not animated — `height`
  cannot transition from `auto`, and the grid-rows trick is more machinery than this earns.
  The blur-swap already covers the change.
- **Multiple books in one picture is NOT in this plan.** It changes the recognizer's
  contract (candidates are competing guesses for one book, not a list of books), the picker,
  and the log schema. It needs a design pass first.
