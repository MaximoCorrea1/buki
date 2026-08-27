# Session TODO — 2026-08-27, review lane

**Second pair sharing 2026-08-27.** The earlier pair is `...-2026-08-27-launch-prep`
(store copy, manual-add, the 429, the passage probe, the OPENWORK reconcile). This pair is
the one that works **THE LANE's agent queue: items 45-55**, the carried findings from
`docs/REVIEW-2026-08-24-prelaunch.md`.

Ledger created **before the first substantive tool call**, which breaks a five-session
streak of writing it late. The paths were printed in the first reply.

---

## TASKS

| # | task | state | owner | note |
|---|---|---|---|---|
| 1 | Session start: CLAUDE.md, OPENWORK LANE + §0, newest handoff | [x] | agent | done before probes |
| 2 | Create both ledgers, print both paths | [x] | agent | this file + the CONTEXT pair |
| 3 | Run the three probes + the two drift probes | [x] | agent | 860/72 at open (NOT the 856/71 inherited), tsc 0, build 0, 0 ahead, sets match |
| 4 | Re-probe every inherited item BEFORE ranking (Rule 4) | [x] | agent | done for 45 and 46; both had false statements in the item text |
| 5 | **Item 45** — the price in three places `pricing.test.ts` cannot see | [x] | agent | `e521839`. It was TWO places and the prescribed fix was wrong. 7 mutations, 7 caught |
| 6 | **Item 46** — four privacy/permission claims that are not true | [x] | agent | `9c2b268` + `24433f9`. 18 mutations, 18 caught. TM-11 was a feature, not a false claim |
| 7 | **Item 47** — re-catching a book destroys the good record (ADV-6) | [x] | agent | `ff09658`. SIX of seven. 21 mutations, 21 caught, 3 survived first pass |
| 8 | **Item 48** — the activation lifecycle's last three holes | [x] | agent | `261852c`. TWO of three. 5 mutations, 5 caught, 1 proved equivalent and removed |
| 8b | **Item 59** — C-3, a dead activation with no escape but wiping the shelf | [!] | **Maximo** | split out of 48. BLOCKED on item 2: one probe against the live endpoint settles it |
| 7b | **Item 58** — ADV-7, two catch flows, two trial spends | [?] | **Maximo** | split out of 47. A decision about what a catch IS, not a fix |
| 9 | **Item 49** — four reliability holes on the waited-on path | [x] | agent | `0486712` + `b006efc`. ALL FOUR. 25 mutations, 25 caught, 4 survived first pass |
| 10 | **Item 50** — the measured performance set | [ ] | agent | PERF-1/2/3. Re-measure after, not before. **NEXT** |
| 11 | **Item 51** — server contract and edge gaps | [ ] | agent | AC-5/6/10/12, SEC-3, AC-9/TM-6, R-6/TM-13, PERF-6/SEC-4, TM-12 |
| 12 | **Item 52** — the tray lives in the host page's light DOM | [ ] | agent | TM-9 exfiltration surface, TM-10 latent `javascript:` |
| 13 | **Item 53** — types that do not type | [ ] | agent | TS-1/2/3/4/7 |
| 14 | **Item 54** — dead code, stale comments, one edge against the graph | [ ] | agent | `README.md` currently lies |
| 15 | **Item 55** — the two surfaces no test can reach | [ ] | agent | M-5 context-menu orchestration, M-6 card renderer incl. paywall |
| 16 | Reshoot all five captures at DPR 2 | [ ] | Maximo | all 1x. Cannot be fixed downstream |
| 17 | By hand: the `+` on an empty shelf | [ ] | Maximo | no test can reach it |
| 18 | By hand: re-adding an owned book moves it | [ ] | Maximo | logic guarded, wiring is not |
| 19 | Confirm the $5 cap STOPS spending, not emails | [ ] | Maximo | a GCloud budget caps nothing |
| 20 | Alert below the cap (~50%) | [ ] | Maximo | so the first news is not the outage |
| 21 | The six Vercel variables | [ ] | Maximo | item 2, blocked on 22 |
| 22 | Draft upload → real extension id | [ ] | Maximo | item 37. The chain starts here |
| 23 | Item 3 — the by-hand browser pass | [ ] | Maximo | no agent can ever tick this |
| 24 | Item 9 — five Web Store screenshots at 1280x800 | [ ] | Maximo | blocked behind item 45 (copy is irreversible) |
| 25 | Item 56 — probe the CORS redirect chain | [ ] | Maximo | one curl |
| 26 | Item 35 — affiliate tags empty | [ ] | Maximo | after launch; Amazon blocked BY launch |
| 27 | Item 36 — install CTAs → store URL | [ ] | agent | launch day only. Five change, three must not |
| 28 | Item 57 — find a book from a passage | [ ] | agent | AFTER launch. Naive design is dead |
| 29 | **NEW.** `cover.ts:applyCover` fetches twice on a cache miss | [ ] | agent | `img.src = url` AND `rememberCover(url)`. Folds into item 50 (PERF-2) |
| 30 | **NEW.** By hand: Buki's button still appears on x.com after TM-14 | [ ] | Maximo | no test can prove Chrome still injects. Filed into item 3 |
| 31 | **NEW.** By hand: the Forget control, and that no required host is listed | [ ] | Maximo | filed into item 3 |
| 32 | **NEW.** By hand: export a shelf with a title starting `=`, open in Excel | [ ] | Maximo | filed into item 3 |
| 33 | **NEW.** `OPENWORK.md` is over its own size budget: §5 begins at line 2063 and Read takes 2000 | [?] | founder | the whole case ledger is unreachable in one read. Extract §5's CASES, provably. Rule 8 |
| 34 | **NEW.** Push 9 commits to `origin/main` | [?] | founder | not pushed; not asked |

`[x]` done+verified · `[~]` in progress · `[ ]` open · `[?]` founder decision · `[!]` blocked

---

## Checkpoint log

| # | what | outcome |
|---|---|---|
| 1 | Session start protocol run in CLAUDE.md's order | ledgers created before probes, first time in six sessions |
| 2 | Five probes | 860/72, NOT the inherited 856/71. `5461211` landed after the handoff |
| 3 | Item 45 re-probed before planning | two statements in the item text were false. Recorded in the CONTEXT pair |
| 4 | Item 45 guard written and mutated | 6/7 first pass. The survivor was a real hole: an editorial note quoting the copy satisfied the guard |
| 5 | Item 45 committed | `e521839`, 7/7 |
| 6 | Item 46 re-probed | TM-11 is a feature, not a false claim. TM-4 confirmed live at `cover.ts:applyCover` |
| 7 | TM-8 fixed, and probing it found a second vector | `isbnCell` writes a formula; OpenLibrary is a wiki. 7/7 |
| 8 | TM-14 removed after proving nothing depends on it | content script does zero fetches; one `executeScript` site under `activeTab` |
| 9 | TM-4 / TM-7 copy corrected, store block re-measured 953 -> 883 | `storeCopy.test.ts` now owns the number. 8/8 |
| 10 | Item 46 part one committed | `9c2b268` |
| 11 | TM-11 built: `grantedHosts.ts` + options section | absence proof failed on its own docblocks first. 11/11 |
| 12 | TM-11 committed | `24433f9` |
| 13 | Harness caught running the wrong target and fixed | reported two files, ran 889. Right answer, wrong reason |
| 14 | Item 47 re-probed | ADV-6's prescribed fix is WRONG for the common case; C-5's correct rule is not transitive |
| 15 | ADV-6, C-5, C-6 fixed and mutated | 9/9. Mutation 47b applies the review's own fix and is caught |
| 16 | C-7, C-9 fixed | 7/7 after two tray tests were added for a field only the compiler protected |
| 17 | C-8 fixed | 5/5. `coversToKeep` + an absence proof on the popup wiring |
| 18 | Item 47 committed, ADV-7 filed as item 58 | `ff09658`. 949 tests / 76 files |
| 19 | Item 48 re-probed | ADV-3 confirmed: undefined does not survive JSON.stringify, so every renewal re-activates |
| 20 | C-3 attempted twice and REVERTED twice | item 27's premise does not expire; five existing tests encode it; the probe needs live endpoints |
| 21 | Item 48 committed | `261852c`. One mutation proved equivalent and the condition was deleted rather than counted |
| 22 | `CLAUDE.md`'s size warning corrected | it claimed ~100 lines of §5 were reachable; §5 now BEGINS past the cut |
| 23 | Handoff written, pointer updated, `cat -A` clean | `%TEMP%/buki-handoff-2026-08-27-review-lane.md` |
| 24 | Item 49 re-probed | R-1's `licenseHandler` comment was false from the day it was written |
| 25 | R-1, R-4 fixed and committed | `0486712`. 11 mutations, 2 survived: the signal composition, and `livePrep` being unreachable |
| 26 | R-2's cooldown had to be PERSISTED | MV3 teardown kills module scope. Item 27's `Required<ProState>` fixture caught the missing `readPro` line |
| 27 | R-3's number DERIVED from the pipeline's ceilings | 3 constants exported so the test computes the budget rather than trusting a comment |
| 28 | R-2, R-3 committed | `b006efc`. 14 mutations, 2 survived: a NaN cooldown, and a FIXED test clock that cannot see a clock being re-read |

---

## Measurements (each with its probe)

**Point, do not copy.** All nine live in `docs/SESSION-CONTEXT-2026-08-27-review-lane.md`,
each with the probe that produced it and the population it was taken over. Duplicating them
here is how two docs start disagreeing.

---

## Product bugs found this session

| # | Bug | Where it went |
|---|---|---|
| 1 | **A second CSV formula-injection vector the review did not file.** `isbnCell` emits `="<isbn>"`, which IS a formula, and `openLibrary.ts:44` casts `doc.isbn[0]` out of a wiki anyone may edit | Fixed in `9c2b268`. Recorded in OPENWORK item 46's body |
| 2 | **`cover.ts:applyCover` fetches a cover TWICE on a cache miss** - `img.src = url` and `rememberCover(url)` | Task 29. Folds into item 50, PERF-2 |
| 3 | **The store's host-permissions answer described two permissions the manifest no longer held** - created by fixing TM-14, caught before commit | Fixed in the same commit, and `storeCopy.test.ts` now fails in both directions |
| 4 | **The paste block's character count was measured by hand once and had drifted** | `storeCopy.test.ts` owns it now, counted with CRLF |
| 5 | **`shotFor` counted books and never pictures**, so a four-photo post yielding one book stored photograph ONE as that book's cover | Fixed in `ff09658`, C-9 |
| 6 | **`postKey` dropped the host**, so two sites sharing an image path were one catch - a MEMO HIT, returning the first post's books for the second | Fixed in `ff09658`, C-7 |
| 7 | **The cover cache was pruned INSIDE the 8s undo window**, so Undo restored a book to a drawn board | Fixed in `ff09658`, C-8 |

---

## Ideas raised, and where each went

| Idea | Where it went |
|---|---|
| A **"Forget all sites"** button beside the per-row Forget | **Deliberately not built.** The list is typically 0-3 rows for a real reader, because the common cover hosts are REQUIRED and therefore never listed; and a bulk wipe with no undo is a footgun. Revisit if real usage shows long lists |
| Derive "customer-facing" from `.vercelignore` for the price guard | **Rejected, and the reason is worth keeping.** `docs/store` IS vercel-ignored, and `listing.md` is the most customer-facing price surface there is. The derived population looked elegant and was wrong |
| Allowlist the cost figures so the blunt `$N` rule could be widened | **Rejected.** An allowlist holding `4.99` waves through *"Buki Pro is $4.99 a month"* |
