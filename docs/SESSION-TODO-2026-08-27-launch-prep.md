# Session ledger — 2026-08-26 to 08-27, launch prep

> **Not served publicly:** `docs/SESSION-*` is in `.vercelignore`.
>
> **WRITTEN LATE, AND THAT IS THE FINDING.** This pair should have existed before the first
> substantive tool call on 08-26. It was created on 08-27 at the founder's instruction, after
> two days of work. **That is now five sessions running.** The reconstruction below is
> complete because the commit messages in this repo carry their own reasoning; it would not
> have been possible in a repo that commits `wip`. That is luck, not process.
>
> **Supersedes nothing.** Continues `docs/SESSION-TODO-2026-08-25-p0-fixes.md`, which covers
> the six P0s and the review filing. This session began as a continuation of that one.

---

## TASKS

| # | task | state | owner | note |
|---|---|---|---|---|
| 1 | Store screenshot copy: polish the CTAs | `[x]` | agent | `a88ed8f`. Superseded within the hour by row 2 |
| 2 | Store screenshots: change the APPROACH, five frames into one story | `[x]` | agent | `753f5cd`. The Heisenberg post carries three of five frames |
| 3 | Show the frames somewhere Maximo can see them | `[x]` | agent | Artifact `9bad48b0`, built from the tool's own output so it cannot drift |
| 4 | Add AI keywords to the description | `[x]` | agent | `d50f65f`. 6 mentions / 914 words = 0.66% |
| 5 | Record that `AI-powered` is banned but `AI` is not | `[x]` | agent | `.agents/product-marketing.md`, with the delete-the-word test |
| 6 | Manual search-and-add: design | `[x]` | agent | `ebb2f1f`, reviewed `13d6ae5` |
| 7 | Manual search-and-add: plan | `[x]` | agent | `941ef36`, ten tasks |
| 8 | Manual search-and-add: build | `[x]` | agent | `fce5a92`. 7 mutations, 7 caught |
| 9 | Single-purpose statement widened to cover it | `[x]` | agent | Same commit. **Free now, a review cycle after submission** |
| 10 | Keyword + discovery pass, store AND landing | `[x]` | agent | `ceaf32b`. Summary rewritten, `storeCopy.test.ts` added |
| 11 | **THE 429**: nineteen sockets to OpenLibrary | `[x]` | agent | `18f89d7`. `mapPool`, `GROUND_AT_ONCE = 4`. 5 mutations, 5 caught |
| 12 | Cover lag: title first, cover a second later | `[x]` | agent | `88334bf`. `warmCovers`. 6 mutations, 6 caught |
| 13 | Tray head says what it found before how | `[x]` | agent | `0c9ca38` |
| 14 | Passage recognition: is it doable? | `[x]` | agent | Probed `d3fef3c`. **The obvious design is dead.** Filed as item 57 |
| 15 | Reconcile LANE rows against item bodies | `[x]` | agent | Found 1, 26 and 57 drifted. See §5 T9 |
| 16 | **PUSH TO `origin/main`** | `[!]` | **Maximo** | **28 commits. Blocked by the permission classifier since 08-25** |
| 17 | Reshoot all five captures at **DPR 2** | `[ ]` | **Maximo** | Item 9. Every current capture is 1x. **Cannot be fixed downstream** |
| 18 | By hand: the `+` is present on an EMPTY shelf | `[ ]` | **Maximo** | No test can reach it. Item 3's pass |
| 19 | By hand: re-adding an owned book MOVES it | `[ ]` | **Maximo** | Guards exist for the logic, not the wiring |
| 20 | Confirm the $5 cap STOPS spending, not just emails | `[ ]` | **Maximo** | A Google Cloud *budget* is an alert and caps nothing |
| 21 | Set the Gemini alert BELOW the cap (~50%) | `[ ]` | **Maximo** | So the first news is not the outage |
| 22 | Probe whether `search/inside` can be SCOPED to a work | `[ ]` | agent | One request. Decides whether item 57 exists at all |
| 23 | The six Vercel variables | `[ ]` | **Maximo** | Item 2. Blocked on the draft upload (item 37) |
| 24 | Draft upload → real extension id into `manifest.json` | `[ ]` | **Maximo** | Item 37. **The chain now starts here** |

`[x]` done+verified · `[~]` in progress · `[ ]` open · `[?]` founder decision · `[!]` blocked

---

## Checkpoint log

| # | what happened | evidence |
|---|---|---|
| 1 | Store frames polished, then **re-done from scratch** on Maximo's *"change the approach"* | 620→811 tests across both |
| 2 | Noticed three captures are ONE POST (@Kekius_Sage, Heisenberg). Frames became a narrative | `753f5cd` |
| 3 | AI keywords added as FACT, never as claim. Brand rule clarified rather than broken | `d50f65f` |
| 4 | Affiliate dependency found INVERTED: Amazon is blocked BY launch, not before it | Same commit |
| 5 | Manual-add spec → review → plan → build. Provenance design corrected mid-spec | `ebb2f1f`→`fce5a92` |
| 6 | Store summary rewritten for discovery; `storeCopy.test.ts` closes item 45's disease | `ceaf32b`, 4 mutations |
| 7 | `llms.txt` found naming a pile that has not existed since 08-18 | Same commit |
| 8 | Items 1, 2, 3 closed by Maximo. Chain now starts at the draft upload | Same commit |
| 9 | **Service-worker log read. Root cause found in the stack: `Promise.all (index 17)`** | `18f89d7` |
| 10 | Cover prefetch. Two of my own tests had holes; both found by mutation | `88334bf` |
| 11 | Tray head reordered. First guard too broad, suite caught it | `0c9ca38` |
| 12 | Passage endpoint probed. **Pride and Prejudice absent from its own top 3** | `d3fef3c` |
| 13 | OPENWORK reconciled: LANE vs bodies, header count corrected 20 → 19 | this commit |
| 14 | Pushed to `origin/main` | **NOT DONE. See task 16** |

---

## Every finding, with what it cost

### Product bugs found and fixed

**F1. Nineteen concurrent connections to openlibrary.org.** `recognizeBook` used a bare
`Promise.all` and `MAX_BOOKS` is 20. HTTP 429, then sixteen 6s timeouts, then the breaker
open for its full two-minute `COOLDOWN_MS`. **Presented as "covers are not loading" and was
not a cover bug at all.** Fixed at `GROUND_AT_ONCE = 4`.

**F2. The cover fetch could not start until the card was on screen.** Structural: the tray
obeys the host page's CSP so the worker must fetch, and the worker was only asked after the
render. `warmCovers` moves it a full message round trip earlier. **Never awaited** - awaiting
would turn a fill-in into a blank tray.

**F3. The tray head said HOW before WHAT.** A single-book card was headed by *"read from the
cover"*, a lowercase fragment where a heading belongs. `foundHeading` already wrote the right
sentence for both counts and simply was not shown for one book.

**F4. `llms.txt` named a pile that stopped existing on 2026-08-18.** *"Now, Next, Someday or
Read"* - renamed to **Finished** in `1a65357`. **Eight days wrong, in the one file written
specifically for AI systems to read**, where nothing looks broken.

**F5. The Polar benefit existed and was never ATTACHED.** Every field correct; zero benefits
on the product. `polar-setup.md` warns about this by name: the subscriber pays, gets no key,
and refunds rather than filing a bug.

**F6. The affiliate dependency was backwards.** `launch.md` said step 8 had no blockers.
Amazon Associates wants the property URL and the store URL does not exist until step 11
publishes, so **Amazon is blocked BY launch.** Not a launch blocker either way.

### Things measured

| | Probe | Result |
|---|---|---|
| Store summary length | `NEW_SUMMARY.length` | **105 of 132** |
| AI keyword density | `grep -o` over the description block | **6 / 914 words = 0.66%** |
| Capture resolution | PNG IHDR bytes | **604x762, 367x110, 355x213, 561x600, 351x587 — all 1x** |
| Passage search latency | `fetch` + `Date.now()` | **4194–5025ms**, against a 6s `TIMEOUT_MS` |
| Passage search quality | 3 queries | **2,228 hits and the source book absent from the top 3** |
| $5 cap in catches | `$5 / $0.00011` | **~45,000 catches ≈ 4,500 free trials** |
| Suite | `./node_modules/.bin/vitest run` | **856 across 71 files** |
| Unpushed | `git rev-list --count origin/main..HEAD` | **28** |
| Open items | `grep -c '^- [ ] **[0-9]'` | **19** (6 Maximo, 13 agent) |

### Ideas raised and where they went

- **Manual search-and-add** → built. Free and unlimited, decided by Maximo.
- **Find a book from a passage** → probed, obvious design killed, filed as **item 57**.
- **Gemini free key for the trials** → **declined**, and the reason is the privacy page, not
  the rate limit. `privacy.html` says the picture is *"not stored"*, which is a claim about
  OUR server; free-tier training terms would make that materially incomplete on the page a
  reviewer opens.
- **Cover fallback to the original photo** → **already exists for a single book** (`shot`),
  and `storage.ts:26` deliberately refuses it for a multi-book catch, because a photo of five
  books is not a cover for any of them. Correct as-is; the real bug was F1.

---

## Carried forward

Everything still open is in `OPENWORK.md` THE LANE, which is the authority. This ledger adds
only what has no item number:

- **Task 16, the push.** Blocked two days.
- **Tasks 18-19**, the by-hand checks no test can reach. They belong to item 3's pass.
- **Tasks 20-21**, the Gemini cap follow-ups. Tracked inside item 26's closed body rather than
  as a new item, because they are the same control.
- **Task 22**, the scoping probe. It decides whether item 57 has a floor.
