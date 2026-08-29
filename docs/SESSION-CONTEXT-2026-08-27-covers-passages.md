# SESSION CONTEXT — the covers + passages lane (2026-08-27 → 08-28)

Companion to `SESSION-TODO-2026-08-27-covers-passages.md`. **That file owns WHAT. This one owns
WHY** — what was measured, with which probe, which beliefs it overturned, and which instruments
returned a confident wrong answer.

> **The instruments list at the bottom is the most valuable thing in this file**, because the
> next session inherits the instruments, not the findings.

---

## What was asked

1. Re-read the three Flows and two named design skills (`frontend-design`, `emil-design-eng`).
2. Carry the review lane's 43-row table forward. **Not superseded.**
3. *"remember: when we find no cover book, we use the original image."*
4. *"lets see if we cant solve the 'find any book from phrase, passage, page etc'"*
5. Then, three times: **`go`** — which became items 51, 52 and 53.

---

## Measurements, each with its probe

| # | Measurement | Probe | When |
|---|---|---|---|
| M1 | Opened at **1,019 tests / 76 files** | `./node_modules/.bin/vitest run` | session open |
| M2 | Closed at **1,160 tests / 88 files**, tsc 0, build 0, sweep 0 | same; **exit codes read UNPIPED** | 08-28 |
| M3 | **21 commits**, `0c554ae..9acfc16`, 0 unpushed | `git rev-list --count 0c554ae..HEAD` | 08-28 |
| M4 | **15 open items**, LANE ≡ BODY | `grep -c '^- \[ \] \*\*[0-9]' OPENWORK.md` + the two-list diff | 08-28 |
| M5 | **26 mutation plans, 231 mutations** in the repo; **126 added this lane** across 12 plans | counted from `tools/mutations/*.json`, **not recalled** | 08-28 |
| M6 | `OPENWORK.md` **3,194 lines / 255,333 chars**; §5 begins at **2380**, §6 at **3161** | `wc -l -c`, `grep -n '^## [56]\.'` | 08-28 |
| M7 | **Field filters on `search/inside` are dead.** `AND meta_mediatype:texts` — true of EVERY document — returns `total=0` | `tools/probe/passage-grounding.mjs` step A | B1 |
| M8 | **Bare boolean scoping works.** 2,228 hits → **227, book at rank 1** | same, step A | B1 |
| M9 | **The count is not the check.** `AND Hemingway` → **115 hits**, top *"Book girl's guide to cocktails"* | same, step B | B1 |
| M10 | **Title-matching discriminates 5/5** (ranks 1, 6, 3, 1, 1); wrong author finds none | same, step B | B1 |
| M11 | **Wrong-book-right-author refused 7 of 8**; the 8th an omnibus at rank 8 vs the right answer at rank 1 | same, step C | B1 |
| M12 | ⛔ **Coverage is the ceiling.** 4 modern in-copyright novels, **0 found**; two returned **zero hits** | same, step D | B1 |
| M13 | Passage latency **982–9,983ms** over 19 queries, against a 6,000ms `TIMEOUT_MS` | same, step E | B1 |
| M14 | **TS-7's wave is ELEVEN** — 5 production, 6 test fixtures | flag on, `tsc --noEmit \| grep -c 'error TS'` | H3 |
| M15 | **TS-7 catches the `activationId` shape:** 1 error with the flag on, **0 with it off** | a probe file compiled twice, then removed | H3 |
| M16 | **TS-3/TS-4 fire:** a 9th variant with no reply and no branch → **exactly 2 errors** | a probe variant added, compiled, removed | H6 |
| M17 | `toVisionConfig` called **zero** times against an import on line 14 | `grep -c 'toVisionConfig(' src/extension/background.ts` | H4 |
| M18 | `content.ts`'s stylesheet has **110 `buki-` references** and serves TWO surfaces | `grep -c 'buki-' src/extension/content.ts` | H2 |

**On M7–M13's population:** five public-domain classics with famous opening lines, four modern
in-copyright novels, one deliberately generic sentence. **Not a random sample of what people
post** — chosen to make the mechanism visible. **The coverage figure is a floor-finding, not a
rate:** it shows the corpus excludes contemporary fiction, not what fraction of real catches
would fail.

⚠ **M6 is the standing problem getting WORSE.** §5 began at 2163 when this lane opened and
begins at **2380** now. The Read tool takes 2,000 lines by default, so **the entire case ledger
— every trap that has already cost this project time — is unreachable in one call, and the gap
grew by 217 lines this lane.** Founder decision F6 / review-lane task 23.

---

## Beliefs held, and what the probe did to them

### B1 — "the cover fallback needs building"
**Measured:** the READ path already implemented it. **Overturned to:** the rule was broken at
the WRITE. **A storage question wearing a rendering question's clothes.**

### B2 — "C-9 argues against the founder's rule"
**Measured, by reading what C-9 actually claimed:** its harm was the photograph BEATING art,
fixed independently on 08-16. **Overturned to:** C-9 is **two rules wearing one condition**, and
only one of them still has a live premise.

### B3 — "the passage feature has no floor" (the spec's own conclusion, that morning)
**Measured:** it has one. Not by field — by bare boolean term. **Overturned to:** the
engineering question is answered and **the blocker moved to coverage**, which is a positioning
decision. Item 57 changed OWNER from agent to Maximo without closing.

### B4 — "titles are often absent and authors always are"
**Measured:** every hit carries `meta_title`, `meta_creator`, `identifier`, `page_num`. **And
that payload turned out to be the entire answer.** The correction cost one query:
`Object.keys(hit.fields)`.

### B5 — "TS-7 will be a wave of errors, and that wave IS the finding"
**Measured: ELEVEN**, five in production and one of those in a function nothing called.
**Overturned to:** the conditional-spread discipline had already absorbed the rest. **The review
was wrong in the good direction**, and that is worth recording as loudly as a miss.

### B6 — "the shadow root is TM-9's fix"
**Measured:** the stylesheet has 110 `buki-` references and serves the tray AND the Save button
injected into X's own article DOM, which a shadow root cannot contain. **Overturned to:** the
named leak is closed by a WeakMap-shaped fix; the shadow root is a separate item (61) whose
failure mode is visual and unverifiable from node.

### B7 — "`as unknown as` in four fixtures is a workaround"
**Overturned to:** it is the FINDING. Those fixtures test the present-but-undefined shape
deliberately, because **`exactOptionalPropertyTypes` stops TypeScript SOURCE producing it and
does nothing about the same shape arriving from `JSON.parse` or `chrome.storage.local`.**
Deleting them would have removed the runtime guard's only test while making the codebase look
safer.

---

## ⭐ Instruments that lied — the full list, sixteen

**This list is worth more than the findings.** Numbers 11 and 16 are the two that matter most.

1. **`edition_key:` returning 0** — read as *"scoping is unsupported"*. It was a **wrong field
   name**, indistinguishable from an unsupported filter on one query. **Remedy, now step A of
   the probe:** watch a filter that MUST match everything before believing one that failed.
2. **`AND <wrong author>` returning `total > 0`** — measured term co-occurrence, not book
   identity. Hemingway is a cocktail. **The real check was one field deeper.**
3. **"5 of 5 discriminate" read as "5 of 5 found the book"** — three matched a companion, essays
   and a parody. The headline was right and the obvious reading of it was wrong.
4. **A green suite on the `pictures > 1` half of C-9** — 1,019 passing tests included **no test
   that passed a real image with `pictures > 1`**. A test that passes for the wrong reason is
   indistinguishable from coverage until something mutates it.
5. **`size=100` on the OpenLibrary endpoint** — silently ignored; 20 hits returned regardless.
6. **`node tools/control-bytes.mjs | tail`, twice in one session** — the pipe reports `tail`'s
   exit status, so a tool that `process.exit(1)`s without doing its job looked clean. **Same
   mechanism as `tsc --noEmit | head`, which was ALREADY in §5**, hit again by a reader who knew
   about it. §5 T20.
7. ⭐ **A COMMENT IN THE SOURCE, VOUCHING FOR THE HOLE BENEATH IT — twice, two files.**
   `ipCap.ts` argued at length that it needed no eviction (IPv4 reasoning beside an IPv6 edge).
   `PolarValidation`'s docblock described AC-10's exact 403-to-a-live-subscriber failure — as a
   reason to be *careful*, not a reason to *check*. **The most expensive kind: it suppresses
   inspection rather than returning a wrong number.**
8. **A `?raw` guard satisfied by an IMPORT line** — stripping comments was not enough; the
   import named the constant, so a shell calling `createIpCap()` bare passed. **A mention is not
   a use.**
9. **My own new test matching the pattern it was written to replace** —
   `source.includes('api')` finds `vercel.json`'s `/((?!api/).*)`, which mentions `api` to
   EXCLUDE it. It would have passed against the unfixed config.
10. ⭐ **A MUTATION THAT READ A CLOCK** — `Math.round(performance.now())` reported **CAUGHT when
    redirected and SURVIVED when piped**, same plan, seconds apart. **The harness was honest and
    the MUTATION was the lie.** Found only because the plan happened to run twice and the totals
    disagreed. §5 T22.
11. ⭐ **MY OWN MEMORY, TWICE IN ONE HOUR, ON WORK MINUTES OLD.** The mutation total written as
    **74** (`ls` says **81**); the R-6 commit hash written as **`da01ad9`**, which **does not
    exist in this repository** (`9fe7165`). Neither would have failed a test, a build or a
    review. **They would simply have been inherited.**
12. **`.rejects.toThrow()` passing on the wrong error** — loosening AC-6's guard let
    `content: 42` reach `parseGuesses`, which throws a `TypeError` of its own. **"It threw" and
    "it threw for the right reason" are different assertions.**
13. **A mutation that could not fail, because `JSON.stringify` answered for it** — `Infinity`
    cannot cross the wire, so the guard it removed was unreachable there, while the SECOND COPY
    of the rule against structured-clone storage needed it. **Two copies, not equally
    exercised.** Answered by exporting one and importing it.
14. **A guarded scripted edit printing `MISS` while the shell committed anyway** — the TS-7
    strike silently missed on a lowercase/uppercase difference (`wave IS` vs `wave is`), and the
    commit that claimed it went out. **Read the guard's OUTPUT before the commit, not after.**
15. **A mutation plan's own TARGET LIST** — `recognitionLog.test.ts` was missing from it, so the
    test that would have caught the mutation was **never run**, and the result was reported as
    SURVIVED. Indistinguishable from a hole in the code until the list was read.
16. ⭐ **A MUTATION THAT COULD NOT FAIL BECAUSE THE HARNESS IS THE WRONG INSTRUMENT.** Two
    mutations weakening a TYPE-level completeness proof survived: `MESSAGE_CONTRACT_COMPLETE` is
    `true` at runtime whatever its declared type says, and the harness runs `vitest`. **A limit
    of the instrument, not a hole in the code**, and recorded as one — with the real
    verification being a `tsc` probe watched failing, and a source guard to catch DELETION.

---

## The pattern across items 51, 52 and 53

**Five of the sixteen findings were guarded by a comment, a test, or a type that pointed the
wrong way.** Not absent — present, and wrong:

| The thing that looked like a guard | What it actually was |
|---|---|
| `ipCap`'s eviction paragraph | IPv4 reasoning beside an IPv6 edge |
| `PolarValidation`'s docblock | A description of the bug, written as a reason to be careful |
| `"NEVER lets the provider key reach the client"` | A mock whose body did not contain the key |
| `toBe(request.signal)` | A cheap stand-in for "the caller can abort it" |
| `Array.isArray(raw) ? (raw as SavedBook[]) : []` | A type assertion doing no work at runtime |

**The generalisation, and it is the lesson of this lane:** a guard is only evidence if you have
watched it FAIL. Everything above passed, every day, while the thing it named was broken.

---

## Existing tests that went red, and were right to

Six, across the lane. **None was wrong** — each had encoded a cheap proxy for its own rule:

| Test | Stood in for | Now asserts |
|---|---|---|
| `toBe(request.signal)` | "the caller can abort it" | aborting the caller aborts what the provider got |
| relay headers `toEqual(['content-type'])` | "no upstream header crosses back" | the exact set this file writes |
| `fakeModel(null)` → `{}` | "the reply is not what this test is about" | a well-formed reply that found nothing |
| four `licenseHandler` shape tests | Polar's answer is what we cast it to | the shape is checked; a bad one is 502 |
| `shotFor(SHOT, 5, 1)` undefined | C-9, both halves | the half whose premise survived |
| four TS-7 fixtures | `Book` with undefined fields | the same, cast, because runtime still produces it |

**A cheap proxy for a rule breaks the moment the implementation grows a second reason to do the
thing.** That is not brittleness; it is the test having asserted something narrower than the
rule it was protecting.
