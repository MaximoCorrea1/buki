# Session TODO — 2026-08-27, review lane

**Second pair sharing 2026-08-27.** The earlier pair is `...-2026-08-27-launch-prep`
(store copy, manual-add, the 429, the passage probe, the OPENWORK reconcile). This pair
works **THE LANE's agent queue: items 45–55**, the findings carried out of
`docs/REVIEW-2026-08-24-prelaunch.md`.

Ledger created **before the first substantive tool call**, breaking a five-session streak of
writing it late. Reasoning, measurements and the instrument list live in the CONTEXT pair:
`docs/SESSION-CONTEXT-2026-08-27-review-lane.md`. **Point, do not copy** — this file owns the
TASKS, that one owns the WHY.

---

## TASKS

`[x]` done+verified · `[~]` in progress · `[ ]` open · `[?]` founder decision · `[!]` blocked

### Session discipline

| # | task | state | owner | note |
|---|---|---|---|---|
| 1 | Session start: CLAUDE.md, OPENWORK LANE + §0, newest handoff | [x] | agent | done before probes |
| 2 | Create both ledgers, print both paths | [x] | agent | before the first substantive tool call |
| 3 | Three probes + two drift probes | [x] | agent | **860/72 at open, NOT the inherited 856/71** |
| 4 | Re-probe every inherited item BEFORE ranking (Rule 4) | [x] | agent | done for 45–50. **Four items carried false statements in their own text** |
| 5 | Capture everything, update all docs, push to main | [x] | agent | this rewrite, `bd0e628`, and the push |

### The agent lane — items 45 to 55

| # | task | state | owner | note |
|---|---|---|---|---|
| 6 | **Item 45** — the price is spelled where the guard cannot see it | [x] | agent | `e521839`, `965d3c1`. **It was TWO surfaces, not three, and the prescribed fix was red on arrival.** 9 mutations, 9 caught |
| 7 | **Item 46** — five privacy/permission findings | [x] | agent | `9c2b268`, `24433f9`. TM-4/7/8/11/14. **TM-8 had a SECOND vector the review missed**; TM-11 was a missing feature, not a false claim. 18 mutations, 18 caught |
| 8 | **Item 47** — six ways the shelf lost or merged the wrong book | [x] | agent | `ff09658`, `a4c3b61`, `a72a721`. ADV-6, C-5, C-6, C-7, C-8, C-9. **The prescribed ADV-6 fix is wrong for the common case.** 21 mutations, 21 caught |
| 9 | **Item 48** — activation lifecycle | [x] | agent | `261852c`, `a870aff`. ADV-3 + ADV-8 fixed; **C-3 written twice and REVERTED twice**, split out as item 59. 5 mutations, 5 caught, 1 proved equivalent and deleted |
| 10 | **Item 49** — all four reliability holes | [x] | agent | `0486712`, `b006efc`, `608dba8`. R-1, R-2, R-3, R-4. 25 mutations, 25 caught |
| 11 | **Item 50** — the measured performance set | [~] | agent | `b08489c`, `12c9055`, `d4a96de`, `b9ecce1`. **FIVE of nine.** Rows 12–15 are what remains |
| 16 | **Item 51** — the server's remaining contract and edge gaps | [ ] | agent | AC-5, AC-6, AC-10, AC-12, SEC-3, AC-9/TM-6, R-6/TM-13, PERF-6/SEC-4, TM-12. **NEXT** |
| 17 | **Item 52** — the tray lives in the host page's light DOM | [ ] | agent | TM-9 exfiltration surface, TM-10 latent `javascript:` |
| 18 | **Item 53** — types that do not type | [ ] | agent | TS-1/2/3/4/7. **TS-7 (`exactOptionalPropertyTypes`) is the flag item 47's ADV-6 had to work around by hand** |
| 19 | **Item 54** — dead code, stale comments, one edge against the graph | [ ] | agent | `README.md` currently lies about `tools/mark-sizes.mjs`. **Three dead imports were already removed from `background.ts` in `12c9055`** |
| 20 | **Item 55** — the two surfaces no test can reach | [ ] | agent | M-5 context-menu orchestration, M-6 the card renderer including the paywall |

### Item 50's remainder, split so no row is silently one-quarter done

| # | task | state | owner | note |
|---|---|---|---|---|
| 12 | **PERF-2, second half** — the tray re-requests cover BYTES on every card repaint | [ ] | agent | `content.ts:1230` sends `coverBytes` per candidate per repaint. A per-session memo removes the message entirely. The FIRST half — the store never wrote what it fetched — is fixed in `b08489c` |
| 13 | **PERF-3** — OpenLibrary search asks for full ISBN arrays | [?] | **founder** | ⚠ **The implied fix is a PRODUCT REGRESSION and the item does not say so.** That ISBN feeds `sameBook`'s unconditional match, every Buy link, and the Goodreads dedup column. Options: accept the ~70KB per 20-query burst, or fetch lazily for the book actually SAVED, which adds a round trip to the save path |
| 14 | **PERF-8** — `/api/vision` buffers the whole image before opening upstream | [ ] | agent | ~55–138KB per image, two copies in flight |
| 15 | **PERF-10's remainder** — entitlement reads still serial before the image download | [ ] | agent | **Half closed by item 49's R-1**: the licence renewal no longer blocks a catch that holds a usable session |

### Decisions and probes that are NOT agent work

| # | task | state | owner | note |
|---|---|---|---|---|
| 21 | **Item 58** — ADV-7, two catch flows derive two jobs for one post | [?] | **Maximo** | Split out of 47. The flows key differently ON PURPOSE; folding them changes what the model is asked. **Three options costed in the item body.** Costs one trial catch, only when one post is caught both ways |
| 22 | **Item 59** — C-3, a dead activation has no escape but wiping the shelf | [!] | **Maximo** | Split out of 48. **BLOCKED on item 2.** One request against the live validate endpoint settles it: does Polar distinguish *"this activation does not exist"* from *"this licence is refused"*? |
| 23 | **`OPENWORK.md` is over its size budget** | [?] | **founder** | See "The doc system" below. Structural fix, not a trim |

### Maximo's launch chain

| # | task | state | owner | note |
|---|---|---|---|---|
| 24 | **Item 37** — draft upload → the real extension id | [ ] | **Maximo** | **THE CHAIN STARTS HERE.** Zip, upload as DRAFT, do not publish, copy the public key into `manifest.json` as `key` |
| 25 | **Item 2** — the six Vercel variables | [ ] | **Maximo** | Blocked on 24. Also unblocks item 59's probe |
| 26 | **Item 3** — the by-hand browser pass | [ ] | **Maximo** | No agent can ever tick this. **Three checks added this session — rows 27–29** |
| 27 | By hand: **the Buki button still appears on x.com** | [ ] | **Maximo** | ⚠ **The one change this session that no test can verify.** TM-14 removed the host permission. If Chrome stops injecting, catch-on-X is gone and nothing in this repo would say so |
| 28 | By hand: the Forget control, and that no REQUIRED host is ever listed | [ ] | **Maximo** | `pbs.twimg.com` and `openlibrary.org` must never get a Forget button — `permissions.remove` declines them and the button would lie |
| 29 | By hand: export a shelf with a title starting `=`, open it in Excel | [ ] | **Maximo** | The cell must read as text AND the ISBN column must still import |
| 30 | **Item 9** — five Web Store screenshots at 1280×800 | [ ] | **Maximo** | Unblocked by item 45 now that the price guard covers the listing |
| 31 | Reshoot all five captures at **DPR 2** | [ ] | **Maximo** | All five are 1× (604×762 down to 351×587). **Cannot be fixed downstream** |
| 32 | By hand: the `+` on an EMPTY shelf | [ ] | **Maximo** | From the 08-27 launch-prep pair. No test can reach it |
| 33 | By hand: re-adding an owned book MOVES it | [ ] | **Maximo** | Logic guarded, wiring is not. **Item 47's ADV-6 fix touches this exact path — re-check it** |
| 34 | Confirm the $5 Gemini cap STOPS spending, not emails | [ ] | **Maximo** | A Google Cloud *budget* is an alert and caps nothing |
| 35 | Alert BELOW the cap, ~50% | [ ] | **Maximo** | So the first news is not the outage |
| 36 | **Item 56** — probe the CORS redirect chain | [ ] | **Maximo** | One curl. If wrong, every shelf cover silently falls back to a drawn board |
| 37 | **Item 35** — the affiliate tags are empty | [ ] | **Maximo** | After launch. Amazon is blocked BY launch; Bookshop is awaiting review |

### Launch-day and after-launch agent work

| # | task | state | owner | note |
|---|---|---|---|---|
| 38 | **Item 36** — five install CTAs become the store URL | [ ] | agent | **Launch day only.** Five change, THREE must not (two `Source` links and `Report a problem`). `host.test.ts` fails a half-migration |
| 39 | **Item 57** — find a book from a PASSAGE | [ ] | agent | **After launch.** The naive design is dead (probed 08-27). Next step is one probe: can `search/inside` be scoped to a work? |

### Found this session and not yet closed

| # | task | state | owner | note |
|---|---|---|---|---|
| 40 | `cover.ts:applyCover` fetches a cover TWICE on a cache miss | [ ] | agent | `img.src = url` AND `rememberCover(url)`. **NOT fixed on purpose**: the second is probably an HTTP-cache hit and browser cache behaviour is not measurable from node. Folds into item 50 |
| 41 | An options-page control: **"pair this install again"** | [?] | **founder** | Fell out of item 59's analysis. The customer knows which failure case they are in and the code does not. Would close C-3 without needing Polar's refusal codes |
| 42 | The session's stated scope included **business and iOS design** and neither was worked | [?] | **founder** | Honest gap — see below |
| 43 | `README.md:103` lists `tools/mark-sizes.mjs` as working; it is 100% dead | [ ] | agent | Item 54's M-2. Called out separately because `README.md` is the file a stranger reads first |

---

## What was asked for and NOT done

The session opener named **business, backend, features, efficiency and optimization, design,
iOS design**. What actually happened was **backend, features, efficiency and optimization** —
items 45 to 50, the agent lane top-to-bottom.

- **Business** was touched only where it intersected correctness: the store listing's price
  guard (item 45), the store permission answers and the privacy copy (item 46), and the
  host-permissions paste block re-measured against its 1000-character field. **No positioning,
  launch-sequence or marketing work was done.** `.agents/product-marketing.md` and
  `docs/store/launch.md` are untouched.
- **Design** got one real surface — the *Sites Buki can reach* section on the options page
  (item 46, TM-11), built as an iOS inset grouped list in the page's existing materials, with
  the separator inset to the row's own padding rather than run full-width. **No broader iOS
  pass was made**, and the lane did not need one.

Recorded as task 42 rather than quietly dropped. **If the next session is meant to be a
business or design session it should say so and start from `.agents/product-marketing.md` and
`docs/brand.md`, not from THE LANE.**

---

## Checkpoint log

| # | what | outcome |
|---|---|---|
| 1 | Session start protocol run in CLAUDE.md's order | ledgers created before probes, first time in six sessions |
| 2 | Five probes | **860/72, not the inherited 856/71.** `5461211` landed after the 08:29 handoff was written |
| 3 | Item 45 re-probed before planning | two statements in the item's own text were false |
| 4 | Item 45 guard written and mutated | **6/7 first pass.** The survivor: an editorial note QUOTING the copy satisfied a guard on the copy |
| 5 | Item 45 committed | `e521839` |
| 6 | Item 46 re-probed | TM-11 is a feature, not a false claim. TM-4 confirmed live at `cover.ts:applyCover` |
| 7 | TM-8 fixed, and probing it found a SECOND vector | `isbnCell` writes a live formula; openlibrary.org is a wiki. 7/7 |
| 8 | TM-14 removed after proving nothing depends on it | content script does zero fetches; one `executeScript` site, under `activeTab` |
| 9 | TM-4 / TM-7 copy corrected; paste block re-measured 953 → 883 | `storeCopy.test.ts` owns that number now. 8/8 |
| 10 | Item 46 part one committed | `9c2b268` |
| 11 | TM-11 built: `grantedHosts.ts` + the options section | **the absence proof failed on its own docblocks first.** 11/11 |
| 12 | TM-11 committed | `24433f9` |
| 13 | Harness caught running the WRONG target and fixed | reported two files, ran all 889. Right answer, wrong reason |
| 14 | Item 47 re-probed | **ADV-6's prescribed fix is wrong for the common case; C-5's correct rule is not transitive** |
| 15 | ADV-6, C-5, C-6 fixed and mutated | 9/9. **Mutation `47b` applies the review's own fix verbatim and is caught** |
| 16 | C-7, C-9 fixed | 7/7, after two tray tests were added for a field only the compiler protected |
| 17 | C-8 fixed | 5/5. `coversToKeep` + an absence proof on the popup wiring |
| 18 | Item 47 committed; ADV-7 filed as item 58 | `ff09658` |
| 19 | Item 48 re-probed | ADV-3 confirmed: **undefined does not survive `JSON.stringify`**, so every renewal re-activates |
| 20 | **C-3 attempted twice and REVERTED twice** | item 27's premise does not expire; five existing tests encode it; the probe needs live endpoints |
| 21 | Item 48 committed | `261852c`. One mutation proved EQUIVALENT and the condition was deleted rather than counted |
| 22 | `CLAUDE.md`'s size warning corrected | it claimed ~100 lines of §5 were reachable; §5 now BEGINS past the cut |
| 23 | Handoff written, pointer updated, `cat -A` clean | `%TEMP%/buki-handoff-2026-08-27-review-lane.md` |
| 24 | Item 49 re-probed | **R-1's comment in `licenseHandler.ts` was false from the day it was written** |
| 25 | R-1, R-4 fixed and committed | `0486712`. 11 mutations, **2 survived**: the signal composition, and `livePrep` being unreachable |
| 26 | R-2's cooldown had to be PERSISTED | MV3 teardown kills module scope. **Item 27's `Required<ProState>` fixture caught the missing `readPro` line** |
| 27 | R-3's number DERIVED from the pipeline's ceilings | three constants exported so the test computes the budget rather than trusting a comment |
| 28 | R-2, R-3 committed | `b006efc`. 14 mutations, **2 survived**: a NaN cooldown, and a FIXED test clock |
| 29 | Item 49 closed in OPENWORK | `608dba8`. The open count moved by ONE while FIVE items closed |
| 30 | Item 50 re-probed | PERF-1 partly expired (mapPool landed 08-27) but **its sibling in `groundText` was untouched at 21 concurrent** |
| 31 | `groundText` bounded; `coverData` caches | `b08489c`. `GROUND_AT_ONCE` moved to `mapPool.ts` so one ceiling covers both callers |
| 32 | PERF-7 extracted from `background.ts` and indexed | `12c9055`. **3 mutations survived**: every fixture let the candidate and the shelf share a `bookKey` |
| 33 | PERF-4, PERF-5 | `d4a96de`. **A literal NUL byte reached a source file** and only a mutation ABORT found it |
| 34 | Item 50 left OPEN at five of nine | `b9ecce1`. PERF-3's implied fix is a product regression |
| 35 | **The mutation harness promoted out of `zzz-`** | `bd0e628`. `.gitignore:17` is `zzz-*`; the instrument and all 14 plans would have been deleted with the scratch |
| 36 | Everything captured, all docs updated, pushed to `origin/main` | this rewrite |

---

## Product bugs found this session, and where each went

| # | Bug | Where it went |
|---|---|---|
| 1 | **A second CSV formula-injection vector the review did not file.** `isbnCell` emits `="<isbn>"`, which IS a formula, and `openLibrary.ts:44` casts `doc.isbn[0]` out of a wiki anyone may edit | Fixed, `9c2b268`. Item 46's body |
| 2 | **The store's host-permission answer described two permissions the manifest no longer held** — created by fixing TM-14, caught before commit | Fixed in the same commit; `storeCopy.test.ts` now fails in BOTH directions |
| 3 | **The paste block's character count was measured by hand once and had drifted** | `storeCopy.test.ts` owns it, counted with CRLF |
| 4 | **`shotFor` counted books and never pictures**, so a four-photo post yielding one book stored photograph ONE as that book's cover | Fixed, `ff09658`, C-9 |
| 5 | **`postKey` dropped the host**, so two sites sharing an image path were one catch — a MEMO HIT returning the first post's books for the second | Fixed, `ff09658`, C-7 |
| 6 | **The cover cache was pruned INSIDE the 8s undo window**, so Undo restored a book to a drawn board | Fixed, `ff09658`, C-8 |
| 7 | **`groundText` fired 21 concurrent searches at openlibrary.org** — more than the nineteen that caused the 08-27 outage. The 429 fix covered one of two fan-outs | Fixed, `b08489c`. **The largest finding of the session, and it was not in the review** |
| 8 | **`coverDataUrl` read the cache and never wrote it**, so every cover it fetched was a miss by construction | Fixed, `b08489c` |
| 9 | **`paint()` did five storage reads per keystroke** under a comment saying it did none, and launched both with `void` from a synchronous function | Fixed, `d4a96de` |
| 10 | **A literal NUL byte in `generatedCover.ts`** — invisible in the editor and in `git diff` | Fixed, `d4a96de`. §5 T19 |
| 11 | **`cover.ts:applyCover` double-fetches on a cache miss** | Task 40. NOT fixed — browser HTTP-cache behaviour is not measurable from node |

---

## Ideas raised, and where each went

| Idea | Where it went |
|---|---|
| A **"Forget all sites"** button beside the per-row Forget | **Deliberately not built.** The list is typically 0–3 rows because the common cover hosts are REQUIRED and never listed; a bulk wipe with no undo is a footgun. Revisit if real usage shows long lists |
| Derive "customer-facing" from `.vercelignore` for the price guard | **Tried and rejected.** `docs/store` IS vercel-ignored and `listing.md` is the most customer-facing price surface there is. The derived population looked elegant and was wrong |
| Allowlist the cost figures so the blunt `$N` rule could be widened | **Rejected.** An allowlist holding `4.99` waves through *"Buki Pro is $4.99 a month"* |
| An options-page **"pair this install again"** control | **Task 41, founder decision.** Would close item 59 without needing Polar's refusal codes |
| Fetch the ISBN **lazily**, only for the book actually saved | **Task 13, founder decision.** The only PERF-3 option that does not regress the product, and it adds a round trip to the save path |
| Put the mutation harness and the benches under `tools/` | **Done, `bd0e628`.** They were one `rm` from being lost |
| Replace CLAUDE.md's quoted line numbers with the probe | **Done, `b9ecce1`.** They went stale twice in one day about the same fact |

---

## Measurements

**Point, do not copy.** Every measurement, with the probe that produced it and the population
it was taken over, lives in `docs/SESSION-CONTEXT-2026-08-27-review-lane.md`. Duplicating them
here is how two docs start disagreeing.

---

## The doc system — task 23, and it got worse today

`OPENWORK.md` went from **196,000 chars / 2,545 lines to 227,569 / 2,895 in one day — 16%.**
**§5 now begins at line 2159 and the Read tool takes 2000**, so the entire case ledger is
unreachable in one read: every trap that has already cost this project time.

`CLAUDE.md` was corrected **twice today** for this, the second correction needed within ninety
minutes of the first. It no longer quotes line numbers at all — it names the probe
(`grep -n '^## [56]\.' OPENWORK.md`), because a hand-copied number in a growing file is the
wrong mechanism.

**The fix is structural, not a trim**, and `maintaining-project-docs` Rule 8 says how: extract
§5's CASES to a companion file, leave the LAWS behind as named rules with pointers, and move it
**provably** — byte-identical text, a hash of the moved span pinned in a test, and a
both-directions reachability assertion (every moved entry reachable from the front doc, every
section of the front doc naming at least one entry). That guard went red on its first run
elsewhere and found six entries nothing pointed at.

**Not started, because it restructures the file every session plans from.** Founder's call.
