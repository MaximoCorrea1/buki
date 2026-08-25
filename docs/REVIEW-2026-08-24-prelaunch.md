# The pre-launch review, 2026-08-24

**Ten reviewers, ~1.5M tokens, ~100 findings, six P0s.** This file is the permanent record.
`OPENWORK.md` carries the ORDER and the status; this carries the EVIDENCE. When an item in
THE LANE says "see the review", it means here.

> **Not served publicly.** `docs/` is the Vercel site root; this file is covered by
> `.vercelignore`'s `docs/REVIEW-*` glob, added in the same commit.

**State when the review ran:** `46b62fb`, 620 tests / 58 files, `tsc` 0, build 0, tree clean.
~~Nothing was fixed.~~ **True for one day.** Maximo's instruction was *"we solve them on next
session"*, and that session was 2026-08-25: **all six P0s, four P1s and the whole of §3's
mutation table are closed.** See §0.0 immediately below, and `OPENWORK.md` THE LANE for status.

---

## 0.0 STATUS, 2026-08-25 — what has been fixed since this was written

> **This file was written on 2026-08-24 with nothing fixed.** That sentence is still in the
> header below and was TRUE for one day. This section is the correction, kept above the
> original rather than replacing it, because **the evidence below is the reason the fixes
> look the way they do** and deleting the "nothing was fixed" framing would lose that.
>
> **`OPENWORK.md` THE LANE remains the authority on status.** This section exists so that
> nobody reads a finding here, believes it is live, and re-audits something already closed —
> which is exactly what §6's twenty clean bills exist to prevent for the other direction.

### The six P0s: ALL CLOSED

| | Finding | Closed by | Evidence it cannot silently return |
| --- | --- | --- | --- |
| **P0-1** | `/api/vision` forwards the body verbatim | item 38, `99a2e4e` | `src/server/visionBody.ts` REBUILDS the request. **6 mutations, 6 caught** |
| **P0-2** | A Polar non-2xx becomes 403, extension deletes the session | item 39, `05bee90` | Rule shared in `src/shared/retry.ts`. **6 mutations caught in BOTH directions** |
| **P0-3** | No rate limit on the licensed path | item 40, `11f2d6f` | `src/server/proCap.ts` + `BUKI_REVOKED_KEY_IDS`. **6 mutations, 6 caught** |
| **P0-4** | A hostile page can drive the injected tray | item 41, `16e257f` | 3 seams extracted; `contentSafety.test.ts` proves the ABSENCE of a second way in. **7 mutations, 7 caught** |
| **P0-5** | The card's × is a free-read button | item 42, `2b023a8` | `request.signal` upstream + `TRIAL_ATTEMPTS`. **9 mutations, 1 survived and found a real hole** |
| **P0-6** | Options-page slot reuse deletable with 620/620 green | item 43, `f344127` | `src/extension/activateKey.ts`. **This review's own mutation now fails 6 tests** |

### §3's mutation table: 5 of 6 used to survive a green suite. ALL SIX NOW FAIL.

| Mutation | 2026-08-24 | 2026-08-25 |
| --- | --- | --- |
| `options.ts` activation reuse → `undefined` | 620/620 green | **6 fail** |
| `theme.ts` click handler deleted | 620/620 green | **2 fail** |
| `storage.ts` `shot` + `source` carry removed | 620/620 green | **2 fail** |
| `visionHandler.ts` bearer `empty→null` collapsed | 620/620 green | **1 fails** |
| `visionHandler.ts` upstream headers passed through | 620/620 green | **2 fail** |
| `docs/index.html` launch-day find-and-replace | 620/620 green | **1 fails** |
| `TRIAL_SPELLED` drift | caught | caught |

**The `index.html` guard was widened past what §3 prescribed.** It named the three GitHub
links; the same find-and-replace also catches the **two Polar checkout URLs**, and a replace
that caught those sends every purchase to a 404 on launch day. Both sets are now counted.

### P1s closed: AC-3, AC-4, AC-7, AC-8 — filed together as item 44 and closed the same day

Not because they were the most severe, but because **all four say *"cannot be added to
clients already in the wild"*, and there are none until publication.** That deadline was the
item. `dff79ce`.

**A fifth landed with them that this review did not file.** A mismatched `BUKI_EXTENSION_ID`
refuses every renewal with 403 from the Origin check, while `/api/vision` keeps serving
token-bearing requests because it skips that check when a token is present — **so the failure
is invisible for eight days**, and by the time anyone notices, every subscriber has been
signed out by a status that was never about them. That is **P0-2's trigger (c)**, which P0-2
could not close from either half. Every `/api/license` refusal now carries a `code`, and
`origin` vs `licence` are two 403s that mean opposite things.

### Also closed, as a side effect rather than as an item

- **PERF-9** — catch-anywhere installed X's feed scanner on every third-party page,
  permanently, with no `clearInterval`. Same root as P0-4's third edit; gone with the host gate.
- **AC-4's claim-shape half** landed a commit early, with item 40, because `proCap` keys a
  rate limit on `licenseKeyId` and **a cap keyed on `undefined` is a cap on nobody.**
- **`storage.ts`'s `shot`/`source` carry** is now guarded — but **ADV-6's `book` half is
  NOT**, and that is the one that destroys a good record. See item 47.

### Two of this review's own prescriptions were DECLINED, with arithmetic

- **P0-1's `max_tokens` 256–512.** `max_tokens` maps to Gemini's `maxOutputTokens`, which on a
  THINKING model is a **combined reasoning-and-output budget** — and `llmVision.ts` already
  records that the pinned alias can be repointed at one that thinks. Twenty books is
  `MAX_BOOKS` and twenty entries is ~400 tokens, so **512 would truncate a real answer into
  invalid JSON that `parseGuesses` reads as "no books found"** — a silent failure, which is
  this codebase's signature. **Set to 2,048**: ~5x headroom, and still 64,000 → 2,048.
- **P0-3's `GRACE_MS` → 48h, and its tighter grace-traffic ceiling.** Once the per-licence cap
  exists, seven days versus two is **$0.54 versus $0.135** of exposure per leaked token.
  Thirty-four cents is not worth weakening the outage protection P0-2 was filed to strengthen,
  and the grace sub-ceiling's wall would fall on a real subscriber **during a real outage**.

### One number in this review was re-derived rather than taken

**The $3.46 is a MODEL-choice figure, not a token-budget one.** 1M input + 64k output is
**$0.126** at flash-lite rates and **$3.46** at Pro long-context rates ($2.50/M in, $15/M out).
So the model pin is ~95% of P0-1's fix and the input caps are the rest — which is why the pin,
not the clamp, is the thing that must never regress.

### Everything else in this file is OPEN, and now has a number

Every remaining P1, the whole §5 P2/P3 catalogue and §7 were filed on 2026-08-25 as
**`OPENWORK.md` items 45–56**, ordered by what it costs to ship without them rather than by
the severity labels here. **§6's twenty clean bills stand unchanged.**


---

## 0. How to read this

| Column | Meaning |
| --- | --- |
| **VERIFIED** | I read the code myself and confirmed the claim, independently of the agent |
| **REPORTED** | An agent's claim, evidence cited, not independently re-read by me |
| **MUTATION-PROVEN** | An agent broke the code, re-ran the suite, and it stayed green |

**Every P0 below is VERIFIED.** Agents were told not to be trusted at face value and two of
their claims were narrowed on re-reading (noted in place).

**Scope note.** `git diff origin/main` was EMPTY — everything is merged — so the skill's
diff-based scoping would have produced an empty review. Scope was the whole product, weighted
to the ~1,700-line server attack surface.

**Reviewers run:** correctness, testing, maintainability, security, api-contract, adversarial,
performance, reliability, kieran-typescript, plus an independent threat model.
**Skipped, with reasons:** `project-standards` (no `CLAUDE.md`/`AGENTS.md` — §0 lists both as
deliberately absent), `learnings-researcher` (no `docs/solutions/`), `agent-native` (no agent
surface), `previous-comments` (no PR), migration/schema agents (no database).

---

## 1. THE PATTERN — read this before any individual finding

Every P0, and most of the P1s, have one fingerprint:

> **The correct rule is written down, in a comment, within twenty lines of the code that
> breaks it.**

| The comment says | The code does |
| --- | --- |
| `licenseHandler.ts:164` "503, NOT 403: a 4xx makes the extension throw its session away during OUR outage" | returns 403 for a Polar 502, eight lines below |
| `visionRoute.ts:42` "The MODEL IS LEFT EMPTY on purpose: the server pins the alias" | no file in `src/server/` contains the word `model` |
| `license.ts:132` "forgetting the id would silently activate again next time" | a fallback that forgets it on the activate path |
| `license.ts:7` "not a stolen subscription for longer than a day" | `isLicensed()` twelve lines below computes eight days |
| `content.ts:108` "the mark's own spine and two cords down the edge" | removed 2026-08-24, documented 154 lines below |
| `tray-harness.mjs:60` "the same slice contentChrome.test.ts takes" | two different slicers, one keeps the prefix |
| `host.ts:11` "nothing imports VISION_ENDPOINT yet" | true only because the constant is DEAD, not because the route is |
| `README.md:103` `node tools/mark-sizes.mjs` | `TypeError` since 2026-08-17 |

**This is not carelessness.** The reasoning in this repo is better than most codebases ever
produce. That is precisely the mechanism: **the comments are load-bearing and unexecuted.**
Their quality is what stops anyone re-checking the code beneath them.

**The tests inherited the same habit.** Every guard asserts that a STRING IS PRESENT, not that
a BEHAVIOUR HOLDS — and a string is exactly what a good comment guarantees. See §3.

**The countermeasure is not more comments and not more tests.** It is converting the six or
seven load-bearing sentences into assertions that can fail.

---

## 2. THE SIX P0s

### P0-1 · `/api/vision` forwards the request body verbatim

**Found independently by FOUR reviewers** (security, api-contract AC-01, correctness C4,
threat-model #1). **VERIFIED** by reading four files end to end.

`src/server/visionHandler.ts:98` is the entire body handling on the money path:

```ts
body: await request.text(),
```

No JSON parse, no schema, no model allowlist, no size cap, no `max_tokens` clamp, no
image-count clamp. The only `request.json()` / `JSON.parse` in `src/server/` are in
`licenseHandler.ts:95` and `token.ts:124`.

**The chain, verified file by file:**

```
options.html:537      <input id="model" type="text">        free text, saved unvalidated
        ↓                                                   (options.ts:171)
background.ts:164     model: route.model || settings.model  route.model is '' on the proxy path
        ↓
llmVision.ts:192      JSON.stringify({ model, messages })   the model goes in the body
        ↓
visionHandler.ts:98   body: await request.text()            forwarded VERBATIM
        ↓
                      billed to GEMINI_API_KEY
```

**Two attack paths, and the first is not an attack.** A keyless user typing `gemini-2.5-pro`
into the settings Model field bills us for Pro-tier inference. That is a supported flow through
our own UI. An attacker skips the UI: `Origin: chrome-extension://<public store id>`, no
Authorization header, `policy.ts:36-40` returns `{kind:'trial'}`, body forwarded.

**The economics, measured by the threat model against Google's published pricing:**

| | input tokens | output | cost |
| --- | --- | --- | --- |
| honest catch (one 768px tile + prompt) | ~1,230 | ~30 | **$0.000135** |
| attacker request | ~1,000,000 | 64,000 | **~$3.46** |

**A 25,000x ratio.** And `policy.ts:17`, `ipCap.ts:13` and `visionHandler.ts:73` all justify
their design by citing "$0.00011" — the left column. **Every cost control in the system is
priced against a number the caller chooses.** `TRIAL_PER_IP_PER_DAY = 40` is ~$0.004 of
exposure under the assumption and ~$138/day/IP/isolate without it.

**The client-side half is this repo's signature bug.** `background.ts:164`'s comment reads
*"fall back to the configured model only when we are talking to a provider directly"* — and
`||` never checks the endpoint. `visionRoute.test.ts:81` asserts `model === ''` one layer BELOW
where the body is assembled, so the property three artefacts claim is asserted at the wrong
layer and false at the right one. `docs/superpowers/polar-setup.md:383` ("No model is pinned
anywhere") is wrong the same way.

**Fix, server-side, and only server-side.** Correcting the `||` closes the UI path and NOT the
vulnerability — the client is not the thing being defended. In `handleVision`: parse the body,
rebuild the upstream request from fields we control, pin the model to a server constant, set
`max_tokens` (~256–512), reject bodies over ~1.5MB before reading, enforce one user message
with at most `MAX_IMAGES` image parts. All four are testable in `visionHandler.test.ts` with
no deploy. **Ship WITH item 26 (the spend cap), not instead of it** — with P0-1 unfixed the
cap IS the loss ceiling and it will be reached rather than approached.

---

### P0-2 · A Polar non-2xx becomes 403, and the extension deletes the session

**Found independently by FOUR reviewers** (reliability, api-contract AC-02, adversarial ADV-1,
correctness C2). **VERIFIED** end to end.

`src/server/licenseHandler.ts`, two adjacent branches:

```ts
} catch (err) {
  // Polar is unreachable. 503, NOT 403: a 4xx makes the extension throw its session
  // away during OUR outage, which is the exact moment the grace window exists to cover.
  return json({ error: 'upstream' }, 503);     // ← handles DNS / socket failure
}

if (!res.ok) {
  return json({ error: detail... }, 403);      // ← handles a Polar 502. No status branch.
}
```

**The correct reasoning is written down eight lines above the code that violates it.** The
rarer outage shape (socket failure) is handled; the commoner one (a gateway 5xx) falls through
to 403.

**The verified cascade:**

```
Polar returns 502 / 500 / 503 / 429
  → licenseHandler.ts:170   if (!res.ok) → our 403      (status read for the log, then discarded)
  → license.ts:118          retryable: res.status >= 500  → 403 is NOT retryable
  → proState.ts:166-172     session: null                 ← the bearer token is erased from disk
  → visionRoute.ts:52       no Authorization header sent
  → policy.ts:37            classified as `trial`
  → gate.ts:63              WallError
  → the subscriber meets "Get Buki Pro, $4 a month" — the wall they already paid to pass
```

The token was NOT expired. `verify` would have returned `expired` and `decideAccess` would have
served `{kind:'pro', grace:true}` for another seven days. **The seven-day grace window — the
single mechanism built to keep a Polar incident from becoming the customer's problem — is
defeated by a transient condition, and the evidence it relied on is destroyed.**

**Three triggers, not one.** (a) Polar answers 5xx. (b) Our OWN `keyCap` answers 429 —
`CHECKS_PER_KEY_PER_DAY = 40` — with the text "Try again tomorrow", which is also non-retryable
and also wipes the session. (c) `BUKI_EXTENSION_ID` mismatched after publishing → every renewal
403s, while `/api/vision` keeps serving token-bearing requests, so the failure is invisible
until the token ages out.

**`grep -c 'status: 5' licenseHandler.test.ts` → 0.** Every existing test drives a THROWN
fetch. The response-shaped outage has no coverage.

**Fix.** Server: `if (res.status >= 500 || res.status === 429) return json({error:'upstream'}, 503);`
immediately inside `if (!res.ok)`, above the 403. Client: `retryable: res.status >= 500 ||
res.status === 429 || res.status === 408` — mirroring the rule `llmVision.ts:78` already uses,
extracted so the two clients cannot drift. Both halves, or the fix is half a fix.

---

### P0-3 · No rate limit of any kind on the licensed path

Found by security SEC-2 and the threat model. **VERIFIED.**

Both brakes sit inside one conditional at `visionHandler.ts:80`:

```ts
if (access.kind === 'trial') {
  if (env.trialClosed) return refuse('The free trial is closed just now.', 402);
  if (env.ipCap(request, now)) return refuse('Too many free catches...', 429);
}
```

A valid session token therefore has: **no IP cap, no kill switch, no per-key cap, and no
Origin check** (`policy.test.ts:73` asserts the origin is not required when a token is
present). `decideAccess` returns `licenseKeyId` — `policy.ts:45,49` — and `handleVision` reads
only `.kind` and `.status`. **The field a per-licence cap would key on is computed and
discarded.**

**The token is an 8-day unrevocable bearer.** `TOKEN_TTL_MS` 24h + `GRACE_MS` 7 days, bound to
no device and no IP, with no revocation path (no database, by design). Grace is UNCONDITIONAL:
the server never learns whether Polar was actually down.

**Chained with P0-1 this is the cheapest attack on the budget.** Pay $4 once, read the token
out of `chrome.storage.local` (the build is deliberately unminified and `PRO_KEY = 'buki-pro'`
is plain), and hold an uncapped, unrevocable, arbitrary-prompt Gemini proxy for eight days —
shareable, since nothing binds it to a device.

The reasoning in the code ("stopping somebody who is paying is the worst possible place to save
a hundredth of a cent") is sound for a $0.00011 catch. It does not hold once the caller picks
the cost.

**Fix.** A per-token cap keyed on `access.licenseKeyId` — already returned, already in the
signed claim, needs no new plumbing. Reuse `createKeyCap`'s shape. Set it where no human
reaches: a few hundred a day. Two refinements in the same edit: count `grace: true` requests
against a much tighter ceiling, and shorten `GRACE_MS` to 48h (an outage longer than that is a
Polar incident you will hear about). Optionally `BUKI_REVOKED_KEY_IDS` as a comma-separated env
var checked against `claim.licenseKeyId` — turns "rotate the secret and log everyone out" into
a one-line env change.

---

### P0-4 · A hostile page can drive the injected tray

Found by the threat model ONLY — no other reviewer saw it. **VERIFIED**: both concrete claims
re-read.

**Three facts that compose into an attack:**

1. **The script runs on attacker origins by design.** The manifest scopes `content_scripts` to
   X, but `ensureTray` → `background.ts:380` runs `executeScript({files:['dist/content.js']})`
   on ANY tab on a context-menu click. Once injected it arms permanently: `content.ts:1515`
   observes `document.body` with `{childList:true, subtree:true}` and `content.ts:1519` runs
   `setInterval(scan, 2000)` for the tab's lifetime, with no `clearInterval` anywhere.
2. **`grep -rc isTrusted src/` → ZERO occurrences in all of `src/`.** Unguarded handlers:
   `content.ts:1443` (save button), `:1218` (intent buttons → shelf write), `:1181` (Save all),
   `:1036`/`:1041` (wall → `openPage`).
3. **The image filter is a substring match**, `content.ts:548`:
   ```ts
   .filter((src) => src.includes('twimg.com/media')),
   ```
   `https://attacker.example/twimg.com/media/x.png` passes. **The correct implementation is
   three lines away in a sibling file** — `twitterImage.ts:51` does
   `if (parsed.hostname !== 'pbs.twimg.com') return url;`.

**The chain.** User right-clicks any image on attacker.com once (the normal catch-anywhere
flow) → `content.js` injected → scanner arms → the page appends forged
`<article data-testid="tweet">` markup with an `<img src="https://attacker.example/twimg.com/media/x.png">`
→ Buki injects a save button → the page calls `.click()` on it. That runs the whole pipeline:
spends one of the user's ten free catches (or bills their own provider key), sends
attacker-chosen text and image to the model on our key, issues a `fetch` from the service
worker with no scheme or host validation, and — via `.buki-intent` → `shotFor(card.image, 1)`
→ `saveBook.ts:58` — **persists the attacker-controlled URL as the book's `shot`**.

**That last one is a permanent beacon.** `cover.ts:49-53` fetches `saved.shot` on every popup
open, from the extension origin, forever.

**Fix, three small edits.** (1) `if (!e.isTrusted) return;` at the five listener sites — kills
the whole synthetic-drive class. (2) Replace the `.includes` with a hostname check and re-check
it in `background.ts` before `inlineAll`. (3) Gate the scanner on the host —
`if (/(^|\.)(x|twitter)\.com$/.test(location.hostname))` — which also fixes the
`permissions.md:55-60` justification gap, since that answer says "injects the same result card"
while the bundle actually polls the DOM every two seconds forever.

---

### P0-5 · The card's × is a free-read button

Found by adversarial ADV-5. **VERIFIED.**

`gate.ts:61-66`:

```ts
const result = await work();
if (verdict.spendTrial) await deps.trial.spend();
```

If `work()` REJECTS, the spend never happens. And `grep -c signal src/server/visionHandler.ts`
→ **0** — the upstream Gemini call carries no `AbortSignal`, so a client abort never reaches
the provider. **The money is committed; the counter does not move.**

**Trigger, with no forgery and no storage editing:** press catch, press the card's × ("Stop
looking") about two seconds later, repeat. `dismiss` sends `cancelRecognize`, the worker aborts
and calls `lookups.forget(job)` — which is what makes the next press a fresh, full-price
lookup. The abort surfaces as `VisionHttpError(408)`, `work()` rejects, `spendTrial` is skipped.
The options page still reads "10 of 10 free catches left".

**The same path fires with no intent at all:** a 12s timeout produces the identical 408 after
two attempts. A user on a slow uplink pushing ~200KB of inlined JPEG reaches it without touching
the ×.

**Why this is worse than the recorded risk.** `trial.ts:6-12` accepts that the counter is
forgeable, reasoning that "whoever resets storage every ten books was never going to pay four
dollars". `ipCap.ts:11-14` calls the client counter "the trial count that matters". **Both
statements are false on this path** — no reset is involved and the counter that matters cannot
move. Of three documented defences, two are simultaneously ineffective and the third (item 26)
does not exist yet.

**Fix.** Separate "you gave up" from "nothing was spent". Add `trialAttempts` in `trial.ts`,
incremented in a `finally` for every attempt that actually issued an upstream request, with a
ceiling of ~2-3x `TRIAL_CATCHES`. Keep `trialSpent` as the advertised generous number; use
`trialAttempts` purely as the ceiling that stops an unbounded loop. This preserves the
deliberate "a timeout costs nothing" promise while bounding it.

---

### P0-6 · The options page's activation-slot reuse is deletable with 620/620 green

Found by the testing reviewer. **MUTATION-PROVEN**, and the tree was verified clean afterwards.

Replacing `options.ts:85`

```ts
const reuse = held.key === pasted ? held.activationId : undefined;
```

with `const reuse = undefined;` makes every Activate press spend one of the licence's **five
permanent slots**. Result: `Test Files 58 passed (58) / Tests 620 passed (620)`.

The only guard is `proState.test.ts:336` — `expect(optionsSrc).toContain('activationId')` —
which still passes because the identifier survives in the `writePro` spread at `options.ts:93`
and in four comments.

**This is character-for-character the failure §5 already records**: `toContain('markRestored')`
passed with the call in dead code AND with its arguments reversed.

**Five presses lock the person who paid out of their own licence, permanently, with no
self-service fix.** The Activate button is exactly what a human presses repeatedly when a key
does not take.

**Fix.** Do to `options.ts` what `saveBook.ts` already did to `background.ts`: extract
`src/extension/activateKey.ts` exporting pure `activationFor(pasted, held)` and
`nextProState(pasted, held, result)`. Then assert with real values — same key + stored id →
id offered back; DIFFERENT key + stored id → undefined; ok result with no activationId in the
response → the stored reuse is persisted; non-retryable refusal → `{session:null, activationId
kept}`; retryable refusal → `writePro` not called. Replace the `toContain` with an import-line
regex, which is the one thing a `?raw` guard proves cleanly.

---

## 3. THE MUTATION RESULTS — the strongest evidence in the review

The testing reviewer broke six things, re-ran, and recorded the result. **Five survived a
fully green suite.** All mutations were reverted; `git status` and `git diff HEAD` were
verified clean by me afterwards.

| Mutation | Suite | Consequence if it shipped |
| --- | --- | --- |
| `options.ts` activation reuse → `undefined` | **620/620 green** | five presses exhaust the licence (P0-6) |
| `theme.ts` click handler deleted | **620/620 green** | the theme button renders, focuses, does nothing |
| `storage.ts` `shot` + `source` carry removed | **620/620 green** | every book loses its cover the first time it changes pile |
| `visionHandler.ts` bearer `empty→null` collapsed | **620/620 green** | a broken session silently demoted to trial |
| `visionHandler.ts` upstream headers passed through | **620/620 green** | `GEMINI_API_KEY` could ride home in a header |
| `docs/index.html` launch-day find-and-replace | **620/620 green** | ships "Source" pointing at the Web Store |
| `TRIAL_SPELLED` drift | **CAUGHT** | — |

**Two of these deserve special note.**

`theme.ts:111` says `start` is *"Exported and taking its document so the live path is reachable
from a test"*. **No test ever calls it.** The module was restructured, given its own bundle
entry, and given a docblock about `brand.md`'s two-day dead theme button — and the assertion
that would have caught a dead theme button was never written.

The `docs/index.html` mutation is **the exact edit `OPENWORK.md` item 36 exists to prevent**.
`host.test.ts:144`'s docblock is entirely about it: *"A find-and-replace on the day would send
Source to the Web Store, and nobody would notice."* The test asserts link TEXT, not destination
— `toContain('>Source<')` survives any href change. Worse, the sibling assertion "sends
everybody to the SAME place" passes MORE confidently after the bad replace, because now all
eight agree.

**Fix for the guard:** capture the non-`.btn` anchors and assert the destination —
`expect(keep.length).toBe(3)` to guard the vacuous pass, then
`expect(href).toMatch(/^https:\/\/github\.com\//)` for each.

---

## 4. P1 FINDINGS

| ID | Finding | File | Status |
| --- | --- | --- | --- |
| R-1 | **The licence exchange runs on the catch path with no timeout**, outside the catch's abort signal. `keepSession` is awaited at `background.ts:200`, BEFORE the AbortController exists at `:206`. `licenseHandler.ts:9` claims it is "never during a catch" — false, `background.ts:200` calls it there by design | `background.ts:106` | REPORTED |
| R-2 | **A failed renewal retries on every catch** with no backoff, no cooldown, no breaker. Burns `CHECKS_PER_KEY_PER_DAY = 40`; then our own 429 reads as non-retryable and wipes the session — P0-2 by a second route | `proState.ts:141` | REPORTED |
| R-3 | **A `looking` card has no watchdog in either direction.** If the worker dies mid-catch on the context-menu flow, "Reading the cover…" sits on someone else's page permanently, dismissible only by hand | `catchTray.ts:152` | REPORTED |
| R-4 | **The image download every catch blocks on has an abort signal but no timeout** | `inlineImage.ts:97` | REPORTED |
| AC-3 | **The server's 401 contract is not implemented on the client.** `policy.ts:51` and `visionHandler.ts:63` both say 401 means "re-exchange your licence key". `grep 401 src/extension/` returns two comments and zero handlers. A 401 is `permanent` → `needsSetup` → the options page opens on every catch. **The only lever that makes a `BUKI_TOKEN_SECRET` rotation survivable, and it cannot be added to clients already in the wild** | `llmVision.ts:78` | REPORTED |
| AC-4 | **No version marker anywhere** — no `/v1/`, no header, no body field, no `v` in the token payload. `verify()` checks ONLY `typeof claim.exp === 'number'`, so a token missing `licenseKeyId` returns `valid` with `licenseKeyId: undefined`. **A shape migration fails OPEN and SILENTLY in both directions.** Found independently by api-contract AND typescript | `token.ts:23` | REPORTED |
| AC-5 | **The client compiles the server's `TOKEN_TTL_MS` and `GRACE_MS` into its bundle.** Change either server-side and every shipped client desynchronises | `license.ts:10` | REPORTED |
| AC-6 | **A response-shape change on `/api/vision` fails silently as "no books found"**, not as an error. `typeof raw !== 'string' → return []` is indistinguishable from an empty picture | `llmVision.ts:251` | REPORTED |
| ADV-3 | **The licence server mints a session without proving the claim carries an activation id.** On the ACTIVATE path there is no fallback: if Polar's response lacks a top-level `id`, `JSON.stringify` drops the key, the client's `?? ''` yields `''`, `writePro`'s `&& activationId` guard omits the field, and the next renewal ACTIVATES again. **Item 27's P0, re-opened.** The client comment eleven lines up names the hazard and the fallback has nothing to fall back TO | `licenseHandler.ts:196` | **VERIFIED** |
| ADV-8 | **`ensureSession` is documented as never throwing; both `deps.save` calls are outside the `try`.** A storage-quota failure rejects into the catch. Worse: it happens AFTER `exchange` returned ok, so on a first pairing Polar has already spent a slot and the id was never persisted | `proState.ts:126` | REPORTED |
| TS-1 | **`readSettings` casts a whole storage record and spreads it over the defaults.** The only one of three storage readers that does not validate field by field — and its values are called as methods on the money path (`settings.apiKey.trim()`) | `settings.ts:27` | REPORTED |
| PERF-1 | **Grounding fan-out waits for the slowest of N queries.** MEASURED live: 20 concurrent OpenLibrary searches, median 1,215ms, **wall 6,072ms**. `Promise.all` samples the p95 on every catch. Second-order: `withBreaker` calls `failed()` per query, so three tail timeouts inside ONE catch open the 120s breaker | `recognizer.ts:56` | REPORTED (measured) |
| PERF-2 | **The tray re-fetches every candidate cover on every card repaint** — N + N² round trips. Filing 20 books one at a time = **420 `coverBytes` messages, ~10MB** of cross-process payload. `coverData.ts` has `store.match` and no `store.put`, so every candidate is a cache miss by construction | `content.ts:1162` | REPORTED (measured) |
| C-3 | **A dead `activationId` is never cleared.** If the id becomes invalid at Polar (the customer deactivates that install to free a slot), every exchange validates a nonexistent activation and re-stores the same dead id. Re-pasting the key does not help — `options.ts:85` reuses it. **The only escape is clearing extension storage** | `proState.ts:166` | REPORTED |
| M-1 | **`host.ts` exports `LICENSE_ENDPOINT` and `VISION_ENDPOINT` and nothing imports either.** Three files rebuild the paths by hand. `host.test.ts` globs for stale HOSTS only, never the PATH | `host.ts:19` | REPORTED |
| M-2 | **`tools/mark-sizes.mjs` is 100% dead** — reads `MARK.cords`, retired 2026-08-17, `TypeError` on first use. `README.md:103` lists it as working and `x-button-harness.mjs:7` cites it as evidence. `entryPoints.test.ts` is green because it only asserts the file PARSES | `tools/mark-sizes.mjs` | **VERIFIED** |
| M-3 | **`tray-harness.mjs` hand-spells the mark** — an 8th copy outside `mark.test.ts`'s asserted seven, in a file that CAN import `markSvg`. This copy has already lied once and cost a real design detour | `tools/tray-harness.mjs:52` | **VERIFIED** (this session) |
| M-4 | **The Web Store listing, the launch runbook and `llms.txt` spell the price** and sit outside `pricing.test.ts`'s two guarded surfaces. `host.test.ts` already globs all three files; the price guard does not. **listing.md is the copy pasted into the store form, and store copy cannot be edited after submission without re-review** | `pricing.test.ts:34` | REPORTED |
| M-5 | **The context-menu handler is 95 lines of the riskiest orchestration in the extension and no test can reach it.** Four ordering rules stated in comments, none checked | `background.ts:411` | REPORTED |
| M-6 | **The whole card renderer is unreachable by any test, including the paywall.** `trayCopy.ts` lists four rules the wall must obey; the tests check the STRINGS. Nothing checks that `wallBody` renders `WALL.free` as a real button — rule 3, the line between an offer and a dark pattern | `content.ts:941` | REPORTED |

---

## 5. P2 / P3 — the catalogue

Grouped by theme. Full evidence is in the agent transcripts; each line is enough to re-find it.

**Data integrity**
- **ADV-6 · Re-catching a book you own overwrites the good record with a degraded one.**
  `storage.ts:96` takes `book` WHOLESALE while defending `source: source ?? previous?.source`
  and `shot: shot ?? previous?.shot` on the two lines below. When OpenLibrary is down the
  recogniser correctly emits a bare guess with no `isbn` and no `coverUrl`; saving it destroys
  both on disk. Buy links fall back to a title search; the cover falls back to a photograph.
  The user is told "Moved · Dune → now". **VERIFIED.** Fix: `book: previous ? {...previous.book, ...book} : book`.
- **C-5 · `bookKey` drops everything after the first colon.** "The Lord of the Rings: The Two
  Towers" and "…: The Return of the King" are the same book. Differing ISBNs cannot veto —
  the ISBN check can only ADD a match. Saving the second overwrites the first.
- **C-6 · `normAuthor` takes the longest token, not the surname.** "Gabriel García Márquez" →
  `gabriel`; "G. García Márquez" → `marquez`. Two spellings, two keys, one book filed twice.
- **C-8 · Removing a book prunes its cached cover before the 8s undo window closes.**
- **C-9 · `shotFor` guards on the number of BOOKS, not the number of IMAGES.** A four-photo
  post yielding one book stores photograph one as that book's cover.
- **ADV-7 · The two catch flows derive different job keys for a multi-image post** — two cards,
  two vision calls, two trial spends for one post.
- **C-7 · `postKey` drops the host**, so on catch-anywhere two images with the same path on
  different sites are one catch.

**Server / contract**
- **SEC-3 · `/api/license` has no per-IP cap** and `keyCap` is keyed on the string the attacker
  chooses, so N distinct guesses produce N real calls on our Polar org token. Impact is
  availability: a throttled `POLAR_ACCESS_TOKEN` locks out every subscriber's renewal at once.
  `createIpCap` already exists and is tested.
- **AC-9 / TM-6 · `/api/vision` relays the upstream body with no redaction and no length cap**,
  while `/api/license` scrubs and truncates the same class of data. The endpoint that holds the
  money-spending credential is the one without the scrub.
- **AC-10 · Polar's response is cast, never validated.** A well-formed JSON body with different
  keys → `status === undefined` → 403 "That licence is not active" to a subscriber whose licence
  is fine. The honest 502 is only reachable on malformed JSON.
- **AC-7 · 402 (the trial kill switch) is indistinguishable from a setup failure** — the client
  opens the options page. Until the client understands 402, the switch cannot be flipped without
  telling every trial user their setup is broken.
- **AC-8 · Three error envelopes across two endpoints**, and 405/500 return BARE TEXT with no
  content-type, so the client extracts no message on exactly the two statuses meaning "the
  server itself is broken".
- **AC-12 · `expiresAt` is a server timestamp evaluated against the client's clock**, with no
  skew tolerance and no `expiresIn` to anchor locally.
- **R-6 / TM-13 · Neither edge function bounds its upstream call.**
- **PERF-6 / SEC-4 · `ipCap` has no eviction** and keys on the full IPv6 address. A residential
  /64 gives one client 2^64 keys — both an unbounded-memory problem and a free bypass. **The
  x-forwarded-for question is settled: Vercel overwrites it at the edge** (threat model, with a
  docs citation), so it is NOT spoofable today. **But the safety comes from the platform, not
  the code**, and `ipCap.ts:38-41` reasons from generic HTTP semantics. Move hosts or add a
  proxy and the only automated brake evaporates silently.
- **TM-12 · `vercel.json` excludes `/api/` from the headers block**, so API responses carry no
  `nosniff` and no `Cache-Control: no-store` — and the licence response body is a bearer token.

**Client / privacy**
- **TM-4 · `privacy.html:55` says "Never in the background"** — opening the popup fetches every
  saved book's cover, disclosing the user's IP to `pbs.twimg.com`, `openlibrary.org` and
  `archive.org` with no user action. **The one claim a reviewer can falsify in thirty seconds
  with DevTools open on the popup.**
- **TM-7 · `permissions.md:36` says storage holds settings and "none of it is transmitted".**
  `visionSettings` contains `apiKey`, transmitted as a Bearer on every cover read.
  `privacy.html:53` gets this right; the store answer does not.
- **TM-8 · Prompt injection → CSV formula injection.** `goodreadsCsv` quotes on `/[",\n\r]/`
  but writes the title raw; `=HYPERLINK(...)` survives into the export.
- **TM-9 · The tray lives in the host page's light DOM** with stable class names, and
  `content.ts:955` mirrors which pile a book is in into `el.dataset['sig']` — a CSS-attribute
  exfiltration surface. Fix: closed shadow root, move `sig` to a `WeakMap`.
- **TM-10 · Latent `javascript:` on the shelf.** `content.ts:519` uses `href*="/status/"`
  (substring) and returns `.href` verbatim. Defused today only by `popup.ts:467`'s protocol
  guard at the single render site.
- **TM-11 · Host grants accumulate and are never revoked.** No "forget" path.
- **TM-14 · `https://twitter.com/*` and `https://x.com/*` in `host_permissions` are unnecessary**
  — nothing fetches either host and `content_scripts.matches` needs no host permission in MV3.
  Two fewer entries a reviewer can ask about.
- **PERF-9 · Catch-anywhere installs X's feed scanner on every third-party page, permanently.**
  Provably zero-yield off X and never stops. Same root as P0-4's third edit.

**Performance**
- **PERF-3 · OpenLibrary search asks for full ISBN arrays and uses one entry.** MEASURED:
  `'Dune Frank Herbert'` with `isbn` → **8,320 bytes**; without → **398 bytes**. **20.9x.**
  Across five titles, 14.4x. In one 20-query burst: 70KB downloaded, ~93% discarded.
- **PERF-4 · `popup.paint()` issues four storage reads per keystroke** — under a comment reading
  `// synchronous: no storage read, no await, no render race`. **All three clauses are false.**
- **PERF-5 · Every keystroke rebuilds the whole shelf DOM** with no cap and no memo. MEASURED
  `weaveOf`: 119 books 5.12ms, 500 books 15.98ms, 2000 books 58.80ms.
- **PERF-7 · `shelvedAmong` is O(candidates × shelf)** with both identity keys recomputed per
  comparison. MEASURED: 2000 books = 40,000 calls, 179ms, on the catch's response path. A Map
  makes it 36x faster.
- **PERF-8 · `/api/vision` buffers the entire image payload before opening the upstream
  connection** — ~55-138KB per image, two copies in flight.
- **PERF-10 · The licence renewal and entitlement reads sit serially in front of the image
  download**, though nothing about downloading the picture depends on the session.

**Types / maintainability**
- **TS-2 · The shelf and the log cast unvalidated storage arrays.** `Array.isArray` is the only
  check. A corrupt `intent` exports the literal `undefined` into Goodreads' "Exclusive Shelf".
- **TS-3 · Five of eight `BackgroundRequest` variants and all six `ContentRequest` variants have
  no declared response type.**
- **TS-4 · Neither message receiver has a `never` check**, so a ninth variant is a silent no-op.
- **TS-7 · `exactOptionalPropertyTypes` is off.** It is the ONE compiler flag that makes
  "omitted" and "present but undefined" different types — the exact distinction every
  conditional-spread comment in this repo reasons about in prose. **It is the only thing that
  would have made the original `activationId` bug red.**
- **C-1/C-2/C-3/C-4/C-5 (maintainability) · Seven stale comments**, listed in §1.
- **X-3 · `settings.toVisionConfig` is dead code and `background.ts` still imports it.**
- **X-2 · `entitlement.footer()` has no caller**, and two module headers vouch for it.
- **D-7 · `bindingFor` indexes `BINDING` by `CLOTH.length`** — a cross-module length coupling
  that fails silently on the sixth dye.
- **D-5 · `toolbar.ts` hardcodes two brand colours** and names sources that do not hold them.
- **D-9 · `tray-harness.mjs` retypes the cloth palette, names the wrong file, and drops one of
  the five dyes** — so marigold is structurally invisible to the only tool that can see the tray.
- **K-1 · `src/recognizer/` imports `src/extension/`** — the only edge running against the graph.
- **X-6 · Nine dead CSS tokens**, five of which are an unguarded fourth copy of `BINDING`.
- **X-5 · `Tweet.altText` is declared in three files, threaded through two call sites, and never
  populated.**

---

## 6. CLEAN BILLS — checked and sound

Recorded so nobody re-audits them.

1. **Token cryptography.** HMAC-SHA256 via WebCrypto; MAC verified BEFORE the payload is parsed;
   constant-time compare with a fixed-length pre-check; no JWT `alg` field; empty secret makes
   `importKey` throw → fail-closed. No forgery, parse confusion or length extension without the
   secret.
2. **Zero runtime dependencies.** `package.json` `dependencies: {}`; all 132 lockfile entries
   dev-only. Nothing third-party ships in the extension. Verified by me.
3. **No secrets in git history or the bundle.** Full-history scan for `polar_oat_`, `AIza…`,
   `sk-…`: **0 hits**. No tracked `.env`. The shipped bundle talks to exactly six hosts, all
   declared. Verified by me.
4. **No injection sinks.** Zero `innerHTML` / `insertAdjacentHTML` / `document.write` / `eval` /
   `new Function` in `src/`. The one `DOMParser` use builds fully static SVG.
5. **No SSRF on the server.** Every outbound URL is a module constant.
6. **The Origin check is sound in the fail-closed direction** — exact `===`, no `startsWith`;
   a missing Origin refuses; both handlers 500 rather than serve when `BUKI_EXTENSION_ID` is
   empty. It is forgeable by non-browsers, which the code says out loud three times.
7. **No credential crosses back to the client.** `handleVision` copies only body and status,
   never a header.
8. **`optional_host_permissions: ["https://*/*"]` is used safely.** `originPatternFor` rejects
   non-https, wildcards in the hostname, and bracketed IPv6.
9. **Cross-extension messaging is closed.** No `externally_connectable`, no
   `onMessageExternal`.
10. **A hostile web page cannot reach the server directly** — no CORS headers and 405 on
    non-POST, so the mandatory preflight fails.
11. **`chrome.storage.sync` is never used.** The licence key is not pushed to the user's Google
    account.
12. **`docs/` exclusions hold in production.** `/SESSION-CONTEXT-…md` → 404,
    `/superpowers/polar-setup.md` → 404. Verified live by me.
13. **`/api/vision` on a bare GET → 405 with an empty body.** No stack trace, no env names.
    Verified live by me.
14. **`/privacy` is served**, with the new rights and children sections, dated 2026-08-20.
    Verified live by me.
15. **`buyLink` is correctly encoded**; `book.coverUrl` is never LLM- or page-derived.
16. **The `authorName()` N+1 remains disproved** (re-checked by the performance reviewer).
17. **`ipCap` / `keyCap` near-duplication is justified** — each documents how and why it differs.
18. **`TRIAL_SPELLED` / `TRIAL_CATCHES` drift IS caught** in both single-step directions
    (mutation-tested).
19. **Every `import.meta.glob` guard asserts non-emptiness.** None is vacuous.
20. **The suite is order-independent** — zero `beforeEach`, `vi.mock`, `vi.stubGlobal` or fake
    timers anywhere.

---

## 7. THE ONE THING THAT COULD NOT BE VERIFIED STATICALLY

`permissions.md:153` and `coverCache.ts:36-42` assert that every hop of the
`covers.openlibrary.org → archive.org` redirect answers with permissive CORS. That is a
live-network fact with no contract behind it. **Probe it once against a real cover before
submitting** — if it is wrong, every shelf cover silently falls back to the drawn board and
nothing would tell you it had happened.

---

## 8. SEQUENCING — this interlocks with item 37

**The day `BUKI_EXTENSION_ID` is set to the shipped id is the day `/api/vision` becomes
reachable by anyone who reads the store URL.** The extension id is public the moment the item
is listed, and the Origin check is forgeable by non-browsers.

`docs/store/launch.md` has the ordering right. What must change: **P0-1 (the model pin) and
item 26 (the spend cap) both have to be live BEFORE step 5**, not after.
