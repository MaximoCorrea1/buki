# SESSION TODO — 2026-08-27, covers + passages lane

**Second lane on this date.** The first is `SESSION-TODO-2026-08-27-review-lane.md` (items 45-50,
43 rows). **That pair is not superseded** — its rows 11-43 are still open and still owned. This
file owns only what the founder raised in the message that opened this lane.

> **Why a second pair rather than appending.** The review lane's ledger is the record of items
> 45-50 and its `## TASKS` table is the authority on those. This lane is FEATURE work the founder
> named directly, and the 08-27 handoff said it out loud: *"If the next session is meant to be a
> business or design session it should say so and start from `.agents/product-marketing.md` and
> `docs/brand.md`, not from THE LANE."* It said so.

---

## TASKS

| # | task | state | owner | note |
|---|---|---|---|---|
| **A1** | **No cover art → show the original image.** Founder rule | **[x]** | agent | `cae4ad1`. `shotFor`: `books === 1` → `books >= 1`. 7 mutations, 7 caught |
| **A2** | What a multi-book catch with no art shows — **five identical tiles** | **[?]** | **Maximo** | **Filed as item 60 by the commit that caused it.** 3 options costed, doing nothing is one |
| **B1** | **Passages: the ONE probe the spec said decides it** | **[x]** | agent | **Scoping WORKS** — by bare boolean term, not by field. 5/5 discriminate |
| **B2** | Design the inverted flow (model proposes, full text CHECKS) | **[x]** | agent | Designed and written into item 57 + the spec. Every piece already exists |
| **B3** | Google Books full text as the alternative | **[!]** | agent | **Only if B4 says no.** Unmeasured — better coverage, a key, a quota |
| **B4** | ⭐ **Does *"whether it is a cover or a page"* survive *"for books old enough to be in the open library"*?** | **[?]** | **Maximo** | **NEW, and it is the whole decision.** Coverage, not ranking, is the blocker |
| **C1** | Re-verify the suite after every change, mutation-test every new guard | [~] | agent | 1,020 / 76 green; 7/7 caught on the one guard added |
| **C2** | Update `OPENWORK.md` + this pair the turn anything closes | [~] | agent | Items 57 rewritten, 60 filed, §0 gained `tools/probe/` |
| **C3** | Promote the passage probe out of `zzz-` before it is deleted | **[x]** | agent | `tools/probe/passage-grounding.mjs`. `.gitignore:17` is `zzz-*` |

`[x]` done+verified · `[~]` in progress · `[ ]` open · `[?]` founder decision · `[!]` blocked

`[x]` done+verified · `[~]` in progress · `[ ]` open · `[?]` founder decision · `[!]` blocked

**Carried, not re-listed:** all 43 rows of the review lane's table. Its rows 11-23 (item 50's
remainder, items 51-55, the three founder decisions) and 24-43 (Maximo's launch chain) are
unchanged by this lane. **Read that file for them.**

---

## A1 — the founder's rule, and the one place it collides

**The rule, verbatim:** *"when we find no cover book, we use the original image."*

**Where it ALREADY holds.** `coverSources` (`src/extension/coverSource.ts`) returns
`[book.coverUrl, shot]`, so a book with no catalogue art already falls to the picture it was
caught from, and `coverFor` walks that list on error before drawing a board. Reversed 08-16;
the order is right and is not what needs changing.

**Where it does NOT hold, and this is the gap.** `shot` is only STORED when
`shotFor(image, books, pictures)` returns it, and that is `books === 1 && pictures === 1`
(item 47, C-9). So a book from a two-book photo, or a one-book post with four photos, is
saved with **no `shot` at all** — and if OpenLibrary holds no art for it, the founder's rule
cannot fire because the picture was never kept. `content.ts:1327` and `content.ts:1356`.

**Reachable how often:** `generatedCover.ts` says OpenLibrary has no art for *"a large share of
books"*, and held none at all for hours on 08-04. This is not a rare path.

**The honest objection to just deleting the gate** (this is A2, and it is the founder's call):
after the 08-16 reversal, real art always wins, so C-9's original harm — *"each book's real
cover was never used"* — **cannot recur**. What CAN recur is different and visual: five books
caught from one photograph, none with art, would show **five identical tiles** on a face-out
shelf. The drawn board is per-book (hashed from title+author), so five boards read as five
different books and five copies of one photo read as a bug.

---

## Detail log

*(appended as work happens; newest last)*

- **Session opened.** Founder: reread flows, reread `frontend-design` + `emil-design-eng`, read
  the carried table, get to work. Two new rules named: the cover fallback, and passages.
- **Baseline probed before anything:** 1,019 tests / 76 files, tsc 0, build 0, 0 unpushed,
  tree clean. Matches what the review lane's handoff predicted, so nothing drifted overnight.
- **A1 RED.** New test asserted `shotFor(SHOT, 5, 1) === SHOT`; failed with *"expected undefined
  to be …"*, which is the feature missing rather than a typo. Watched, not assumed.
- **A1 found a test gap on the way.** The `pictures > 1` half of C-9 had **no test with a real
  image** — only `shotFor(undefined, 1, 0)`, which passes for the wrong reason. Added. That is
  the +1 in 1,020.
- **A1 GREEN, then mutated.** 7 mutations, **7 caught**, including the old rule restored
  verbatim and the 08-16 ordering reverted — because this change RESTS on that ordering and
  would be unsafe without it. `tools/mutations/item-60-shotfor.json`.
- **A1 corrected two comments that still told the old story** — the `content.ts` call site and
  the `shot` docblock in `storage.ts` — in the same commit. A rule that changes in one file and
  not in the two that explain it is how a codebase starts disagreeing with itself.
- **B1, probe 1.** Read the FIELD NAMES off a real hit before guessing any. Found
  `meta_title`, `meta_creator`, `identifier`, `page_num` — **which contradicts the spec's own
  claim** that titles are often absent and authors always are.
- **B1, probe 2.** Every field-scoped query returned 0 — **including the negative controls.**
  Control and treatment agreeing means the instrument said nothing. Did not conclude.
- **B1, probe 3, THE DISCRIMINATOR.** `AND meta_mediatype:texts` (true of every document)
  returns **0** → field filters are dead. `AND Austen` (bare term) returns **227 from 2,228,
  book at rank 1** → bare boolean scoping works. `AND <impossible word>` returns 0 → AND does
  narrow. **Three queries, and only together do they mean anything.**
- **B1, probe 4, the refusal test.** `AND Hemingway` still returns 115 hits topped by a cocktail
  book. **The count is not the check.** Would have shipped a bug.
- **B1, probe 5.** Title-matching the returned hits: **5/5 discriminate.** Read past the
  headline — 3 of the 5 matched a companion / essays / a Spike Milligan parody, not the book.
  Established why that is fine: the hit's title never reaches the shelf.
- **B1, probe 6, the adversarial one.** Wrong-book-right-author refused 7 of 8; the 8th is an
  omnibus at rank 8 against the right answer at rank 1, so BEST-match closes it. **And the
  coverage finding that moved the blocker:** four modern in-copyright novels, none found.
- **C3.** Six `zzz-` probe scripts consolidated into one re-runnable `tools/probe/`
  and **re-run from the new home to confirm it reproduces.** Same lesson as `bd0e628`.
