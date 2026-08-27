# Session context — 2026-08-27, review lane

**Pair:** `docs/SESSION-TODO-2026-08-27-review-lane.md`.
**Second pair sharing this date.** The earlier one is `...-2026-08-27-launch-prep`; it owns
store copy, manual-add, the 429, the passage probe and the OPENWORK reconcile. This pair
owns **THE LANE's agent queue, items 45-55** — the findings carried out of
`docs/REVIEW-2026-08-24-prelaunch.md`.

---

## What was asked

> "read my entire project ... we WILL FOLLOW THEM! we must finish our lane ... business,
> backend, features, efficiency and optimization, design ... check the review findings we
> got and carried and fix them. get as much context first"

Read as: work THE LANE top-to-bottom on the agent side, with the business axis named
(pre-launch, zero users, store copy irreversible after submission) and the design axis named
(Apple restraint + German precision + Teenage Engineering + the iOS turn already in
`docs/brand.md`).

**Standing constraint from `CLAUDE.md`:** do not dispatch subagents unless the founder asks.
Not asked; none dispatched.

**Routing decision worth recording.** The superpowers Flow routes a new feature to
`brainstorming`. TM-11 is a new feature. It was **deliberately skipped**, because both
`CLAUDE.md` and the 08-27 handoff say in as many words: *"Do not use `document-generate` or a
brainstorming skill for the lane. The plan exists; it is THE LANE."* User instructions
outrank flow routing. Skipped on purpose, not by omission.

---

## What was MEASURED, with the probe beside it

| # | Measurement | Probe | Population / unit |
|---|---|---|---|
| 1 | **949 tests / 76 files** at close | `./node_modules/.bin/vitest run` | whole suite. Opened at **860/72**, not the 856/71 both the header and the handoff carried |
| 2 | The inherited test count was stale by **4 tests / 1 file** before this session touched anything | `git log --since="2026-08-27 08:20" --name-only` | `5461211` added `agentRules.test.ts` **after** the 08:29 handoff was written |
| 3 | A blunt *"every `$N` must be declared"* rule over the shipped docs is **red on arrival in 12 files, ~40 figures** | `zzz-price-scan.mjs` over 223 files | every one of the 40 is a COST, not a price: `$0.00011` a catch, the `$5` cap, `$3.46`, `$2.50/M`, `$1.20 per 1M events` |
| 4 | **36 per-period price claims** exist across the repo | same scan, `CLAIM` regex | the only non-Buki ones are a rival's in `competitor-profiles/` and **Polar's `$2/month payout fee`** inside `docs/superpowers/` |
| 5 | The store host-permissions paste block moved **953 → 970 → 883** characters | `zzz-count-block.mjs`, then `storeCopy.test.ts` | LF count; CRLF is 895. Limit 1000. The 970 was an intermediate I rejected for leaving only 20 characters of room |
| 6 | The content script makes **zero** fetches | `grep -n 'fetch(' src/extension/content.ts src/extension/theme.ts` | this is what made TM-14 safe. Every fetch is in the worker or the options page |
| 7 | `executeScript` has **one** call site | `grep -rn 'executeScript' src/` | `background.ts:428`, reached from the context-menu handler, which has `activeTab` from the gesture |
| 8 | **56 mutations run, 56 caught** across five commits | `zzz-mutate.mjs` × 8 plans | 7 + 2 (item 45) + 7 (TM-8) + 8 (TM-14/store copy) + 11 (TM-11) + 9 + 7 + 5 (item 47) |
| 9 | **FOUR mutations survived first pass**, every one a real hole in a test written minutes earlier | see "instruments" below | 45d, 47d, 47o, 47p |

---

## Beliefs overturned

1. **"The price is spelled in three places."** It is two. `docs/store/launch.md` does not
   state the price: its only `$29` is *"subscriber pays $29, gets nothing to paste"*, prose
   about a failure mode. Probe: measurement 3 above.

2. **"Widen the glob to the three files `host.test.ts` already covers. Same shape, same
   mechanism, one line."** Red on arrival across 12 files. The reflex response is an
   allowlist, and an allowlist holding `4.99` waves through a store listing reading *"Buki
   Pro is $4.99 a month"*. **The one-line fix destroys the guard it was meant to extend.**

3. **"TM-11: host grants accumulate and are never revoked" is one of four false claims.**
   It is not a false claim at all. `permissions.md`'s *"never holds access to a site the user
   has not right-clicked an image on"* is TRUE. TM-11 was a **missing feature**, which is a
   different kind of work and a different commit.

4. **"TM-8 is the CSV title field."** It is the title, the author, **and the ISBN**.
   `isbnCell` deliberately emits `="9781449373320"`, which IS a formula, so a quote in that
   position breaks out: `="x"&cmd|'/c calc'!A0&""`. The page cannot reach it, but
   **openlibrary.org is a wiki anyone may edit** and `openLibrary.ts:44` casts `doc.isbn[0]`
   straight out of its JSON. Not in the review.

5. **"Prefix any cell starting with `=`" is the fix for TM-8.** It breaks the ISBN silently,
   and a missing ISBN is exactly the duplicate-on-reimport failure `isbnCell` exists to
   prevent. Two of the seven mutations are that half-fix and its sibling.

6. **"The apostrophe is free."** It is not: the primary path for the export is UPLOAD to
   Goodreads, not Excel, and those importers read bytes rather than evaluating them. So the
   escape fires only when the value actually begins with a trigger. A real title opening with
   `-` pays a leading apostrophe on import; that is the price of not executing the other kind.

7. **"`docs/` is the public site root, so `.vercelignore` defines what a customer reads."**
   It does not, for this purpose: `docs/store` IS vercel-ignored, and `listing.md` is the
   most customer-facing price surface there is. A derived population looked elegant and was
   wrong.

---

## Instruments that returned a confident wrong answer

**This list matters more than the findings, because the next session inherits the
instruments.** SEVEN this session — see the table at the end for what they share — and six of
them were mine, written minutes earlier.

1. **A vacuous-pass guard that asked whether a FILE mentions a price.** Mutation 45d deleted
   the price sentence from `docs/store/listing.md` and the suite stayed green: the file
   states the price twice, and **line 23's editorial note QUOTING that copy satisfied the
   guard**. Commentary about the copy standing in for the copy — the `?raw` failure of §5,
   one level up. The guard now reads the *Detailed description* section, and renaming that
   heading fails loudly. **Caught only because the mutation existed.**

2. **An absence proof that counted its own docblocks as call sites.** *"There is no second
   way to remove a permission"* scanned raw source for `permissions.remove` and found five
   hits — four of them JSDoc paragraphs explaining why there is exactly one call. Same
   failure as 1, in the other direction. Fixed by stripping comments before scanning, which
   is what `DOM` at the top of `optionsPage.test.ts` has always done for HTML and nobody
   carried across to TypeScript. **Mutation TM11c now proves the discrimination in both
   directions at once**: comment out the real call, leave the four mentions, guard goes red.

3. **The mutation harness silently ran the wrong target and gave the right answer.**
   `zzz-mutate.mjs` took `target` as one argv element, so two space-separated paths became
   one filter. The patch to split them was written **through the shell**, the backslash in
   `/\s+/` was eaten, and `split(/s+/)` produced fragments — `"rc/"`, `"hared/manife"` —
   which matched every path as substring filters. **The harness reported it was testing two
   files while running the whole 889-test suite.** It reported 8/8 caught, which was true,
   and true for a reason it did not state. Caught by reading the file the tool-result note
   printed back.

   ⚠ **This is the backtick/backslash trap, hit for the sixth session running, with the
   remedy already in memory: use the Write tool, not the shell.** It was fixed with the Edit
   tool. The lesson is not "record it again" — it is recorded. The lesson is that a shell
   edit to a *measuring instrument* is the worst place to take that risk, because the
   instrument's output is what you would use to notice.

---

## What the harness now encodes

`zzz-mutate.mjs` (gitignored, reusable for items 47-55) carries every §5 lesson that made a
previous harness lie, as a rule rather than a comment:

| Rule | What it prevents |
|---|---|
| Strip the **ESC byte**, `/\x1b\[[0-9;]*m/g` | `/\[[0-9;]*m/` leaves `\x1b`, `\s` does not match it, and every mutation reports SURVIVED against a harness that read nothing |
| Compare the **TOTAL**, not the failure count | a mutation that does not compile makes the file fail to LOAD, so vitest reports a smaller all-green total, which reads as "survived" and is exactly backwards |
| **ABORT** when a total cannot be parsed | scoring it zero is how a harness that read nothing reports a clean sweep. **This fired for real** on the bad target and refused to score |
| **ABORT** when a `from` pattern is not found | a silent no-op mutation reports SURVIVED against an unchanged file |
| Build the command from `process.execPath` | `execSync` from node runs under cmd.exe, which cannot resolve `node` because the inherited PATH is Unix-form |

---

## Item 47: three more overturned beliefs, and four more instruments

**8. "ADV-6's fix is `book: previous ? {...previous.book, ...book} : book`."** Wrong for the
common case. A spread keeps a previous value only when the incoming KEY IS ABSENT, and this
repo emits both shapes: `recognizer.ts:94` gives `{title, author}` with keys absent, while
`openLibrary.toBook` ALWAYS writes `isbn` and `coverUrl` even when undefined. OpenLibrary
records are patchy, so a sparse-but-matching doc is ordinary — and the spread then wipes the
cover exactly as if nothing had been guarded. **Second time this session a prescribed fix has
been wrong; the first was item 45's.** Mutation 47b applies it verbatim and is caught.

**9. "C-5 is fixed by making the identity key subtitle-aware."** It cannot be. The correct
rule is NOT TRANSITIVE — "Sapiens" matches both "Sapiens: A Brief History" and "Sapiens: An
Illustrated History" while those two do not match each other — and `content.ts:721` and
`manualAdd.ts:67` both build a `Map` from `identityOf`, which needs an equivalence relation.
So the fix had to split the two resolutions rather than sharpen one, and the residual
imprecision is named in the docblock instead of hidden.

**10. "ADV-7 is a bug."** It is a design decision. The two flows key differently on purpose:
`background.ts:499` sends `imageUrls: [info.srcUrl]` — *read THIS cover* — while
`content.ts:1486` scrapes the whole post. Folding them changes what the model is asked. Filed
as item 58, Maximo's, with the three options and what each costs.

### Instruments, continued

**4. A merge test that never reached the merge.** Two assertions called
`mergeBook(undefined, incoming)`, and `mergeBook` returns `incoming` on its first line when
there is no previous record. So a mutation emitting `isbn: undefined, coverUrl: undefined`
from the merged object **SURVIVED**: the tests written to check that object were exercising
the branch that never builds it. **A test for a merge has to exercise the merge**, and the
same applied one level up in `storage.test.ts`, where a single `add()` has no previous either.

**5. A field the compiler protected and nothing else did.** `Card.pictures` was added, threaded
through `content.ts`, and made every state transition red until each named it — which felt like
proof. Two mutations survived: defaulting the count to 1 with no picture, and dropping it on a
state change. **`tsc` proves a field is CARRIED, never that it is carried CORRECTLY.**

**6. `tsc --noEmit | head` reports head's exit code.** Printed `TSC=0` under ten real errors.
Small, and the same family as the harness above: the thing read to decide was not measuring the
thing it was believed to measure. Run the checker unpiped, or capture its status before the pipe.

**7. A heredoc wrote to `/tmp` and node read `E:\tmp`, and the COMMIT MESSAGE ran ahead of the
file.** The append that was supposed to add this very section failed with `ENOENT`, `git add` on
the unchanged file reported nothing, `git status --porcelain` came back clean, and the commit
landed asserting *"the session CONTEXT pair gains three more instruments"* when it gained
nothing. Recorded here rather than amended away, because in a repo whose commit messages carry
their own reasoning, **a message that describes work not in its own diff is the same class of
lie as a stale doc** — and nothing in the chain complained. `git show --stat` is the probe;
use the session scratchpad directory, never `/tmp`, since Git Bash and node resolve it
differently on this box.

---

## The pattern across all seven instruments

Every one measured something ADJACENT to what it claimed, and every one was green:

| Instrument | Claimed | Actually measured |
|---|---|---|
| the price guard's vacuous-pass check | the shipped copy states a price | the FILE mentions one, including an editorial note quoting it |
| the `permissions.remove` absence proof | one call site | one call site plus four docblocks about it |
| the mutation harness's target | two files | all 889 tests, via fragments that matched every path |
| the mergeBook keys test | the merged object | the early-return branch that never builds it |
| `tsc` on `Card.pictures` | the field is correct | the field is present |
| `tsc --noEmit \| head` | tsc's exit status | head's |
| the CONTEXT append | the file changed | that a command had been typed |

**A red test is a gift. These are the other kind, and there were seven of them in one session.**
