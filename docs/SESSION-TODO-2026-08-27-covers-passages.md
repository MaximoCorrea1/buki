# SESSION TODO — the covers + passages lane (opened 2026-08-27, ran into 08-28)

**Second lane on 08-27.** The first is `SESSION-TODO-2026-08-27-review-lane.md` (items 45-50).
**That pair is NOT superseded** — its rows for item 50's remainder and Maximo's launch chain are
still open and still owned. This file owns everything from the message that opened this lane
onwards, and it ran across two days.

> **Why a second pair rather than appending.** The review lane's ledger is the record of items
> 45-50. This lane began as FEATURE work the founder named directly and became the agent lane
> for items 51, 52 and 53. The 08-27 handoff said it out loud: *"If the next session is meant to
> be a business or design session it should say so."* It said so, then went further.

---

## TASKS

`[x]` done+verified · `[~]` in progress · `[ ]` open · `[?]` founder decision · `[!]` blocked

### A. The founder's two named rules

| # | task | state | owner | note |
|---|---|---|---|---|
| **A1** | **No cover art → show the original image** | **[x]** | agent | `cae4ad1` · `shotFor`: `books === 1` → `books >= 1` · 7/7 mutations |
| **A2** | **Several artless books from one photo now share a tile** | **[?]** | **Maximo** | **Item 60.** Opened deliberately by A1's own commit. 3 options costed; doing nothing is one of them |
| **B1** | **Passages: the ONE probe the spec said would decide it** | **[x]** | agent | `bd2fa38` · scoping WORKS, by bare boolean term, not by field |
| **B2** | Design the inverted flow (model proposes, full text CHECKS) | **[x]** | agent | Written into item 57 + the spec. Every piece already exists |
| **B3** | Google Books full text as the alternative | **[!]** | agent | **Blocked on B4.** Unmeasured: better coverage, a key, a quota |
| **B4** | ⭐ **Does *"reads the picture, whether it is a cover or a page"* survive *"for books old enough to be in the open library"*?** | **[?]** | **Maximo** | **The whole passage decision.** Coverage, not ranking, is the blocker |

### B. Agent lane — three review items closed

| # | task | state | owner | note |
|---|---|---|---|---|
| **E0** | **Re-probe all nine of item 51 before ranking** (Rule 4) | **[x]** | agent | **All nine confirmed still open.** None had been quietly fixed |
| **E1** | PERF-6 / SEC-4 — `ipCap` IPv6 bypass + unbounded map | **[x]** | agent | `b8b33fa` · 11/11, twice |
| **E2** | SEC-3 — no per-IP cap on `/api/license` | **[x]** | agent | `fa5ab8f` · 9/9, twice |
| **E3** | TM-12 — API responses carried no `no-store`, and one body is a bearer token | **[x]** | agent | `887cf50` · 8/8, twice |
| **E4** | R-6 / TM-13 — neither edge function bounded its upstream call | **[x]** | agent | `9fe7165` · 11/11, twice |
| **E5** | AC-9 / TM-6 — the vision relay had no scrub and no cap | **[x]** | agent | `9e36d5f` · 11/11, twice |
| **E6** | AC-10 — Polar's answer cast, never validated | **[x]** | agent | `2cc9983` · 12/12, twice |
| **E7** | AC-6 — an unreadable answer read as *"no book on that cover"* | **[x]** | agent | `f639b39` · 6/6, twice |
| **E8** | AC-5 + AC-12 — the token lifetime contract crossing the wire | **[x]** | agent | `58177a3` · 13/13, twice |
| **E9** | ⭐ **ITEM 51 CLOSED — all nine** | **[x]** | agent | **81 mutations, 81 caught**, every plan run twice |
| **H1** | Item 52 — TM-9 (`data-sig` exfiltration) + TM-10 (latent `javascript:`) | **[x]** | agent | `87c6110` · 16/16, twice |
| **H2** | ⭐ **ITEM 52 CLOSED — both named findings** | **[x]** | agent | The general hardening became item 61 |
| **H3** | TS-7 — `exactOptionalPropertyTypes` ON | **[x]** | agent | `37463c8` · the wave was **11**, not a flood |
| **H4** | X-3 — `toVisionConfig` dead code | **[x]** | agent | Deleted, not fixed. Was one of TS-7's eleven |
| **H5** | TS-1 + TS-2 — three storage readers casting what they read | **[x]** | agent | `ccb8b15` · 16/16, twice |
| **H6** | TS-3 + TS-4 — message reply map + exhaustiveness checks | **[x]** | agent | `9acfc16` · 6/6, twice |
| **H7** | ⭐ **ITEM 53 CLOSED — all five** | **[x]** | agent | |

### C. Filed OUT of this lane — new items, none of them agent work today

| # | task | state | owner | note |
|---|---|---|---|---|
| **N1** | **Item 60** — artless books sharing a tile | **[?]** | **Maximo** | See A2. Filed by the commit that caused it |
| **N2** | **Item 61** — the tray's DOM is still readable by the page it sits on | **[ ]** | agent, **needs a browser** | Card TEXT, class names, the injected `<style>`. **The 110-selector stylesheet must be SPLIT first** |
| **N3** | §5 gained **T20, T21, T22** | **[x]** | agent | The sweep that could not run · bold-onto-slash ends a docblock · **a mutation that reads a clock** |
| **N4** | §5 T16 gained a **second instance**, T19 a **third and fourth** | **[x]** | agent | Both from my own mistakes this lane |

### D. My own errors this lane — every one caught, every one recorded

| # | task | state | owner | note |
|---|---|---|---|---|
| **D1** | Control-byte sweep could not run, while two docs said to run it | **[x]** | agent | `02af222` · §5 T20 |
| **D2** | A commit message named two edits that were in the PREVIOUS commit | **[x]** | agent | `d22831c` · §5 T16, 2nd instance |
| **D3** | Mutation count written from memory: **74**, probe says **81** | **[x]** | agent | `aadec3e` · instrument #15 |
| **D4** | A commit hash written from memory: `da01ad9` — **does not exist** | **[x]** | agent | `aadec3e` · real hash `9fe7165` |
| **D5** | A literal NUL reached `cardSignature.ts`, then the commit message describing it | **[x]** | agent | `2ec9eb1` · §5 T19, 3rd+4th |
| **D6** | A guarded `sed`/python edit printed **MISS** and the shell committed anyway | **[x]** | agent | `a2b56ac` · TS-7 strike silently missed |
| **D7** | `\|` `tail`/`head` laundered an exit code — **twice in one session** | **[x]** | agent | §5 T20. Same trap as `tsc \| head` |

### E. OPEN — the next agent lane, in order

| # | task | state | owner | note |
|---|---|---|---|---|
| **G1** | **Item 54** — dead code, stale comments, one edge against the graph | **[ ]** | agent | **NEXT.** M-2: `README.md:103` lists a dead tool as working. X-3 already struck |
| **G2** | **Item 55** — the two surfaces no test can reach (M-5, M-6) | **[ ]** | agent | Context-menu orchestration + the whole card renderer including the paywall |
| **G3** | **Item 50's remainder** — PERF-2's tray memo, PERF-8, PERF-10's rest | **[ ]** | agent | **PERF-3 is a founder decision, NOT a free win** |
| **G4** | **Item 61** — the tray shadow root | **[ ]** | agent, **needs a browser** | See N2 |
| **G5** | **Item 36** (launch day) · **item 57** (passages, after B4) | **[ ]** | agent | 57 now needs Maximo's call first |
| **G6** | `applyCover` double-fetch | **[ ]** | agent | Not fixed — unmeasurable from node |

### F. FOUNDER DECISIONS — six, none of them blocked on me

| # | decision | state | owner | note |
|---|---|---|---|---|
| **F1** | **Item 58** (ADV-7) — two catch flows key differently on purpose | **[?]** | **Maximo** | 3 options costed in the item body |
| **F2** | **Item 59** (C-3) — how a dead activation escapes | **[!]** | **Maximo** | Blocked on item 2. **Or** the *"pair this install again"* control, which needs no probe |
| **F3** | **Item 60** — five identical tiles vs five drawn boards | **[?]** | **Maximo** | New this lane |
| **F4** | **PERF-3** — accept ~70KB per 20-query burst, or fetch the ISBN lazily | **[?]** | **Maximo** | The implied fix breaks `sameBook`, every Buy link, and the Goodreads dedup column |
| **F5** | **B4 / item 57** — the passage positioning call | **[?]** | **Maximo** | See A/B4 |
| **F6** | **Task 23** — extract `OPENWORK.md` §5 | **[?]** | **founder** | **WORSE this lane: §5 now begins at line 2380, was 2163** |

### G. MAXIMO'S CHAIN — unchanged by this lane, still the launch blocker

| # | task | state | owner | note |
|---|---|---|---|---|
| **M1** | **Item 37** — upload the zip as a DRAFT, copy the public key into `manifest.json` | **[ ]** | **Maximo** | **HEADS THE CHAIN.** Both endpoints 403 for every customer without it |
| **M2** | **Item 2** — the six Vercel variables | **[ ]** | **Maximo** | Behind item 37 |
| **M3** | **Item 3** — the by-hand browser pass, 13+ checks | **[ ]** | **Maximo** | **No agent can ever tick this** |
| **M4** | ⚠ **Check #1 of item 3: does the Buki button still appear on x.com?** | **[ ]** | **Maximo** | TM-14 removed that host permission on 08-27. **No test can prove Chrome still injects** |
| **M5** | Items 9, 35, 56 | **[ ]** | **Maximo** | 56 is one curl: the CORS redirect chain |

---

## Detail — A1, the cover rule

**The rule, verbatim:** *"when we find no cover book, we use the original image."*

**Where it ALREADY held.** `coverSources` returns `[book.coverUrl, shot]`, and `coverFor` walks
that list on error before drawing a board. Reversed 08-16; that order is correct and was not
what needed changing.

**Where it did NOT.** `shot` was only STORED when `shotFor(image, books, pictures)` returned it,
and that was `books === 1 && pictures === 1` (item 47, C-9). So a book from a two-book photo was
saved with **no `shot` at all**, and if OpenLibrary held no art the rule could not fire because
the picture was never kept.

**Why half of C-9 had expired.** C-9's stated harm was *"five books arrived on the shelf wearing
the photograph INSTEAD OF their own covers."* That was fixed on 08-16 by the ORDERING reversal.
A stored photograph can no longer displace art, so the only moment it is drawn is the moment
there is none — and there the choice is photograph-versus-a-board-we-drew.

**The half that does NOT expire.** `pictures > 1`. `content.ts` opens the card with
`tweet.imageUrls[0]` and `VisionGuess` is `{title, author}` with no image index, so a
four-picture post yielding one book would store a one-in-four guess at a photograph that may
show a different book. **Several books in ONE picture is a fact; one book from FOUR pictures is
a guess.**

**Found on the way:** the `pictures > 1` half had **no test with a real image** — only
`shotFor(undefined, 1, 0)`, which passes because the image is undefined, not because the guard
works.

---

## Detail — B1, the passage probe, six rounds

Full record: `docs/superpowers/specs/2026-08-27-passage-probe.md`. Re-runnable:
`node tools/probe/passage-grounding.mjs`.

1. **Read the FIELD NAMES off a real hit before guessing any.** Found `meta_title`,
   `meta_creator`, `identifier`, `page_num` — which **contradicts the spec's own claim** that
   titles are often absent and authors always are.
2. **Every field-scoped query returned 0, INCLUDING the negative controls.** Control and
   treatment agreeing means the instrument said nothing. Did not conclude.
3. **The discriminator.** `AND meta_mediatype:texts` — true of every document in the corpus —
   returns **0**, so field filters are dead. `AND Austen` (bare term) returns **227 from 2,228,
   book at rank 1**. `AND <impossible word>` returns 0, so AND does narrow.
4. **The count is not the check.** `AND Hemingway` still returns **115 hits** topped by a
   cocktail recipe book, because Hemingway is a cocktail.
5. **The titles are the check.** 5/5 discriminate. Read past the headline: 3 of the 5 matched a
   companion, a book of essays, and a Spike Milligan parody — fine, because the hit's title
   never reaches the shelf.
6. **The adversarial one.** Wrong-book-right-author refused 7 of 8; the 8th is an omnibus at
   rank 8 against the right answer at rank 1, so BEST-match closes it. **And the coverage
   finding that moved the blocker:** four modern in-copyright novels, none found, two returning
   zero hits.

---

## Checkpoint log — newest last

- **Session opened.** Founder: reread flows, reread `frontend-design` + `emil-design-eng`, carry
  the 43-row table, get to work. Two new rules named.
- **Baseline before anything:** 1,019 tests / 76 files, tsc 0, build 0, 0 unpushed, tree clean.
- **A1 RED**, then GREEN, then 7/7 mutations including the 08-16 ordering reverted — because
  this change RESTS on that ordering and would be unsafe without it.
- **B1** six probe rounds; consolidated into `tools/probe/` and re-run from its new home.
- **D1** the control-byte sweep found dead mid-task. Fixed, `--verify` added.
- **D2** commit message named the previous commit's edits. Corrected by follow-up, not amend.
- **E0** all nine of item 51 re-probed against the system. None quietly fixed.
- **E1-E8** eight commits, 81 mutations, 81 caught, every plan run twice.
- **D3/D4** two numbers written from memory, both wrong, both corrected.
- **H1** item 52. A mutation found a SECOND bug in the same function: the old signature join
  collided on a crafted title.
- **D5** a literal NUL reached `cardSignature.ts` and then the commit message about it.
- **H3** TS-7 on. Wave measured at eleven. Verified by watching tsc fail with the flag on and
  pass with it off.
- **D6** the TS-7 strike printed MISS and the shell committed anyway.
- **H5** TS-1/TS-2. A mutation proved the new validators were tested but NOT CONNECTED.
- **H6** TS-3/TS-4. The completeness proof went red on its first run and caught two mistakes in
  the map it was checking.
- **END STATE, probed 2026-08-28:** 1,160 tests / 88 files · tsc 0 · build 0 · sweep 0 ·
  0 unpushed · `origin/main` at `9acfc16` · tree clean · **15 open items** · LANE ≡ BODY.
