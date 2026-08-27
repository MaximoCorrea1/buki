# Session context — 2026-08-26 to 08-27, launch prep

> **Not served publicly:** `docs/SESSION-*` is in `.vercelignore`.
>
> The ledger is `docs/SESSION-TODO-2026-08-27-launch-prep.md`. **This file owns the
> REASONING**: what was believed, what was measured, which probe measured it, and which
> instruments returned a confident wrong answer.

**Continues** `docs/SESSION-CONTEXT-2026-08-25-p0-fixes.md`. That session closed the six
pre-launch P0s and filed the rest of the 08-24 review as items 45-56. This one is store
copy, one feature, three bugs and a probe.

---

## What was asked

| | Maximo's words | What it became |
|---|---|---|
| 1 | *"idk if i like the ctas"* on the store frames | A polish pass, then a full rewrite when he said the polish was the wrong move |
| 2 | *"instead of repolish the currents text, change the approach... these screenshots need to convert, sell, be fun"* | Five frames as one story |
| 3 | *"we need to add more ai keywords to our descriptions, since we use ai actually"* | AI as fact, never as claim, plus the rule written down so it survives |
| 4 | *"lets add the feature to manually search and add a book"*, then **B** | Spec → review → plan → build |
| 5 | *"try to be very optimized on they keywords and discovery"* | Store summary rewritten, landing title/description/FAQ, `storeCopy.test.ts` |
| 6 | A pasted service-worker log | The 429, the cover lag, and the tray head |
| 7 | *"HUGE IDEA: FIND ANY BOOK FROM A PASSAGE"* | Probed. The obvious design is dead |

---

## Beliefs this session OVERTURNED

**Each of these was written down somewhere and believed. The probe is beside it.**

### B1. "OpenLibrary has no hard rate quota"

`openLibrary.ts` said, in its own docblock: *"Free, no API key, and no hard rate quota
(unlike keyless Google Books, which 429s)."*

**Measured false 2026-08-27** by the service-worker log Maximo pasted: `HTTP 429`, then
sixteen consecutive `did not answer within 6s`. There is no PUBLISHED quota, which is not the
same as no quota. **That sentence is very likely why an unbounded `Promise.all` over twenty
guesses looked safe to write.** Struck rather than deleted: the wrong belief explains the code
above it.

### B2. "A manual add needs a `manual` provenance value"

The first draft of the manual-add spec said `PROVENANCE` would gain `manual: 'added by hand'`.

**Wrong, found by grep before any code:** `PROVENANCE` is read at `content.ts:1141` and
NOWHERE else, on the catch tray's `Card`, at the moment of the catch. **It is never
persisted.** `SavedBook.source` is `{url, kind}` - a URL, not a label - and the detail sheet
renders it as *the post that sold you*. A hand-added book simply has no source, which is
already a legal state the sheet handles. **The feature got smaller because the spec was
checked against the code rather than against itself.**

### B3. "The `+` goes in the masthead, because that is the only chrome that survives an empty shelf"

The first half is true - `paint()` calls `renderEmpty()` and returns before the search row
exists. **The second half does not follow, and `popup.html` had already said so:**

> *"Settings is already pinned right, out of the flow, so the mark and the count stay on the
> page's axis. A second control pinned to the SAME corner would crowd it and push the axis
> around... One at each corner instead."*

Three slots, one per corner, both corners taken. **What shipped: the `+` renders twice from
one factory** - the search row's trailing edge, and the empty state. Between them it is present
in every state, which is what placement `B` actually required. **`B` asked for a permanent
control, not a control in a particular element**, and those looked identical only while the
header seemed free.

### B4. "Full-text search will ground a passage"

Told to Maximo on 08-27 as *"the path exists"*. **It exists and it is bad**, and the probe is
the only reason that was caught before a spec was written:

| Query | Result |
| --- | --- |
| *"It is a truth universally acknowledged..."* | 200, 4850ms, 2,228 hits. **Pride and Prejudice is NOT in the top three.** A KS3 revision guide is |
| An Ecclesiastes passage | 200, 4194ms. Thematically adjacent, not the source |
| A generic sentence | 200, 5025ms, 102 hits, all noise |

Anthologies, textbooks, criticism and quotation collections all contain a passage and compete
with the source on equal footing. **The obvious design would put a revision guide on the shelf
and call it Jane Austen.** See item 57 for the inverted design that might live.

### B5. "The covers need a fallback"

Maximo's read of the symptom, and reasonable. **The fallback already exists and had already
fired**: the drawn cloth is a designed state, and *"A book with no cover art still gets a
cover"* is an H2 on the landing. For a single book, the original photo is already kept as
`shot`; `storage.ts:26` deliberately refuses it for a multi-book catch, because a photo of
five books is not a cover for any of them. **Nothing about the fallback was wrong. The
catalogue had been rate-limited into silence by our own burst.**

### B6. "The affiliate step is parallel"

`launch.md` said step 8 had no blockers, and had said so since it was written. **Amazon
Associates wants the URL of the property the links sit on, and the store URL does not exist
until step 11 publishes the draft.** The dependency was inverted: Amazon is blocked BY launch.
Still not a launch blocker - the tags ship empty and the links work.

### B7. My own ceiling test pinned nothing

`expect(peak).toBeLessThanOrEqual(GROUND_AT_ONCE)` reads like a ceiling. **Raise
`GROUND_AT_ONCE` to 20 and it becomes `19 <= 20`, green, with the 429 fully restored.** Found
only by mutating the constant. Reading the test does not show it, because it reads correctly.

---

### B8. "The traps are written down, so they are known"

Five repeat hits on `heredoc`, `backtick`, `npx` and `0x08` in one session, by an agent
that had read `OPENWORK.md`. The obvious read is carelessness. **The measured one is that
they were unreachable.**

```
§5 spans OPENWORK.md lines 1900-2511.   The Read tool takes 2000 by default.
heredoc  BELOW the cut     backtick  BELOW the cut
npx      BELOW the cut     0x08      BELOW the cut
ESC byte ABOVE (written the same day, at the top of the section)
```

**Only the entry added that morning was readable.** So `CLAUDE.md` was written - Buki had
none at all - and it SPELLS the shell traps out rather than pointing at §5.
`src/shared/agentRules.test.ts` holds it to that. **A rule nobody can read is not a rule**,
and "write it down" had been the fix three times without working.

---

## Instruments that returned a CONFIDENT WRONG ANSWER

**This list is worth more than the findings**, because the next session inherits the
instruments and not the conclusions.

### I1. The mutation harness reported SURVIVED for every mutation, twice, against working guards

**Root cause: the ANSI strip left the ESC byte.** `out.replace(/\[[0-9;]*m/g, '')` removes
`[32m` and leaves `\x1b`, so `/Tests\s+(\d+)/` never matches - `\s` does not match ESC - and
both counts parse as zero. **A total of zero scores as "survived".**

It cost five round trips and **two wrong hypotheses** (`maxBuffer`, then a stray network call)
before the raw bytes were printed. The fix is `/\x1b\[[0-9;]*m/g`, and the harness now ABORTS
when it cannot parse a total rather than scoring it zero. **Three occurrences this session.**

### I2. `execSync` from a node script silently runs under cmd.exe

It cannot resolve `./node_modules/.bin/vitest`, or even the bare word `node`, because the
inherited PATH is Unix-form. The error comes back in Spanish and the captured output is ~100
bytes. **A harness parsing that reads nothing and scores everything green.** Build the command
from `process.execPath`.

### I3. A `?raw` presence guard satisfied by its own explanatory comment

`expect(storeShots).toContain('ten catches free')` passed with the phrase **deleted from the
frame**, because the comment above it saying *"pricing.test.ts holds 'Ten catches free' to
TRIAL_CATCHES"* satisfied the check. Now asserts over extracted `head:`/`sub:` literals.

### I4. `grep -c` on open items said 20 while the truth was 19

The LANE rows for items 1 and 26 were struck the moment they closed; their Part 2 checkboxes
were not. **The file disagreed with itself for half a day** and the header carried the stale
half. Item 57 had a LANE row and no body at all. **The probe is now in §5 as T9: the number
SET from the LANE must equal the set from the bodies.**

### I5. A presence check satisfied by a MENTION rather than by the rule

`CLAUDE.md`'s first guard looked for the words `npx` and `backtick` anywhere in the file.
**Deleting both actual rules left it green**, because both words also appear in the
size-budget note at the top that LISTS which traps fall below the cut. Now asserted on the
REMEDY (`process.execPath`, `node <file>.mjs`, `String.raw`) and scoped to the shell
section. **Same shape as the `?raw` guard satisfied by its own comment - a mention is not
an instruction.**

### I6. A test fixture smaller than the bound it guards

`mapPool`'s completeness tests used two and three items against a pool of four, so a mutation
that stopped after the first batch survived. And "one failure must not strand the rest" passed
either way at two failures, because surviving workers drain the cursor - **only failing
exactly `COVERS_AT_ONCE` distinguishes the implementations.** Two attempts to state.

---

## Decisions taken, with who took them

| Decision | Taken by | Reasoning kept in |
|---|---|---|
| A manual add is **free and unlimited** | Maximo | It never calls the vision model. `TRIAL_CATCHES` untouched; *catch* stays the paid unit |
| Placement **B**, a permanent control | Maximo | Then corrected in execution: see B3 |
| `addedBy?: 'hand'` **cut** | agent, at spec review | Provenance exists so a reader can adjudicate BUKI'S GUESS. A typed title has no guess in it |
| `AI` allowed as fact, `AI-powered` still banned | agent, on Maximo's instruction | The delete-the-word test, in `.agents/product-marketing.md` |
| The tray keeps its provenance line, **demoted not deleted** | agent | It answers *"will it get a book wrong"* and the store description has a section built on it |
| Gemini free key: **no** | agent | `privacy.html` says the picture is *"not stored"* - a claim about OUR server. Free-tier training terms would make that materially incomplete |
| Passage feature: **after launch** | agent | The obvious design is dead and the replacement has an unprobed floor |
| `GROUND_AT_ONCE = 4` | agent | Manners, not throughput. 19 books finish in ~2s vs ~7.5s sequential, and never present as a burst |

---

## What the next session must not re-derive

1. **The chain starts at the draft upload (item 37).** Items 1, 2 and 3 of `launch.md` are
   done. Everything else is blocked behind getting the real extension id.
2. **Every capture is 1x.** The copy and the staging are finished; only the resolution is
   wrong, and it cannot be fixed after the fact.
3. **Nothing security-shaped is open.** Items 45-57 are correctness, honesty, performance and
   hygiene.
4. ~~**The push has been blocked for two days.** 28 commits.~~ **PUSHED 2026-08-27**, `60b98e4`, 29 commits, `origin/main..HEAD` = 0. It had been refused since 08-25 and went through on this attempt with nothing changed.
5. **Run the T9 probe before trusting the open-item count.** It was wrong within the last day.
