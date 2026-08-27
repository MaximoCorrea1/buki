# SESSION CONTEXT — 2026-08-27, covers + passages lane

Companion to `SESSION-TODO-2026-08-27-covers-passages.md`. This file owns the REASONING: what was
measured, with which probe, and which beliefs it overturned.

---

## What was asked

Founder, opening this lane:

1. Re-read the three Flows and the two named design skills (`frontend-design`, `emil-design-eng`).
2. Carry the review lane's 43-row table forward. **Not superseded.**
3. *"remember: when we find no cover book, we use the original image."*
4. *"lets see if we cant solve the 'find any book from phrase, passage, page etc'"*

Points 3 and 4 are the work. Points 1 and 2 are the frame.

---

## Measurements, each with its probe

| # | Measurement | Probe | Taken |
|---|---|---|---|
| M1 | 1,019 tests across 76 files, all green | `./node_modules/.bin/vitest run` | session open |
| M2 | tsc exit 0, build exit 0 | `node node_modules/typescript/bin/tsc --noEmit` / `node build.mjs` — **exit code read directly, NOT piped through `head`** | session open |
| M3 | 0 unpushed, tree clean | `git rev-list --count origin/main..HEAD`, `git status --porcelain` | session open |
| M4 | `OPENWORK.md` is 2,899 lines / 228,626 chars; §5 begins at 2163 | `wc -l -c OPENWORK.md`, `grep -n '^## [56]\.' OPENWORK.md` | session open |
| M5 | `shotFor`'s new guard: **7 mutations, 7 caught** | `node tools/mutations/../mutate.mjs tools/mutations/item-60-shotfor.json` | after A1 |
| M6 | Suite after A1: **1,020 / 76**, tsc 0, build 0 | as M1/M2 | after A1 |
| M7 | **Field filters on `search/inside` are dead.** `AND meta_mediatype:texts` — the mediatype of EVERY document — returns `total=0` | `tools/probe/passage-grounding.mjs` step A | B1 |
| M8 | **Bare boolean scoping works.** `"<passage>"` → 2,228 hits, book absent from top 3. `"<passage>" AND Austen` → **227 hits, book at rank 1** | same, step A | B1 |
| M9 | **The count is not the check.** `"<austen passage>" AND Hemingway` → **115 hits**, top *"Book girl's guide to cocktails for book lovers"* | same, step B | B1 |
| M10 | **Title-matching discriminates 5/5.** Right author finds the book (ranks 1, 6, 3, 1, 1); wrong author finds none | same, step B | B1 |
| M11 | **Wrong-book-right-author refused 7 of 8.** The 8th is an omnibus at rank 8 vs the right answer at rank 1 | same, step C | B1 |
| M12 | ⛔ **Coverage is the ceiling.** 4 modern in-copyright novels, **0 found**; *Gone Girl* and *Normal People* returned **zero hits** | same, step D | B1 |
| M13 | Latency **982–9,983ms** over 19 queries. `openLibrary.ts` `TIMEOUT_MS` is **6,000** — the max exceeds it | same, step E | B1 |

**On M7–M13's population:** five public-domain classics with famous opening lines, four
modern in-copyright novels, one deliberately generic sentence. **Not a random sample of what
people post** — it is a sample chosen to make the mechanism visible. The coverage figure in
particular is a floor-finding, not a rate: it shows the corpus excludes contemporary fiction,
not what fraction of real catches would fail.

**M4 restates the standing problem rather than discovering it:** §5 still begins past the Read
tool's 2000-line default, so the whole case ledger is unreachable in one call. Review-lane task 23.

---

## Beliefs held, and what the probe did to them

### B1 — "the cover fallback needs building"

**Believed:** the founder's rule describes something absent.

**Measured, by reading `coverSource.ts` and `cover.ts`:** the READ path already implements it
exactly. `coverSources` returns `[book.coverUrl, shot]` and `coverFor` walks it on error before
falling to `drawnCover`. The 08-16 reversal put `coverUrl` first deliberately and that order is
correct.

**Overturned to:** the rule is broken at the WRITE, not the read. `shotFor` refuses to store the
picture unless `books === 1 && pictures === 1`, so for a multi-book or multi-picture catch there
is no picture left for the read path to fall back to. **The fix is a storage question wearing a
rendering question's clothes**, and it lands in `content.ts`, not `cover.ts`.

### B2 — "C-9 argues against the founder's rule"

**Believed:** item 47's C-9 fix and the founder's rule are in direct conflict, so one must lose.

**Measured, by reading what C-9 actually claimed:** C-9's stated harm is *"five books arrived on
the shelf wearing the same photograph instead of their own covers"* — the photograph BEATING real
art. That failure was fixed by the 08-16 ORDERING reversal, independently of `shotFor`. With
`coverUrl` first, a stored photograph can never displace real art.

**Overturned to:** they conflict on a narrower case than it appears — books with **no art at all**
from a **multi-book** catch. There the trade is five identical photo tiles against five distinct
drawn boards, which is a visual judgement and therefore the founder's. Logged as task A2 rather
than decided here.

---

### B3 — "the passage feature has no floor" (the spec's own conclusion, this morning)

**Believed, and written into `OPENWORK.md` item 57 and the spec:** *"Unprobed and blocking:
whether `search/inside` can be scoped to a work or edition at all. If it cannot, this design
has no floor."*

**Measured:** it can. Not the way the spec guessed — field filters are dead (M7) — but a bare
boolean term scopes it, and scopes it well (M8). The design has a floor, it refuses correctly
(M10, M11), and the check costs no extra request because the titles were already in the
payload.

**Overturned to:** the engineering question is answered and **the blocker moved to coverage**
(M12), which is a positioning decision rather than a build. Item 57 changed owner from agent
to Maximo without closing.

### B4 — "titles are often absent and authors always are"

**Believed:** the spec recorded this as fact and drew a cost from it — *"so every hit costs a
second lookup to become a book."*

**Measured:** every hit carries `meta_title`, `meta_creator`, `identifier` and `page_num`. The
second lookup does not exist. **And that payload turned out to be the entire answer** — the
check that discriminates 5/5 reads the titles that were already there.

**Why it was wrong:** the spec described the response as *"a raw Elasticsearch document"* and
stopped. Printing `Object.keys(hit.fields)` was the whole correction, and it took one query.

### B5 — "C-9 and the founder's cover rule are in direct conflict"

Superseded by what the probe of the SOURCE showed: they conflict on one narrow case, and C-9
is two rules wearing one condition. See B2 above and `OPENWORK.md` item 60.

---

## Instruments that lied

*(this list is worth more than the findings, because the next session inherits the
instruments)*

1. **`edition_key:` returning 0.** Read as *"scoping is unsupported"*. It was a **wrong field
   name**, and a wrong field name is indistinguishable from an unsupported filter when you
   only look at one query. **What it actually measured:** that `edition_key` is not a field.
   **Remedy, and it is now step A of the probe:** watch a filter that MUST match everything
   (`meta_mediatype:texts`) before believing one that failed.

2. **`AND <wrong author>` returning `total > 0`.** Read as *"the check does not refuse"*. It
   measured **term co-occurrence**, not book identity — Hemingway is a cocktail, so a cocktail
   recipe book matches. **The real check was one field deeper**, in the titles the same
   response already carried.

3. **"5 of 5 discriminate" read as "5 of 5 found the book".** Three of the five matched a
   *companion*, a book of *essays*, and a *Spike Milligan parody*. The headline was right and
   the obvious reading of it was wrong. **What it actually measured:** that a book of that
   NAME contains the passage — which is the right evidence, but only once you say so out loud.

4. **A green test suite, on the `pictures > 1` half of C-9.** 1,019 passing tests included
   **no test that passed a real image with `pictures > 1`** — only `shotFor(undefined, 1, 0)`,
   which passes because the image is undefined, not because the guard works. **A test that
   passes for the wrong reason is indistinguishable from coverage** until something mutates it.

5. **`size=100` on the OpenLibrary endpoint.** Silently ignored; 20 hits returned regardless.
   A depth-walk that believed it had walked 100 would under-report every "not found".

---

## Carried context this lane does not re-derive

- **The review lane's pair** owns items 45-50, the 14 measurements behind them, and the ten
  instruments that lied. `SESSION-CONTEXT-2026-08-27-review-lane.md`.
- **`OPENWORK.md` THE LANE** is the only authority on status.
- **The passage spec** — `docs/superpowers/specs/2026-08-27-passage-probe.md` — already ran three
  full-text queries and killed the naive design. This lane starts from its open question, not
  from scratch.
