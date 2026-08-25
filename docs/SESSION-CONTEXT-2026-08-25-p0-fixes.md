# 2026-08-25 — the six P0s, fixed, and mutation-tested on the way in

**Pair:** `docs/SESSION-TODO-2026-08-25-p0-fixes.md`
**The findings:** `docs/REVIEW-2026-08-24-prelaunch.md` — that is the evidence; `OPENWORK.md`
is the order and the status. This file is the REASONING: what was measured, which of the
review's own prescriptions were declined and why, and which instruments lied.

> **THE HONEST NOTE, and it is now FOUR consecutive sessions.** `maintaining-project-docs`
> requires this pair before the first substantive tool call. It did not exist; it was written
> mid-session, after item 43 landed, rather than at the end — which is an improvement of
> about one step and not a fix. The skill's own baseline records the rule being "written down
> and re-issued twice more" and concludes *"writing it down was not the lever."* Confirmed a
> fifth time.
>
> **What DID work this session was a mechanism rather than a rule**: every fix was
> mutation-tested before it was committed, and that caught two real holes. A rule that
> produces an artefact you can watch fail is a different kind of rule from one that asks you
> to remember something.

---

## What was asked

Read everything — code, docs, ADRs, findings, competitors, strategy — then work the lane:
**items 38 → 41 → 39 → 40**, and the two P0s behind them. Act across business, backend,
features, efficiency and design.

All six P0s closed. One new item filed (44). Six commits, one per item, each independently
revertable.

---

## Measured, with the probe beside it

| Measurement | Probe | Value |
| --- | --- | --- |
| Test suite, session start | `./node_modules/.bin/vitest run` | 620 / 58 files |
| Test suite, session end | same | **760 / 65 files** |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit` | exit 0 throughout |
| Build | `node build.mjs` | exit 0 throughout |
| Commits since `d3e5923` | `git rev-list --count d3e5923..HEAD` | **41** |
| Open numbered items | `grep -c '^- \[ \] \*\*[0-9]' OPENWORK.md` | **9** (was 14) |
| P0s open | `grep -cE '^- \[ \] \*\*(38\|39\|40\|41\|42\|43)\.' OPENWORK.md` | **0** |
| Mutations run against the new guards | by hand, one file at a time | **47** |
| Mutations caught immediately | same | **44** |
| **Mutations that SURVIVED** | same | **3 — all three real holes** |
| The review's §3 mutation table, re-run | each mutation applied, suite re-run, reverted | **6 of 6 now caught** (was 1 of 6) |
| Gemini OpenAI-compat base URL | `ai.google.dev/gemini-api/docs/openai`, fetched live | `…/v1beta/openai/` + `/chat/completions` |
| `max_tokens` in that doc's parameter tables | same fetch | **not listed**, and that mattered — see below |
| `content-length` survives `new Request(...)` | `node -e` probe | **yes**, so the early-out is testable |
| `Event.isTrusted` on a synthetic dispatch | `node -e` probe | **`false`**, so the guard is testable with real events |
| `Request.signal` follows the caller's controller | `node -e` probe | **yes**, and `text()` still works after abort |
| Attacker request cost, re-derived | Google's published Pro long-context rates | **$2.50 in + $0.96 out = $3.46** — the review's figure, and it is a MODEL-choice number |
| Leaked-token exposure after item 40 | 8 days × 500 × $0.000135 | **~$0.54** |

---

## Beliefs overturned

### 1. "The $3.46 is a token-budget problem." It is a MODEL-choice problem, ~95% of it.

**Believed:** the review's fix list treats the model pin, the `max_tokens` clamp and the size
caps as three parts of one repair.

**Measured** against Google's published pricing: 1M input + 64k output is **$0.126** at
flash-lite rates and **$3.46** at Pro long-context rates ($2.50/M in, $15/M out). The
attacker's leverage is almost entirely *which model*, and only marginally *how many tokens*.

**So the pin is the thing that must never regress**, and the clamp is a secondary bound. That
changed where the rigour went: the model-pin assertion reads the body `fetch` was actually
called with, and reverting the rebuild fails eleven tests.

### 2. "`max_tokens` 256–512, as the review suggests." That number would have broken catches.

**Believed:** a tight output clamp is free.

**Checked** at the source rather than from memory. `max_tokens` maps to Gemini's
`maxOutputTokens`, which on a THINKING model is a **combined budget for reasoning and
output** — and `llmVision.ts` already records that the pinned alias can be repointed at a
model that thinks. Twenty books is `MAX_BOOKS`, and twenty `{"title","author"}` entries is
roughly 400 tokens. **512 would have truncated a real answer into invalid JSON, which
`parseGuesses` reads as "no books found"** — a silent failure, which is this codebase's
signature.

**Set to 2,048**: ~5x headroom over the largest honest answer, and still 64,000 → 2,048.

### 3. "The review named every lever on `/api/vision`." It named the big one and missed four.

`n: 100` is a hundred completions charged for one request. `service_tier: 'priority'` is a
premium price band. `extra_body` is Gemini's documented escape hatch and can re-open anything
the module closes. `max_completion_tokens` is OpenAI's newer spelling of the clamp, so
dropping only the old name would have left the new one honoured.

**None of them is a new finding so much as a consequence of the approach.** A SANITISER has to
enumerate what is dangerous and is wrong the day the provider adds a field; a REBUILD gives
everything else nowhere to go. The allowlist is three keys and the test asserts its complement.

### 4. "Shorten `GRACE_MS` to 48h." Once the per-licence cap exists, this is worth 34 cents.

**Believed** (review, item 40): tighten the grace window, because that is where a stolen token
spends most of its life.

**Arithmetic:** with `CATCHES_PER_LICENCE_PER_DAY = 500`, seven days is $0.54 of exposure and
two days is $0.135. **Thirty-four cents** — against weakening the outage protection that item
39 was filed to strengthen. Declined, along with the tighter grace-traffic ceiling, whose wall
would fall on a real subscriber during a real outage.

**The general shape is worth keeping:** once one control bounds a thing properly, the controls
that used to matter stop mattering, and the reflex to add all of them is how a paying customer
ends up meeting a wall.

### 5. "Extracting the arithmetic fixes item 43." Half of it. A mutation said so.

**Believed:** pulling `activationFor` and `nextProState` out of `options.ts` closes it, as the
review prescribes.

**Measured:** with only those extracted, `options.ts` was rewritten to build its own `ProState`
and call `writePro` directly — **and the whole suite stayed green**, because the replacement
source guard only forbids the two spellings it already knows.

So `activate()` owns the ORDER too. That also made the review's own fifth assertion —
*"retryable refusal → `writePro` not called"* — expressible for the first time: the difference
between "wrote a state with no session" and "wrote nothing" is a paying customer signed out
during our own outage, and no reading of `options.ts` as text can tell the two apart.

### 6. "The client-side `||` is out of scope." It became a one-word deletion.

The review says *"FIX SERVER-SIDE ONLY"*, meaning the client is not the thing being defended,
and that is right. But `visionRoute` already returns `{endpoint, model, apiKey}` — the exact
shape `VisionConfig` wants — so `background.ts`'s `model: route.model || settings.model`
became `config: route`. **The fix was not adding a check; it was deleting the second place the
decision lived.** The second place is the one that was wrong.

### 7. "A source guard can replace an extraction." It cannot, and this is the third proof.

`contentSafety.test.ts` is written entirely as ABSENCE proofs for that reason: no bare click
listener, no module-scope timer, no unguarded `armFeedScan()`, no `.includes('twimg`, no
`lookUp(msg.tweet)`. **It never asserts the safe call is present — a comment satisfies that.**
The behaviours themselves are tested against real `Event` objects, real URLs and a real
`EventTarget`, in modules extracted for the purpose.

---

## Instruments that lied, this session

| Instrument | How it lied | Instead |
| --- | --- | --- |
| **The tests I had just written for item 42** | Replacing `attempts: () => read(ATTEMPTS_KEY)` with `async () => 0` left the whole suite green. Attempts were written on every catch and read back as zero for ever, so the ceiling could never be reached and the fix was INERT | The round trip, not the two halves. **This is `readPro` dropping `activationId` for the third time** (item 27, twice) |
| **The tests I had just written for item 43** | Extracting the arithmetic left `options.ts` free to bypass it, green | Extract the ORDER as well |
| A `sed` mutation that unbalanced braces | `gate.test.ts` failed to LOAD, so vitest reported **`92 passed`** — a SMALLER total than the baseline's 107, all green. Read as "survived", it is exactly backwards | **Compare the TOTAL, not the failure count.** Two of 39 mutations were invalid this way |
| My first abort test | Only listened for the `abort` EVENT, while `handleVision` does two awaits before it calls fetch — so the abort had already happened and the listener waited for an event in the past. It HUNG rather than failing | A real `fetch` checks `signal.aborted` first. Now the fake does too, and the abort is delivered mid-flight |
| `expect(optionsSrc).toContain('activationId')` | The review's finding, confirmed by re-running its mutation | Replaced by an import-line regex, two absence rules, and a check on the only `writePro` argument left |
| **My first `bearer empty→null` test** | Used `Authorization: 'Bearer '`, which LOOKS like the empty case. `Headers` strips trailing whitespace, so it arrives as `'Bearer'`, the `\s+` never matches, and BOTH implementations answer 401. **The test passed AND the mutation survived, with no connection between the two facts** | **A fixture that goes through any normalising layer is not the value you wrote.** Only `authorization: ''` distinguishes them; a four-line `node -e` probe settled it in seconds |
| A JS template literal in a `node -e` heredoc | Backticks inside backticks — **§5's backtick trap wearing a third costume**, after the CSS comment and the `?raw` slice. It struck twice more when a `\.` inside a regex literal was passed through shell quoting | Build the string from an array, use `String.raw`, or use the Edit tool |
| `grep -n 'held\.key'` | Did not match `held\.key` in the file, because shell `\.` is a literal dot and the file holds a real backslash inside a regex literal | The absence guard was there all along; the grep was the thing that was wrong |

---

## Decisions worth not re-deriving

- **`PINNED_MODEL` is a module constant, NOT a seventh required environment variable.** Six
  are already handed across by hand at launch and one that silently defaults is one more way
  to ship half-configured. The alias is `-latest` precisely so it does not retire.
- **It is deliberately NOT imported from `llmVision.GEMINI`.** That constant is the default
  for a user spending their OWN key against Google directly; this is what Buki pays for. They
  agree today and are allowed to diverge; coupling them would let a client edit change what
  the server buys.
- **`content-length` is an early-out, never the control.** The byte cap inside
  `rebuildVisionBody` is authoritative, and a test proves it holds when the header lies. Same
  shape as `ipCap.ts`'s note about `x-forwarded-for`: the safety must come from the code.
- **`BUKI_REVOKED_KEY_IDS` is unset by default**, like `BUKI_TRIAL_CLOSED`, so it adds nothing
  to launch day. Empty must revoke NOTHING — `''.split(',')` is `['']`, and a set holding the
  empty string revokes everything.
- **`proCap` is a THIRD near-duplicate day-counter, and that is a decision.** Clean bill #17
  blessed `ipCap`/`keyCap` *because each documents how and why it differs*. **If a fourth
  appears, extract a shared factory instead of writing the comment a fourth time.**
- **The image filter is applied on BOTH sides of the trust boundary.** `content.ts` runs
  inside a page Buki does not control. The CONTEXT-MENU flow is exempt on purpose: there the
  URL is Chrome's own `info.srcUrl`.
- **`standingOf` takes an object, not two adjacent numbers.** A caller that swaps `spent` and
  `attempts` would compile, typecheck, and quietly hand somebody three times the trial.
- **Both trial ceilings fold into ONE `trialLeft`.** Two counts read in two places is two
  places to disagree, and the disagreement reads as the wall saying "spent" while `planLabel`
  says "10 of 10 left" — a false statement made at the exact moment somebody decides to pay.
- **Do not re-litigate:** the declined grace tightening (see Belief 4), the model pin's
  constant-not-variable form, the three-counter duplication, `GRACE_MS` staying at 7 days.

---

## THE PATTERN, one level up from the review's

The review's finding was: **the correct rule is written down, in a comment, within twenty
lines of the code that breaks it.** It is right, and it names why — the reasoning is good
enough to be trusted, and trust is what stops anyone re-reading the code beneath it.

**What this session adds is that the same thing happens to a test the moment it is written.**
Two of the guards written today, by someone holding the entire design in their head, minutes
after articulating the exact failure mode they were meant to prevent, did not work. Not
because of carelessness — because a guard you just wrote is the one you are least able to see
through. You know what it *means*, which is precisely what stops you checking what it *does*.

**The countermeasure is not more care and not more review. It is that a guard is not finished
when it passes; it is finished when you have watched it fail.** Thirty-nine mutations cost
about twenty minutes across the session and found two inert fixes. Recorded in §5.

---

## The review's own mutation table, re-run

§3 is the review's strongest evidence: six mutations, **five of which survived a fully green
620-test suite.** Item 43 closed one. The other four were closed afterwards and the whole
table was then re-run, each mutation applied and reverted one at a time.

| Mutation | 2026-08-24 | 2026-08-25 |
| --- | --- | --- |
| `options.ts` activation reuse → `undefined` | 620/620 green | **6 tests fail** |
| `theme.ts` click handler deleted | 620/620 green | **2 tests fail** |
| `storage.ts` `shot` + `source` carry removed | 620/620 green | **2 tests fail** |
| `visionHandler.ts` bearer `empty→null` collapsed | 620/620 green | **1 test fails** |
| `visionHandler.ts` upstream headers relayed | 620/620 green | **2 tests fail** |
| `docs/index.html` launch-day find-and-replace | 620/620 green | **1 test fails** |
| `TRIAL_SPELLED` drift | caught | caught |

**Two of these were tests that verified a mock.** The provider-key guard mocked an upstream
with NO headers, so it proved the mock had none. The `host.test.ts` guard asserted link TEXT,
so it survived any href change — and its sibling assertion, "sends everybody to the SAME
place", passed MORE confidently after the bad replace, because now all eight agreed.

**The `index.html` guard was widened past what the review asked for.** It prescribed the
three GitHub links; the same find-and-replace would also catch the two Polar checkout URLs,
and a replace that caught THOSE sends every purchase to a 404 on launch day. Both sets are
now counted and asserted.

## What was NOT done, and why

- **Item 26, the Gemini spend cap.** Maximo's, a dashboard. It is now the FLOOR rather than a
  second ceiling: items 38 and 40 bound what one caller can buy, and the provider cap is the
  only thing that bounds the aggregate. `launch.md` step 4.5 is half clear.
- **Item 44's four contract findings (AC-3, AC-4, AC-7, AC-8).** Filed with their deadline.
  Half of AC-4 landed because item 40 made it load-bearing.
- **Every P1 and P2 in the review outside the six P0s.** Untouched, and the review is still
  the record for all of them.
- **Nothing was pushed.** `main` is ahead of `origin/main` by this session's commits.
