# Open work

**State as of 2026-08-27**, verified by running the commands, not from memory:

| | |
| --- | --- |
| Tests | **1,019 across 76 files**, all passing (`./node_modules/.bin/vitest run`, 2026-08-27). **This row read 856/71 for half a day and both the header and the handoff carried it**: `5461211` added `agentRules.test.ts` after the 08:29 handoff was written, and item 45 added six more. Re-derive it; do not carry it. **The caveat has changed rather than gone.** On 2026-08-24 the review mutation-tested six behaviours and FIVE survived. On 2026-08-25 the six P0 fixes were each mutation-tested as they landed — **55 mutations, 52 caught immediately, and the three that survived were real holes in tests written minutes earlier.** The review's OWN mutation table (§3) was then re-run against the suite: **all six now fail, where five used to pass.** Both are now closed and recorded in §5. Green still is not covered; what is different is that the parts touched this session have been shown to fail |
| Mutations | **94 run, 94 caught** on 2026-08-27 (`node tools/mutate.mjs tools/mutations/<plan>.json`, 14 plans). **13 survived first pass**, every one a real hole in a test written minutes earlier; **1 proved EQUIVALENT** and answered by deleting the condition; **1 ABORTED as INVALID** rather than scored. The harness and every plan were promoted out of `zzz-` in `bd0e628` — `.gitignore:17` is `zzz-*`, so all of it was one `rm` from being lost |
| Typecheck | `tsc --noEmit` exit 0 (now covers `api/` too) |
| Build | `node build.mjs` clean |
| Working tree | clean |
| Reliability | **The catch path had a self-inflicted outage and it is fixed, 2026-08-27** (item 58 in §5, commit `18f89d7`). `recognizeBook` grounded its guesses with a bare `Promise.all` and `MAX_BOOKS` is 20, so a nineteen-book photograph opened **nineteen simultaneous connections to openlibrary.org** and was answered `HTTP 429`. The rate-limited address then went silent, sixteen 6s timeouts cleared `TOLERANCE` of 3 six times over, and the catalogue was gone for the full two-minute `COOLDOWN_MS`. It presented as *"covers are not loading"*. Bounded at `GROUND_AT_ONCE = 4` by `src/recognizer/mapPool.ts`, and `warmCovers` reuses the same pool so the fix was not undone one hostname over |
| Mark | **the catcher** — a blue ball with two eyes, from Maximo's drawing, 2026-08-17. It replaced three spines on all six surfaces plus the rasteriser. `tools/mark.mjs` |
| Generations | landing **third**; popup, setup page and catch tray **fourth** (iOS neutrals, 2026-08-16). They are deliberately different — see `docs/brand.md`, *The iOS turn* |
| Security | **The six pre-launch P0s are closed, 2026-08-25** (items 38-43), **and item 44 with them**. `/api/vision` rebuilds the request body instead of relaying it, the licensed path has a ceiling and an off switch, a Polar 5xx no longer deletes a subscriber's session, a hostile page cannot drive the tray, the card's × is not a free read, and the activation reuse is extracted and tested with real values. **Evidence: `docs/REVIEW-2026-08-24-prelaunch.md`; order and status: THE LANE below.** The wire contract (item 44) is closed too, which was the one piece of work with a real deadline: AC-3, AC-4, AC-7, AC-8 and the extension-id blind spot. **Nothing security-shaped is open.** |
| Paid tier | **written, wired to a till, still switched off.** The checkout links landed 2026-08-18 (item 34) so the funnel is no longer a circle. What remains is credentials, not code: Every client and server module exists and is tested. The Polar products were created 2026-08-17; the variables (item 2, **six of them**) are what remain. See items 10–16. **The renewal bug that would have broken every subscriber took TWO fixes** — the handler on 08-18 (`cdda054`) and the storage READ the same day (`3012b30`), without which the first one was inert. See item 27 |
| Branch | **`main`**, tree clean. **PUSHED 2026-08-27 (evening). `main` = `origin/main` at `640d451`, 0 ahead** (`git rev-list --count origin/main..HEAD`). **Eighteen commits went up in one go**: items 45-49 closed, item 50 taken to five of nine, the mutation harness promoted out of `zzz-`, and the whole session captured. **84 commits since `d3e5923`** (`git rev-list --count d3e5923..HEAD`). ⚠ **THIS ROW NAMED `60b98e4` UNTIL THE PUSH ABOVE HAD ALREADY LANDED**, which is the drift this file keeps paying for, in miniature, for the second time in one day - it was corrected in the same session rather than inherited. **The figure beside a commit count is written INTO the commit that changes it and is therefore wrong by one the moment it lands - that has happened five times. Run the probe.** |
| Plan | `grep -c` on `2026-08-09-buki-pro.md`: **68** done, **17** left. Task 15 closed except Step 2 (a real Chrome + a Polar test card) |
| Open items | **17.** (`grep -c '^- [ ] **[0-9]' OPENWORK.md`, 2026-08-27, second lane.) **Ten are Maximo's (2, 3, 9, 35, 37, 56, 58, 59, 60, and 57 now needs his call first); seven are agent work (36, 50-55).** **Item 57 moved from agent to Maximo without closing**, because the second probe answered the engineering question and left a positioning one. **Item 60 was filed by the commit that CAUSED it**, which is the only honest moment to file a trade-off. **Items 45, 46, 47, 48 and 49 closed 2026-08-27**, and items 58 and 59 were filed out of 47 and 48 - so this number moved by one while FIVE items closed. **Read the LANE, not this number.** It read 14 on 08-25, fell to 8 as the six P0s and item 44 closed, rose to 20 when the rest of the 08-24 review was filed as items 45-56, and is 19 now: items **1 and 26 closed on 08-27** and item **57** was added. **THE COUNT WAS 20 AND WRONG FOR HALF A DAY.** The LANE rows for 1 and 26 were struck the moment they closed and their Part 2 CHECKBOXES were not, so the file disagreed with itself and the stale half was the one a reader reaches second. Found by counting both and comparing, which is now the probe: `grep -o '^| \*\*[0-9]*\*\*' OPENWORK.md` must return the same set as the item bodies |

*(Re-derived every time this header is touched, never carried. **A commit count written
into a commit is wrong by one the moment it lands**, which is how this number has drifted
three times now, so the probe is given beside it. Run the probe; do not trust the figure.
The test count has drifted the same way: it read 345 while the suite was at 375, and on
2026-08-17 this header was written as 512 and three tests were added before the commit
landed. **Both numbers here were corrected by the verification gate, not by noticing.**)*

## THE LANE — who does what next, in order

**Read this before anything else.** Every item is numbered across the whole document, so
"do 28 next" is unambiguous. This table is the ORDER; the items themselves carry the why.

| # | Lane | Item | Blocks |
| --- | --- | --- | --- |
| ~~1~~ | **Maximo** | ~~Polar product exists; verify the benefit's activation settings~~ **DONE 2026-08-26.** The License Key benefit is attached to **both** products. The settings were already right - prefix `BUKI`, expiry off, limit 5, customer can deactivate, usage limit empty - but the benefit was **not attached**, which is the silent failure `polar-setup.md` warns about by name: a subscriber pays, receives no key, and refunds rather than filing a bug | — |
| **2** | **Maximo** | The six Vercel variables, **one of which stays unset** | `/api/vision`, `/api/license` |
| ~~26~~ | **Maximo** | ~~Hard spend cap + alert on the Gemini key~~ **CAP SET 2026-08-26, at $5.** At the `$0.00011` per catch `entitlement.ts` and `policy.ts` both assume, that is roughly **45,000 catches, or 4,500 users' entire free trials** - ample for launch. **TWO THINGS REMAIN AND BOTH ARE MAXIMO'S:** (a) confirm it STOPS spending rather than emailing, because a Google Cloud *budget* is an alert by default and does not cap anything; (b) set the alert **below** the cap, ~50%, so the first news is not the outage. **Raise it the day there are paying subscribers** - a tripped cap takes Pro down with it | — |
| ~~28~~ | agent | ~~`/api/license` has no rate limit~~ **DONE 2026-08-18** (`c5e3f64`) | — |
| ~~29~~ | agent | ~~`proState` has no write queue around a call that spends a slot~~ **DONE 2026-08-18** (`b1676e9`) | — |
| ~~30~~ | agent | ~~Extract `handleSaveBook` so the `?raw` guard's blind spot closes~~ **DONE 2026-08-18** (`99d6cae`) | — |
| ~~34~~ | ~~Maximo, then agent~~ | ~~**NOBODY CAN BUY.**~~ **DONE 2026-08-18.** Both checkout links are in `src/shared/pricing.ts` and on the Pro card, inside `#pricing` where the wall lands. Guarded, and earned with an A/B. Original text: Polar gives each product a checkout link and neither exists yet, so all three in-extension CTAs land on the landing's `#pricing`, whose Pro button sends you to GitHub to install the extension you already have. **The funnel is a loop with no till in it.** Recorded in `polar-setup.md` §9 and in a superseded ledger, never in this table until 2026-08-18 | every sale |
| **36** | agent, on launch day | **Every install CTA on the landing points at GitHub.** Honest today, wrong the moment the item is listed. **Five change, three must not** - two `Source` links and `Report a problem` stay GitHub, and a find-and-replace would move them. Guarded: `host.test.ts` fails a half-migration | the whole funnel, on day one |
| ~~45~~ | agent | ~~The price is spelled in three places `pricing.test.ts` cannot see~~ **DONE 2026-08-27.** **It was TWO places, not three, and the prescribed fix was wrong.** `launch.md` does not state the price - its only `$29` is *"subscriber pays $29, gets nothing to paste"*, prose about a failure mode. And *"widen the glob, same shape, one line"* is **red on arrival**: measured, the blunt `$N` rule finds ~40 undeclared figures across 12 files and every one is a COST (`$0.00011` a catch, the `$5` cap, `$3.46`, `$2.50/M`). The reflex answer is an allowlist, and an allowlist holding `4.99` waves through *"Buki Pro is $4.99 a month"*. The unit is a **price CLAIM** - a figure whose next words say how long it buys. **7 mutations, 7 caught, and the first pass caught 6: deleting the price sentence from `listing.md` left the guard green because line 23's editorial note QUOTING that copy satisfied it** | items 9 and 11, irreversibly |
| ~~46~~ | agent | ~~Four privacy and permission claims that are not true~~ **DONE 2026-08-27**, `9c2b268` + `24433f9`. **TM-8 was the only live hole and probing it found a SECOND vector the review did not file**: `isbnCell` writes `="<isbn>"`, which IS a formula, and `openLibrary.ts:44` casts `doc.isbn[0]` out of a wiki anyone may edit. **TM-11 was not a false claim at all** - `permissions.md` is right that Buki never holds access to a site nobody right-clicked - it was a missing feature, and the options page now lists every granted site with a Forget beside it. **18 mutations across the two commits, 18 caught.** ⚠ **One thing no test can prove: that Chrome still injects on x.com after TM-14 removed the host permission. Item 3, by hand** | store review |
| ~~47~~ | agent | ~~Re-catching a book destroys the good record, plus five ways two books become one~~ **DONE 2026-08-27**, `ff09658`. Six of the seven closed. **THE PRESCRIBED FIX FOR ADV-6 IS WRONG**: a spread keeps a previous value only when the incoming KEY IS ABSENT, and `openLibrary.toBook` ALWAYS writes `isbn` and `coverUrl` even when undefined - so `{...previous.book, ...book}` wipes the cover on any sparse-but-matching doc, which is ordinary. **C-5's correct rule is NOT TRANSITIVE** and therefore cannot live in a Map key, so `bookKey` and `sameBook` now sit at different resolutions on purpose. **21 mutations, 21 caught, 3 survived first pass.** ADV-7 split out as item **58** | the shelf, which is the product |
| **58** | **Maximo** | **Two catch flows, two jobs, two trial spends for one post** (ADV-7). Not a bug an agent may fix: the flows key differently ON PURPOSE, and folding them changes what the model is asked | one trial catch, per post caught both ways |
| ~~48~~ | agent | ~~The activation lifecycle's last three holes~~ **TWO DONE 2026-08-27**, `261852c`. ADV-3: the server minted a session with no activation id, and undefined does not survive `JSON.stringify`, so **every renewal activated again** - five slots gone in five days. ADV-8: `ensureSession` says it never throws and both saves sat outside the `try`. **C-3 IS NOT FIXED AND THAT IS THE FINDING** - two fixes were written and both reverted, because item 27's premise does not expire and telling the two cases apart needs Polar's refusal codes, which cannot be probed until item 2. Split out as item **59** | every subscriber, eventually |
| **59** | **Maximo**, then agent | **A DEAD ACTIVATION HAS NO ESCAPE BUT CLEARING STORAGE, which destroys the shelf** (C-3). Blocked on item 2: one probe against the live endpoint settles it | a subscriber who deactivates an install |
| ~~49~~ | agent | ~~Four reliability holes on the path somebody is waiting on~~ **DONE 2026-08-27**, `0486712` + `b006efc`. **ALL FOUR.** R-1's comment in `licenseHandler.ts` - *"never during a catch"* - **was false from the day it was written**, which is why a missing timeout on the catch path went unnoticed. R-2's cooldown had to be PERSISTED, because an MV3 worker is torn down between catches and module scope does not survive. R-3's watchdog number is DERIVED from the pipeline's own ceilings rather than guessed, which is why this exports three of them. **25 mutations, 25 caught, 4 survived first pass** | a catch that hangs, on someone else’s page |
| **50** | agent | **FIVE OF NINE DONE 2026-08-27**, `b08489c` + `12c9055` + `d4a96de`. **The biggest was not in the item**: the 08-27 429 fix bounded ONE of two fan-outs at the same host, and `groundText` was still firing **21 concurrent** searches - more than the nineteen that caused the outage. PERF-2 (half), PERF-4, PERF-5, PERF-7 closed with before/after numbers. **REMAINING: PERF-2's tray memo, PERF-3, PERF-8, PERF-10.** PERF-3's implied fix is a product regression - see the body | the first impression |
| **51** | agent | **FIVE OF NINE DONE** — `b8b33fa` (PERF-6/SEC-4), `fa5ab8f` (SEC-3), and TM-12. **The one worth reading: `ipCap` carried a written argument for why it needed no eviction, and the argument was IPv4 reasoning beside an IPv6-capable edge** — a /64 delegation gave one caller 2^64 keys, so the brake was a no-op and the map unbounded. **REMAINING FOUR: AC-5, AC-6, AC-10, AC-12.** R-6/TM-13 and AC-9/TM-6 closed 08-28 All re-probed and confirmed still open on 08-27 | — |
| **52** | agent | **The tray lives in the host page's light DOM** (TM-9 exfiltration surface, TM-10 latent `javascript:`) | — |
| **53** | agent | **Types that do not type** (TS-1/2/3/4/7). TS-7 is the flag that would have made the `activationId` bug red | every future silent-drop bug |
| **54** | agent | **Dead code, stale comments, one edge against the graph** (M-1, M-2, M-3, X-2, X-3, X-5, X-6, D-5, D-7, D-9, K-1, five stale comments). All re-confirmed by grep on 08-25 | `README.md` currently lies |
| **55** | agent | **The two surfaces no test can reach** (M-5 the context-menu orchestration, M-6 the whole card renderer including the paywall) | — |
| **57** | **Maximo decides, then agent**, AFTER LAUNCH | **Find a book from a passage. PROBED TWICE 2026-08-27 AND THE SECOND ROUND OVERTURNED THE FIRST.** The floor round one said might not exist is there: field filters are dead but a **bare boolean term** scopes the query (2,228 hits → 227, the book from absent-in-the-top-3 to **rank 1**), and comparing the model's proposed title against the returned hit titles **discriminated 5/5** and refused 7 of 8 wrong-book-right-author hallucinations at **no extra request**. **The blocker is no longer ranking, it is COVERAGE** — four modern in-copyright novels, none found, two returning zero hits. `node tools/probe/passage-grounding.mjs` | **a positioning call, not a build** |
| **60** | **Maximo** | **Several artless books from one photograph now show the same tile.** Opened deliberately by `cae4ad1`, which is the founder's *"when we find no cover book, we use the original image"*. Honest but repetitive on a face-out shelf. Two ways out are costed in the body; doing nothing is a real option | the shelf's first impression |
| **56** | **Maximo** | **The CORS redirect chain has never been probed** (review §7). One curl. If it is wrong every shelf cover silently falls back to a drawn board | item 3 |
| **35** | **Maximo** | **The affiliate tags are empty.** `AFFILIATE = { amazonTag: '', bookshopId: '' }`, so every Buy link works and earns nothing. The disclosure is already in three places, which is the half that is done. **2026-08-26: Amazon is blocked BY launch** - Associates wants the property URL and the store URL does not exist until the draft is published. Bookshop is applied for and awaiting review. **Not a launch blocker either way** | affiliate revenue, AFTER launch |
| **37** | **Maximo**, then agent | **THE EXTENSION ID CHANGES WHEN YOU PUBLISH**, and `BUKI_EXTENSION_ID` gates both endpoints. Upload the zip as a draft FIRST, copy the public key into `manifest.json`, and the unpacked id becomes the shipped id | items 2, 3 |
| ~~38~~ | agent | ~~`/api/vision` forwards the body verbatim.~~ **DONE 2026-08-25.** The body is REBUILT, not relayed: `src/server/visionBody.ts` pins the model, clamps `max_tokens`, caps bytes/images/prompt, and emits a three-key allowlist so `n`, `service_tier`, `stream` and `extra_body` have nowhere to go. Six mutations run against the new guards, **six caught** | — |
| ~~39~~ | agent | ~~A Polar 5xx becomes 403 and the extension deletes a paying subscriber's session.~~ **DONE 2026-08-25.** Both halves. The rule now lives once, in `src/shared/retry.ts`, used by `licenseHandler`, `license.ts` AND `llmVision.ts` — the two clients that had drifted. **Six mutations, six caught**, in both directions | — |
| ~~40~~ | agent | ~~No rate limit at all on the licensed path.~~ **DONE 2026-08-25.** `proCap.ts`: 500 catches per LICENCE per day, keyed on the `licenseKeyId` `decideAccess` was already computing and throwing away. Plus `BUKI_REVOKED_KEY_IDS`, the first targeted incident lever this product has. **A leaked token is now worth about $0.54 for its whole life.** Six mutations, six caught | — |
| ~~41~~ | agent | ~~A hostile page can drive the tray.~~ **DONE 2026-08-25.** Three seams, each extracted and tested for real: `realClick.ts` (`isTrusted`, on real events), `feedHost.ts` (the scanner arms only on X), `twitterImage.isTweetMedia` (hostname, not substring). `contentSafety.test.ts` proves the ABSENCE of any second way in. **Seven mutations, seven caught** | — |
| ~~42~~ | agent | ~~The card's x is a free-read button.~~ **DONE 2026-08-25.** Both halves: the server now hands Gemini `request.signal`, so calling a catch off actually stops the billing, and `TRIAL_ATTEMPTS` bounds doing it on purpose. **Both ceilings fold into `trialLeft`**, so the wall and the options page cannot tell one person two stories. Nine mutations; **one survived and found a real hole** | — |
| ~~43~~ | agent | ~~The options page's slot reuse is deletable with 620/620 green.~~ **DONE 2026-08-25.** `activateKey.ts` — and the ORDER came out as well as the arithmetic, because a mutation proved extracting only the arithmetic left the handler free to bypass it. The review's own mutation now fails six tests | — |
| **3** | **Maximo** | The by-hand browser pass. **No agent can ever tick this** | item 9 |
| **9** | **Maximo** | Five Web Store screenshots at 1280x800. **The frames, the headlines and the staging are done** (`docs/store/assets.md`, `tools/store-shots.mjs`); what is left is capturing five real ones and re-running the tool | item 15 |
| ~~17~~ | agent | ~~`docs/privacy.html` + the landing's data section~~ **DONE 2026-08-18** (`c0a3e00`). **The landing was already correct**; `privacy.html`, `README.md` and both Web Store answers were not. No DO-NOT-SUBMIT banners remain in `permissions.md` | — |
| ~~18~~ | agent | ~~Task 15 close-the-loop~~ **DONE 2026-08-18** for every part an agent can do. **Step 2 is Maximo's**: a real Chrome, a fresh profile and a Polar test card. Step 3's strikes were NOT executed and must not be | — |
| ~~31~~ | decision | ~~Relaying Polar's error text~~ **SETTLED by 28**: the oracle is now bounded at 40 probes per key per day per isolate. The text stays, because it tells a customer what to do | — |
| ~~32~~ | agent | ~~`api/vision.ts` holds its IP counter inline and untested~~ **DONE 2026-08-18** (`8e9816f`). `src/server/ipCap.ts`, 7 tests, four of them on the `x-forwarded-for` chain rule. That file is 39 lines again | — |
| ~~33~~ | agent | ~~Nothing parses `content.ts`~~ **DONE 2026-08-18** (`30a4685`). `entryPoints.test.ts` runs esbuild's transform over all four unimportable files. Earned against the REAL failure: putting the backtick back turns the suite red | — |
| ~~25~~ | decision | ~~Is the secondary button filled enough to look filled~~ **DECIDED 2026-08-18** (`1a65357`): no, by day. Moved to `--board`, hover to a new `--board-hi`. Rendered in both moods first | — |
| ~~—~~ | decision | ~~The **"Read" collision**~~ **DECIDED 2026-08-18** (`1a65357`): renamed to **Finished**. One word in `PILE_LABEL`; the stored `Intent` is still `read`, so no migration and the export is untouched | — |
| ~~—~~ | ~~agent~~ | ~~`authorName()` is an N+1~~ **NOT TRUE, checked 2026-08-18.** `groundText` uses `search`, which asks for `author_name` in `FIELDS` and pays no follow-up. The follow-up is reached only from `lookupByIsbn`, once, for ONE book on the retailer-link path. A 20-book photo costs 20 searches and zero follow-ups. Pinned by a test | — |
| ~~—~~ | ~~agent~~ | ~~The X button wears a book glyph~~ **DONE 2026-08-18** (`2b58df2`). It wears the catcher, at X's own 18px icon box. **The open-book variant was NOT built**: `.agents/product-marketing.md` rules that shape out by name, and two shapes in 18px is a smudge. Overrulable, knowingly | — |

**The critical path is 1, 2, 26.** Until the first two exist the paid tier is written and
switched off, and until 26 exists nothing bounds what abuse can cost.

> ### THE SIX P0s ARE CLOSED, 2026-08-25. The agent queue is item 44 and item 36.
>
> ~~THERE IS NO AGENT WORK LEFT IN THIS TABLE~~ — true on 08-18, false on 08-24, and true
> again on 08-25 in a different way. **Items 38-43 all landed**, each mutation-tested as it
> went in. Item 38's gate on item 37 is satisfied: the model is pinned server-side, so the
> day `BUKI_EXTENSION_ID` becomes the shipped id, `/api/vision` is reachable by anyone who
> reads the store URL but can no longer be made to buy anything the caller chose.
> **`launch.md` step 4.5 is now half-clear — item 26, the provider spend cap, is the other
> half and it is Maximo's.**
>
> **ONE NEW ITEM CAME OUT OF DOING THEM: item 44 — filed and CLOSED the same day.** It had
> a deadline rather than a severity: AC-3, AC-4, AC-7 and AC-8 all say *"cannot be added
> to clients already in the wild"*, and there are none until publication. All four landed,
> plus the fifth the review did not file — the extension-id blind spot that made item 39's
> trigger (c) invisible for eight days.
>
> **ITEMS 45-56 ARE THE REST OF THE REVIEW, filed 2026-08-25 on Maximo's instruction:**
> *"capture all this review, all points with its context. all of them. we solve them on
> next session."* Every remaining P1, the whole P2/P3 catalogue and §7 now have a number,
> an owner and an order, so none of them lives only inside a 593-line document. **Nothing
> security-shaped is open; items 45 and 46 lead because they are irreversible at a date.**
>
> The paragraph below is kept because its reasoning about MAXIMO's items is still exactly right:
>
> Everything above is Maximo's: **1, 2, 26** (a dashboard and two credentials), then
> **3** and **9** (a real browser, which no agent can drive because Chrome refuses
> `--load-extension`), and **Task 15 Step 2**, which needs a Polar test card.
>
> ~~Item 34 is the exception~~ **CLOSED 2026-08-18.** Maximo sent both checkout links and
> they are wired, so the funnel has a till. **Item 36 is the new exception**, and it is one
> agent edit that can only happen on launch day: five install CTAs become the store URL, and
> three GitHub links must not move.
>
> **A NOTE ON WHERE THE VARIABLES GO, checked 2026-08-18 with `vercel env ls`.** The Vercel
> project is called **`shelfy`**, not `buki` — it serves `get-buki.vercel.app` under its old
> name — and there is a separate `save-book-extension` project on the same account that
> looks exactly like the right answer. **The project currently has ZERO environment
> variables**, so all six of item 2 are outstanding.
>
> **Two launch blockers were found on 2026-08-18 that nothing in this table predicted**,
> and both were the same shape: written, tested, and inert. `readPro` dropped the
> activation id so item 27's fix never ran, and the manifest never granted the proxy host
> so neither endpoint could be reached at all. **Both would have surfaced only on the day
> the variables were set** — which is item 2, and is why item 3 exists.

> ### ⚠ 27 WAS FIXED TWICE, and the second half is the one worth reading. 2026-08-18.
>
> `cdda054` fixed "activate once, validate forever" in four places — the handler branches,
> the id travels back in the response, `writePro` stores it, both call sites forward it.
> **`readPro` never read it back out**, so the id was written on every exchange and dropped
> on every read, `ensureSession` handed `undefined` to the server, and the server took the
> ACTIVATE branch. A subscriber was still burning a slot a day. Fixed in `3012b30`.
>
> **Nothing was red and nothing could have been.** `activationId` is optional, so a literal
> that omits it is a valid `ProState` and `tsc` had nothing to say. The round-trip test's
> fixture had no `activationId`, so it could not see a reader that drops one. Every
> `ensureSession` test passed the id in as an ARGUMENT, bypassing storage — the id flowed
> perfectly in all 550 tests and never once in production. And
> `expect(optionsSrc).toContain('activationId')` is item 30's blind spot, protecting the P0.
>
> The new fixture is typed `Required<ProState>`, which makes the COMPILER enumerate the
> interface: a fourth field stops it compiling until it is named, and then the assertion
> fails until `readPro` carries it out.

---

## 0. Which doc owns which fact

The `maintaining-project-docs` skill names a generic contract set. This repo's filenames
differ, and hunting for a file that does not exist wastes the same time as reading one that
lies. **Put a fact in ONE of these; a fact in two places is a fact that will disagree.**

| The fact | Lives in | Not in |
| --- | --- | --- |
| **The rules an agent needs on TURN ONE, and the ground truth it cannot derive** | **`CLAUDE.md`** (new 2026-08-27) | this file, which is too long to be read whole |
| What is open, who owns it, what it unblocks | **this file** | any handoff |
| The visual contract: tokens, generations, the mark, the checklist | `docs/brand.md` | `DESIGN.md` |
| The mark's geometry and its measured colour values | `tools/mark.mjs` | anywhere else — six surfaces are asserted against it |
| Positioning, ICP, objections, voice | `.agents/product-marketing.md` | the landing copy |
| What the product does today | `README.md` | `DESIGN.md` |
| Tier boundaries, machine-readable | `docs/pricing.md` | the landing |
| Store copy and permission justifications | `docs/store/` | — |
| **The launch SEQUENCE**: what order, what gate, what to watch | `docs/store/launch.md` | this file, which owns STATUS |
| **How to capture the store assets**: staging per shot, and the video script | `docs/store/assets.md` | `listing.md`, which owns the shot LIST and the copy |
| The paid-tier implementation, step by step | `docs/superpowers/plans/2026-08-09-buki-pro.md` | — |
| Polar setup, field by field | `docs/superpowers/polar-setup.md` | — |
| The competitive landscape | `competitor-profiles/_summary.md` | — |
| This session's reasoning and what was measured | `docs/SESSION-CONTEXT-<date>-<label>.md` | — |
| This session's forget-nothing ledger | `docs/SESSION-TODO-<date>-<label>.md` | — |
| **WHAT WAS ACTUALLY BROKEN ON PURPOSE**, per item, so *"N mutations, N caught"* can be re-run rather than believed | **`tools/mutations/`** + its `README.md`. Run with `node tools/mutate.mjs tools/mutations/<plan>.json` from the repo root | a commit message, which cannot be re-run |
| **The before/after numbers for a performance change** | **`tools/bench/`** — one script per finding, run the SAME way before and after | a number quoted in prose, which the next session cannot reproduce |
| **Whether an idea against a THIRD-PARTY service is feasible at all** | **`tools/probe/`** — one script per question, hitting the live endpoint. **Deliberately NOT in the vitest suite**: it needs the network, and its numbers are expected to move. What it must keep proving is the SHAPE. `passage-grounding.mjs` is the worked example | the suite, which must stay hermetic; or a spec, which records a belief rather than a query |
| **The 2026-08-24 pre-launch review**: every finding, its evidence, its attack path, its fix | **`docs/REVIEW-2026-08-24-prelaunch.md`** | this file, which owns the ORDER and the STATUS |

> ### ⚠ TWO SESSIONS SHARE 2026-08-18. Filename order is not a reading order.
>
> | Pair | What it covers |
> | --- | --- |
> | `...-2026-08-18-pro-hardening` | **Earlier.** The five-agent review, the item-27 renewal P0, the merge of `buki-pro` into `main` |
> | `...-2026-08-18-launch-readiness` | **Later, and the one to read first.** Three launch blockers found and fixed, items 17/25/28/29/30/31/32/33/34/18 closed, items 34–37 filed, the launch sequence and store assets written |
>
> **A third pair now shares a subject rather than a date.** `...-2026-08-24-prelaunch-review`
> is where the six P0s were FOUND; `...-2026-08-25-p0-fixes` is where they were fixed, and it
> carries the two of the review's own prescriptions that were declined, with the arithmetic.
> Read the 24th for the evidence and the 25th for what was decided about it.
>
> They are sequential, not alternatives. The later pair carries the live state.

**`DESIGN.md` is a dated record, not a contract.** It is the 2026-07-20 design session,
kept because the reasoning explains the product's shape, and it carries its own
`PARTLY SUPERSEDED` banner naming what stopped being true. Do not update it; supersede it.

**The newest handoff** is `C:/Users/User/AppData/Local/Temp/buki-handoff-2026-08-27-review-lane.md`
(2026-08-27 evening, the second pair on that date: **items 45, 46, 47, 48 and 49 closed, item
50 taken to five of nine**, items 58 and 59 filed out of 47 and 48, and the mutation harness
promoted out of `zzz-` into `tools/`). It supersedes `buki-handoff-2026-08-27-launch-prep.md`
(2026-08-25, the six P0s fixed and the rest of the review filed). It supersedes
`buki-handoff-2026-08-24-prelaunch-review.md`, which described the same findings before any
of them were fixed, which in turn superseded `buki-handoff-2026-08-18-launch-readiness.md`.
**Forward slashes deliberately** — see §5, where a backslash in this exact pointer was eaten
as an escape and shipped a raw `0x08` byte that markdown renders as nothing. Handoffs are
written to the OS temp directory rather than the repo, and they are read once and superseded
— **a lesson recorded only in a handoff is a lesson you will pay for again.** §5 is where
things survive.

**Files this repo does NOT have, so stop looking:** `CONTEXT.md`, `CLAUDE.md`,
`ARCHITECTURE.md`, `SEO.md`, `CRO.md`, `MARKETING.md`, `COMPETITORS.md`,
`DB-REFERENCE.md`, `docs/adr/`, `docs/solutions/`, `docs/handoffs/`, `docs/retros/`.
Handoffs are written to the OS temp directory, not the repo.

**`docs/` is served publicly by Vercel.** Anything added there that is not a page must go
in `.vercelignore` in the same commit. The session ledgers are already there.

---

**This file is an ordered checklist. Work it top to bottom.** Items are numbered across the
whole document so "do 7 next" is unambiguous. Each one says who can do it and what it
unblocks.

---

## Part 1. Maximo only. Nothing in Part 3 can start until 1 and 2 are done

> ### ✅ 27 IS FIXED, 2026-08-18. Kept because the shape of it is worth not repeating.
>
> **Every paying customer's licence self-destructs in about five days.** Found by the
> adversarial reviewer on 2026-08-17 and then CONFIRMED against Polar's own documentation,
> not left as a hypothesis.
>
> `POST /v1/license-keys/activate` **creates an activation** — it spends one of the five
> slots. It is the **only** Polar endpoint this codebase ever calls. And `ensureSession`
> calls it on **every renewal**, which is daily (`needsRenewal` fires 5 minutes before a
> 24-hour token expires), with the same constant label `Buki for Chrome`.
>
> | Day | What happens |
> | --- | --- |
> | 0 | Customer pastes the key. Slot 1 of 5. |
> | 1–4 | Each day of use renews. Slots 2, 3, 4, 5. |
> | 5 | Polar answers *"Activation limit reached"*. `license.ts` maps any 4xx to non-retryable, `proState.ts` clears the session and keeps the key, `visionRoute` then sends no token, the server classifies them `trial`, and `gate.ts` throws `WallError`. **A paying subscriber is shown the "Get Buki Pro" wall.** |
>
> Nothing distinguishes this from a genuine revocation. `proState.test.ts` frames every
> non-retryable rejection as *"revoked, refunded, or the subscription ended"*.
>
> **This repo already stated the premise and missed the conclusion.** `polar-setup.md` §7
> says, in a sentence written this same session: *"Each `curl` consumes one of the five
> activation slots on that key."* That is the same call the extension makes every day.
>
> **The fix, which is Polar's own documented pattern:** activate ONCE, keep the returned
> `activation_id`, and use **`validate`** (which accepts an `activation_id` and creates no
> activation) for every check after that. The `activationId` is already captured — it goes
> into the signed token claim in `licenseHandler.ts` — and is never sent back to Polar.
>
> **RE-CHECKED AGAINST POLAR'S DOCS, 2026-08-18, via context7. No longer a hypothesis.**
> `activate` creates an activation and is *"optional if there is no activation limit"*;
> `validate` is the *"for each session"* call and takes the `activation_id` that activate
> returned. The full contract, both endpoint families, and the two ways out are written up
> in `docs/superpowers/polar-setup.md` §2.1.
>
> **FIXED 2026-08-18.** The handler branches: no activation id means a first pairing and it
> ACTIVATES; an id means it VALIDATES, which creates nothing. The id travels back in the
> response, `ProState` persists it, and `ensureSession` hands it over on every renewal.
>
> **The two response shapes are inverted and that is the trap** — activate answers
> `{ id: <activation>, license_key: { id, status } }`, validate answers
> `{ id: <key>, status, activation: { id } }`. Read one as the other and `status` is
> `undefined`, so every renewal 403s and looks exactly like a revoked subscription.
>
> **The fix was nearly undone at the wiring.** `background.ts` supplied the dep as
> `exchange: (key) => ...` and **an arrow with fewer parameters is assignable in
> TypeScript**, so it compiled, passed every test, and dropped the id. Both call sites now
> forward it, asserted in `proState.test.ts`.

- [x] **1. Create the Polar product.** **DONE 2026-08-27.** The License Key benefit is
  attached to **both** products. Every field was already right - prefix `BUKI`, expiry off,
  activation limit 5, customer can deactivate, usage limit empty - but the benefit had never
  been ATTACHED, which is the silent failure `polar-setup.md` warns about by name: a
  subscriber pays, gets no key, and refunds rather than filing a bug. The LANE row was struck
  the same day and this checkbox was not, which is how the file came to disagree with itself.
  Original text follows.

- [ ] ~~**1. Create the Polar product.**~~ **Field by field, with the reasoning and a curl that
      proves it before any code exists: `docs/superpowers/polar-setup.md`.**

      The short version. Two products, one per billing interval: Buki Pro Monthly $4 and
      Buki Pro Yearly $29. **Attach the License Key benefit to BOTH** or a yearly
      subscriber pays and gets nothing to paste in. **Enable activations on the benefit**,
      limit 5, and allow customer deactivation; `/license-keys/activate` is the call the
      whole paid tier rests on and it cannot work on a benefit without activations. Create
      an **organisation** access token with license-key read and write; that is
      `POLAR_ACCESS_TOKEN`. `POLAR_ORGANIZATION_ID` is the **UUID**, not the slug.
      The webhook Polar recommends is **not needed**: the design validates on demand and
      stores no subscription state, which is why there is no database.
      *Unblocks: item 2, then Tasks 6, 7, 9.*

- [ ] **2. Set the environment variables** in Vercel, **project `shelfy`** — not `buki` —
      all environments. **CHECKED 2026-08-18 with `vercel project ls`: there is no project
      called `buki`.** The one serving `https://get-buki.vercel.app` still carries its old
      name. `.vercel/project.json` points at it correctly, so `vercel env add` from the repo
      root lands in the right place. A sibling `save-book-extension` project existed and
      looked exactly like the right answer; **Maximo deleted it on 2026-08-18**, so the
      decoy is gone.

      **STATUS 2026-08-19, reported by Maximo: every variable is set EXCEPT
      `BUKI_EXTENSION_ID`,** which is correct and is not a gap - it is item 37. That value
      cannot be known until the draft upload assigns the real id, and setting it early from
      `chrome://extensions` is the third launch blocker, not a head start.
      (Superseded: `vercel env ls` on 2026-08-18 returned "No Environment Variables found",
      all six outstanding. **Re-probe with `vercel env ls` before trusting this line** - it
      is a report, not a measurement this file made.)
      **None of these may ever appear in a file under `src/extension/`.** That is a leak,
      not a shortcut. **Field by field, with the reasoning: `docs/superpowers/polar-setup.md` §8.**

      **This item said FIVE until 2026-08-17. There are six**, and the sixth was found by
      reading `api/vision.ts` instead of this list.

      | Name | Required | Notes |
      | --- | --- | --- |
      | `GEMINI_API_KEY` | **yes, 500 without it** | Create at https://aistudio.google.com/apikey then link billing at https://aistudio.google.com/plan_information. The free tier queues rather than erroring, which is what the 12-second hang on 2026-08-12 looked like, and "it does not throttle" is a line on the pricing page. **No model is pinned**, on purpose. |
      | `BUKI_TOKEN_SECRET` | **yes, 500 without it** | 32+ random bytes, `openssl rand -base64 32` |
      | `BUKI_EXTENSION_ID` | **yes, 500 without it** | **SET THIS LAST. See item 37.** NOT from `chrome://extensions` on an unpacked build - that id is invented locally and is not the one customers get. Upload the zip as a DRAFT, take the public key from the Package tab into `manifest.json`, and only then read the id. This row said "from `chrome://extensions` with the extension loaded unpacked" until 2026-08-19, which is the exact instruction item 37 exists to overturn |
      | `POLAR_ACCESS_TOKEN` | yes, for `/api/license` | from item 1 |
      | `POLAR_ORGANIZATION_ID` | yes, for `/api/license` | Polar settings, the **UUID** |
      | `BUKI_TRIAL_CLOSED` | **no. leave unset** | The emergency brake: `1` stops the free trial answering, with no deploy. Anything else is the same as unset. |

      The first three are checked together and return **500** if any is missing, because a
      missing secret would verify every session token as garbage and silently demote every
      subscriber to the trial. A half-configured deploy that looks like it works is the
      failure being avoided.

- [ ] **3. Task 11 Step 5: verify catch-anywhere by hand.** Six checks, written out in
      `docs/superpowers/plans/2026-08-09-buki-pro.md` under Task 11. **No agent can ever
      tick this**: Chrome stable refuses `--load-extension` and `--disable-extensions-except`,
      so there is no headless substitute. The check most likely to fail is the permission
      prompt, because `chrome.permissions.request` needs the click's user gesture and no
      unit test can prove the gesture survived the await. Watch the service worker console:
      `could not ask for` means it threw.

      > **THREE MORE, ADDED 2026-08-27 WITH ITEM 46. The first is the one that would be
      > silent.**
      >
      > 1. **The Buki button still appears in a post's action bar on x.com.** TM-14 removed
      >    `https://twitter.com/*` and `https://x.com/*` from `host_permissions`, because in
      >    MV3 a declared content script carries its own access to the sites it matches and
      >    those two entries granted nothing twice. That reasoning was checked against the
      >    code — the content script makes ZERO fetches and the only `executeScript` call
      >    site runs under `activeTab` from a gesture — but **no test can prove Chrome still
      >    injects.** If it does not, catch-on-X is gone and nothing else would say so.
      > 2. **Sites Buki can reach** (options page, last section). Grant one site by
      >    right-clicking a cover somewhere new, confirm it appears, press Forget, confirm it
      >    goes and the status line says so. Then confirm **no required host is ever listed** —
      >    `pbs.twimg.com` and `openlibrary.org` must never get a Forget button, because
      >    `permissions.remove` declines them and the button would lie.
      > 3. **Export a shelf holding a book whose title starts with `=`** and open the CSV in
      >    Excel or Sheets. The cell must read as text, and the ISBN column must still import.

      **A seventh check, added 2026-08-13 with item 6.** Decline the permission prompt, and
      right-click an image on `chrome://extensions`. Each should put a mark on the Buki
      toolbar button with the reason in its tooltip, and clear itself after 6 seconds.
      This is unit-tested against a fake `chrome.action` and has **never been seen in a
      real browser**, for the same reason as everything else in this item.

      **A tenth to a thirteenth, added 2026-08-16 with the bug pass. None of these can be
      unit-tested, and three of them are the fixes themselves.**

      - **Right-click a photo holding SEVERAL books.** Save two of them. Each must arrive
        on the shelf with **its own** cover. Until today they all wore the photograph.
      - **Catch two books in quick succession**, so the second card arrives while the
        first is still settling. No card may overlap another. The travel is 280ms and the
        interrupting reflows fire at 115ms and 200ms, so this reproduces easily.
      - **The popup's rounded corners.** Rewritten 2026-08-16 (second pass), because the
        first version of this check described the wrong mechanism. The radius is now on
        `.win`, an element inside `<body>`, since a background on the root or the body
        propagates to the canvas and no radius clips a canvas. Corner roundness is now
        proven by a corner pixel in headless. **What is still unproven is what Chrome
        paints OUTSIDE the radius in a real popup bubble** — the document canvas is
        deliberately transparent now, so that area is Chrome's own base colour, which
        should follow `color-scheme`. Check both moods. A white corner at night is the
        failure to look for.
      - **The tray's typeface on a strict-CSP page** (GitHub, or a bank). The font is a
        `data:` URL registered with `FontFace`, and a page's own `font-src` may refuse it.
        Refusal is meant to fall through to the system stack, not to break the card.
      - **A catch holding TWENTY books**, on a laptop. Added 2026-08-16 (second pass). The
        card's book list is now bounded at `min(50vh, 380px)` and scrolls inside the card;
        the head and *Save all* must stay put, and the card must never be taller than the
        tray. Three books must NOT scroll. `node tools/tray-harness.mjs` renders both, but
        only a real page can show it landing on somebody else's scroll.

      **A ninth, added 2026-08-16 with the extension's second mood.** On a machine set to
      dark, open the popup: it should be dark. Press the switch in the **top left**. It
      should go cream and stay cream when the popup is closed and reopened, and the setup
      page should agree, because both are extension-origin pages sharing one
      `localStorage`. **No unit test can prove this.** The harness proves it over http,
      which is a different kind of origin from `chrome-extension://`, and the first attempt
      at that harness proved nothing at all because Chrome disables `localStorage` on
      `file://` and both moods photographed identically.

      **An eighth, added with item 7.** Open the popup, press `Settings` in the top right,
      press `Export the shelf`. A `buki-shelf-<date>.csv` should download. Then actually
      feed it to Goodreads' importer at goodreads.com/review/import and check three things:
      the books arrive, `read` books land on the read shelf, and the `buki-*` shelves are
      created. **This is the only check that proves the format**, and no unit test can
      stand in for it.

---

## Part 2. Unblocked. An agent can start any of these right now

> ### THE SIX P0s FROM THE 2026-08-24 PRE-LAUNCH REVIEW — items 38 to 43
>
> Ten reviewers, ~1.5M tokens, ~100 findings. **Full evidence, attack paths, measured costs
> and the fix for each: `docs/REVIEW-2026-08-24-prelaunch.md`.** That file is the record; these
> items are the ORDER. Every one below was VERIFIED against source, not taken on an agent's word.
>
> **Nothing was fixed.** Maximo's instruction on the day: *"we solve them on next session."*
>
> **They share one shape**, and it is worth knowing before touching any of them: *the correct
> rule is written down, in a comment, within twenty lines of the code that breaks it.* Eight
> instances are tabulated in the review's section 1. The tests inherited the habit - every
> guard asserts a STRING IS PRESENT rather than a BEHAVIOUR HOLDS, which is exactly what a good
> comment already guarantees. **Five mutations survived a fully green 620-test suite.**

- [x] **38. `/api/vision` FORWARDS THE REQUEST BODY VERBATIM.** **DONE 2026-08-25.**

      **The fix is a REBUILD, not a sanitise**, and that distinction is the whole design. A
      sanitiser has to enumerate what is dangerous and is wrong the day the provider adds a
      field. `src/server/visionBody.ts` builds the upstream request from the two things a
      catch actually needs — one prompt and up to four pictures — so everything else the
      caller sent has nowhere to go. The allowlist is three keys (`model`, `messages`,
      `max_tokens`) and `visionBody.test.ts` asserts its COMPLEMENT: any fourth key is a
      field somebody forwarded without deciding it was safe.

      **Four levers the review did not name, all closed by the same rebuild.** `n: 100` is
      a hundred completions charged for one request; `service_tier: 'priority'` is a
      premium price band; `extra_body` is Gemini's documented escape hatch and can re-open
      anything this module closes; `max_completion_tokens` is OpenAI's newer spelling of
      `max_tokens`, so dropping only the old name would have left the new one honoured.

      **`max_tokens` is 2,048, not the 256-512 the review suggested, and the difference is
      load-bearing.** Twenty books is `MAX_BOOKS` and twenty entries is roughly 400 tokens,
      so a few hundred would truncate a real answer into invalid JSON that `parseGuesses`
      reads as "no books found" — the silent failure this codebase keeps producing. Worse,
      `max_tokens` maps to Gemini's `maxOutputTokens`, which on a THINKING model is a
      combined budget for reasoning and output; `llmVision.ts` already records that an
      alias can be repointed at one that thinks. 2,048 keeps ~5x headroom over the largest
      honest answer and still takes 64,000 attacker-chosen tokens down to 2,048.

      **Where the 25,000x actually came from, checked against Google's pricing rather than
      assumed:** $3.46 is 1M input + 64k output at **Pro long-context** rates ($2.50/M in,
      $15/M out). At flash-lite rates the same request is ~$0.13. **So the model pin is
      most of the fix and the input caps are the rest** — which is why the pin, not the
      clamp, is the thing that must never regress.

      **The client half was fixed too, and it is NOT the security fix.**
      `background.ts`'s `model: route.model || settings.model` is now `config: route` —
      `Route` and `VisionConfig` are the same shape, so there is no second place for the
      decision to live. The second place is the one that was wrong. It closes the path
      through our own UI; the server is what defends the credential, because an attacker
      does not use our UI.

      **`polar-setup.md` §"No model is pinned anywhere" was corrected in the same commit**,
      with the old sentence kept above the new one, because it was TRUE and that was the
      finding.

      *Original text:* The caller picks the model and
      the token budget, billed to `GEMINI_API_KEY`. `visionHandler.ts:98` is
      `body: await request.text()` and that is the entire body handling on the money path: no
      parse, no model allowlist, no size cap, no `max_tokens` clamp.
      **This is not only an attack.** `options.html:537` is a free-text model field;
      `background.ts:164`'s `model: route.model || settings.model` puts it back on the proxy
      path under a comment claiming it only falls back "when we are talking to a provider
      directly" - the `||` never checks the endpoint. **A keyless user typing `gemini-2.5-pro`
      into settings bills us for Pro-tier inference, through our own UI.**
      Measured: honest catch **$0.000135**, attacker request **~$3.46**. A **25,000x ratio** -
      and `policy.ts:17` justifies its forgeable-Origin design by citing the honest number.
      **FIX SERVER-SIDE ONLY.** Correcting the `||` closes the UI path and NOT the
      vulnerability; the client is not the thing being defended. Found by FOUR independent
      reviewers. **Ship this WITH item 26, not instead of it.**

- [x] **39. A POLAR NON-2xx BECOMES 403, AND THE EXTENSION DELETES THE SESSION.**
      **DONE 2026-08-25.** Both halves, plus the thing that stops it recurring.

      **The rule was never wrong — it was DUPLICATED.** `llmVision.ts:78` has had it right
      for months (`status < 500 && status !== 429 && status !== TIMEOUT_STATUS`).
      `license.ts:118` had its own copy reading `res.status >= 500`. Two copies of a rule
      is two rules, and these two had already drifted. It now lives once in
      **`src/shared/retry.ts`** as `worthRetrying(status)`, imported by all three call
      sites. `src/shared/` specifically, because `src/recognizer/` importing
      `src/extension/` is already the one edge running against the graph (K-1) and this
      must not add a second.

      **Server:** `worthRetrying(res.status)` inside `if (!res.ok)`, above the 403, and it
      quotes NOTHING of the upstream body — unlike the 403 path, which scrubs it. A gateway
      error page is not something a customer can act on, and every relayed byte is a byte
      that could carry `POLAR_ACCESS_TOKEN` home. A test asserts that.

      **The mutation set ran in BOTH directions**, which is what makes it a fix rather than
      a blanket: making everything 503, or everything retryable, fails too. A cancelled
      subscriber must still lose their session, or the options page can never say what is
      wrong.

      **Trigger (c) is NOT closed here and is not this item's to close.** A mismatched
      `BUKI_EXTENSION_ID` still 403s every renewal from the Origin check while
      `/api/vision` keeps serving token-bearing requests, so the failure stays invisible
      until the token ages out. That is item 37's job — set the shipped id — and the new
      finding filed at item 44 is the machine-readable marker that would make it visible.

      *Original text:*
      `licenseHandler.ts:170` returns 403 for every `!res.ok` including 500/502/503/429. Eight
      lines above, the `catch` branch returns 503 with a comment saying exactly why 403 is
      wrong. **The rarer outage shape is handled; the commoner one is not.**
      Cascade: 403 -> `license.ts:118` `retryable: status >= 500` is false -> `proState.ts:166`
      writes `session: null` -> no Authorization header -> classified `trial` -> `WallError`.
      **A paying subscriber meets the wall they paid to pass, during a third party's bad
      minute**, and the seven-day grace window that exists to prevent exactly this is defeated
      because the evidence it needs has been erased. Three triggers, not one - our own `keyCap`
      429 does it too. `grep -c 'status: 5' licenseHandler.test.ts` -> **0**. Found by FOUR
      independent reviewers. **Both halves must land, or it is half a fix.**

- [x] **40. NO RATE LIMIT OF ANY KIND ON THE LICENSED PATH.** **DONE 2026-08-25.**

      **`CATCHES_PER_LICENCE_PER_DAY = 500`**, keyed on `access.licenseKeyId` — the field
      that was already in the signed claim, already returned by `decideAccess`, and already
      discarded by `handleVision` on every request. No new plumbing, only a value that
      stopped being thrown away. The ceiling is an order of magnitude above
      `TRIAL_PER_IP_PER_DAY = 40`, which this repo documents as "well above what one person
      could legitimately do", because a brake a customer can FEEL makes "unlimited, no
      throttling" false.

      **TWO OF THE REVIEW'S FOUR SUGGESTIONS WERE DECLINED, and the reasoning is the useful
      part.**

      - *A tighter ceiling for `grace: true` traffic* — **not done.** Grace is where a
        stolen token spends most of its life, so it looks like the leverage point. But the
        wall it would raise falls on a real subscriber DURING A REAL OUTAGE, which is
        precisely the failure item 39 was filed to fix. With the per-licence cap in place
        the grace tail is already bounded, so the sub-ceiling buys almost nothing and risks
        the one thing grace exists to prevent.
      - *Shortening `GRACE_MS` to 48h* — **not done, and the arithmetic is why.** Once the
        cap exists, seven days versus two is the difference between **$0.54** and **$0.135**
        of exposure per leaked token. Thirty-four cents is not worth weakening the outage
        protection the previous item was filed to strengthen. **The cap is doing all the
        work; the window length barely matters any more.**
      - *A per-licence cap* — done, as above.
      - *`BUKI_REVOKED_KEY_IDS`* — done, and it turned out to be the most valuable of the
        four. `launch.md`'s "If something goes wrong" table listed exactly three levers and
        **every one was all-or-nothing**, including "remove `GEMINI_API_KEY`", which 500s
        the product for payers too. This is the first targeted one. Unset is the normal
        state, like `BUKI_TRIAL_CLOSED`, so it adds nothing to launch day.

      **Half of AC-4 closed in the same commit, because item 40 made it load-bearing.**
      `verify()` checked only `typeof claim.exp === 'number'`, so a token with no
      `licenseKeyId` returned `valid` with the field `undefined` — and a rate limit keyed on
      `undefined` is a rate limit on nobody. It now requires a non-empty string. **There are
      no tokens in the wild, so this cost nothing today and is unavailable the day after
      launch.** See item 44.

      *Original text:* Both brakes sit inside
      `if (access.kind === 'trial')` at `visionHandler.ts:80`, and `policy.ts` skips the Origin
      check entirely when a token is present. `decideAccess` returns `licenseKeyId` and
      `handleVision` reads only `.kind` - **the field a per-licence cap would key on is
      computed and discarded.** The token is an 8-day (24h + 7d grace) unrevocable bearer bound
      to no device and no IP. Chained with 38: pay $4 once, read the token out of unminified
      `chrome.storage.local`, hold an uncapped arbitrary-prompt Gemini proxy for a week, and
      share it. Grace is UNCONDITIONAL - the server never learns whether Polar was actually down.

- [x] **41. A HOSTILE PAGE CAN DRIVE THE INJECTED TRAY.** **DONE 2026-08-25.**

      **All three edits landed, and each one alone breaks the chain** — which is the point
      of doing all three. The scanner no longer arms off X, so the forged article is never
      scanned; a synthetic `.click()` no longer runs anything, so the button cannot be
      pressed; and the image filter asks about the HOST, so the beacon URL never survives
      to be saved.

      **Each is now a module, because `content.ts` cannot be imported by a test** — it
      touches `document` at module scope. `realClick.ts` is tested against REAL events on
      a real `EventTarget` (Node has both), `feedHost.ts` against the near-misses
      (`x.com.evil.test`, `notx.com`), `isTweetMedia` against the exact string from the
      review. Nothing is mocked, so what passes is what the browser does.

      **The filter is applied on BOTH sides of the trust boundary.** `content.ts` runs
      inside a page Buki does not control, so a filter only there is one the attacker is
      standing next to; `background.ts` re-asks the question when the `recognize` message
      arrives. The CONTEXT-MENU flow is deliberately exempt — there the URL is Chrome's own
      `info.srcUrl`, and catching a book from any image on any site is the product.

      **`contentSafety.test.ts` is written entirely as ABSENCE proofs**, because §5 records
      that a `?raw` guard cannot see control flow and the review found three that passed on
      a string in a comment. It does not assert the safe call is present — a comment
      satisfies that. It asserts there is no bare click listener, no module-scope timer or
      observer, no unguarded `armFeedScan()`, no `.includes('twimg`, and no
      `lookUp(msg.tweet`. Plus one count that guards the vacuous pass: zero bare listeners
      is also what a file with no buttons looks like, and a deleted listener is exactly the
      `theme.ts` mutation that survived a green suite.

      **Two things closed for free.** PERF-9 — catch-anywhere installed X's feed scanner on
      every third-party page, permanently, with no `clearInterval` anywhere — is the same
      root and is gone with the gate. And `permissions.md`'s scripting answer, which told a
      reviewer the injection "injects the same result card" while the bundle polled the DOM
      every two seconds for ever, is now true as written; a note there says not to soften it.

      *Original text:* Three facts compose:
      `grep -rc isTrusted src/` -> **ZERO in all of `src/`**; the image filter is
      `src.includes('twimg.com/media')`, a SUBSTRING match, so
      `https://attacker.example/twimg.com/media/x.png` passes; and the scanner arms permanently
      on any page after one right-click, with no `clearInterval` anywhere.
      Chain: forged `<article data-testid="tweet">` + a synthetic `.click()` spends the user's
      free catch, sends attacker content to the model on our key, and **persists an
      attacker-controlled URL as the book's `shot`** - which `cover.ts:49` then fetches on every
      popup open, forever. **The correct hostname check is three lines away in
      `twitterImage.ts:51`.** Found by the threat model ONLY. Three small edits.

- [x] **42. THE CARD'S x IS A FREE-READ BUTTON.** **DONE 2026-08-25.** Both halves, and
      they fix different things: one stops the waste, the other bounds doing it on purpose.

      **Server.** `grep -c signal src/server/visionHandler.ts` was **0**. The extension
      aborts correctly — `dismiss` sends `cancelRecognize`, the worker's controller fires,
      the socket closes — and none of it crossed the hop, so Gemini went on generating and
      billing against a connection nobody was listening to. The upstream fetch now carries
      `request.signal`.

      **Client.** `trialAttempts` in `trial.ts`, incremented in a `finally` for every catch
      that issued a request, ceiling `TRIAL_ATTEMPTS = TRIAL_CATCHES * 3`. **The advertised
      promise is untouched**: a reading that never came back still costs none of the ten,
      because charging for a timeout is the fastest uninstall there is.

      **Both ceilings fold into ONE `trialLeft`, and that was the design decision worth
      making.** Two counts read in two places is two places to disagree, and the
      disagreement lands as the wall saying "spent" while `planLabel` says "10 of 10 left" —
      a false statement made to somebody at the exact moment they are deciding whether to
      pay. `decide`, `planLabel` and `footer` now all read the same number by construction.

      **`standingOf` takes an OBJECT, not two adjacent numbers.**
      `standingOf(pro, spent, attempts, key, now)` puts two interchangeable-looking integers
      side by side; a caller that swaps them compiles, typechecks, and quietly hands somebody
      three times the trial.

      **The attempt counter is swallowed in the `finally`.** A `finally` that throws
      REPLACES the error being unwound, so a storage-quota failure would surface instead of
      the wall — on the one path where the message is the entire point.

      *Original text:* `gate.ts:64` spends the trial credit only
      after `work()` RESOLVES, and `grep -c signal src/server/visionHandler.ts` -> **0**, so a
      client abort never reaches Gemini. **The money is committed; the counter does not move.**
      Press catch, press "Stop looking" after two seconds, repeat - no forgery, no storage
      editing. The same path fires unintentionally on any 12s timeout.
      `trial.ts:6` accepts that the counter is forgeable because "whoever resets storage every
      ten books was never going to pay four dollars", and `ipCap.ts:11` calls it "the trial
      count that matters". **Both statements are false on this path.**

- [x] **43. THE OPTIONS PAGE'S ACTIVATION-SLOT REUSE IS DELETABLE WITH 620/620 GREEN.**
      **DONE 2026-08-25.** `src/extension/activateKey.ts`, the same move `saveBook.ts` made
      out of `background.ts`. **The review's exact mutation — `const reuse = undefined` —
      now fails six tests.**

      **EXTRACTING THE ARITHMETIC WAS ONLY HALF, and a mutation is what said so.** With just
      `activationFor` and `nextProState` pulled out, `options.ts` was still free to build its
      own `ProState` and call `writePro` directly — and the whole suite stayed green, because
      the replacement source guard only forbids the two spellings it already knows and §5
      records that a `?raw` guard cannot see control flow at all. So `activate()` owns the
      ORDER too. The handler is now: read a field, call it, say the sentence that comes back.
      There is no branch left in it.

      **The assertion that could never have been written before:** *a retryable refusal
      writes NOTHING.* The difference between "wrote a state with no session" and "wrote
      nothing" is a paying customer signed out during our own outage, and no amount of
      reading `options.ts` as text can tell the two apart. It is the review's fifth
      prescribed assertion, and it needed the orchestration extracted to become expressible.

      **`toContain('activationId')` is gone**, replaced by an import-line regex plus two
      absence rules plus a check that the ONLY `writePro` argument in the file is the
      one-line adapter. That last one exists because the first two were proven insufficient.

      **Five mutations, five caught**, including the one that survived the first attempt.

      *Original text:*
      MUTATION-PROVEN: replacing `options.ts:85`'s `reuse` with `undefined` makes every Activate
      press spend one of the licence's **five permanent slots**, and the suite stays fully green.
      The only guard is `proState.test.ts:336` `toContain('activationId')`, which passes on the
      identifier surviving in a spread and four comments. **This is character-for-character the
      failure section 5 already records** for `toContain('markRestored')`.
      **Five presses lock the person who paid out of their own licence, with no self-service
      fix** - and the Activate button is exactly what a human presses repeatedly when a key does
      not take. Fix by extraction (`activateKey.ts`), the way `saveBook.ts` did it, not by
      another string guard.


- [x] **44. THE WIRE CONTRACT IS FREE TO CHANGE UNTIL PUBLICATION, AND NEVER AGAIN.**
      **Filed AND DONE 2026-08-25.** Eight mutations, eight caught.

      **All four contract findings closed, plus the fifth the review did not file.**

      | | What landed |
      | --- | --- |
      | **AC-3** | `visionFailure.ts`. A 401 is `act: 'session'`, not "your setup is broken" — the extension forgets the dead token so the NEXT catch re-exchanges the licence. **It used to call `chrome.runtime.openOptionsPage()`**, sending a keyless reader to a page with nothing on it they could change |
      | **AC-4** | `TOKEN_VERSION` in the signed payload, required by `verify`, rejected in BOTH directions. A rejected version reads as `bad` → 401 → re-exchange, so **bumping it is a migration the clients run themselves, one catch each, instead of an outage** |
      | **AC-7** | 402 is `act: 'closed'`. The trial kill switch can now be pulled without telling every trial user their setup is broken — which is the same as being able to pull it at all |
      | **AC-8** | 405 and 500 join their endpoint's own envelope, with a content-type. Both now say something a person can read, and **neither names an environment variable** — asserted, because a 500 that says which one is missing is a configuration map handed to a stranger |
      | **the fifth** | `code` on every `/api/license` refusal. `origin` vs `licence` are two 403s that mean opposite things, and the client now keeps a paying session through the first |

      **THE FIFTH IS THE ONE WORTH READING.** A mismatched `BUKI_EXTENSION_ID` makes the
      Origin check refuse EVERY renewal with 403, while `/api/vision` keeps serving
      token-bearing requests because it skips that check when a token is present. So the
      failure was invisible for eight days — and by the time anyone noticed, every subscriber
      had been signed out by a status that was never about them. **That is item 39's trigger
      (c), which item 39 could not close from either half.** `license.ts` now keeps the
      session and logs the likely cause by name. An UNCODED 403 stays final, which is the
      safe direction: believing the status can only ever cost one re-exchange.

      **`NoKeyError` moved out of `background.ts`** so the whole classification is importable,
      and `forgetSession` was extracted from `ensureSession` because it grew a second caller —
      two copies of "which fields survive" is two chances to drop the activation id, which is
      the bug item 27 was filed for twice.

      **One thing deliberately not done: no in-catch retry after a 401.** It would put a
      second upstream request on the money path for a case that only happens during an
      incident. The card says to try again and the next press works.

      *Original filing:* Not a new defect — a new DEADLINE on
      four the review already filed, and the reason to treat those four as one item.

      **AC-3, AC-4, AC-7 and AC-8 share a sentence:** *"cannot be added to clients already
      in the wild."* Today there are none. That stays true until the item is published and
      is false for ever afterwards. Together they cost about a morning; after launch they
      cost a migration nobody can run.

      | Finding | What is missing | What it costs after launch |
      | --- | --- | --- |
      | AC-3 | The client has no 401 handler at all. `policy.ts:51` and `visionHandler.ts:63` both document the contract; `grep 401 src/extension/` finds two comments and zero handlers | **A `BUKI_TOKEN_SECRET` rotation becomes unsurvivable.** It is also what would make item 40's new revocation lever HEAL a client rather than merely refuse it |
      | AC-4 | No version marker anywhere — no `/v1/`, no header, no `v` in the token payload. **Half closed 2026-08-25**: `verify` now requires `licenseKeyId`. The version half is untouched | Any shape migration fails open and silent, in both directions |
      | AC-7 | 402 (the trial kill switch) is indistinguishable from a setup failure, so the client opens the options page | **The kill switch cannot be flipped without telling every trial user their setup is broken** — and it is one of only three pre-existing incident levers |
      | AC-8 | Three error envelopes across two endpoints, and 405/500 return BARE TEXT with no content-type | The client extracts no message on exactly the two statuses that mean "the server itself is broken" |

      **A fifth thing belongs here and is not in the review.** A mismatched
      `BUKI_EXTENSION_ID` 403s every renewal from the Origin check while `/api/vision` keeps
      serving token-bearing requests, so the failure stays invisible until tokens age out.
      That is item 39's trigger (c), which item 39 could not close from either half. A
      machine-readable error code on the licence endpoint is what turns it into a day-one
      symptom instead of a day-eight one.

      **Do this before step 5 of `launch.md`, beside item 38's gate.** After publication
      every one of these becomes a permanent property of whatever is already installed.

---

## THE REST OF THE 2026-08-24 REVIEW — items 45 to 56, filed 2026-08-25

> **Read this before picking anything up.** The six P0s and item 44 are closed. What follows
> is **every remaining finding in `docs/REVIEW-2026-08-24-prelaunch.md`**, filed so that none
> of them lives only inside a 593-line document nobody re-reads. Maximo's instruction on
> 2026-08-25: *"capture all this review, all points with its context. all of them. we solve
> them on next session."*
>
> **The review still owns the EVIDENCE** — the attack path, the measured cost, the file and
> line. These items own the ORDER and the STATUS, exactly as §0 requires. Each line carries
> enough to decide whether to pick it up; the review carries enough to fix it.
>
> **Ordered by what it costs to ship without it**, not by the review's own severity labels.
> Two things outrank everything else because they are IRREVERSIBLE at a date: store copy
> cannot be edited after submission without re-review (item 45), and a privacy claim a
> reviewer can falsify in thirty seconds is a rejection (item 46).
>
> **VERIFIED** below means the review's author re-read the code themselves. **MEASURED**
> means a number came off a running probe. Everything else is an agent's claim with evidence
> cited — good, and not the same thing. **Probe before you plan around any of it.**

- [x] **45. THE PRICE IS SPELLED IN THREE PLACES THE GUARD CANNOT SEE, AND ONE OF THEM
      CANNOT BE EDITED AFTER SUBMISSION.** *(review §4, M-4)* **DONE 2026-08-27.**

      `pricing.test.ts:34` guarded exactly two surfaces: the landing and `docs/pricing.md`.

      **Why this was first.** `docs/store/listing.md` is the copy pasted into the store form,
      and **store copy cannot be changed after submission without another review cycle** —
      days to weeks, per `launch.md`. A price that drifts between `pricing.ts` and the store
      listing is a false statement made to somebody at the moment they decide to pay, and it
      is the one class of error you cannot quietly fix the next morning. That reasoning held.

      **TWO THINGS THE ITEM SAID WERE FALSE, and both were found by probing before planning.**

      1. **It is two surfaces, not three.** `docs/store/launch.md` does not state the price.
         Its only `$29` is *"subscriber pays $29, gets nothing to paste"* — prose about a
         failure mode — and its other figures are costs and caps: `$5`, `$3.46`, `$0.00011`,
         `$1.20`, `$0.54`. The real surfaces are **`docs/store/listing.md`** (uneditable after
         submission) and **`docs/llms.txt`** (what an assistant answers when somebody asks
         what Buki costs).
      2. **The prescribed fix — *"widen the glob to the three files `host.test.ts` already
         covers, same shape, one line"* — is RED ON ARRIVAL.** Measured across 223 files: the
         blunt *"every `$N` must be declared"* rule finds ~40 undeclared figures in 12 files,
         and **every one of them is a cost, not a price.** The reflex response is an
         allowlist, and an allowlist holding `4.99` waves through a store listing reading
         *"Buki Pro is $4.99 a month"*. **The one-line fix destroys the guard it is meant to
         extend.**

      **The unit is a PRICE CLAIM, not a dollar figure**: a number whose next words say how
      long it buys. `$4 a month` is a claim; `$0.00011` a catch is arithmetic; `$15 per
      dispute` is Polar's fee. Measured: 36 claims across the repo, and the only non-Buki ones
      are a rival's in `competitor-profiles/` (already excluded by `host.test.ts`'s own
      precedent) and **Polar's `$2/month payout fee` inside `docs/superpowers/`** — which is
      the single, measured exclusion the new glob carries.

      **7 mutations, 7 caught — AND THE FIRST PASS CAUGHT 6.** Deleting the price sentence
      from `listing.md` left the suite green: the file states the price twice, and line 23's
      editorial note *quoting* that copy satisfied a guard that asked whether the FILE
      mentions a price. **Commentary about the copy standing in for the copy** — the `?raw`
      failure of §5, one level up. The guard now reads the *Detailed description* section,
      and renaming that heading fails loudly.

- [x] **46. FOUR PRIVACY AND PERMISSION CLAIMS THAT ARE NOT TRUE, AND ONE A REVIEWER CAN
      FALSIFY IN THIRTY SECONDS.** *(review §5, Client/privacy)* **DONE 2026-08-27**,
      `9c2b268` (the four claims) and `24433f9` (TM-11, which turned out to be a feature).

      | ID | The claim | What actually happens | Closed |
      | --- | --- | --- | --- |
      | **TM-4** | `privacy.html:55` — *"Never in the background"* | **Opening the popup fetches every saved book's cover**, disclosing the reader's IP to `pbs.twimg.com`, `openlibrary.org` and `archive.org` with no user action. **The one claim a reviewer can falsify with DevTools open on the popup** | Confirmed live at `cover.ts:applyCover`, which falls through to `img.src = url` **plus** `rememberCover(url)` on a cache miss. The sentence was TRUE of the picture, so it keeps its precision and moves down to the picture; the cover requests get their own disclosure, including that they carry an IP the way any image on any page does |
      | **TM-7** | `permissions.md:36` — storage holds settings and *"none of it is transmitted"* | `visionSettings` contains `apiKey`, transmitted as a Bearer on every cover read. `privacy.html:53` gets this RIGHT; the store answer does not — so the two disagree and the store one is the one a reviewer reads | The store answer now matches `privacy.html`. Swept the other surfaces: `README.md:205` says the LOG is never transmitted, which is true, so this was wrong in exactly one place |
      | **TM-8** | — | **Prompt injection → CSV formula injection.** `goodreadsCsv` quotes on `/[",\n\r]/` but writes the title raw, so `=HYPERLINK(...)` survives into the export and executes in Excel | Fixed, **and probing the fix found a SECOND vector the review did not file** — see below. 7 mutations, 7 caught |
      | **TM-11** | — | **Host grants accumulate and are never revoked.** There is no "forget this site" path; a permission granted once for one cover is held for ever | **NOT a false claim.** `permissions.md`'s *"never holds access to a site the user has not right-clicked an image on"* is true; this was a missing FEATURE. Built: `grantedHosts.ts` + a section on the options page. 11 mutations, 11 caught |
      | **TM-14** | `manifest.json` | `https://twitter.com/*` and `https://x.com/*` in `host_permissions` are **unnecessary** — nothing fetches either host, and `content_scripts.matches` needs no host permission in MV3. **Two fewer entries a reviewer can ask about** | Removed, after proving the content script makes **zero** fetches and the only `executeScript` call site is reached from the context-menu handler, which has `activeTab` from the gesture |

      **THE SECOND CSV VECTOR, which the review did not have.** `isbnCell` deliberately emits
      `="9781449373320"` — Goodreads' own format, and the reason a bare ISBN does not become
      `9.78145E+12`. **That is itself a formula**, so a quote in that position breaks out:
      `="x"&cmd|'/c calc'!A0&""` is a live DDE concatenation and CSV quoting does not touch
      it. The page cannot reach it (`extractIsbnFromLinks` validates to `[0-9X]{10}`), but
      **OpenLibrary can**: `openLibrary.ts:44` takes `doc.isbn[0]` out of a JSON response and
      casts it, and **openlibrary.org is a wiki anyone may edit**. Same class as AC-10 with a
      worse sink. The formula form is now earned by shape.

      **This is also why the obvious fix was wrong.** A blanket *"prefix any cell starting
      with `=`"* breaks the ISBN silently, and the ISBN going missing is exactly the
      duplicate-on-reimport failure `isbnCell` exists to prevent. Two of the seven mutations
      are that half-fix and its sibling: decline to wrap, but DROP the value rather than
      making it safe.

      ⚠ **ONE THING NO TEST CAN PROVE, and it belongs to item 3.** Removing a host permission
      cannot be verified anywhere but a real browser. Load unpacked, open x.com, and confirm
      the Buki button still appears in a post's action bar. `permissions.md` says so at the
      point of the change.

- [x] **47. RE-CATCHING A BOOK DESTROYS THE GOOD RECORD, AND FIVE WAYS TWO BOOKS BECOME
      ONE.** *(review §5, Data integrity)* **SIX OF SEVEN DONE 2026-08-27**, `ff09658`.
      ADV-7 was split out as item **58** because it is a decision, not a fix.

      **THE PRESCRIBED FIX FOR ADV-6 IS WRONG, and the reason generalises.** It reads
      `book: previous ? { ...previous.book, ...book } : book`. A spread keeps a previous
      value only when the incoming KEY IS ABSENT, and this repo produces both shapes:
      `recognizer.ts:94` emits `{ title, author }` with the keys absent, while
      `openLibrary.toBook` ALWAYS writes `isbn: (doc.isbn ?? [])[0]` and `coverUrl: … :
      undefined`. OpenLibrary records are patchy, so a doc that MATCHES but carries neither
      is ordinary - and then the spread overwrites with `undefined` and the cover is gone as
      if nothing had been guarded. **`src/extension/mergeBook.ts` states the rule once
      instead: a re-catch never makes the record worse.** One of the 21 mutations applies
      the review's fix verbatim, and it is caught. **This is exactly the distinction item
      53's TS-7 (`exactOptionalPropertyTypes`) exists to make.**

      **C-5's CORRECT RULE IS NOT TRANSITIVE, so it cannot live in a key.** "Sapiens"
      matches both "Sapiens: A Brief History" and "Sapiens: An Illustrated History", while
      those two do not match each other. `content.ts:721` and `manualAdd.ts:67` both build a
      `Map` from `identityOf`, and a Map needs an equivalence relation. So `bookKey` stays
      COARSE for the Map and `sameBook` is EXACT and decides whether a save overwrites - the
      residual imprecision (a shelf holding *The Two Towers* may badge *The Return of the
      King* as held) is named in the docblock rather than hidden. A wrong label on a screen,
      recoverable in one press; not a book overwritten on disk.

      **21 mutations, 21 caught. THREE SURVIVED FIRST PASS**, every one a real hole in a
      test written minutes earlier: a merge test calling `mergeBook(undefined, …)` that
      returned on the first line and never reached the branch it was written to check, and
      two tray tests that did not exist at all because the new field had only been threaded
      through the compiler.

      - **ADV-6 · VERIFIED.** `storage.ts:96` takes `book` WHOLESALE while defending
        `source: source ?? previous?.source` and `shot: shot ?? previous?.shot` on the two
        lines below. **When OpenLibrary is down the recogniser correctly emits a bare guess
        with no `isbn` and no `coverUrl`, and saving it destroys both on disk.** Buy links
        fall back to a title search; the cover falls back to a photograph. The user is told
        *"Moved · Dune → now"*. **Fix: `book: previous ? {...previous.book, ...book} : book`.**
        *(The `shot`/`source` half of this line is now guarded — see the §3 mutation table
        work of 2026-08-25 — but `book` itself is not.)*
      - **C-5 · `bookKey` drops everything after the first colon.** *"The Lord of the Rings:
        The Two Towers"* and *"…: The Return of the King"* are the same book. **Differing
        ISBNs cannot veto** — the ISBN check can only ADD a match. Saving the second
        overwrites the first.
      - **C-6 · `normAuthor` takes the longest token, not the surname.** *"Gabriel García
        Márquez"* → `gabriel`; *"G. García Márquez"* → `marquez`. Two spellings, two keys,
        one book filed twice.
      - **C-7 · `postKey` drops the host**, so on catch-anywhere two images with the same
        path on different sites are one catch.
      - **C-8 · Removing a book prunes its cached cover before the 8s undo window closes.**
      - **C-9 · `shotFor` guards on the number of BOOKS, not the number of IMAGES.** A
        four-photo post yielding one book stores photograph one as that book's cover.
      - **ADV-7 · The two catch flows derive different job keys for a multi-image post** —
        two cards, two vision calls, **two trial spends for one post**.

- [ ] **58. TWO CATCH FLOWS, TWO JOBS, TWO TRIAL SPENDS FOR ONE POST.** *(review §5,
      ADV-7)* **A DECISION, NOT A BUG, and that is why it is Maximo's.**

      The two flows derive different job keys for a multi-image post, and they do it on
      purpose. `background.ts:499` builds its Tweet as `imageUrls: [info.srcUrl]` - the
      right-click means *read THIS cover* - while `content.ts:1486` scrapes the whole post.
      `postKey` hashes the images, so the keys differ, `lookups` does not dedupe, and
      catching one post both ways costs two vision calls and two trial catches.

      **Folding them into one job changes what the model is asked**, which is a product
      decision about what a catch IS, not a correctness fix. The alternatives, with what
      each costs: (a) leave it - two different questions cost two catches, and nobody has
      complained because nobody has used it; (b) key on the POST rather than its pictures -
      one catch per post, but two right-clicks on two different books in one post become one
      job and the second book is never read; (c) let the context-menu flow adopt the post's
      full image list - one job, but the model is now sent four pictures when the reader
      pointed at one, which is slower and costs more.

      Probed 2026-08-27. Nothing here is urgent: the cost is one trial catch, and only for
      somebody who catches the same post twice by two different routes.

- [x] **48. THE ACTIVATION LIFECYCLE'S LAST THREE HOLES.** *(review §4)* **TWO OF THREE DONE
      2026-08-27**, `261852c`. C-3 split out as item **59**, because it needs a probe nobody
      can run until item 2 exists.

      **ADV-3, and it is item 27's P0 through a different door.** On the ACTIVATE path
      `claim.activationId` is Polar's `id` with no fallback - there is no prior id to fall
      back TO - so a missing key gives `undefined`, and **undefined does not survive
      `JSON.stringify`**: it vanishes from the signed claim AND from the response body. The
      client's `?? ''` yields `''`, `writePro`'s `&& activationId` guard omits the field, and
      **the next renewal ACTIVATES AGAIN.** Renewal runs daily against five permanent slots,
      so the subscriber is locked out inside a week. Now refused **502**, not 403: our
      upstream failed its own contract, and 502 is in `worthRetrying` so a client holding a
      session keeps it.

      > **One mutation was proved EQUIVALENT and the code was simplified rather than the
      > number inflated.** The guard was first written `!renewing && !claim.activationId`.
      > `renewing` is `Boolean(activationId)` and the renewing branch ends `?? activationId`,
      > so a renewal always carries an id by construction and the excluded case cannot occur.
      > A condition that can never be false is one a reader reasons about for nothing.

      **ADV-8.** `ensureSession`'s docblock says *"It never throws"* and both `deps.save`
      calls sat OUTSIDE the `try`. It runs on the path of a catch somebody is waiting on, so
      a storage-quota failure did not degrade to *"carry on with what we have"* - it rejected
      into the caller and took the catch with it. **Worse on a first pairing: `exchange` has
      ALREADY SPENT A SLOT by then**, so throwing lost the catch AND the slot, and the id
      that would have stopped the next renewal spending another was never written.

      - **ADV-3 · VERIFIED. The licence server mints a session without proving the claim
        carries an activation id.** On the ACTIVATE path there is no fallback: if Polar's
        response lacks a top-level `id`, `JSON.stringify` drops the key, the client's `?? ''`
        yields `''`, `writePro`'s `&& activationId` guard omits the field, **and the next
        renewal ACTIVATES again**. `licenseHandler.ts:196`. **This is item 27's P0,
        re-opened** — the client comment eleven lines up names the hazard and the fallback
        has nothing to fall back TO.
      - **ADV-8 · `ensureSession` is documented as never throwing; both `deps.save` calls are
        outside the `try`.** `proState.ts:126`. A storage-quota failure rejects into the
        catch. Worse: it happens AFTER `exchange` returned ok, **so on a first pairing Polar
        has already spent a slot and the id was never persisted.**
      - **C-3 · MOVED TO ITEM 59, 2026-08-27.** Not fixed, and not for want of trying.

      All three are about the five permanent slots, which is the only finite resource this
      product can burn. `activateKey.ts` (item 43) made the CLIENT half testable; none of
      these three is fixed by it.

- [ ] **59. A DEAD ACTIVATION HAS NO ESCAPE BUT CLEARING EXTENSION STORAGE, WHICH DESTROYS
      THE SHELF.** *(review §4, C-3.)* **Split out of item 48 on 2026-08-27. BLOCKED ON ITEM 2.**

      If the activation is removed at Polar - the customer deactivates that install to free
      one of five slots - every later exchange validates an activation that no longer exists
      and is refused for ever. `activateKey.activationFor` reuses the stored id by design, so
      re-pasting the key does not help.

      **TWO FIXES WERE WRITTEN AND BOTH REVERTED. The reasons are the item.**

      1. **Drop the id on a refused renewal.** Item 27's premise does not expire there, it
         just does not cover everything. A subscription that lapsed and was fixed **still has
         its activation at Polar**, so dropping the id makes the next success activate a
         SECOND time for the same machine - item 27 exactly. A deactivated install wants the
         opposite. Nothing in the code can tell the two apart.
      2. **Re-pasting while unpaired asks to pair again** (`activationFor` requires a live
         session). Broke five existing tests that encode the prior decision, and degrades the
         commoner case to fix the rarer one: the lapsed customer who re-pastes out of
         impatience spends a slot that automatic renewal would not have.

      **WHAT WOULD SETTLE IT, and it is one request.** Once item 2's variables exist,
      deactivate an install at Polar and call the validate endpoint with its id. If Polar
      distinguishes *"this activation does not exist"* (404) from *"this licence is refused"*
      (403), the server can say which, and the client drops the id **only** in the first
      case. If it cannot be distinguished, the answer is a deliberate control on the options
      page - *"pair this install again"* - because the customer knows which case they are in
      and the code does not.

      **The asymmetry is why this is worth the wait:** keeping the id costs a permanent
      lockout whose only escape destroys the reader's books; dropping it wrongly costs one
      of five slots, recoverable from the Polar dashboard.

- [x] **49. FOUR RELIABILITY HOLES ON THE PATH SOMEBODY IS WAITING ON.** *(review §4)*
      **ALL FOUR DONE 2026-08-27**, `0486712` (R-1, R-4) and `b006efc` (R-2, R-3).

      **R-1 SAT UNNOTICED BECAUSE A COMMENT SAID IT COULD NOT EXIST.** `licenseHandler.ts`
      opened with *"called once a day by an extension that already holds a licence, and
      **never during a catch**"*. `background.ts` calls it there BY DESIGN - an MV3 worker is
      torn down between clicks, so the catch is the only reliable heartbeat this extension
      has. A reader checking whether that endpoint needed a timeout found a sentence saying
      it could not matter. **The exchange had no timeout at all** while `llmVision` sets 12s
      and `openLibrary` sets 6s, and it was awaited SIX LINES before the catch's
      `AbortController` existed, so cancelling never reached it either.

      Bounded at `EXCHANGE_TIMEOUT_MS = 8s`, and **deliberately NOT put under the catch's
      signal**: aborting an exchange Polar has already ACTIVATED loses the activation id we
      never got back, and the next renewal spends another of five permanent slots. A ceiling
      bounds the wait; the signal would trade a hang for a slot. **And the catch no longer
      WAITS for a renewal it does not need** - `canCatchOnHeldSession` in `license.ts`.

      **R-2's COOLDOWN HAD TO BE PERSISTED.** `createSessionKeeper`'s latch stops two catches
      in the same SECOND exchanging twice and remembers nothing after, and module scope does
      not survive a worker teardown - which is the same fact that put renewal on the catch in
      the first place. It lives in `ProState.renewFailedAt`, and **adding that field turned
      item 27's own `Required<ProState>` fixture red until `readPro` carried it**, which is
      exactly why that fixture is typed the way it is.

      `RENEW_COOLDOWN_MS = 45min`, and the number comes from the cap: `keyCap` allows 40
      checks per key per day, so anything under 36 minutes lets a broken licence exhaust the
      day again and the backoff is decorative. The test computes that from the real
      `CHECKS_PER_KEY_PER_DAY`.

      **R-3's NUMBER IS DERIVED, NOT GUESSED.** `STALL_MS = 90s` has to clear the pipeline's
      own budget - 10s picture + 24s vision (12s x 2 attempts) + 6s catalogue + 8s licence =
      48s - or it fires on catches that were going to succeed, which is worse than the bug
      because it replaces a slow answer with a wrong error. The test computes that sum from
      the real constants, which is why three of them are now exported.

      > **AN ORDERING TRAP ONE LINE WIDE, and a test pins it.** The watchdog is armed from
      > `tick`, which continues on `!card.transient` - and a `looking` card is precisely the
      > one with `transient: false`. An `armWatchdog` call placed after that guard is never
      > reached by the only state it exists for. **The code would read correctly and do
      > nothing.**

      **R-4.** `livePrep` fetched with `signal ? { signal } : {}`: a cancellable download that
      could never time out, or an uncancellable one with no bound at all. `downloadSignal`
      composes both at `DOWNLOAD_TIMEOUT_MS = 10s`.

      **25 mutations, 25 caught. FOUR SURVIVED FIRST PASS**, and two are worth carrying:
      `return job ?? AbortSignal.timeout(ms)` passed every test because nothing asked whether
      a catch that SUPPLIES a signal also gets a ceiling - which is every catch on the feed
      path. And `openedAt: now()` on every state change survived because the test used a
      FIXED clock: **a clock that never moves cannot detect a clock being re-read.**

      - **R-1 · The licence exchange runs on the catch path with no timeout**, outside the
        catch's abort signal. `keepSession` is awaited at `background.ts:200`, BEFORE the
        `AbortController` exists at `:206`. `licenseHandler.ts:9` claims it is *"never during
        a catch"* — **false, `background.ts:200` calls it there by design.**
      - **R-2 · A failed renewal retries on every catch** with no backoff, no cooldown, no
        breaker. `proState.ts:141`. Burns `CHECKS_PER_KEY_PER_DAY = 40`; then our own 429
        reads as… **retryable now, since item 39** — so this no longer wipes the session, but
        it still burns the whole allowance in one bad afternoon. *(Premise partly expired
        2026-08-25; the burn survives, the session loss does not.)*
      - **R-3 · A `looking` card has no watchdog in either direction.** `catchTray.ts:152`. If
        the worker dies mid-catch on the context-menu flow, *"Reading the cover…"* sits on
        someone else's page permanently, **dismissible only by hand.**
      - **R-4 · The image download every catch blocks on has an abort signal but no timeout.**
        `inlineImage.ts:97`.

- [ ] **50. THE MEASURED PERFORMANCE SET — every number here came off a running probe.**
      *(review §4 and §5)*

      | ID | What | MEASURED |
      | --- | --- | --- |
      | **PERF-1** | Grounding fan-out waits for the slowest of N queries. `Promise.all` samples the p95 on every catch. `recognizer.ts:56` | 20 concurrent OpenLibrary searches: **median 1,215ms, wall 6,072ms** |
      | **PERF-2** | The tray re-fetches every candidate cover on every card repaint — N + N² round trips. `coverData.ts` has `store.match` and **no `store.put`**, so every candidate is a cache miss by construction. `content.ts:1162` | Filing 20 books one at a time = **420 `coverBytes` messages, ~10MB** of cross-process payload |
      | **PERF-3** | OpenLibrary search asks for full ISBN arrays and uses one entry | `'Dune Frank Herbert'` with `isbn` → **8,320 bytes**; without → **398**. **20.9x.** Across five titles, 14.4x. In one 20-query burst: 70KB downloaded, **~93% discarded** |
      | **PERF-4** | `popup.paint()` issues four storage reads per keystroke — under a comment reading `// synchronous: no storage read, no await, no render race`. **All three clauses are false** | — |
      | **PERF-5** | Every keystroke rebuilds the whole shelf DOM, no cap, no memo | `weaveOf`: 119 books **5.12ms** · 500 **15.98ms** · 2000 **58.80ms** |
      | **PERF-7** | `shelvedAmong` is O(candidates × shelf) with both identity keys recomputed per comparison, **on the catch's response path** | 2000 books = 40,000 calls, **179ms**. A Map makes it **36x** faster |
      | **PERF-8** | `/api/vision` buffers the entire image payload before opening the upstream connection | ~55-138KB per image, **two copies in flight** |
      | **PERF-10** | The licence renewal and entitlement reads sit serially in front of the image download, **though nothing about downloading the picture depends on the session** | — |

      **Second-order, and worth knowing before touching PERF-1:** `withBreaker` calls
      `failed()` per query, so **three tail timeouts inside ONE catch open the 120s breaker.**

      **PERF-1, PERF-2 and PERF-3 are the three a first user actually feels.** PERF-9 is
      closed — it was the same root as item 41's host gate.

      ---

      ### FIVE CLOSED 2026-08-27, and the biggest was not in the list

      **THE 429 FIX WENT TO ONE OF TWO FAN-OUTS.** `recognizeBook` was bounded that morning
      after nineteen simultaneous connections to openlibrary.org earned an HTTP 429 and took
      the catalogue down for two minutes. **`groundText` was not**, and it fires at the SAME
      host over up to `MAX_QUERIES = 24` — measured at **21 concurrent** searches from one
      twenty-line page of text, more than the nineteen that caused the outage. It is the
      *"try the post's words"* door offered on every card that comes back empty.

      `GROUND_AT_ONCE` moved to `mapPool.ts`, and that is the actual fix: it lived beside one
      of its two callers, so the other could exceed it without anything noticing. **A ceiling
      defined next to one caller is not a ceiling.** `MAX_QUERIES`'s own docblock called the
      burst *"ACCEPTED rather than unnoticed"*, which is what made it invisible for a day.

      | Finding | Before | After | Where |
      | --- | --- | --- | --- |
      | **PERF-1's sibling** — `groundText` fan-out | **21 concurrent** | **4** | `b08489c` |
      | **PERF-2, first half** — `coverDataUrl` read the store and never wrote it, so every cover it fetched was a cache miss BY CONSTRUCTION | 2 fetches per cover | **1** | `b08489c` |
      | **PERF-7** — the shelf lookup on the catch's RESPONSE path, extracted from `background.ts` and indexed | 5.16 / 16.48 / 57.09ms | **0.32 / 0.91 / 3.52ms** (16-18x) | `12c9055` |
      | **PERF-4** — `paint()` fired `renderStats` and `renderPlan` per keystroke | **5** storage reads per letter, plus a render race | **0** | `d4a96de` |
      | **PERF-5** — `weaveOf` rewove every drawn cover per keystroke | 3.11 / 11.18 / 44.33ms | **0.70 / 1.20 / 5.88ms** (4-9x) | `d4a96de` |

      Shelf sizes are 119 / 500 / 2000 books, measured on this machine with the same bench
      before and after. **PERF-7's ratio is 16-18x, not the 36x the review predicted** — the
      index still calls `sameBook` inside each bucket, which is what keeps it correct.

      ⚠ **PERF-3's IMPLIED FIX IS A PRODUCT REGRESSION and the item does not say so.** The
      measurement is real — `isbn` in `FIELDS` costs 8,320 bytes against 398 — but the ISBN
      it returns is what feeds `sameBook`'s unconditional match, every Buy link, and the
      Goodreads export's dedup column. Dropping the field to save ~70KB per twenty-query
      burst breaks all three. **There is no free version of this**, and the honest options are
      to accept the bytes or to fetch the ISBN lazily for the book actually SAVED, which adds
      a round trip to the save path. Not attempted on a guess.

      **PERF-10 is half closed** by item 49's R-1: the licence renewal no longer sits in
      front of the catch at all when the held session is still usable. The entitlement reads
      remain serial.

      **STILL OPEN: PERF-2's second half** (the tray re-requests cover BYTES on every card
      repaint, which a per-session memo in `content.ts` would remove), **PERF-3**, **PERF-8**
      (`/api/vision` buffers the whole image before opening upstream), **PERF-10's remainder**.

- [ ] **51. THE SERVER'S REMAINING CONTRACT AND EDGE GAPS.** *(review §4 and §5)*

      - **AC-5 · The client compiles the server's `TOKEN_TTL_MS` and `GRACE_MS` into its
        bundle.** `license.ts:10`. Change either server-side and **every shipped client
        desynchronises.** *(Item 44 closed the version marker; this is the other half of the
        same class and is NOT closed.)*
      - **AC-6 · A response-shape change on `/api/vision` fails silently as "no books
        found"**, not as an error. `llmVision.ts:251` — `typeof raw !== 'string' → return []`
        is indistinguishable from an empty picture.
      - **AC-10 · Polar's response is cast, never validated.** A well-formed JSON body with
        different keys → `status === undefined` → **403 "That licence is not active" to a
        subscriber whose licence is fine.** The honest 502 is only reachable on malformed JSON.
      - **AC-12 · `expiresAt` is a server timestamp evaluated against the client's clock**,
        with no skew tolerance and no `expiresIn` to anchor locally.
      - ~~**SEC-3 · `/api/license` has no per-IP cap.**~~ **DONE 2026-08-27, `fa5ab8f`.**
        `keyCap` counts the KEY, which the caller chooses, so a per-key cap structurally
        cannot bound ENUMERATION. `ipCap` now runs BEFORE `keyCap` (so a capped caller cannot
        churn the key map's eviction and push a real customer out) and BEFORE the body parse
        (so a flood of garbage is counted too). Ceiling `LICENSE_PER_IP_PER_DAY = 240`, six
        times the trial one, because five activation slots renewing daily behind one NAT is a
        real household and locking out a subscriber is this endpoint's worst outcome.
        **9 mutations, 9 caught — one found the shell guard was satisfied by the IMPORT
        line**, so a shell calling `createIpCap()` bare took the trial ceiling silently.
      - ~~**AC-9 / TM-6 · `/api/vision` relays the upstream body with no redaction and no
        length cap.**~~ **DONE 2026-08-28.** `src/server/upstreamRelay.ts`. The key is scrubbed
        from EVERY body, success included, and both ceilings are bytes rather than characters.
        **An oversized SUCCESS is REFUSED rather than truncated**, because `llmVision` does
        `typeof raw !== 'string' -> return []`, so a truncated success becomes *no books
        found* — truncating here would have manufactured AC-6's exact silent wrong answer.
        **The existing "NEVER lets the provider key reach the client" test mocked a body that
        did not contain the key**, so it verified the mock; there is a hostile-upstream
        version now, on 200, 401 and 500. **11 mutations, 11 caught, twice.**
      - ~~**R-6 / TM-13 · Neither edge function bounds its upstream call.**~~ **DONE
        2026-08-28.** `src/server/upstreamTimeout.ts`. `visionHandler` passed
        `request.signal`, which is abort PROPAGATION and not a timeout — it covers *"the
        caller gave up"* and does nothing when nobody does. **That is not hypothetical here:
        the reason that signal exists at all is that a dismissed card left Gemini generating
        and billing, so the fix closed only the half where somebody pressed the ×.**
        `licenseHandler` passed no signal at all, so an UNRESPONSIVE Polar — distinct from an
        unreachable one, which was handled — held the request until the platform killed it.
        **The ceilings are chosen RELATIVE to the client's and asserted against those
        constants, not against copied numbers:** above the client's, a server bound can never
        fire. Same status either way (502/503, both retryable), different sentence, because
        *down* and *slow* are different incidents. **11 mutations, 11 caught, twice.**
      - ~~**PERF-6 / SEC-4 · `ipCap` has no eviction and keys on the full IPv6 address.**~~
        **DONE 2026-08-27, `b8b33fa`.** The module carried an explicit argument for needing no
        eviction — *"an attacker cannot mint new source IPs the way they can mint candidate
        licence keys"* — **and that argument was IPv4 reasoning written beside an IPv6-capable
        edge.** A residential delegation is a /64 at minimum, so one customer holds 2^64
        addresses and could mint them per request. IPv6 now collapses to its /64 (no wider: a
        /48 buckets unrelated customers of one ISP); IPv4 and IPv4-mapped stay whole. Eviction
        mirrors `keyCap`, including the direction — forgetting OPENS the brake, because
        refusing everybody on overflow turns a probe into an outage. **11 mutations, 11 caught;
        3 survived the first pass and one was EQUIVALENT and answered by simplifying.**
        **STILL TRUE and unchanged by this:** the `x-forwarded-for` safety comes from Vercel
        overwriting it at the edge, not from this code. Move hosts and the brake evaporates.
      - ~~**TM-12 · `vercel.json` excludes `/api/` from the headers block.**~~ **DONE
        2026-08-27.** Fixed at the THREE places a response is built (`src/server/
        responseHeaders.ts`), with `vercel.json` kept as a second layer rather than the only
        one — a header applied by hosting configuration disappears silently when the hosting
        changes and cannot be tested without a deploy, which is the same failure shape as the
        `x-forwarded-for` note directly above. Guarded by an ABSENCE proof: every `new
        Response(` in both handlers spreads `SAFE_HEADERS`, counted, not spot-checked.
        **8 mutations, 8 caught.**

- [ ] **52. THE TRAY LIVES IN THE HOST PAGE'S LIGHT DOM.** *(review §5)*

      - **TM-9 · Stable class names in the host page's light DOM**, and `content.ts:955`
        mirrors which pile a book is in into `el.dataset['sig']` — **a CSS-attribute
        exfiltration surface.** Fix: closed shadow root, move `sig` to a `WeakMap`.
      - **TM-10 · Latent `javascript:` on the shelf.** `content.ts:519` uses
        `href*="/status/"` (substring — **the same shape as the `twimg` filter item 41 fixed**)
        and returns `.href` verbatim. **Defused today only by `popup.ts:467`'s protocol guard
        at the single render site**, which means a second render site re-opens it.

- [ ] **53. TYPES THAT DO NOT TYPE.** *(review §4 and §5)*

      - **TS-1 · `readSettings` casts a whole storage record and spreads it over the
        defaults.** `settings.ts:27`. The only one of three storage readers that does not
        validate field by field — **and its values are called as methods on the money path**
        (`settings.apiKey.trim()`).
      - **TS-2 · The shelf and the log cast unvalidated storage arrays.** `Array.isArray` is
        the only check. **A corrupt `intent` exports the literal `undefined` into Goodreads'
        "Exclusive Shelf".**
      - **TS-3 · Five of eight `BackgroundRequest` variants and all six `ContentRequest`
        variants have no declared response type.**
      - **TS-4 · Neither message receiver has a `never` check**, so a ninth variant is a
        silent no-op.
      - **TS-7 · `exactOptionalPropertyTypes` is off.** *(Confirmed still absent from
        `tsconfig.json`, 2026-08-25.)* It is the ONE compiler flag that makes "omitted" and
        "present but undefined" different types — **the exact distinction every
        conditional-spread comment in this repo reasons about in prose.** It is the only
        thing that would have made the original `activationId` bug red. **Expect a wave of
        errors when it is turned on; that wave is the finding.**

- [ ] **54. DEAD CODE, STALE COMMENTS, AND ONE EDGE AGAINST THE GRAPH.** *(review §4 and §5)*

      All confirmed **still true on 2026-08-25** by grep, not by reading the review.

      - **M-1 · `host.ts` exports `LICENSE_ENDPOINT` and `VISION_ENDPOINT` and nothing imports
        either.** Three files rebuild the paths by hand. `host.test.ts` globs for stale HOSTS
        only, **never the PATH**.
      - **M-2 · `tools/mark-sizes.mjs` is 100% dead** — reads `MARK.cords`, retired
        2026-08-17, `TypeError` on first use. **`README.md:103` lists it as working** and
        `x-button-harness.mjs:7` cites it as evidence. `entryPoints.test.ts` is green because
        it only asserts the file PARSES.
      - **M-3 · `tray-harness.mjs` hand-spells the mark** — an 8th copy outside
        `mark.test.ts`'s asserted seven, **in a file that CAN import `markSvg`.** This copy
        has already lied once and cost a real design detour.
      - **X-2 · `entitlement.footer()` has no caller**, and two module headers vouch for it.
      - **X-3 · `settings.toVisionConfig` is dead code and `background.ts` still imports it.**
        *(Confirmed 2026-08-25: still imported at `background.ts:12`, no non-test caller.)*
      - **X-5 · `Tweet.altText` is declared in three files, threaded through two call sites,
        and never populated.**
      - **X-6 · Nine dead CSS tokens**, five of which are an unguarded fourth copy of
        `BINDING`.
      - **D-5 · `toolbar.ts` hardcodes two brand colours** and names sources that do not hold
        them.
      - **D-7 · `bindingFor` indexes `BINDING` by `CLOTH.length`** — a cross-module length
        coupling that **fails silently on the sixth dye.**
      - **D-9 · `tray-harness.mjs` retypes the cloth palette, names the wrong file, and drops
        one of the five dyes** — so **marigold is structurally invisible to the only tool that
        can see the tray.**
      - **K-1 · `src/recognizer/` imports `src/extension/`** — the only edge running against
        the graph. *(Confirmed 2026-08-25: `groundText.ts:5` and `recognizer.ts:5`, both
        importing `sameBook` from `../extension/bookIdentity`. Deliberate — the identity rule
        lives in one place — but it is why `src/shared/` is where anything shared must go.)*
      - **The seven stale comments** tabulated in review §1. Two were corrected on 2026-08-25
        (`visionRoute.ts:42`'s model pin is now TRUE; `polar-setup.md:383` rewritten). **Five
        remain**, including `README.md:103` above.

- [ ] **55. THE TWO SURFACES NO TEST CAN REACH.** *(review §4)*

      - **M-5 · The context-menu handler is 95 lines of the riskiest orchestration in the
        extension and no test can reach it.** `background.ts:411`. **Four ordering rules
        stated in comments, none checked.** This session moved four decisions OUT of that file
        (`visionFailure`, `forgetSession`, `keepTweetMedia`, `realClick`); the ORCHESTRATION
        is still unreachable.
      - **M-6 · The whole card renderer is unreachable by any test, including the paywall.**
        `content.ts:941`. `trayCopy.ts` lists four rules the wall must obey; the tests check
        the STRINGS. **Nothing checks that `wallBody` renders `WALL.free` as a real button —
        rule 3, the line between an offer and a dark pattern.**

- [ ] **57. Find a book from a PASSAGE, not a cover.** Maximo, 2026-08-27:
  *"HUGE IDEA: FIND ANY BOOK FROM A PASSAGE, PHRASE, PAGE, IS THAT DOABLE?"*

  **Reading it was never the hard part** - a photograph of a page is just another image and
  the vision model already takes images. **Grounding it is the feature.** A cover read is
  checkable (title and author against the catalogue, which is what lets the tray say *read
  from the cover*); a passage appears nowhere in catalogue metadata, so without a check the
  model answers confidently and often wrongly, which is this product's trust story inverted.

  **PROBED 2026-08-27, and the probe killed the obvious design.**
  `https://openlibrary.org/search/inside.json`, three queries, one at a time with a 2.5s
  pause because nineteen concurrent searches had earned an HTTP 429 the same morning:

  | Query | Result |
  | --- | --- |
  | *"It is a truth universally acknowledged..."* | 200, **4850ms**, 2,228 hits. **Pride and Prejudice is NOT in the top three.** A KS3 revision guide is, and a volume of criticism |
  | An Ecclesiastes passage | 200, 4194ms, 1,100 hits. Thematically adjacent books, not the source |
  | A deliberately generic sentence | 200, 5025ms, 102 hits, all noise |

  Not a fluke: anthologies, textbooks, criticism and quotation collections all contain the
  passage and compete with the source on equal footing. Also **4-5s against `openLibrary.ts`'s
  6s `TIMEOUT_MS`**, and a raw Elasticsearch document (`hits.hits[]` with `highlight`,
  `_score`, `fields`) where titles are often absent and authors always are, so every hit
  costs a second lookup. **One encouraging result:** the generic sentence returned noise rather
  than a confident wrong answer, so the failure mode is "nothing useful" and not "the wrong
  book stated firmly".

  **So "search the passage, take the top hit" would put a revision guide on the shelf and call
  it Jane Austen.** Dead, and round two reproduced it in a second book: *Nineteen Eighty-Four*
  ranks below an Orwell symposium, a novel called *Wanksy*, and a grammar textbook, for its
  own opening line. **General, not an Austen-anthology fluke.**

  ---

  ⭐ **ROUND 2, THE SAME DAY, AND IT OVERTURNED THE PARAGRAPH THAT USED TO BE HERE.** Maximo:
  *"lets see if we cant solve the 'find any book from phrase, passage, page etc'"*. Round one
  ended on *"unprobed and blocking: whether `search/inside` can be scoped at all."* **It can.**
  Re-runnable: `node tools/probe/passage-grounding.mjs`.

  **One claim above is now known WRONG and is kept only to show what was believed:**
  *"titles are often absent and authors always are, so every hit costs a second lookup."*
  Every hit carries `meta_title`, `meta_creator`, `identifier` and `page_num`. **There is no
  second lookup**, and that payload turned out to be the whole answer.

  1. **Field filters are dead, and nearly mis-read as "scoping is impossible".**
     `edition_key:`, `meta_title:`, `meta_creator:` all return 0 — **and so do the negative
     controls**, which means the instrument said nothing. The discriminator was a filter that
     MUST match everything: `AND meta_mediatype:texts`, the mediatype of every document in the
     corpus, **returns 0**. The `meta_*` keys are STORED, not indexed. `&edition=`, `&ia=` and
     `&sort=` are ignored too. *A filter never watched to PASS is not evidence, exactly as a
     guard never watched to FAIL is not.*
  2. **BARE BOOLEAN SCOPING WORKS.** `"<passage>" AND Austen` → **2,228 hits down to 227, and
     the book itself from absent-in-the-top-3 to RANK 1.**
  3. **The COUNT is not the check.** `"<austen passage>" AND Hemingway` returns **115 hits**,
     topped by a cocktail recipe book, because Hemingway is a cocktail. A design reading
     *"total > 0, confirmed"* ships the exact bug this item exists to avoid.
  4. **The TITLES are the check, and they cost nothing.** Compare the model's proposed title
     against the returned hit titles — **starts-with, not contains**, because *"Twentieth
     century interpretations of Pride and prejudice"* contains it and is criticism.
     **Discriminated 5 of 5**, wrong author matching none. The titles are already in the
     response that answered the query.
  5. **It refuses the realistic hallucination.** Wrong-book-right-author, not wrong-author, is
     what a model gets wrong. **7 of 8 refused**; the 8th matched an omnibus at rank 8 while
     the right answer sat at rank 1, so **BEST match rather than ANY match** closes it.

  ⛔ **THE BLOCKER MOVED, AND THIS IS THE PART THAT NEEDS A DECISION.** Ranking is solved.
  **Coverage is not.** Four modern in-copyright novels — *The Hunger Games*, *Gone Girl*,
  *The Road*, *Normal People* — **none found; two returned literally zero hits.** The corpus
  is scanned-and-open books: classics are in it, contemporary fiction is not. Latency measured
  **982-9,983ms** across 19 queries against a 6,000ms `TIMEOUT_MS`, survivable only because
  the failure mode is *"could not confirm"*.

  **MAXIMO'S CALL, and it is positioning before it is engineering:** does *"reads the picture,
  whether it is a cover or a page"* survive the sentence that must follow it — ***"for books
  old enough to be in the open library"***? If yes, this is a build of known size and every
  piece exists (`bookIdentity.ts` already holds the title comparison, `normAuthor` already
  extracts the surname the query needs). If no, the alternative is Google Books full text:
  better coverage, a key, a quota, and **unmeasured**. Full record:
  `docs/superpowers/specs/2026-08-27-passage-probe.md`.

- [ ] **60. SEVERAL ARTLESS BOOKS FROM ONE PHOTOGRAPH NOW SHOW THE SAME TILE.**
      **Opened deliberately on 2026-08-27 by `cae4ad1`**, and filed in the same commit rather
      than discovered later.

      `cae4ad1` is the founder's rule — *"when we find no cover book, we use the original
      image"* — and it loosened `shotFor` from `books === 1` to `books >= 1`. The half of C-9
      it retired had genuinely expired (see the commit). **What it trades away is visual:**
      the drawn boards were hashed per book, so five artless books read as five different
      objects. Five copies of one photograph read as a bug, even though each is honest.

      **How often:** only when SEVERAL books from ONE photograph ALL lack catalogue art. Any
      book with art shows its art, because `coverSources` puts `coverUrl` first.

      **Three ways out, and doing nothing is a real one:**

      1. **Accept it.** The tile is true — that book was read out of that picture. Cost: 0.
      2. **Stamp the title over the photograph**, exactly as `drawnCover` already stamps it.
         Five tiles then differ by the one thing that identifies them, and the photograph
         reads as the shelf's texture rather than as five duplicate covers. Reuses
         `titleStep` and the `.stamp` class; needs `coverFor` to know the shot is SHARED,
         which `popup.ts` can compute shelf-wide in one pass. **Cost: small, and it is the
         one I would build.**
      3. **Per-book image attribution at the source** — add an image index to `VisionGuess`
         so each book knows which picture it came from. **This also closes the OTHER half of
         C-9**, the one still refusing, and would let a four-picture post keep its pictures.
         Cost: touches the prompt, the response schema, the recognizer and the card — and it
         changes what the model is asked, which is item 58's territory.

- [ ] **56. THE ONE THING THAT COULD NOT BE VERIFIED STATICALLY. Maximo, one command.**
      *(review §7)*

      `permissions.md:153` and `coverCache.ts:36-42` assert that **every hop** of the
      `covers.openlibrary.org → archive.org` redirect answers with permissive CORS. **That is
      a live-network fact with no contract behind it.**

      Probe it once against a real cover before submitting. **If it is wrong, every shelf
      cover silently falls back to the drawn board and nothing would tell you it had
      happened** — which is this codebase's signature failure, on the surface the product is
      named for.


Ordered by value. 4 and 5 came out of the code review on 2026-08-13. **4 to 8, 23 and 24
are all done.** The landing is finished top to bottom, the extension has caught up to it,
and the mark is one drawing everywhere. 9 waits on item 3 being done by hand.

**There is no live agent item left in Part 2.** 21 closed on 2026-08-15 and it was the
last surface. Everything remaining is either Maximo's (1, 2, 3), waiting on those, or the
one half of 17 that can be written now — see below.

**The product no longer advertises anything that does not exist except the hosted proxy
and the ten free catches**, both of which are items 10 and 14 and both of which wait on
Maximo's items 1 and 2.

- [x] **4. Make `ensureTray` and `mayFetch` testable.** Done 2026-08-13. Both moved out of
      `background.ts`, which cannot be imported by a test at all: it registers
      `chrome.contextMenus` and `chrome.runtime` listeners at module scope, so importing it
      throws before any test runs. `ensureTray(tabId, { tell, inject })` now lives in
      `src/extension/ensureTray.ts`; `mayFetch(url, { request })` went into
      `imageOrigin.ts`, beside the `originPatternFor` that decides what it asks for.
      `background.ts` holds the live wiring as `liveTray` and `livePermissions`. 9 tests,
      including the double-listener case and the chrome:// page.

- [x] **5. Guard the host against drift.** Done 2026-08-13. `src/shared/host.test.ts`
      globs every shipped file plus `docs/superpowers` (the plan carries pasteable code
      with the host in it) and fails naming each file that disagrees with `BUKI_HOST`.
      Proved by renaming the host and watching it list all 14 mentions across 7 files.
      **It globs rather than listing files by hand on purpose**, because the last rename
      broke on files the list did not know about. It uses `import.meta.glob` via a
      declaration in `src/raw.d.ts`, since this repo deliberately has no `@types/node`.
      One correction to the item as written: `docs/pricing.md` does *not* carry the host,
      only a GitHub URL.

- [x] **6. Give the two silent early returns some feedback.** Done 2026-08-13.
      `src/extension/toolbar.ts`: `sayStopped` puts a mark on the toolbar and the reason in
      the tooltip, then takes both off after 6s. The tooltip exists because `brand.md` says
      errors are never vague and a badge holds four characters. The mark is a book board,
      cream `#FAF7F2` on oxblood `#4A1414` at 14.2:1, because cream on the coral cloth
      measures 3.09:1 and that is the exact failure bindings exist to solve. **It is NOT
      called before `mayFetch`**: that ask must stay the first await in the handler.

- [x] **7. Goodreads and StoryGraph export.** Done 2026-08-13. *(§2.1 below is now the
      record of why, not a to-do.)*

      **It is FREE on both tiers, and that was a correction, not a giveaway.**
      `docs/pricing.md` contained four statements that could not all be true: Free "export:
      no", Pro "export: yes", "the key is the entire difference between the tiers", and
      "the shelf, the piles, the provenance record and local storage are never gated".
      Exporting your shelf is a shelf feature. Maximo resolved it in favour of the two
      statements that define the product, so `entitlement.ts` is not involved at all and
      there is no paywall path to build.

      **What ships:** `src/extension/goodreadsCsv.ts`, one pure module, 15 tests. Goodreads
      closed its write API in 2020, so a file is the only route into either service, and
      StoryGraph reads Goodreads' format, so one file serves both.

      | Decision | Why |
      | --- | --- |
      | now/next/someday → `to-read`, read → `read` | The shelf spec calls the piles a *priority*, not a reading state. Mapping Now to `currently-reading` would announce you are actively reading everything you meant to read next. |
      | Pile kept as a `Bookshelves` tag (`buki-next`) | Goodreads has three exclusive shelves and Buki has four piles. The tag is what stops the collapse losing the ordering. |
      | `My Review` = `Caught from <url>` | The post that sold you is the one thing no competitor stores. Without it the export drops the differentiator. Empty when there is no source, never an invented sentence. |
      | ISBN written as `="978…"` | A bare 13 digit ISBN opened in Excel becomes `9.78145E+12`, and re-saving before import corrupts it silently. This is Goodreads' *own* export format, so both importers demonstrably read it. |
      | **No** UTF-8 BOM | Same Excel argument, opposite answer. A BOM would make the first header read `﻿Title` and risk the importer not finding Title at all. The primary path is upload, not Excel, so the wrapper is worth it and the BOM is not. |
      | No `Date Read` column | Buki never records when you finished a book, only when you caught it. Emitting `savedAt` there would be a lie about the reader's own history. |
      | Blob + `<a download>`, **no `downloads` permission** | Asking for a new permission right before store review, for something a blob already does, works directly against item 17. |

      **Surfaces.** Options page gained a *Your shelf* section above Recognition log
      (feature above diagnostics). The popup masthead gained a `Settings` button, pinned to
      the corner rather than added as a third centred line, because the header is a centred
      column and a 560px panel should not get taller to hold one link. That is the same
      move the catch card makes with its dismiss control. **It is also the first route from
      the shelf to settings the product has ever had**, without which the export the
      landing advertises was reachable only by right-clicking the toolbar icon.

      **Three polish fixes to `options.html` came out of building this**, all against the
      checklist in `docs/brand.md` rather than taste:

      1. **`button:disabled` did not exist.** The page had no disabled styling at all, so
         the export button on an empty shelf would have looked identical to a working one.
         Given the popup's own `opacity: 0.5; cursor: default`.
      2. **No hover was gated.** `options.html` carried zero
         `@media (hover: hover) and (pointer: fine)` while the popup carried five, so on a
         touch screen a tapped button stayed lit. Both rules are gated now.
      3. **`.ghost` had no ring**, so three controls on the page read as bold text. The
         ring is `--muted`, the same value as the label, so the whole control is one solid
         colour and the flat rule holds. **Not `--board`: measured 1.28:1 on the paper**,
         a boundary you cannot see.

         > **EXPIRED 2026-08-16, and the doc did not follow until 2026-08-17.** The iOS
         > turn (`a40e335`) replaced that ring with a FILLED SURFACE, which is the Apple
         > idiom and is what `docs/brand.md`'s checklist allows in as many words: *a
         > control's boundary clears 3:1, **or** it has a filled surface instead of an
         > edge.* So the decision is sound and this entry described the previous one for a
         > day. **What nobody measured is the fill itself:** `--sunk` on `--paper` is
         > **1.08:1 by day and 1.15:1 at night**, which is fainter than the 1.28:1 this
         > entry rejects by name two lines up. See the `[?]` in Part 4, item 25.

      **One finding left alone on purpose.** The landing's `.btn.ghost` ring is `--rule` on
      `--paper`, which measures **1.38:1** and fails the 3:1 bar for a control boundary the
      same way. It is not changed here, because retouching the landing as a side effect of
      extension work is how unrelated regressions get in. Worth its own pass.

      **Known limitation, stated rather than discovered later:** importing twice creates
      duplicates for ISBN-less books. Goodreads dedupes on ISBN when present. The fix is on
      their side and it is not worth chasing.

      **Not verified in a real browser**, like items 3 and 6: the CSV is unit-tested, but
      nobody has clicked the button in Chrome or fed the file to Goodreads. Worth adding to
      the item 3 pass.

- [x] **8. The landing: eyebrows and dark mode.** Done 2026-08-13. Eyebrows: see item 20.

      **Dark mode was three times the job it looked like**, and the reason is worth keeping.
      The token swap was the easy part. What actually had to be found:

      1. **Thirteen hardcoded `rgba(251, 247, 236, …)`**, the cream at an alpha: the
         masthead's glass, the hero scrim that carries the reading, the band quote's halo.
         Relighting `--paper` would not have touched one of them, because none of them
         mentioned it, and every one would have survived into dark mode as a cream bar
         across a navy page. They now go through `--paper-rgb`. **This is the retokening
         trap in `docs/brand.md` one step removed, and it is worth adding to the grep: look
         for `rgba(` as well as `#`.**
      2. **The masthead mark was `fill="#0a0f33"` inline.** On a dark ground both shelved
         spines vanish, which is the exact failure `brand.md` records for `icon.svg`. Now
         `--mark-spine` / `--mark-caught`, the names `brand.md` already gave them. Mirrored,
         not merely lightened: cream spines with a **cobalt** catch is 9.00:1 against 9.58:1
         in daylight, where leaving the light blue would have been **1.69:1** and the mark
         would say nothing.
      3. **The plates.** `tools/plates.sh` needs the 4000px museum scans, which are not in
         the repo. `tools/plates-dark.sh` derives them from the **shipped webp** instead,
         which is legitimate because `colorlevels` runs last in that pipeline, so the
         shipped file's luma is monotonic in the original's. Not a CSS filter: a duotone's
         argument is that its two colours are the page's two colours.

      **Tonal order is kept rather than negated**, and that was measured, not preferred. For
      a cream headline to clear 7:1 the plate's brightest area must sit at or below 0.0806
      relative luminance; the sky at `#35457f` is 0.0655, so cream lands at **7.92:1** with
      the painting's own light still reading as light. Negating looks more dramatic, puts
      the headline on the pale ruin where it measures worse, and inverts a credited
      painting's values. `plates-dark.sh` is parameterised, so it is one command to change
      your mind.

      Dark plates are **smaller** than the light ones (125KB against 305KB at 1400): a
      compressed tonal range gives the encoder less to keep. `<picture>` with a `media`
      source means exactly one downloads, and the hero preload is split in two so a dark
      machine does not fetch the light plate and throw it away.

      **Deliberately NOT darkened: the three step mockups.** `.frame` is `#faf7f2`, which is
      the extension's own paper. Those panels depict a real light surface, so dimming them
      to suit the page would misrepresent the product, the same way the real book covers on
      the shelf are photographs and do not invert. They are the brightest thing on the dark
      page and that is the honest answer.

      **One trap for whoever verifies this:** the machine renders dark by default, so a
      plain screenshot is NOT the light mode. Neutralise **every** `(prefers-color-scheme:
      dark)` occurrence, not just the `@media` block, or you get the dark plate under
      light tokens and it looks like a regression that is not there. **Count them rather
      than trusting a number written down**: it was five, and the pricing plate made it six
      on 2026-08-15. The screenshot script asserts the count, which is how that was caught.

      **While doing the eyebrows I found and fixed a live defect on the same page**, so it
      is recorded here rather than left in a commit message. The masthead's primary call to
      action is an `<a class="btn">` inside the nav. `.top nav a` is specificity (0,1,2) and
      `.btn` is (0,1,0), so the nav rule was repainting the button: **2.11:1 at rest**, and
      on hover the background and the text both became `--blue`, measuring **1.00:1**. The
      label was not faint, it was invisible, on the one control the page exists to get
      clicked. Fixed with `:not(.btn)`, the same answer `popup.html` used for `#sheet`.
      `src/shared/landingChrome.test.ts` guards it and `docs/brand.md` now carries the rule.
      I swept the rest of the stylesheet for the same trap: six candidate rules, five safe,
      and `.close-band` already handles its own components correctly (16.19:1 and 10.73:1).

- [x] **23. Finish the landing rebuild: everything below the hero.** Done 2026-08-15.
      *(§2.3 below is the record of what it found, because the interesting part was not
      the layout.)*

      Both of Maximo's outstanding asks are now done. **"Use more artwork"**: the Panini
      plate went from a letterboxed 460px strip to `min(72svh, 660px)`, and the closing
      band carries the hero's own plate, so **the page closes where it opened**. **Better
      CTA animation**: the scroll reveals were retuned against `emil-design-eng`'s table,
      and two motion defects were fixed on the way (below).

      **One surface language replaced five.** Radii of 2, 4, 6, 7, 8 and 20px became
      `--r-lg`, `--r-md` and the capsule. The step frames lost a `1px solid var(--rule)`
      hairline — a *page* token drawn around a picture of the *product*, which is the one
      place the page's vocabulary does not belong — and gained elevation instead. The
      picker lost its rule-and-grid for two panels. Shadows were navy at every depth,
      which is a shadow that does nothing on a navy page; they are tokens now.

      **Both plan buttons are solid**, and that is not a hierarchy mistake. A ghost on the
      Free card's own 4% tint composited to a grey pill with dark text, which is what a
      **disabled** control looks like, on the one button the free tier exists to offer.
      Same label, same action, same destination: the card carries the tier, not the
      control.

- [x] **24. Reconcile the mark. RESOLVED 2026-08-15, and in the best available way.**

      Maximo supplied `design/mark-source.png`: **three spines, two shelved and one pulled
      out and lit, with the cord rules across all three.** That is the original idea drawn
      properly, so **the brand story never needed rewriting and the icon set was never
      stale** — the two-spine drawing that briefly sat on the landing was the outlier, and
      it is gone.

      Redrawn as geometry (three rounded rects, two masked bands) rather than traced, so it
      tokenises for both moods and stays sharp at 16px. Now identical on the landing, the
      popup and the options page. `docs/brand.md` carries the coordinates and the measured
      values.

      **A real defect fell out of it:** the popup's caught spine was a hardcoded `#7cc0fd`,
      **1.81:1 on its own cream paper**, sitting directly beneath a comment explaining that
      a light value on that ground measures 1.6:1 and cannot be used.

      *Still open, and small:* `icons/*.png`, `icons/mark.svg`, `docs/icon.svg` and the
      store tile are the older three-spine drawing — right idea, slightly different
      geometry, and no longer carrying the cord rules. **Do not regenerate them by dropping
      the new SVG into `tools/make-icons.mjs` unthinkingly:** `brand.md` records why
      `icon.svg` carries a cream plate rather than a transparent ground.

      **A second copy of the same defect was found on 2026-08-16 and closed.** "Defined
      once" was true of the mark's *geometry* and not of its *colour*.
      `tools/mark.mjs` declared `grounds['landing, day'].caught = '#2f7fd6'` while
      `docs/index.html` shipped `light-dark(#7cc0fd, #1231a8)` — the same literal removed
      from the other three cream grounds the day before, measuring **1.81:1** on the paper.
      The night value was correct throughout.

      **`mark.test.ts` could not see it, and the shape of that blindness is the reusable
      part.** It asserted two things that never met: the contrast checks looped over
      `MARK.grounds`, which is data inside `mark.mjs`, so they proved the table was
      internally sound and never opened a stylesheet; the "same coordinates everywhere"
      check grepped the six surfaces for `x=`, `rotate(` and the cord `y=`, and **no colour
      was in that array**. It now reads `--mark-caught` and the caught rect's `fill` out of
      each surface and compares them to the ground that surface sits on. Proved to
      discriminate on all three declaration shapes by breaking each one and watching only
      that test fail: `light-dark()` on the landing, a plain hex in `popup.html`, an SVG
      `fill` in `icons/icon.svg`.

      **It was a consistency failure and not a legibility one, and the first version of
      this entry said otherwise.** It claimed `#7cc0fd` reads as the gap between two dark
      spines at 25px. Rendered at 16, 24, 25, 28, 40 and 120px, it does not: it is a pale
      blue spine between two near-black ones every time. The 1.81:1 is against the cream
      *page*, which is the wrong axis for a flanked element, and the 2026-08-15 session had
      already thrown out a caught-versus-ground bar for exactly that reason. **That
      discarded metric was re-derived from a ratio a day later by someone who had not
      rendered it.** `tools/mark-sizes.mjs` was written the same day so the next argument
      about a value starts by looking at it.

      The change still stands on the reason that was always sufficient: `tools/mark.mjs` is
      the definition, it declares `#2f7fd6` for every cream ground, and three of the four
      already agreed.

- [ ] **9. Screenshots for the Web Store.** Five at 1280x800. **Item 8 is done**, so the
      remaining blocker is item 3 (and now item 37, which must come first or the by-hand
      pass runs under an id nobody will ever have). Shoot against a shelf of books actually
      saved; a mocked shelf reads as a mock.

      **THE FRAMING IS DONE as of 2026-08-18.** The store wants 1280x800 and the popup is
      560px wide, so every shot is COMPOSED rather than cropped — upscaling a 560px capture
      softens the type on a listing whose whole claim is craft. `tools/store-shots.mjs`
      builds the five frames from the mark's own ramp; `docs/store/assets.md` carries the
      staging for each shot, what RUINS each one, and the 45-second video script.
      What is left is capturing five real ones and re-running the tool.
      *Unblocks item 15.*

### 2.6 There was no light mode, and it was a coupling bug

Kept because the SHAPE is the reusable part: a control whose wiring sat behind a guard that
had nothing to do with it.

`docs/index.html` ran one IIFE that opens

```js
var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (still || !("IntersectionObserver" in window)) return;
```

and then, forty lines later, attached the theme button's click handler. **For any reader
with reduced motion turned on, the button rendered, focused, and did nothing.** Measured by
forcing the query true and clicking it: `data-theme` stayed `dark` and the body stayed
`#080d20`. After the fix, the same test reports `dark -> light`, body `rgb(251,247,236)`.

**Three things are worth carrying forward.**

1. **Nothing about choosing a colour scheme depends on wanting animation.** The two only
   shared a function because they shared a `<script>`. `src/shared/landingTheme.test.ts`
   parses the page's top-level IIFEs and fails the build if they are put back together.
2. **No screenshot could ever have found this.** The button is present, correctly labelled
   and focusable in every render. It needed an *interaction* under a *specific media query*,
   which is why the diagnostic overrode `matchMedia` and clicked the button rather than
   looking at a picture.
3. **The reveal must not hide a container that a later script fills.** `.wall` was in the
   reveal list; the observer saw it as an empty grid with zero height and the six boards
   were appended by a different IIFE afterwards. Removed.

### 2.5 The extension caught up, 2026-08-15

> **Dated record. Its closing claim expired the next day.** This section ends by saying
> the only surface still behind is `content.ts`. That was true on 2026-08-15 and stopped
> being true on 2026-08-16, when the whole extension went to iOS neutrals and the tray
> went with it. The reasoning below is why the extension caught up at all and is worth
> keeping; for what any surface looks like now, `docs/brand.md` owns it.

`docs/brand.md` had recorded since that morning that three generations were live at once and
that the extension would follow the landing. It has followed. **`popup.html` and
`options.html` are third generation**; the only surface still behind is `content.ts`, which
is item 21 and behind for a reason.

| What | Why it mattered |
| --- | --- |
| **One family.** Instrument 30KB + Petrona 44KB → Manrope **25KB** | An extension pays for fonts worse than a website does: a website serves what is asked for, an extension ships the whole folder into **every install**. `--serif` survives for book titles only and is the *system* serif, so it costs nothing. |
| **Sentences at `--ink`** | `--muted` was the identical `#3d477a` doing the identical job. The one that mattered: the affiliate disclosure was 10.5px of 8.24:1 grey, and store policy permits affiliate links **only when disclosed**. |
| **The segmented control drawn as one** | Tracked uppercase mono is a *label* treatment. `PILE_LABEL` was always sentence case — only the CSS was shouting, so `shelfView.ts` was untouched. |
| **Mono narrowed to data that lines up** | The counts and the cloth. `Settings`, the record and the pile tag are words. |
| Two radii and a capsule, replacing six | 14/9, not the landing's 22/14: a 560px panel is not a page. |

**A new guard, and it earned itself immediately.** `src/shared/fonts.test.ts`. A dangling
`@font-face` is the quietest failure this repo can ship — the browser 404s, falls silently
through to `system-ui`, and every surface renders in a face nobody chose. It looks *fine*.
The test also catches the reverse, a font in `fonts/` nothing loads, which `docs/` carried
for two days. **Use it by deleting the old fonts first and letting it name what to fix.**

**Two more ungated hovers**, found by looking rather than by trusting the note that said the
sweep was done: `summary:hover` on the options page, and `.drop` had a hover and nothing for
a finger.

### 2.4 The second pass, 2026-08-15: contrast, one axis, four plates

Maximo reviewed the finished page and asked for six things at once: far more contrast and
**no faded fonts**, more symmetry, **much** more artwork, clearer CTAs, more iOS, and light
mode specifically. All six are done. The two that carry a rule worth keeping:

**"No faded fonts" was structural, not a bad value.** `--ink-2` measured 8.24:1, which is
AAA, and the page still read washed. The reason is that `--ink-2` carried `.sub`,
`.step-body`, `.answers dd`, `.picker p`, `.fine`, `.plan-line`, `.aside` and the footer —
**nearly every sentence on the page**. Body copy set two steps lighter than its own
heading, in a different *hue*, reads faded however well it measures. Every sentence is
`--ink` now (17.38:1 / 16.79:1) and **hierarchy comes from size and weight**. That is also
the iOS answer: a phone sets near-black at every level and never fades a sentence to rank
it. `--ink-2` was darkened as well, so the labels and fine print still wearing it are not
faded either.

**One axis.** Every section head sat hard left with 40% of the width empty beside it, above
symmetric grids that had no axis to agree with — that, not the grids, is what read as
lopsided. Heads, subs, step labels, step bodies, the plate quote and the whole closing band
are centred. The hero stays left, because it sits on a painting whose architecture is on
the left and whose sky is on the right.

**Four uses of the artwork**, up from two. Hero, the Panini plate as a full second hero at
`min(88svh, 820px)`, **pricing**, and the close. Pricing meant lifting `#costs` out of the
shell so its plate could bleed, and turning the plan cards into glass — see the note in
`docs/brand.md` about why `--surface` cannot be used over a painting.

### 2.3 Three colours that only broke at night, and the test that now catches them

Kept because the *class* of defect is the reusable part, not the three instances.

Finishing the page below the hero found three live contrast failures, **all dark-mode
only, and every one of them a literal that did not move when the token under it did.**

| Where | The literal | What it measured |
| --- | --- | --- |
| `.plan` background | `rgba(255, 255, 255, 0.4)` | A 40% **white** veil. Invisible over the light paper; over the dark paper it composites to `#6b6e79`, a mid-grey slab. Body text **2.93:1**, price **4.43:1** |
| `.plan.pro` background | `var(--navy)` | `#0a0f33` on an `#080d20` page is **1.04:1**. The recommended plan had no edge at all |
| `.flag` text | `#fff` on `var(--blue)` | 10.34:1 by day, **2.70:1** by night |

**Why the item 8 sweep missed all three.** That sweep grepped for the cream at an alpha
and found thirteen. None of these three are cream. A grep for one literal only ever finds
that literal, which is why this is now a test.

**The two real lessons.** First, `.plan` inverted the pricing *hierarchy*, not just the
contrast: the loudest card on the page was the one nobody is meant to take. A colour bug
can be a product bug. Second, **dark UI raises a surface by lifting it, not by darkening
it.** `--navy-card` is `light-dark(#0a0f33, #16204a)`: the same idea in both moods, drawn
the way each mood draws elevation. Cream on it is 13.65:1.

**`src/shared/landingTokens.test.ts` fails the build if a literal colour appears on page
chrome.** It allows two families by name, and the allowlist is itself asserted so an
exemption cannot quietly protect a selector that no longer exists:

- **the three step mockups**, which depict the *extension's* light surface and must not be
  dimmed to suit the page (item 8's recorded decision), and
- **the generated covers**, which carry `generatedCover.ts`'s own five dyes.

It caught a fourth offender by itself that no screenshot would have shown:
`.btn.cream:hover { background: #fff }`.

### 2.2 The landing rebuild, 2026-08-15: what was decided and why

Kept because the diagnosis is reusable and the mechanism choices are not obvious.

**Why it looked old.** Maximo's words were "idk why the landing looks old". The answer is
specific: `frontend-design`'s own calibration names *"a warm cream background near #F4F1EA
with a high-contrast serif display"* as the first of three looks machine-generated design
defaults to. The landing was `#FBF7EC` with a high-contrast serif display. `brand.md` had
carefully dodged the AI-default serif **faces** and never noticed it had walked into the
default **composition**.

**The fix was to stop competing with the artwork.** The plates are the one genuinely
distinctive asset. A vintage face beside a vintage engraving is two things saying the same
thing; a crisp current sans beside a baroque etching is contrast. Maximo chose "all modern
sans, plates carry classical" over two softer options.

**Decisions taken, with the numbers behind them:**

| Decision | Why |
| --- | --- |
| **Manrope**, one family, display and body | Maximo chose it over Archivo and Onest from a real render of all four. 121KB of type became 25KB. |
| Emphasis by **colour**, not italic | Manrope ships no italic, and `brand.md` records a faked slant reaching production once. `forgot` recedes in `--ink-2`, so the word the sentence is about is the one that fades. `font-synthesis: none` makes the fake impossible rather than unlikely. |
| **`light-dark()`** for every token | The alternative was three copies of the palette: media query, `[data-theme="dark"]`, and light. In this repo, three copies of one palette is the recorded failure mode. |
| Veils via **`color-mix`** | Replaced `--paper-rgb`. Same reasoning as the rgba trap, one layer up. |
| Hero at **100svh**, wash moved off centre | The old radial sat at 46%/52%, directly on the architecture: it made the painting legible as a background and illegible as a painting. |
| Secondary button is a **tint, not a ring** | The ring measured 1.38:1 on paper. A filled surface needs no boundary to read as a control. |
| Theme init is a **blocking** head script | Deferring it flashes the wrong mood. It writes `data-theme` always, so CSS answers one question instead of two. |
| The choice is stored **only when chosen** | Storing on load would freeze a reader's OS preference forever. |

**Two things CSS could not do**, both handled in the page script: `<picture>` picks its
source from the OS and ignores a manual override, and the `theme-color` metas do the same.
Both flip via `media="all" / "not all"`, which keeps one plate downloaded rather than
shipping both.

**The trap that cost a wrong conclusion.** This machine renders dark by default. A plain
screenshot is therefore **not** the light mode. Neutralise **every**
`(prefers-color-scheme: dark)` occurrence, not only the `@media` block, or you get the dark
plate under light tokens and it looks like a regression that is not there. **Count them, do
not trust this document for the number**: it was five when this was written and the pricing
plate made it six on 2026-08-15.

### 2.1 Goodreads and StoryGraph export: shipped 2026-08-13, and free

Kept as the record of why, because the interesting part was not the CSV.

The landing and `docs/pricing.md` advertised export as a **Pro** feature while the same
file said the paid tier gates one thing only and that the shelf is never gated. Both could
not be true, and `pricing.md` is machine-readable, which is exactly the kind of file an AI
agent quotes verbatim when comparing tools. So the contradiction was not a copy tidiness
problem, it was the product telling two different stories to whoever asked.

Resolved by making export free on both tiers. Pro lost a bullet; the sentence "the key is
the entire difference between the tiers" became true again. See item 7 for the format
decisions.

---

## Part 3. Blocked on Part 1. Plan tasks, in dependency order

Each is fully specified in `docs/superpowers/plans/2026-08-09-buki-pro.md` with complete
code. Tasks 1 to 5 are done and tested; these are the wiring.

**Items 10 to 16 were BUILT on 2026-08-17.** Every one of them is code-complete, tested
and typechecked; what remains in each is the part only Maximo can do. The pattern is the
same throughout: the decision lives in a pure module under `src/`, and the thing that
needs a credential or a dashboard is the shell around it.

- [~] **10. Task 6, the vision proxy.** `src/server/visionHandler.ts` + `api/vision.ts`,
      13 tests including "never lets the provider key reach the client". `vercel.json`
      excludes `/api/` from the static headers. **Remaining: the five variables (item 2)
      and a deploy.**
- [~] **11. Task 7, exchanging a licence for a session.** `src/server/licenseHandler.ts` +
      `api/license.ts`, 11 tests. **Remaining: the Polar product (item 1).**
- [x] **12. Task 8, the extension holds a licence.** `license.ts` and `proState.ts`.
      `isLicensed` stays true through the server's grace window; holding a key is not
      holding a subscription.
- [x] **13. Task 9, settings learn about the licence.** The Buki Pro section on the options
      page, wired on its own guard rather than behind the provider form's early return.
- [x] **14. Task 10, the worker gates a catch.** `gate.ts` wraps the vision call, and
      `visionRoute.ts` decides whose credential goes where.
- [x] **15. Task 12, the wall.** A sixth card state, its words in `trayCopy.ts`, and a test
      that forbids the four words which would turn a limit into a hostage.
- [x] **16. Task 13, the options page holds a licence.** Same section as item 13, and
      **Task 13 Step 1, the restructure, is now genuinely done (2026-08-17)** rather than a
      section added beside the old order. The page leads with *Your plan*; the own key is a
      collapsed `<details>`; `src/extension/optionsPage.test.ts` asserts the order, which no
      other guard in this repo can see. Rendered in both moods before the tick, and the
      render found three defects the plan did not predict. See the plan's Task 13 Step 1.
- [~] **17. Task 14, the documents that are now false.** 4 steps. **The permission
      justifications (2026-08-16) and the store listing (2026-08-17) are written.** What is
      left is the pair that cannot be written until the proxy answers: `docs/privacy.html`
      and the landing's data section, both of which still say the picture goes straight to
      the provider the user configured. *(see §3 below)*
- [~] **18. Task 15, close the loop.** Step 1 is done (529/53, `tsc` 0, build clean).
      **Step 3 carries a DO-NOT-EXECUTE banner as of 2026-08-17**: it says "strike §1.1 and
      §2.3", and this file has been restructured twice since the plan was written. There is
      no §1.1, and §2.3 is now the dark-mode contrast record from 2026-08-15, which has
      nothing to do with Task 0. Following it literally would delete a live section. Steps 2
      and 4 wait on items 1 and 2, because Step 2 needs a real Chrome and a Polar test card.
- [x] **19. Merge `buki-pro` into `main`. DONE 2026-08-18**, at 81 commits, via
      `superpowers:finishing-a-development-branch`. The count in this line was written when
      the branch was 37 ahead and sat stale for days, which is the drift the header warns
      about; it is now a fact with a date rather than a number that ages.

---

## Part 4. Decisions only Maximo can make

- [x] **20. The eyebrow conflict. DECIDED 2026-08-13 by Maximo: delete all three.** Done
      the same day. `THE GESTURE`, `WHAT YOU END UP WITH` and `WHAT IT COSTS` are gone,
      along with the `.kicker` rule and its entry in the reveal script's `SINGLES`. The
      section rhythm did not need repair: the gap above a heading comes from
      `.band { padding: 108px 0 0 }`, not from the label. Checked in a real render at
      1440px and at 390px. **Do not reintroduce one**; `index.html` says so where the rule
      used to be.

- [x] **21. The catch tray. DONE 2026-08-15, and it was the last surface.**
      `src/extension/content.ts` was the violet-black room with one warm lamp, held back
      through two generations because it is the only surface that renders **inside
      somebody else's page**.

      **The design question it was waiting on has an answer: two thirds of the third
      generation arrives and one third must not.** The transparency stops at this surface,
      because the landing's glass works only where the page owns what is behind it and
      here the backdrop might be a photograph. The card owns its ground instead - the same
      argument `icons/icon.svg` makes for its cream plate. **The webfont stops here too:**
      Manrope would need `web_accessible_resources` matching `<all_urls>`, which is the
      trade item 7 refused for the `downloads` permission, right before store review. See
      `docs/brand.md`, *The one surface with no ground of its own*.

      What arrived: the landing's night palette, capsules with a press, sentences at full
      contrast, two radii, and the mark's spine and cords down the card's edge as a
      **gradient**, so they hold the mark's own fractions however tall the card is.

      `src/extension/contentChrome.test.ts` guards what a screenshot cannot: the rule is
      about every page, not the one you happened to look at.

- [x] **30. DONE 2026-08-18 (`99d6cae`). The `?raw` source guard cannot see control flow, and a reviewer PROVED it.**
      `shelfEdit.test.ts` asserts `expect(background).toContain('markRestored')`. Mutation
      testing showed it passes with the call wrapped in `if (false && msg.restoreOf)` (dead
      code) **and passes with the arguments reversed** — which would relink every undo
      backwards — while all 533 tests stayed green.

      **Fix:** extract `handleSaveBook(msg, deps)` in the `(request, env) => response` shape
      `src/server/licenseHandler.ts` and `visionHandler.ts` already use, leaving
      `chrome.runtime.onMessage.addListener` a thin adapter. Then spy on `log.markRestored`
      and assert `toHaveBeenCalledWith('sb_9', <new id>)` in that order.

      **Why this matters beyond one test:** `background.ts`'s entire message-dispatch
      surface is untestable by import, and this was the first use of `?raw` against
      executable code rather than markup or CSS. If the pattern is repeated for the next
      message type instead of extracting, every new guard inherits the same blind spot.
      *(testing reviewer, P1)*

      **Done.** `src/extension/saveBook.ts` holds `handleSaveBook(msg, deps)` in the
      `(request, env) => response` shape; the listener is a four-line adapter.
      **Mutation-tested rather than assumed:** both mutations that previously passed all
      533 tests now fail — reversing the arguments fails 2 tests, `if (false && ...)` fails
      3. The old `toContain('markRestored')` was REPLACED, not kept beside the new one: it
      had stopped meaning anything the moment `restoreOf` left `background.ts`, and a dead
      guard reads as a considered decision. **This is the pattern the next message type
      should follow** rather than inlining a handler and inheriting the blind spot.

- [x] **31. SETTLED 2026-08-18 by item 28 landing. `/api/license` relays Polar's differentiated error text.** `detail` is returned
      almost verbatim, so a caller past the Origin gate learns not just whether a key is
      real but its STATE — unused, fully activated, revoked. That is deliberate and tested
      (*"passes Polar's own words through, because they say what to do"*), because
      "Activation limit reached" tells a customer to deactivate a device and "invalid
      licence" tells them to write to us. It mainly amplifies item 28 rather than standing
      alone: rate-limiting bounds how many oracle queries anybody gets. **Revisit only if
      28 is not done.** *(security reviewer, P3)*

- [x] **29. DONE 2026-08-18 (`b1676e9`). `proState` had no write queue, and it is the one
      read-modify-write that costs money.** `trial.ts`, `storage.ts` and `recognitionLog.ts` each wrap their storage
      read-modify-write in `createWriteQueue()`, each with a comment saying two overlapping
      writes would silently drop one. `readPro`/`writePro` do not, and `ensureSession` is
      exactly that pattern with a **Polar call that spends an activation slot** in the
      middle. Two catches clicked in the same second both read a stale `ProState`, both see
      `needsRenewal`, and both exchange: two slots for one user action. Worse, if one
      succeeds and the other hits a retryable error, `ensureSession` returns the ORIGINAL
      stale object rather than re-reading, so that catch travels with no token and is billed
      to the customer's trial. **Interacts with item 27**: both burn the same five slots.
      Fix: single-flight the exchange, the way `createLookupMemo` already dedupes concurrent
      recognitions. *(adversarial reviewer, P1)*

      **Done, and single-flight rather than a queue.** A queue would make the second caller
      wait and then re-read to discover the work was done; sharing the one promise means
      there is no second exchange to serialise and no losing caller left holding a stale
      state, so both halves close together. Keyed on the licence key, because two keys are
      two pairings with two slot counts. **`createSessionKeeper` is at MODULE SCOPE in
      `background.ts` and that is load-bearing** — built inside `recognize()` it would be a
      fresh latch per catch, which is the same as no latch.

- [x] **28. DONE 2026-08-18 (`c5e3f64`). `/api/license` had no rate limit.** The Origin check added on 2026-08-17 closed
      the zero-effort path and nothing more: `Origin` is a header any script sets, and the
      extension id is public the moment the item is listed. `/api/vision` at least pairs its
      check with a per-IP cap; `LicenseEnv` carries no rate-limit dependency at all. Five
      forged requests with a leaked key exhaust a customer's five slots. **Two reviewers
      raised this independently** (security P2, adversarial P0). Fix: throttle per licence
      key before calling Polar, and prefer `validate` over `activate` for probes so an
      attempt cannot touch the slot count — which is the same change item 27 needs.

      **Done, and with TWO ceilings rather than one**, because the branches cost different
      things and one number cannot bound both. `validate` creates nothing, so its ceiling is
      only about oracle probing: **40/day**. `activate` spends a slot for ever, so its
      ceiling is **3/day** — a legitimate activation happens once per install and only while
      no id is held, so the tight number costs nobody real anything. A single number
      generous enough for five installs renewing daily would also be generous enough to burn
      every slot the customer has.

      The check lands **before the outbound fetch** (a 429 after calling Polar would burn
      the activation it protects) and **after the key is trimmed** (counting the untrimmed
      string hands an attacker a fresh allowance per trailing space). Both tested; the
      ordering guard was earned with an A/B.

      **Honest about what it is:** the counter is per-isolate, so a caller spread across
      isolates gets more than one allowance. It bounds the casual and the accidental. Item
      26 is still the floor under real money.

- [x] **32. DONE 2026-08-18 (`8e9816f`). `api/vision.ts` held its IP counter inline and
      untested.** The same shape `keyCap.ts` was moved out of `api/license.ts` for the same
      day: a day rollover and a ceiling, living in a file whose own header says it is "the
      shell only ... deliberately short enough that nothing here needs a test".

      **Now `src/server/ipCap.ts`, 7 tests**, four of them on the `x-forwarded-for` chain
      rule, which is the half that decides WHO gets counted. `api/vision.ts` is 39 lines
      again. Behaviour unchanged: 40/IP/day, still gated inside `if (access.kind ===
      'trial')`.

      **This item's body sat unticked while THE LANE showed it struck**, and was caught on
      2026-08-18 by reconciling the two. It is the drift `maintaining-project-docs` exists
      for, inside the file that is supposed to be the authority.

      **Two differences to keep when it moves.** Vision's counter tracks IPs, which real
      callers bound for us, so it needs no eviction rule the way the licence one does; and
      it takes a `Request` rather than a string, so the extraction should keep that shape
      rather than making both endpoints share a signature neither wants. §5 already carries
      the trap this is an instance of: *when one handler has a guard, ask what the sibling
      handler has.*

- [x] **34. DONE 2026-08-18. The checkout links exist, and until today nobody could pay.**

      Every purchase CTA in the extension — the wall's *Get Buki Pro, $4 a month*, the
      popup's plan badge, the setup page's *See what Pro costs* — opens
      `${BUKI_HOST}/#pricing`. That section's only button linked to **GitHub**, to install
      the extension the visitor already had. A person who hit the wall was sent in a circle.

      **`CHECKOUT_MONTHLY_URL` and `CHECKOUT_YEARLY_URL` now live in
      `src/shared/pricing.ts`**, beside `PRICING_URL`, the same shape as `host.ts`. The Pro
      card carries both as a line under its button: *"Already have Buki? Buy monthly or buy
      yearly."*

      **A LINE RATHER THAN TWO MORE CAPSULES**, and the reasoning is in the CSS. Three
      buttons on one card destroys the hierarchy it has, and this is a different action for a
      different reader: the capsule is for somebody deciding which tier, the line is for
      somebody who decided already and arrived from the wall needing the interval they chose.
      The existing comment — *"BOTH plan buttons are solid… the same action with the same
      label going to the same place"* — was about to stop being true, so it was corrected
      rather than left to be read as still covering this.

      **The extension still points at `#pricing` on purpose.** Choosing the interval is the
      customer's decision and the landing is the only surface that shows both, so sending the
      wall straight to monthly would take the choice away.

      Measured before it was looked at, then looked at: `--on-navy-accent` on the navy card is
      **6.89:1** and the line around it **10.73:1**, rendered in both moods from the landing's
      own stylesheet. Underlined as well as coloured, because colour alone is not a signal.

      **Guarded four ways** in `pricing.test.ts`: both are Polar over TLS, they are two
      DIFFERENT links (one URL pasted twice would silently sell monthly to somebody who chose
      yearly), the landing carries both, and they are inside the `#pricing` SECTION rather
      than merely somewhere on the page. Earned with an A/B — removing the buy row turns it
      red.

      **They are public.** Polar issues a checkout link to be clicked, which is why it can
      sit in the repo at all. `POLAR_ACCESS_TOKEN` cannot, and the two arrive from the same
      dashboard on the same afternoon.

- [ ] **37. THE EXTENSION ID YOU TEST WITH IS NOT THE ID THAT SHIPS, unless you pin it.**

      `BUKI_EXTENSION_ID` is the value both endpoints check the `Origin` header against:
      `policy.ts` compares `origin === 'chrome-extension://' + extensionId`, and a mismatch
      is a **403 for every real user**, on both `/api/vision` and `/api/license`.

      Chrome: *"The extension ID is generated based on a hash of the public key."* An
      unpacked extension is signed with a key Chrome makes up locally; the Web Store signs
      the published one with a different key. **So the id from `chrome://extensions` during
      item 3 is not the id your customers will have**, `manifest.json` has no `key` field,
      and nothing in this repo would notice. Same shape as the two blockers found on
      2026-08-18: written, tested, and inert on the one day it matters.

      **THE FIX IS A SEQUENCING CHANGE, not code.** Chrome's documented procedure:

      1. Register the developer account and zip the extension directory.
      2. **Upload it as a new item and do NOT publish.** The id is assigned on upload.
      3. Package tab → **View public key** → copy everything between
         `-----BEGIN PUBLIC KEY-----` and `-----END PUBLIC KEY-----`, strip the newlines.
      4. Add it to `manifest.json` as `"key"`. The unpacked build now loads under the
         SHIPPED id.
      5. Only then set `BUKI_EXTENSION_ID`, and only then run item 3.

      **This moves the developer account from "parallel, whenever" to a prerequisite of the
      by-hand pass.** Doing it the other way round means testing an id nobody will ever have.

      <https://developer.chrome.com/docs/extensions/reference/manifest/key>

- [ ] **36. Every install CTA on the landing points at GitHub, and on launch day five of
      them must not.** The comment above the hero button says why it is right today: *"there
      is no Web Store listing yet, so the link goes to the source."*

      **Eight GitHub links. Five change, three must not.**

      | Stays GitHub | Becomes the store URL |
      | --- | --- |
      | `Source` in the nav | `Get Buki free` in the nav |
      | `Source` in the footer | `Get Buki free` in the hero, **the primary CTA of the whole funnel** |
      | `Report a problem` (issues) | `Get Buki free` on the Free plan card |
      | | `Start free, then activate Pro` on the Pro card |
      | | `Get Buki free` in the closing band |

      **A find-and-replace would send `Source` to the Web Store**, and nobody would notice,
      because it still goes somewhere plausible.

      The store URL carries the extension id, so it does not exist until the item is
      published. Same shape as item 34 was, and it now pairs with item 37: pinning the id
      with a manifest `key` means the URL is knowable at the DRAFT upload rather than only
      after publication.

      **Guarded.** `host.test.ts` does not assert WHAT the destination is — it cannot know
      yet. It asserts every install CTA shares ONE, which is the failure that actually
      happens: five links, three updated, two left behind. This repo has form; the plan that
      renamed the production host named three files and the real number was seven. A `.btn`
      anchor whose href is a fragment is an in-page jump, not an install CTA, which is what
      separates *See it catch a book* from the five. Earned with an A/B against exactly that
      half-migration.

      **This item had a LANE row and no body until 2026-08-18**, the mirror of item 32
      having a body and no lane tick. Both were found by reconciling the two halves of this
      file against each other.

- [ ] **35. The affiliate tags are empty, so every Buy link earns nothing.**
      `AFFILIATE = { amazonTag: '', bookshopId: '' }` in `src/extension/buyLink.ts`. The
      links are correct and tested and work without the tags, which is deliberate — a buy
      link that only functions once an affiliate account exists cannot be tested before it
      ships. But until an Amazon Associates tag and a Bookshop.org id are pasted in, the
      second revenue line is zero by construction.

      **The disclosure half is already done**, in the popup footer, the setup page and the
      privacy policy, because Chrome Web Store policy permits affiliate links only when they
      are disclosed. So this is one paste, not a feature.

- [x] **26. Set a hard spend cap and an alert on the Gemini key.** **CAP SET 2026-08-27, at
  $5.** At the `$0.00011` per catch that `entitlement.ts` and `policy.ts` both assume,
  that is roughly **45,000 catches, or 4,500 users' entire free trials** - ample for launch.
  **TWO FOLLOW-UPS REMAIN AND BOTH ARE MAXIMO'S**, tracked here rather than as a new item
  because they are the same control: (a) confirm it STOPS spending rather than emailing,
  because a Google Cloud *budget* is an alert by default and caps nothing; (b) set the alert
  BELOW the cap, around 50%, so the first news is not the outage. **Raise it the day there is
  a paying subscriber** - a tripped cap takes Pro down with it. Original text follows.

- [ ] ~~**26. Set a hard spend cap and an alert on the Gemini key.**~~ Maximo only, in Google
      Cloud billing, and it is the **only** control that bounds what abuse can cost. Both
      APIs identify the caller by an `Origin` header, which anything that is not a browser
      can set, and the extension id is public the moment the item is listed. Everything
      else raises the bar; a spend cap is the floor. `docs/superpowers/polar-setup.md` §8.1.

      **While there, check the real per-catch cost.** `policy.ts` rests the trial threat
      model on "about $0.00011" and that number appears once in this repo, in the comment
      that uses it. Never measured.

- [x] **25. DECIDED 2026-08-18 (`1a65357`): it was not, by day.** `.ghost` was `--sunk` on
      `--paper`: **1.08:1 by day, 1.15:1 at night.** Rendered in both moods at the real
      padding and radius, which is what settled it — night read fine, because true black is
      a strong ground, and by day the control read as bold text with a faint halo rather
      than as a pill.

      Moved to **`--board`**: 1.27:1 by day, 1.79:1 at night, better in both. That is also
      the value the comment above the rule had rejected **by name** at 1.28:1 before the iOS
      turn replaced it with something fainter still, which is the contradiction that kept
      this open.

      **A REGRESSION WAS CAUGHT ON THE WAY.** `.ghost:not(:disabled):hover` was ALREADY
      `--board`, so moving the rest state there would have made rest and hover the same
      colour and deleted the feedback on four controls, silently, with nothing red. Hover
      now takes a new **`--board-hi`** (the next Apple system grey), stepping 1.19:1 by day
      and 1.28:1 at night, away from the ground in both moods. Naming follows the pair this
      system already uses twice.

      **The popup's `--fill`/`--fill-hi` were considered and rejected on a measurement:**
      composited, Apple's translucent material lands FAINTER than `--board` in both moods,
      which is the problem being fixed.

- [x] **22. Ship free-first, or wait for the paid tier? DECIDED 2026-08-13 by Maximo:
      wait.** The landing copy therefore stays as written and stays true on the day it
      ships. The consequence is that **items 1 and 2 are now the critical path for the
      whole project**, not routine setup: nothing in Part 3 can start until the Polar
      product exists and the five Vercel variables are set. The Web Store review clock does
      not start until then, and that is the accepted cost.

---

## 3. The store documents: both are written, and neither may be submitted yet

**`docs/store/permissions.md` was the one that failed review, and its permission half is
now written (2026-08-16).** `scripting`, `activeTab` and the optional host permission are
all justified, each naming the feature that needs it and what breaks without it, and the
narrowest-honest framing is stated at the top where a reviewer comparing the manifest
against the file will meet it first: **`activeTab` plus one optional host permission
requested on first use, not a broad host permission at install.**

Three facts went in that were read out of the code rather than assumed, and they are the
ones that make the ask defensible:

- `originPatternFor` derives the request from the image's **own URL**, so what is actually
  requested is a single host. A hostname carrying a wildcard is refused rather than passed
  to `permissions.request`, so the declared `https://*/*` can never itself be granted.
- Covers live in the **Cache API**, not `chrome.storage.local`, specifically so the shelf
  does not eat the quota and so `unlimitedStorage` never has to be asked for.
- `covers.openlibrary.org` redirects to `archive.org`, which no permission covers and none
  is needed for, because every hop answers with permissive CORS.

**What is still open in that file:** the Data usage section and the
`generativelanguage.googleapis.com` block, both carrying their own DO-NOT-SUBMIT banners.
They describe the picture going straight to the provider the user configured, and
`/api/vision` makes that false. Rewrite them, `docs/privacy.html` and the landing's data
section **in the same commit as the proxy**.

**`docs/store/listing.md` is rewritten, 2026-08-17.** The `Single purpose` field was the
one that would have failed: it said Buki *"identifies books shown in posts on x.com"*, a
statement scoped to one site sitting beside a manifest asking for `scripting`, `activeTab`
and an optional `https://*/*`, which is exactly the contradiction a reviewer looks for. It
now names one purpose covering every entry point the manifest has.

**Two things the rewrite found that were not on anybody's list:**

- **The `Name` field was a field the dashboard does not own.** It read
  `Buki: catch books from X` while `manifest.json` says `Buki`. The Web Store takes the
  name and the summary from the manifest, so the file was offering copy for a box that
  does not exist, in a value that contradicted the shipped one. The summary is now quoted
  from the manifest verbatim and asserted as such.
- **The listing is written FORWARD**, against the product at submission rather than the
  product today, because item 22 decided Buki ships only once the paid tier works. It
  carries a DO-NOT-SUBMIT gate naming the two things that must be true first, in the same
  shape as `permissions.md`'s banners.

**What is genuinely left in item 17:** `docs/privacy.html` and the landing's data section.
Both still say the picture goes straight to the provider the user configured, which the
proxy makes false, and both are rewritten in the same commit as the proxy.

---

## 4. Things that are done, so nobody re-opens them

- **The Vercel rename.** Production domain is `https://get-buki.vercel.app`, defined once
  in `src/shared/host.ts`. Every shipped file that carried the old host was updated.
- **Plate provenance.** Both plates are public domain 18th-century capricci from Wikimedia
  Commons, credited in the page footer. The old ones came from X media ids with unknown
  rights and were an open legal risk for two sessions.
- **Catch-anywhere.** Task 11 is built and committed. Only the manual check remains, item 3.
- **The mark, three-spine version.** `icons/mark.svg` and `icons/icon.svg`. See
  `docs/brand.md` for why the caught spine is a light blue and not the cobalt accent, and
  why the icon has a plate. **The two-spine drawing that briefly superseded it on the
  landing is gone**: Maximo supplied the three-spine mark on 2026-08-15 and it is now the
  only mark, defined once in `tools/mark.mjs` and asserted across six surfaces by
  `src/shared/mark.test.ts`. See item 24.
- **The popup and options page** followed the landing as of 2026-08-12. **They no longer
  do**, and that is scheduled rather than broken: Maximo chose landing-first on 2026-08-15.
  Do not "fix" them by copying the landing's tokens across.
- **Export.** Free on every tier, and the four contradictory statements in `docs/pricing.md`
  are resolved. Do not re-gate it: see item 7.
- **Dark mode.** Both moods, from one `light-dark()` declaration per token, plus a manual
  switch. Do not add a `@media (prefers-color-scheme: dark)` palette block back; that is the
  duplication `light-dark()` replaced.
- **The landing, top to bottom.** Finished 2026-08-15. It has **one** surface language:
  `--surface` and `--ring` for a quiet panel, `--navy-card` for the emphasised one, two
  radii and a capsule. Do not reintroduce a hairline `border` to separate a card — a card
  separates by ring and shadow, and the 3:1 boundary bar in `docs/brand.md` is for a
  *control*, not a surface. Do not add a third radius.
- **The closing band carries the hero's plate**, the dark one in both moods. It is not an
  oversight that a light reader gets a dark plate there: the band is navy either way, and
  the alternative is a second scrim and a second measurement for a surface that is not
  actually lighter. A dark reader pays nothing, because the hero already fetched that file.
- **The landing's serif.** Petrona is gone from `docs/index.html` on purpose, and the
  reasoning is in §2.2. Do not restore it to match the popup.

  The font files were cleaned up with it, and the split matters: **`popup.html` and
  `options.html` load from `fonts/`, not from `docs/`.** So `fonts/petrona.woff2` and
  `fonts/instrument.woff2` stay, because the extension is still on the second generation.
  `docs/petrona.woff2`, `docs/petrona-italic.woff2` and `docs/instrument.woff2` were only
  ever the landing's copies and were being **served publicly for nothing** once the landing
  stopped loading them, so they are deleted. `docs/type.html` and `docs/_type/` went too:
  that page was the specimen for choosing a display face, it says in its own header to
  delete it once one is chosen, and one is chosen. `docs/` fell from 4.3MB to 3.6MB.

---

## 5. Traps that have already cost time

> ### ⚠ MOST OF THIS SECTION IS UNREACHABLE IN A DEFAULT READ, AND THAT WAS MEASURED
>
> §5 spans lines **1900-2511** of this file and the Read tool takes **2000 lines by
> default**, so roughly five sixths of it is invisible unless read with an explicit
> `offset`. On 2026-08-27 the entries below that cut were `heredoc`, `backtick`, `npx`
> and `0x08` - **the exact four traps hit five times in one session**, by an agent that had
> read this file.
>
> **That is why `CLAUDE.md` exists and why it SPELLS THE SHELL TRAPS OUT rather than
> pointing here.** It is the one place the point-do-not-copy rule is deliberately broken,
> and `src/shared/agentRules.test.ts` holds it to that: four mutations, four caught,
> including one that tidied a trap back into a pointer.
>
> **Read this section with `offset: 1900`.**

### THE 2026-08-27 SET. Every one of these made an instrument LIE, not a test fail.

**They are grouped because they share a shape: each produced a confident GREEN over broken
work.** A red test is a gift. These are the other kind.

**T1. A self-referential assertion pins nothing.**
`expect(peak).toBeLessThanOrEqual(GROUND_AT_ONCE)` looks like a ceiling and is not one:
raise `GROUND_AT_ONCE` to 20 and it becomes `19 <= 20`, green, with the HTTP 429 fully
restored. **Pin the CONSTANT against a literal, separately from the behaviour asserted
against the constant.** Found by mutating the constant, which is the only thing that shows
it - reading the test does not, because it reads correctly.

**T2. A fixture smaller than the thing it guards proves nothing.**
`mapPool`'s completeness tests used two and three items against a pool of four, so a
mutation that stopped after the first batch survived. **The guard's fixture must be bigger
than the guard's own bound.**

**T3. Scattered failures are not the failure mode. Total failure is.**
The first attempt at "one bad cover must not strand the rest" failed two of eight and passed
either way, because the surviving pool workers drain the cursor between them. The tail is
only stranded when EVERY worker dies. **Fail exactly `COVERS_AT_ONCE` - the workers take
items 0..n-1 before any of them awaits.** Two attempts before the test could tell the two
implementations apart.

**T4. A `?raw` presence guard is satisfied by the COMMENT that explains it.**
`expect(storeShots).toContain('ten catches free')` passed with the phrase DELETED from the
frame, because the comment above the frame saying *"pricing.test.ts holds 'Ten catches free'
to TRIAL_CATCHES"* satisfied it. **Extract the displayed strings and assert over those**
(`/\b(?:head|sub):\s*'([^']*)'/g`), never over the file. This is §5's oldest lesson in its
purest form and it was re-learned the same week it was written down.

**T5. An ABSENCE proof can be too broad, and the suite will say so.**
Banning `candidates.length > 1` from `content.ts` to stop a heading being gated turned red
on the line that decides whether to draw *Save all* - where a batch button on one book is
exactly what should not be drawn. **Scope an absence proof to the exact shape that was
removed**, here `who.append(mk, provenanceOf(card))`.

**T6. `execSync` from a node script does NOT get the Bash tool's shell.**
It spawns **cmd.exe**, which cannot resolve `./node_modules/.bin/vitest` *or even the bare
word* `node`, because the inherited PATH is Unix-form (`/c/Program Files/nodejs`). The
error returns in Spanish. **Build the command from `process.execPath`.**

**T7. STRIP THE ESC BYTE, not just the `[32m` tail. Three occurrences in one session.**
`out.replace(/\[[0-9;]*m/g, '')` leaves `\x1b` in place, so `/Tests\s+(\d+)/` never
matches - `\s` does not match ESC - and **every mutation reports SURVIVED against a harness
that read nothing.** It cost five round trips and two wrong hypotheses (maxBuffer, then a
network call) before the raw bytes were printed. **Use `/\x1b\[[0-9;]*m/g`, and make the
harness ABORT when it cannot parse a total rather than scoring it as zero.**

**T8. Backticks, again, and now inside CSS-in-a-template-literal.**
`.buki-eyebrow` written with backticks inside a CSS comment in `content.ts` **closed the
template literal**, and `tsc` reported `Property 'buki' does not exist`. `String.raw` does
not help - a backtick terminates the literal regardless. **Five occurrences across this
session**, every one from reaching for `node -e` with a regex or an apostrophe in it. The
remedy is written in the `buki-shell-traps` memory and was not followed: **write content
with the Write tool, apply it with `node <file>.mjs`.**

**T9. THE LANE AND THE ITEM BODIES DRIFT APART, and the stale half is read second.**
Items 1 and 26 had their LANE rows struck the moment they closed and their Part 2 checkboxes
left open, so this file disagreed with itself for half a day and the header's open count was
wrong. Item 57 got a LANE row and no body at all - a row pointing at nothing. **The probe:
the numbers in `grep -o '^| \*\*[0-9]*\*\*' OPENWORK.md` must be the same SET as
`grep -o '^- \[ \] \*\*[0-9]*' OPENWORK.md`.** Run it before trusting the header.

**T10. A comment can be the reason a bug was reasonable to write.**
`openLibrary.ts` said *"no hard rate quota (unlike keyless Google Books, which 429s)"*.
There is no PUBLISHED quota, which is not the same as no quota, and that sentence is very
likely why an unbounded `Promise.all` over twenty guesses looked safe. **When a bug is
found, read what the code says about itself and correct THAT too** - struck rather than
deleted, because the wrong belief explains the code above it.



- **THE GUARD YOU JUST WROTE IS THE ONE YOU ARE LEAST ABLE TO SEE THROUGH. Mutate it. 2026-08-25.**
  Every P0 fix this session was mutation-tested after it went green, and **one of the new
  guards survived**: replacing `trial.ts`'s `attempts: () => read(ATTEMPTS_KEY)` with
  `attempts: async () => 0` left the whole suite green. Attempts were written on every catch
  and read back as zero for ever, so the ceiling could never be reached and item 42's fix was
  inert. **The tests had been written thirty minutes earlier, by someone holding the whole
  design in their head, specifically to catch this class of bug.** They asserted the gate
  called `attempt()` and that `decide` respected the ceiling — both true, both useless
  without the round trip in between.
  This is `readPro` dropping `activationId` for the third time (see item 27, twice). The
  countermeasure is not more care: it is that **a guard is not finished when it passes, it is
  finished when you have watched it fail.** Cost: nothing, because the mutation found it.
  It would have cost the whole of item 42 otherwise.

- **THE HEREDOC TRAP FIRED TWICE MORE. Sixth and seventh occurrences, 2026-08-25**, both
  within an hour, both after re-reading the entry below that warns about it. The failures
  were `unexpected EOF while looking for matching quote` and `here-document delimited by
  end-of-file`, and in both cases **bash never ran the command at all**, so nothing was
  written and the next step reported success against unchanged files.
  **The rule that actually works is mechanical, not a caution: over about twenty lines, write
  the content with the Write tool and apply it with `node <file>`.** A `.mjs` in the scratch
  directory takes ten seconds, applies exactly once, and prints which replacement missed.
  Two of this session's edits also failed on `\.` inside a regex literal surviving shell
  quoting — same root, different character, and the same fix.

- **A TEST CAN PASS AGAINST THE MUTATION FOR A REASON THAT HAS NOTHING TO DO WITH WHAT IT
  ASSERTS. 2026-08-25.** Closing the review's `bearer empty→null` mutation, the obvious
  fixture was `Authorization: 'Bearer '` — which looks exactly like the empty case and is
  not. **`Headers` strips trailing whitespace**, so the value arrives as `'Bearer'`, the
  `\s+` in the regex never matches, and BOTH the correct and the collapsed implementation
  return `'Bearer'` and answer 401. The test passed, the mutation survived, and the two facts
  had no connection to each other. Only `authorization: ''` distinguishes them, which a
  four-line `node -e` probe settled in seconds.
  **The general rule: a fixture that goes through ANY normalising layer — headers, URLs,
  `JSON.parse`, a form encoder — is not the value you wrote.** Probe what arrives before
  asserting on what you sent. This is the third instance this session of a just-written guard
  not doing what its author believed.

- **A MUTATION THAT DOES NOT COMPILE PROVES NOTHING, AND LOOKS LIKE A PASS. 2026-08-25.**
  A `sed` that turned `} finally {` into unbalanced braces made `gate.test.ts` fail to LOAD,
  so vitest reported `92 passed` — a smaller number than the baseline's 107, all green. Read
  as "the mutation survived" it is exactly backwards, and read carelessly it is reassuring.
  **Compare the TOTAL, not just the failure count**: a mutation run whose total dropped did
  not run the tests you think it ran. Two of nine mutations this session were invalid this
  way, both caught only by the total.

- **A LARGE HEREDOC THROUGH BASH BREAKS ON QUOTING. Fourth occurrence 2026-08-18**, writing
  the handoff: `bash: unexpected EOF while looking for matching quote`, with nothing written.
  It has now cost time in four separate sessions and **had never been written down here** —
  it lived only in handoff documents, which are read once and superseded. That is exactly
  why it kept recurring. **Write the file with the Write tool.** Short quoted heredocs
  (`git commit -F - <<'MSG'`) are fine and are used throughout this repo; the failure is
  length plus mixed quoting.
- **A trap recorded only in a handoff is a trap you will pay for again.** Handoffs are
  superseded and stop being read. §5 is the place a lesson survives; when a session finds
  something that cost time, it goes HERE, not only in the ledger pair.

- **A PERFORMANCE CLAIM IS A CLAIM, AND THIS ONE WAS NEVER TRACED.** Three documents
  carried *"`authorName()` is an N+1 ... a 20-book photo means 20 follow-ups"*. The call
  graph says otherwise: the multi-book path is `groundText` -> `search`, and `search.json`
  is asked for `author_name` in `FIELDS`, so it costs one request per title and no
  follow-up. `authorName()` is reached only from `lookupByIsbn`, from a single `if (isbn)`
  branch, for ONE book, on the path that skips vision entirely. **The fix would also have
  been a regression:** moving the ISBN lookup back to `search.json?q=isbn:` is the thing
  that was measured timing out for over 20s on 2026-08-04. A named optimisation nobody
  traced is the same shape as a contrast ratio nobody rendered.

- **WHEN YOU CHANGE A VALUE, THE RULES THAT REFERENCE IT ARE PART OF THE CHANGE.** Item 25
  moved `.ghost`'s rest fill from `--sunk` to `--board`. Eleven lines below,
  `.ghost:not(:disabled):hover` was ALREADY `--board` — so the edit would have made rest and
  hover identical and deleted the hover feedback on four controls, silently, with nothing
  red anywhere. This is the mirror of *"a guard at the top of a script owns everything below
  it"*: **read the rules BELOW the one you are editing, not only the one you are editing.**
- **A CONTRAST RATIO IS ABOUT THE PAIR YOU CHOSE, AND THE CONTROL MAY NOT SIT ON IT.** Item
  25 was measured for a year as "`--sunk` against `--paper`". Three of the four controls
  wearing it sit on `--card`. Rendered, `--sunk` is DARKER than `--card` at night and
  LIGHTER than `--paper`, so the same token flipped from inset to raised depending on what
  was under it. Nobody measuring the named pair would ever have found that. **Ask what the
  control actually sits on before you measure it against the page.**

- **A VALUE CAN BE CORRECT IN EVERY ENVIRONMENT EXCEPT THE ONE THAT MATTERS, and this
  project has now found THREE of them in one day.** `readPro` carried the activation id
  correctly through four modules and dropped it at the storage boundary. The manifest
  declared six hosts and not the one the product actually calls. `BUKI_EXTENSION_ID` is
  right on the developer's machine and wrong for every customer, because Chrome derives an
  extension id from a hash of its public key and the Web Store signs with a different one.
  **None could fail a test, because in each case the TEST environment supplies the value the
  PRODUCTION environment withholds** — a fixture carrying the field, a stubbed `fetch` with
  no CORS, a dev profile with a dev key. **The tell is a value that crosses a boundary the
  test suite never crosses.** Item 3's by-hand pass is the only instrument that sees any of
  them, which is why it cannot be skipped.
- **THE LANE AND THE ITEM BODIES ARE TWO HALVES AND THEY DRIFT APART IN BOTH DIRECTIONS.**
  On 2026-08-18 item 32 was struck in THE LANE and still `[ ]` in its body, and item 36 had
  a LANE row and no body at all. Neither was visible from inside one half. **Reconcile the
  table against the items whenever either is touched**; the count at the top of a grep
  (`grep -c '^- \[ \] \*\*[0-9]'`) is the cheapest way to notice.
- **A PROJECT'S NAME IN A DOC IS A CLAIM LIKE ANY OTHER.** `polar-setup.md` §8 said
  "Project `buki`" for weeks. `vercel project ls` says the project serving
  `get-buki.vercel.app` is still called **`shelfy`** from before the domain was renamed, and
  a sibling `save-book-extension` project sat beside it looking exactly like the right
  answer. Setting six variables on the wrong project is a half-configured deploy that looks
  like it works, which is the failure the 500-loudly design already defends against, one
  level up. **`vercel env ls` prints names without values** and is the safe way to check.
- **A PLATFORM DEFAULT CAN BILL YOU ACROSS PROJECTS YOU WERE NOT THINKING ABOUT.** Vercel's
  Observability Plus is `$1.20 per 1 million events`, enabled by DEFAULT for teams created or
  upgraded to Paid Pro on or after 2026-04-03, and it applies to **every project on the team**
  unless excluded. A zero-user project is not the one generating the bill; its busy siblings
  are. **Exclude the noisy projects rather than disabling the feature** — turning it off drops
  Pro retention to one day, and on a launch where the client is deliberately uninstrumented
  the server logs are most of what you have.

- **A GUARD THAT NAMES THE WRONG HOST CANNOT SEE A MISSING ONE.** `host.test.ts` globs the
  shipped files and fails any that names a DIFFERENT Vercel host. `manifest.json` is in that
  glob and passed **by naming no host at all** — while `visionRoute` posted every keyless
  catch to `${BUKI_HOST}/api/vision` and both the worker and the options page posted every
  licence exchange to `${BUKI_HOST}/api/license`. Chrome treats a request to an undeclared
  origin as a plain cross-origin request, neither handler sets `Access-Control-Allow-Origin`
  and `vercel.json` excludes `/api/` from its headers, so **the whole paid tier would have
  failed on the wire** the day the variables were set. Fixed `b4118cf`. The guard now derives
  the pattern from `BUKI_HOST`. **Ask what a guard is blind to, not only what it checks.**
- **A HARNESS THAT AGREES WITH YOU IS THE ONE TO DISTRUST.** The first `x-button-harness`
  drew X's own action icons at OUR `.72` opacity, when X renders its own at 1. The
  comparison that decides the design is ours-muted against theirs-solid, and the flattering
  version would have been read as a pass. **An instrument has to be checked for the way it
  is kind to you, not only for the way it lies.**
- **583 TESTS PASSED ON A FILE THAT DOES NOT PARSE.** The backtick-in-a-CSS-comment trap
  fired a third time in `content.ts`'s `STYLE` literal. Nothing caught it in the suite,
  because **nothing imports `content.ts` as a module** — it registers listeners at module
  scope, so `contentChrome.test.ts` reads it as `?raw` TEXT. `tsc --noEmit` and
  `node build.mjs` caught it. **Green is not the same as parses**, for the largest file in
  the extension. Item 33.

- **AN OPTIONAL FIELD ADDED TO AN INTERFACE MAKES EVERY EXISTING CONSTRUCTOR OF THAT
  INTERFACE SILENTLY INCOMPLETE.** `cdda054` added `activationId?: string` to `ProState` and
  fixed the four places that WRITE it. `readPro` rebuilds a sanitised subset of that
  interface and was never extended, so the id was stored on every exchange and dropped on
  every read — and the P0 it was added to fix went on happening. **`tsc` cannot help**: the
  field is optional, so a literal that omits it is a valid `ProState`. This is the same
  permissiveness as *"an arrow taking fewer parameters is assignable"*, one commit apart, in
  the same feature. **When you add a field to an interface, grep for every function whose
  return type is that interface** — the writers are obvious and the readers are not.
- **A ROUND-TRIP TEST IS ONLY AS COMPLETE AS ITS FIXTURE, and `Required<T>` fixes that for
  free.** `writePro` → `readPro` had a round-trip test. Its fixture was `{ key, session }`,
  so it could not see a third field being dropped. Typing the fixture `Required<ProState>`
  makes the COMPILER enumerate the interface: a new field stops the fixture compiling until
  it is named, and then the assertion fails until the reader carries it out. Types are
  erased at runtime so a test cannot enumerate an interface itself — this is the one way to
  make it, and it costs one annotation.
- **EVERY TEST OF A FUNCTION THAT TAKES STATE AS AN ARGUMENT IS BLIND TO HOW THAT STATE IS
  LOADED.** All seven `ensureSession` tests passed `activationId` in directly, so the value
  flowed perfectly in every test and never in production. **When a function's input comes
  from storage, at least one test has to start at the storage.**
- **A GUARD CAN PROVE ABSENCE EVEN WHEN IT CANNOT PROVE PRESENCE.** §5 records at length
  that a `?raw` source guard cannot see control flow. It follows that `toContain('x')` is
  weak — but `not.toContain('x')` **on an import statement** is strong: imports have no
  branches, and prose in a comment cannot satisfy it. `background.ts` importing
  `createSessionKeeper` and NOT `ensureSession` is the actual mechanism that keeps the
  renewal inside the latch, so that is what is asserted. Earned with an A/B both times.
- **A COUNTER IS LOGIC, AND A FILE THAT SAYS "NOTHING HERE NEEDS A TEST" MUST NOT GROW ONE.**
  The `/api/license` cap was first written inside `api/license.ts`, whose own header says it
  is the shell only and deliberately short enough to need no test — and it immediately held
  a day rollover, two ceilings and an eviction rule. Moved to `src/server/keyCap.ts` as a
  factory, so a test gets a fresh counter. **`api/vision.ts` still has the same shape**
  (item 32), which is the sibling this file already has a trap about.

- **A retokening that changes an accent's LIGHTNESS invalidates every hardcoded colour
  sitting on it.** Moving `--accent` from amber to cobalt left the options save button at
  `#241705` on `#1231a8`, which measures 1.69:1 and is an unlabelled button. Grep for hex
  literals near any token you relight.
- **`str.replace` does not fail when it matches nothing.** Three font swaps silently did
  nothing because the real declaration was `15px/1.55` and the search string said
  `15px/1.5`. Assert the match or diff the result.
- **A running animation beats a transition on the same property, silently.** The scroll
  cue's `breathe` keyframes wrote `transform`, so adding `:active { transform: scale(...) }`
  produced no press at all and no error. Moving the animation to the `translate` property
  freed `transform` for the press. Whenever a pressable element also animates, check that
  the two are not writing the same property.
- **A colour bug can be a product bug.** `.plan`'s white veil did not merely fail contrast;
  it made the tier nobody is meant to take the loudest card in the section. When a defect
  is in a comparison, check what the defect is *saying*, not only what it measures.
- **A media query outlives the layout it was written for, silently.** The plate quote used
  to hug the right edge, so a `max-width: 860px` block pulled it back with
  `justify-content: flex-start`. The moment the quote was centred, that block quietly
  un-centred it **at every width below 860px** — most readers — and no desktop screenshot
  could ever have shown it. **When you change an alignment, grep the media queries for the
  property you changed.**
- **A declaration can be a no-op and still look deliberate.** `.plate-band blockquote span`
  said `font-style: italic`, but Manrope ships no italic and `font-synthesis: none` makes
  the browser refuse to shear the roman. The emphasis had been doing nothing except going
  lighter for as long as the family has been Manrope. `brand.md` warns about a *faked*
  italic reaching production; this is the inverse and it is just as invisible.
- **`--surface` is a tint of the PAGE and cannot be used over a picture.** It is `--ink` at
  4%, so on a plate the painting shows straight through the card and takes the text with
  it. Over artwork a panel has to be real glass, measured against the plate's own extreme
  pixels — sample them out of the file, do not guess them.
- **A cap chosen for one shape silently truncates another.** `MAX_BOOKS = 8` was sized
  against a photographed bookshelf holding fifty spines, and `groundText` returned the
  first grounding line's results because its job was to find THE book on a cover. Both
  were right for the shape they were written for. Neither knew about a post that lists
  twenty titles, and the result was seven books with nothing on screen saying the rest had
  been dropped. **When you write a cap, write down the shape you sized it against**, so
  the next shape is visible as a question rather than as a silent loss.
- **An ordering bug can reproduce the very truncation it was meant to fix.** Collecting
  books from every grounding line is not enough: putting line one's runners-up ahead of
  line two's best turns a list of twenty into a few titles and their near-misses, because
  the caller slices. Bests first, then the alternates.
- **`getBoundingClientRect()` includes transforms, including one still animating.** The
  tray's FLIP reflow measured mid-travel slots, wrote a fresh `translateY` and discarded
  the in-flight offset, snapping a card by over a hundred pixels onto its neighbour. It
  was not a rare race: the interrupting reflows fire at 115ms and 200ms inside a 280ms
  travel, so it happened on the normal path. **When you re-enter an animation, carry the
  offset it is already carrying.**
- **A background on `html` or `body` propagates to the CANVAS, and a canvas background is
  not clipped by anybody's `border-radius`.** The popup shipped a rounded `<html>` and a
  rounded, painted `<body>`, and had square corners both times — two live declarations,
  neither doing anything. Making the root transparent does not fix it either, because a
  transparent root propagates from the body in turn. **The paint has to be on a third
  element.** Verified as a corner PIXEL over a transparent backdrop: `rgba(0,0,0,255)`
  before, `rgba(0,0,0,0)` after.
- **Raising a cap changes the GEOMETRY of everything downstream of it, not just the count.**
  `MAX_BOOKS` 8 → 20 was right and fixed a real loss. It also made a catch card 680px in a
  732px tray, and since a new card's neighbours travel its full height, a transient overlap
  that was a couple of hundred pixels became 436px. **An element whose height is driven by a
  list needs a bound that does not depend on the list.**
- **A probe that has never been shown to detect the thing it is looking for is not
  evidence.** Five instruments lied in one session, four of them built that session: a
  harness that renders the stylesheet and never runs the script; a rAF probe under
  `--virtual-time-budget` (rAF does not fire); the same probe with rAF shimmed to a timer
  (with `--dump-dom` no frames are produced, so CSS transitions never advance at all); a
  FLIP invariant measured in viewport coordinates across a deliberate scroll; and the same
  one reading at t=0 of a travel it had armed and never advanced. **Earn a probe with an
  A/B where the control is expected to differ**, then trust it.
- **Park the clock instead of waiting for it.** `animation.currentTime` is honoured by style
  recalc without a frame being drawn, which is the only way to measure a transition-timing
  bug in headless. Nothing about `--virtual-time-budget` makes transitions advance.
- **A function can be written, tested, and have NO CALLER.** `needsRenewal` was built on
  2026-08-17 with tests, and nothing invoked it, so a Pro session would have expired after
  a day, ridden the seven-day grace and then shown a paying subscriber the wall they had
  already paid to pass. **Nothing was red.** It was found by reconciling the plan's steps
  against the code during the doc pass, which is the only thing that would have found it.
  When a helper exists to answer a question, grep for who asks.
- **A plan's checkbox is a claim, and claims get made carelessly.** Ticking the six tasks
  built that day put four ticks on steps nobody had performed — a discriminate check, a
  brand-checklist pass, a "look at it in a real page", and a page restructure that was
  actually just an added section. Three were then done properly and one was left open. **If
  a step says "prove" or "look at", the tick means you did that, not that the feature works.**
- **A fixture that quotes copy will quote it wrongly.** `tools/tray-harness.mjs` now reads
  the wall's sentences out of `trayCopy.ts` instead of retyping them, and the first version
  of that reader understood `'...'` but not template literals — so it rendered
  `[head unreadable]`. That is the right failure: **a harness that silently draws a blank
  headline is worse than one that refuses to draw.**
- **`* text=auto` plus an incomplete binary list will corrupt images.** `.gitattributes`
  named only `*.png`, so four `.jfif` photographs were tracked as TEXT and a CRLF
  normalisation pass ran through their bytes. They were restored and verified before the
  commit. The list is complete now; if a new binary type arrives, it goes in the same commit.
- **A generated artefact nobody re-reads will drift, and a confident comment is not a
  render.** `icons/*.png` are committed and `build.mjs` does not regenerate them, so
  nothing opened the file Chrome actually loads. The 16px icon shipped with no catchlights
  because the rasteriser gated them behind `size >= 32`, under a comment asserting that at
  that size a catchlight "eats the eye it is supposed to sit in". Rendered - which the
  comment's author had not done - it is a clean lit pixel, and the gated version is the one
  that looks dead. **That is the fourth time in this repo that a claim about how something
  renders was written without rendering it.** `src/shared/icons.test.ts` now decodes the
  shipped PNGs; `tools/png.mjs` exists so a test can read a pixel without this browser
  extension acquiring @types/node.
- **Writing a file from Python on Windows converts it to CRLF, and anything that slices on
  `'
'` then silently returns garbage.** `contentChrome.test.ts` and `tools/tray-harness.mjs`
  both locate the tray's stylesheet with `indexOf('
`;
')`. After a CRLF write that
  returned **-1**, so the test sliced nearly the whole file, its vacuous-pass guard
  (`rules().length > 15`) still passed because TypeScript parsed as CSS yields plenty of
  brace pairs, and two tests reported green on a stylesheet they were not reading. The repo
  pins `eol=lf` in `.gitattributes`; **pass `newline=''` when writing, and re-run the slice
  as the check.** A guard against a vacuous pass has to be something garbage cannot satisfy.
- **A backtick inside a CSS comment ends the `STYLE` template literal.** The tray's
  stylesheet is a JS template literal, so writing `` `padding: 9px` `` in a comment inside it
  is a parse error a hundred lines away. Twice in one day. Prose, not code voice, inside
  STYLE.
- **`width: 100%` does not force a flex item onto its own line; `flex-basis: 100%` does.**
  The intent row was given `width: 100%` to move it under the cover, and stayed beside it at
  223px of the 267 available, still clipping. The arithmetic said it should have fitted,
  which is why it was measured.
- **`flex: 1` forces EQUAL widths, not fair ones.** It sets a zero basis, so three pills
  reading "Read now", "Read next" and "Read someday" were each handed a third of the row and
  the longest clipped its own last letter. `flex: 1 1 auto` grows from the content basis.
- **A `var()` hides a value from any test that reads declarations as text.** The tray's
  "nothing see-through carries text" guard was walked straight through on the day
  `background: var(--fill)` was introduced, by the person who wrote the guard, because the
  alpha was one indirection away. Resolve tokens before asserting on a value.
- **A hand-maintained fixture drifts the moment the builder moves.** `tools/tray-harness.mjs`
  fell out of step with `bookRow` three times in one session, and each time the harness
  showed a layout bug that was not in the product, or hid one that was. When a card looks
  wrong there, check the fixture's nesting against the builder before believing the CSS.
- **A decision's justification can expire without the decision looking stale.**
  `coverSources` put the photograph ahead of the catalogue's art because OpenLibrary's
  relevance index returned the wrong edition — a real, measured problem, fixed months
  later by `rank` + `strayWords`. The sentence still read true; only its premise had gone.
  **When a rule surprises you, check whether the thing it defends against still happens.**
- **A comment can be right while the code beneath it is wrong.** The popup's caught spine
  was `#7cc0fd`, hardcoded, directly under a comment explaining that a light value on that
  ground measures 1.6:1 and cannot be used. Read the value, not the paragraph about it.
- **A guard against drift has to compare the two things that can drift.** `mark.test.ts`
  checked six surfaces against each other for *shape*, and checked `MARK.grounds` against
  *itself* for contrast. Neither read a colour out of a surface, so the definition and the
  landing disagreed for a day inside a green suite. When you write a "defined once" test,
  ask which axis it actually crosses.
- **A contrast ratio only answers about the pair you chose to compare, and a flanked
  element is read against its NEIGHBOURS, not its ground.** The mark's caught spine
  measures 1.81:1 on cream and 1.86:1 at night, and both render perfectly, because two
  near-black or two cream spines sit either side of it. This repo has now derived a wrong
  conclusion from that number twice, on 2026-08-15 and again on 2026-08-16, each time by
  reasoning from the ratio instead of rendering. `node tools/mark-sizes.mjs` exists for it.
  **When a measurement surprises you, render the thing before you write the paragraph.**
- **A guard at the top of a script owns everything below it.** Before adding anything to an
  existing IIFE, check what it returns early for. The theme switch spent two days inside a
  `prefers-reduced-motion` guard.
- **Headless Chrome will not hold a scroll position for a screenshot**, and
  `--virtual-time-budget` ends the page before a `load` handler fires when images are lazy.
  Report diagnostics **synchronously at the end of `<body>`**, into a `position: fixed`
  element at the TOP of the viewport. Three attempts were wasted learning this.
- **A dangling `@font-face` fails silently and looks like a decision.** The browser 404s,
  falls through the stack, and renders in `system-ui`. No console error a screenshot shows,
  no test that would have caught it before `src/shared/fonts.test.ts` existed.
- **A comment saying a sweep was done is not evidence the sweep was done.**
  `options.html` carried a note claiming every hover was gated. `summary:hover` was not.
  Grep for the thing, do not read the claim.
- **A child element restating its parent's radius will be clamped and read as pinched.**
  The options page's 11px spine given the card's 14px radius had both corners clamped to
  5.5px. Let the parent clip it with `overflow: hidden` instead: one radius, one edit.
- **A whole-document `replace(..., 1)` hits the first match in the FILE, not in the
  section.** Two checkboxes were ticked in the wrong task that way. Scope to the section.
- **Diacritics change a generated cover's dye.** `hashOf` runs over the raw string, so
  correcting `Stanisław Lem` moves Solaris from tobacco to forest.
- **Windows and Git Bash:** `npm run` and `npx` both fail here. Use
  `./node_modules/.bin/vitest run`, `node node_modules/typescript/bin/tsc --noEmit`,
  `node build.mjs`. Chrome is at
  `/c/Program Files (x86)/Google/Chrome/Application/chrome.exe`, and it refuses
  `--load-extension`. Chrome also clamps its window width to about 485px, so a true mobile
  viewport needs the iframe harness, not `--window-size`.
- **`popup.html` renders nothing outside an extension host.** It is `<main id="app">` and
  draws itself from `chrome.storage`. Use `node tools/popup-harness.mjs`.
- **A guard written for one of two allowlists is how the second one drifts.**
  `extensionTokens.test.ts` holds two: `LITERAL_BY_DESIGN` and `MOOD_INVARIANT`. The first
  is asserted against dead entries, under a comment saying *"if a name in the allowlist
  stops existing, the exemption is silently protecting nothing."* The second was not, and
  within a day of the mark changing it was exempting `--mark-caught`, a token deleted from
  all three surfaces. **A dead exemption is worse than a missing one**: it reads as a
  considered decision, so the next reader spends their scepticism elsewhere, and the day a
  token returns under that name it is pre-approved. Both are asserted now. When you write
  an allowlist, count how many the file already has.
- **A POINTER IS A CLAIM AND EXPIRES LIKE ONE.** Superseding a section is only half the
  edit; whatever points AT it has to move in the same commit. `docs/brand.md` banner'd the
  three-spine mark correctly and its own `## The mark` banner went on saying *"read The
  mark: three spines below"* for a day, sending anyone who trusted it straight to retired
  values. The same day, `.agents/product-marketing.md`'s changelog announced the new mark
  while its Visual Identity body still described three spines, two cords and per-ground
  values as current, and the body is the half a copy task actually reads.
- **A banner that ENUMERATES is making a claim about everything it leaves out.**
  `DESIGN.md` opened with "Two things in it are no longer true" and named two, so its later
  appendix paragraphs about the mark, the type and "one product again" all read as still
  true. Three were stale. If a record cannot be kept current, the banner has to say
  *category*, not *count*.
- **A comment can describe elements the file does not contain.** `popup.html`,
  `options.html` and `docs/index.html` each carried an SVG comment about three spines and a
  cord MASK directly above a `<defs>` defining a ball gradient. Measured: zero `<mask>`,
  zero `<rect>`, two `<ellipse>` in all three. `mark.test.ts` asserts the geometry across
  six surfaces and cannot see a sentence. **This is the mirror of the trap already in this
  list** ("a comment can be right while the code beneath it is wrong"), and the pair of them
  is the real rule: the comment and the code are two artefacts, and nothing checks that they
  agree.
- **A `?raw` SOURCE-TEXT GUARD CANNOT SEE CONTROL FLOW, AND IT WAS PROVED.** A reviewer
  mutated `background.ts` twice and re-ran the suite: wrapping the whole relink block in
  `if (false && msg.restoreOf)` left `shelfEdit.test.ts` green, and **swapping the arguments
  to `markRestored(saved.id, msg.restoreOf)` — which reverses every undo — left all 533
  tests green.** `expect(background).toContain('markRestored')` proves two identifiers exist
  in a file. This repo uses `?raw` correctly everywhere else (markup, CSS, `@font-face`,
  geometry) because those have no branches; `background.ts` was the first use against
  executable code. **The real fix is to extract a `handleSaveBook(msg, deps)` in the
  `(request, env) => response` shape `src/server/` already uses**, so the call can be spied
  on. Until then, know the guard's blind spot rather than trusting it.
- **A COMMENT THAT NAMES THE RIGHT LESSON CAN STILL SIT ON THE WRONG SIDE OF IT.**
  `options.html` gained a comment on 2026-08-17 saying the licence section is "guarded on
  its own four elements" and cannot vanish with `main()`'s early return — **citing the two
  days the theme switch spent inside a `prefers-reduced-motion` guard as the reason.** But
  `void wirePro();` was inside `main()`, below a guard on seven provider ids. Renaming any
  one of them would have taken the entire paid path down silently. The lesson was quoted
  accurately and applied to the wrong line. **Now at module scope, asserted at column 0.**
- **TWO ENDPOINTS, ONE THREAT MODEL, AND ONLY ONE OF THEM IMPLEMENTED IT.** `/api/vision`
  has always checked `Origin: chrome-extension://<id>` and documented, correctly, that the
  header is forgeable and is therefore one of three defences. **`/api/license` had no check
  at all**, which made it an open licence-key oracle standing on `POLAR_ACCESS_TOKEN`:
  anybody could POST a candidate key and read from the status whether it was real, on our
  token and our quota. And since a successful activation consumes one of that key's five
  slots, a leaked key plus five requests locks the person who paid out of their own licence.
  Found by asking the threat question about the OTHER endpoint. **When one handler has a
  guard, ask what the sibling handler has**, especially when the sibling is the one holding
  the credential.
- **A NUMBER THAT JUSTIFIES A DESIGN DECISION HAS TO HAVE A PROBE.** `policy.ts` says a
  catch costs "about $0.00011" and rests the whole trial threat model on it. That figure
  appears exactly once in the repo: in the comment that uses it. No source, never measured.
  It may be right. It is the same shape as every contrast ratio this file already records
  being wrong about.
- **A KILL SWITCH NAMED FOR ONE POPULATION MUST BE GATED ON THAT POPULATION.**
  `BUKI_TRIAL_CLOSED` was checked BEFORE `decideAccess` in `visionHandler.ts`, so flipping
  it refused every request and told a paying subscriber *"The free trial is closed just
  now"* — a lockout and a false statement to the one person who paid not to see it. **Eight
  lines below, the IP cap had it right**, gated on `access.kind === 'trial'` under a comment
  saying that stopping somebody who is paying is the worst place to save a hundredth of a
  cent. Two brakes, one intent, and only one of them read it. Both now sit inside a single
  `if (access.kind === 'trial')` so the next one has to walk past the sentence.
  **The switch was also undocumented**, which is how it survived: `OPENWORK.md` item 2 said
  five variables and `api/vision.ts` reads six.
- **A PLAN'S INSTRUCTIONS AGE EXACTLY LIKE ITS SNIPPETS, and one of them would have done
  damage.** Task 15 Step 3 says "strike §1.1 and §2.3" of this file. The plan was written
  2026-08-09; there is no §1.1 at all now, and §2.3 is *Three colours that only broke at
  night*, a record of a defect class that has recurred three times and has nothing to do
  with Task 0. This is the fifth time that plan has been wrong about its own details and the
  first where obeying it would have destroyed something. **Read the target before acting on
  a reference to it**, especially when the instruction is to delete.
- **A ONE-WAY FLAG BREAKS THE MOMENT SOMETHING GAINS AN UNDO.** `markWrong` was written when
  removal was permanent: deleting a wrong match is the recogniser's only free grading
  signal, so a deletion set `wrong: true` and nothing ever cleared it. Undo arrived later,
  when removal moved onto the tile, and reversed the deletion without reversing the flag.
  **The half that was written down was the smaller half.** `library.add` issues a NEW id on
  restore, so the event went on naming a book that was no longer on the shelf: remove it
  again, genuinely, and `markWrong` matched nothing and the log had permanently lost the
  ability to score that catch. **A rate that is one too low is visible; an event that can
  never be scored again is not.** When you add an undo, list every side effect the original
  action had, not just the one the user can see.
- **A rule that selects `button` does not style an `<a>` you drew as a button.** `#getPro`
  sat in the same `.actions` row as *Activate* wearing `.ghost`'s colours and none of its
  shape: measured in Chrome, `radius 0px, padding 0px, height 23.3` against
  `999px, 11px 20px, 35.5`. It looked like a link that had lost its underline, on the one
  control that leads to paying. **When a control is not a `<button>`, check every rule that
  gave the button its shape**, including `:active`.
- **A computed-style read in the same task as the attribute that changes it can be stale.**
  A probe that set `data-theme="light"` and immediately read `getComputedStyle` got the new
  `body` background and the OLD `--sunk`, and reported the day contrast as 16.34:1 when it
  is 1.08:1. A `light-dark()` custom property substituted into a descendant had not
  re-resolved. **The screenshot was right and the probe was wrong**, which is the ordering
  this repo keeps rediscovering: render it, then measure.
- **A harness that flips the mood after load photographs the TRANSITION.** Every control on
  the setup page carries `transition: background-color 140ms`, so narrowing the theme from
  the parent frame animates them, and one screenshot caught a dark pill on a light page and
  read as a contrast bug that was not there. Inject
  `*, *::before, *::after { transition: none !important }` **before** flipping.
- **The Chrome Web Store takes the name and the summary from `manifest.json`.**
  `docs/store/listing.md` offered a `Name` of `Buki: catch books from X` for a dashboard box
  that does not exist, contradicting the manifest's `Buki`. Copy written for a field nobody
  fills in is copy that never ships and never gets corrected.
- **A BACKSLASH IN A PATH IS AN ESCAPE SEQUENCE TO WHATEVER WRITES THE FILE.** The pointer to
  the newest handoff was written as `%TEMP%\buki-handoff-...` and the `\b` was consumed: what
  landed in this file was a raw **backspace byte, 0x08**. Markdown renders it as nothing, so
  every reading of the paragraph looked correct; `cat -A` showed `^H`, and `file` reported
  *"with overstriking"*. **It shipped in `5534ff9`, whose entire purpose was to point at the
  handoff** - the pointer was the payload and the payload was corrupt, so the one document
  meant to carry the session forward had no working address. Nothing could have caught it: no
  test reads this file, and Markdown has no parse gate the way `entryPoints.test.ts` is one
  for JavaScript. **Write paths into docs with FORWARD slashes** - Windows accepts them
  everywhere, and they carry no escape meaning. Probe:
  `git ls-files -z | xargs -0 grep -nP '[\x00-\x08\x0B\x0C\x0E-\x1F]'`, which found exactly
  one hit across every tracked text file.
- **THAT IS THE BACKTICK TRAP AGAIN, WEARING A DIFFERENT CHARACTER.** The backtick one fired
  FOUR times: inside a template literal, in prose, in files nothing imported. The family is
  bigger than either instance. **A character that means something to the tool writing the
  file will mean it, whatever you intended the content to say** - backtick to esbuild,
  backslash to the shell, `%` to cmd. The defence is not vigilance. It is choosing the form
  with no special character in it, or writing through something that does not interpret at
  all: the Write tool, or a quoted heredoc (`<<'EOF'`, never `<<EOF`).
- **THE TABLE THAT SAYS "PUT A FACT IN ONE PLACE" HELD TWO FACTS TWICE.** §0's ownership
  table carried `docs/store/launch.md` and `docs/store/assets.md` on two rows each - one pair
  bolded, one not, and the un-bolded pair was the staler wording. Both were added the day the
  section was extended, by appending rather than by reading the table first. **A doc that
  states a rule is not exempt from it**, and appending is the edit least likely to notice a
  duplicate. Probe:
  `sed -n '/^## 0\./,/^---/p' OPENWORK.md | grep -o '\`docs/[a-zA-Z/.-]*\`' | sort | uniq -d`
- **AN ERROR MESSAGE CAN NAME THE WRONG BINARY, AND THIS ONE DOES.** `npx` from Git Bash on
  this machine fails with a cmd.exe error - in the OS language, so Spanish here -
  `""node"" no se reconoce como un comando interno o externo`. It reads as *node is not
  installed*. **Node is installed and on the PATH:** `which node` gives
  `/c/Program Files/nodejs/node`, `node build.mjs` runs, and `./node_modules/.bin/vitest run`
  passes all 602. What breaks is the `npx.cmd` shim's own quoting of a node path containing a
  space, and it blames its payload rather than itself. **The same `npx` works from
  PowerShell** - both `npx vitest run` and `npx tsc --noEmit` were run there this session.
  So: Git Bash gets `node` and the `./node_modules/.bin/` shims; PowerShell gets `npx`.
  This trap has already been paid twice - once as the environment note in the handoff, once
  on 2026-08-19 when the error was read at face value and the diagnosis "node is not on the
  Bash PATH" was stated before it was probed. **`which` costs nothing; a misread error costs
  a wrong note in a doc the next session plans against.**

- **A COUNTER INTERPOLATED TWICE IS INCREMENTED TWICE.** `tools/tray-harness.mjs` built the
  mark with `id="h${++markSeq}"` and `fill="url(#h${++markSeq})"` in one template. A
  template evaluates each `${}` separately, so the gradient was declared `h1` and referenced
  `h2`: the ball had a fill pointing at nothing and vanished, leaving two eyes on the card.
  **The tell was in the output and legible**: `grep -o 'id="h[0-9]*"' | sort | uniq -c` gave
  odd numbers only. **What made it expensive was that the symptom had a plausible innocent
  cause already measured** - the mark's light ramp end is 1.64:1 on white, so "it reads as
  two dots" was exactly what a contrast problem WOULD look like, and a real number pointed
  at the wrong culprit. `markNode()` in `content.ts` reads the counter once into a variable
  and always did, so **the product was correct and the harness was the thing that lied.**
  Read the counter once, into a const, then interpolate the const.
- **A FIXTURE NAMED `NOW` THAT IS NEVER INJECTED IS THE AMBIENT CLOCK WEARING A COSTUME.**
  `visionRoute.test.ts` declared `const NOW = Date.UTC(2026, 7, 17, 12, 0, 0)` and a `live`
  session expiring an hour later, then called `visionRoute(settings, pro)` **without the
  third argument** - so it measured that session against `Date.now()`. `visionRoute` takes
  `now: number = Date.now()` and its two sibling tests both pass it. This one forgot, passed
  for seven days, and began failing on 2026-08-24 with no code change, on a suite that had
  been green the day before. **A test that fails with the passage of time fails during
  somebody else's work**, which is where the cost is: it arrived in the middle of an
  unrelated redesign and looked like collateral damage from it. Grep a clock fixture for its
  own call sites before trusting that it is injected.
- **A MODULE THAT TOUCHES `document` AT IMPORT IS UNSAFE FOR THE CONTENT SCRIPT, and
  `theme.ts` was the file that already knew.** Wiring the tray to the extension's mood
  needed `resolveTheme`, and the obvious import was `./theme` - which ends
  `if (typeof document !== 'undefined') start(document);` and sets `data-theme` on
  `document.documentElement`. **In a content script that is x.com's root element**, so Buki
  would have flipped the theme of any site using that convention merely by being installed,
  and read the host's `localStorage` under our key. `tsc` and the bundler were both happy;
  the only evidence was `setAttribute("data-theme")` appearing in `dist/content.js`. The
  pure half is now `themeChoice.ts` and `contentChrome.test.ts` fails the build if the entry
  point comes back. **`theme.ts`'s own header calls `background.ts` the cautionary tale for
  module-scope side effects** - the file naming the lesson was the file that had not applied
  it, which is the second time that exact shape has appeared in this section.
- **A GUARD'S MODEL OF THE FILE CAN GO STALE WITHOUT THE GUARD FAILING.**
  `contentChrome.test.ts` resolved tray tokens by matching `\.buki-tray\s*\{`. Splitting the
  tray into two moods made the dark selector `.buki-tray, .buki-tray[data-theme="dark"]` - a
  comma before the brace - so the matcher found neither block. It did not error; it resolved
  every `var()` to itself and would have passed anything. **Its own self-test is what caught
  it**, because that test asserts the resolver still detects a see-through value rather than
  merely asserting no leaks were found. A guard that only proves absence cannot tell you it
  has stopped looking.

- **T11. COMMENTARY ABOUT THE COPY SATISFIES A GUARD ON THE COPY.** `pricing.test.ts`
  asked whether `docs/store/listing.md` mentions a price ANYWHERE, and a mutation deleting
  the price sentence from the shipped copy left the suite green: the file states the price
  twice, and line 23's editorial note *quoting* that copy — inside a blockquote explaining
  why the till had to exist — satisfied the guard. **This is the `?raw` failure one level
  up**: not the comment explaining the code standing in for the code, but the commentary
  ABOUT the copy standing in for the copy. A doc that discusses its own store answers will
  always contain the string you were about to assert on. **Assert on the SECTION that ships**,
  and make renaming that heading fail loudly.
- **T12. AN ABSENCE PROOF THAT COUNTS ITS OWN DOCBLOCKS.** *"There is no second way to remove
  a permission"* scanned raw source for `permissions.remove` and found FIVE hits, four of
  them JSDoc paragraphs explaining why there is exactly one call. Same failure as T11, in the
  other direction: prose about a call standing in for the call. `optionsPage.test.ts` has
  stripped HTML comments from `DOM` since it was written, for exactly this reason, and nobody
  carried the move across to TypeScript. **Strip comments before scanning source**, and prove
  the discrimination in BOTH directions with one mutation: comment out the real call, leave
  the mentions, and watch the guard go red.
- **T13. A MEASURING INSTRUMENT EDITED THROUGH THE SHELL GAVE THE RIGHT ANSWER FOR THE WRONG
  REASON.** `zzz-mutate.mjs` took its target as one argv element, so two space-separated
  paths became one filter. The patch to split them was applied with a shell heredoc, the
  backslash in `/\s+/` was eaten — **the trap already recorded in §5 and in memory, hit for
  the sixth session running** — and `split(/s+/)` produced fragments like `"rc/"` and
  `"hared/manife"`, which vitest matched as substring filters against every path. **The
  harness reported it was testing two files while running the whole 889-test suite.** It said
  8/8 caught, which was true, and true for a reason it did not state. **The remedy is already
  known: use the Write or Edit tool, not the shell.** What is new is where it matters most —
  an instrument's output is the thing you would otherwise use to notice, so a shell edit to a
  harness is the worst available place to take that risk.

- **T14. `tsc` PROVES A FIELD IS CARRIED, NEVER THAT IT IS CARRIED CORRECTLY.** Adding
  `pictures` to `Card` turned every state transition red until each one named it, which felt
  like proof and was not: two mutations survived afterwards — defaulting the count to 1 when
  there was no picture, and resetting it to 1 on a state change. The compiler enumerates the
  fields a literal must have and has nothing to say about the values. **A new field on a
  shared type needs a test per BRANCH, not a green typecheck.**
- **T15. AN EQUIVALENT MUTANT IS A SIGNAL TO SIMPLIFY, NOT A NUMBER TO EXPLAIN AWAY.** The
  ADV-3 guard was written `!renewing && !claim.activationId`. `renewing` is
  `Boolean(activationId)` and the renewing branch ends `?? activationId`, so the excluded
  case cannot occur and removing `!renewing` changed no test. The temptation is to write a
  test that reaches it — there is none — or to count it as caught. **The right move is to
  delete the condition**, because one that can never be false is one every future reader
  reasons about for nothing. Then say in the docblock which existing test still guards the
  invariant, or the simplification looks like a weakening.
- **T16. A COMMIT MESSAGE CAN DESCRIBE WORK THAT IS NOT IN ITS OWN DIFF, AND NOTHING
  COMPLAINS.** A heredoc wrote to `/tmp`, node read `E:\tmp`, `ENOENT`. `git add` on the
  unchanged file said nothing, `git status --porcelain` came back clean, and the commit
  landed asserting a section had been added to a file it never touched. **In a repo whose
  commit messages carry their own reasoning, that is the same class of lie as a stale doc.**
  `git show --stat` is the probe, and the session scratchpad directory is the fix — Git Bash
  and node resolve `/tmp` differently on this box.

  ⭐ **HIT AGAIN 2026-08-27, SECOND LANE, BY A DIFFERENT MECHANISM — AND THAT IS THE POINT.**
  `02af222`'s message says *"Filed as section 5 T20. T19 corrected in the same commit."*
  **Both edits were in `bd2fa38`, the commit before it.** No heredoc, no path confusion: the
  T19/T20 text was written to `OPENWORK.md` before the passage commit staged `OPENWORK.md`,
  so it was swept into that commit, and the sweep commit that followed carried only the tool.
  **Nothing complained, because nothing can.** `git add` of a file already staged-and-committed
  is a no-op that reports success.
  **The rule is therefore about ORDER, not about heredocs: stage and commit each task's files
  BEFORE editing files for the next one, and run `git show --stat <sha>` against the message
  rather than trusting the sequence you remember.** Corrected by a follow-up commit rather than
  an amend, exactly as `a4c3b61` → `a72a721` was, because a force-push would delete the record
  of the mistake along with the mistake.

- **T17. A CEILING DEFINED NEXT TO ONE OF ITS TWO CALLERS IS NOT A CEILING.** `GROUND_AT_ONCE`
  lived in `recognizer.ts`, which is one of the two places that fans out to openlibrary.org.
  The other, `groundText`, kept a bare `Promise.all` over up to `MAX_QUERIES = 24` — **more
  than the nineteen connections that earned the HTTP 429 and took the catalogue down for two
  minutes on the morning of the same day.** The fix landed, was tested, was documented, and
  covered half the surface. **Put a limit where the mechanism is** (`mapPool.ts`), not beside
  whichever caller you were looking at. And when a docblock calls a burst *"ACCEPTED rather
  than unnoticed"*, that word is doing the work of a measurement nobody took.
- **T18. A CORRECT CACHE IS INVISIBLE, SO NO BEHAVIOURAL TEST CAN PROVE ONE EXISTS.** Deleting
  `woven.set(key, made)` from `weaveOf`'s memo left every test green — same cloth, same
  copies, same separation between books — because a cache that never populates changes
  nothing except cost. The mutation survived a block written specifically to guard the memo.
  **Cost is the only observable, so measure it RELATIVELY and in the same run**: N distinct
  inputs against N repeats of one, so machine speed and CI load cancel. Worth writing only
  when the real gap is an order of magnitude (7.5x here) and the threshold is far inside it
  (4x). Run it three times before believing it.
- **T19. A LITERAL CONTROL BYTE REACHED A SOURCE FILE, AND ONLY A MUTATION ABORT FOUND IT.**
  `weaveOf`'s memo key was written with NUL separators instead of the escape — invisible in
  the editor, invisible in `git diff`, and perfectly functional. Nothing was red. It surfaced
  because a mutation plan could not find its own anchor text and the harness ABORTED rather
  than reporting SURVIVED. Same family as the `0x08` that shipped into a doc. **The behaviour
  was right and better than what was intended** (a space separator collides: `{title:'A B',
  author:'C'}` and `{title:'A', author:'B C'}` give one key), so the separator stayed and the
  SPELLING changed. **`node tools/control-bytes.mjs`** sweeps the tree for NUL and 0x08; run it
  after any session that wrote source through a shell. *(This line said `zzz-fix-nul.mjs` until
  08-27 — a path that is gitignored and no longer exists. See T20, which is the same file.)*

- **T20. THE SWEEP IN T19 COULD NOT RUN, AND TWO DOCS TOLD THE NEXT READER TO RUN IT.**
  `tools/control-bytes.mjs` was a one-shot REPAIR for T19's specific NUL, with the sweep bolted
  on after a `process.exit(1)` that fired whenever the repair found nothing to repair. **So from
  the moment T19 was fixed, every invocation exited 1 without reading a single file** — while
  `OPENWORK.md` and the 08-27 handoff both said *"sweep with it; only binaries should match."*

  **Invisible twice over.** The natural way to run a noisy script is
  `node tools/control-bytes.mjs | tail`, and **a pipe reports the exit status of `tail`.** That
  is T-for-T the `tsc --noEmit | head` trap that printed `TSC=0` under ten real errors, hit
  again on a different tool, by a reader who knew about the first one. Both checks in the
  session that found it reported a clean exit; the third, unpiped, reported 1.

  **Two rules out of it.** *A guard whose job is done must become a guard, not stay a fix* — the
  repair half is deleted and the sweep survives alone. And *a guard needs a way to be watched
  failing*: `node tools/control-bytes.mjs --verify` plants a NUL, confirms the sweep catches it,
  and removes it. **Run tools WITHOUT a pipe, or read `${PIPESTATUS[0]}`.**

- **T21. MARKDOWN BOLD RUNNING ONTO A SLASH ENDS THE DOCBLOCK.** Writing a CIDR prefix in a
  docblock as bold-immediately-then-slash puts two asterisks against a slash, which **is the
  block-comment terminator**. `ipCap.ts` stopped parsing, and the symptom was not an error on
  that line — it was `esbuild` failing the TRANSFORM, so vitest reported **"no tests"** for the
  whole file. That is the same reading trap as §5's compile-failure rule: *a file that does not
  load looks like a file with nothing wrong in it.*

  ⭐ **AND THE FIRST ATTEMPT TO WARN ABOUT IT HERE RE-SPELLED THE TERMINATOR**, inside
  backticks, because **a block comment does not respect backticks.** Two failures, the second
  inside the fix for the first — exactly as the backtick trap's sixth occurrence landed inside
  the `node -e` that was mutation-testing the backtick warning. **The remedy is not to be
  careful: it is to never write the two characters at all.** Say *"a /64"* with the bold opening
  on a letter, and spell the terminator in words when you must refer to it.

- **T22. A MUTATION THAT READS A CLOCK GIVES A VERDICT THAT DEPENDS ON MACHINE SPEED.** A
  mutation for *"the unidentifiable caller gets a fresh allowance each time"* replaced the
  shared bucket with `String(Math.round(performance.now()))`. **It reported CAUGHT when the
  harness's output was REDIRECTED to a file and SURVIVED when it was PIPED**, from the same
  plan, the same code, seconds apart. `performance.now()` rounds to whole milliseconds, so
  when all forty-two calls land inside one millisecond they share a key and the mutation
  behaves exactly like the original. Piping changed the timing enough to flip it.

  **The instrument was honest and the MUTATION was the lie**, which is a failure mode nothing
  else in this section covers: everything else here is a harness or a doc being wrong. **A
  mutation is a controlled experiment, so its replacement must be DETERMINISTIC** — no
  `Date.now`, no `performance.now`, no `Math.random`. Where the mutation needs a value that
  varies per call, use a counter: `String((globalThis.__mutN = (globalThis.__mutN ?? 0) + 1))`.

  Found only because the same plan was run twice by chance and the two totals disagreed. **If
  two runs of one plan disagree, the plan is at fault before the code is.** Re-run any new
  plan twice before believing a SURVIVED.

---

## 6. Accepted risks, named so nobody rediscovers them

These came out of the 2026-08-18 review. **None is a bug and none is scheduled.** They are
written down because each one costs a reviewer half an hour to find, and because a risk
nobody has named reads as an oversight the next time somebody trips over it.

- **A refunded or cancelled subscriber keeps working for up to about eight days.** The
  session token is stateless with no revocation list, honoured for `TOKEN_TTL_MS` plus
  `GRACE_MS`. That is the deliberate trade `token.ts` documents: it is what makes a Polar
  outage our problem rather than the customer's, and it is why this project has no
  database. The cost is bounded and small at $4/month. **Do not "fix" it with a revocation
  table** without re-opening that whole decision.
- **There is no partial brake for Pro traffic.** `BUKI_TRIAL_CLOSED` correctly stops only
  the trial (that scoping was itself a fix, 2026-08-17). So if Pro-classified traffic ever
  becomes the cost problem — a replayed token, the grace window above — the only lever is
  removing `GEMINI_API_KEY`, which 500s the product for everybody including payers. An
  all-or-nothing kill, not a graceful one. A provider-side spend cap (item 26) is the real
  answer, because it bounds the money without needing our code to notice anything.
- **A failed `markRestored` is permanent and never retried.** Deliberate, and the same
  pattern `rememberCover` uses: the shelf write already succeeded and a failed relink must
  not fail the undo the user can see. The consequence if it does fail: that attempt stays
  `wrong: true` for ever, understating the kept rate by one, AND stays linked to a deleted
  id, so a later genuine removal of that book scores nothing. It recreates the pre-fix bug,
  gated on a storage write failing.
- **`restoreOf` is trusted.** It is an optional string on the `saveBook` message and the
  only thing that flips the worker into the relink path. Today only `restoreArgs` sets it
  and it always carries `saved.id`. Nothing in the type system stops a future caller
  passing an arbitrary or stale id. Low stakes — `markRestored` is a no-op when no event
  matches — and consistent with how every other message contract here is trusted.
- **The trial counter is forgeable and that is the design.** `trial.ts` says so: defending
  it needs identity, which needs accounts, which needs a database, to protect a fraction of
  a cent. **The stronger argument is the escape hatch**: anyone willing to edit extension
  storage could paste their own key instead and get unlimited cover reading free. Cheating
  buys them nothing they cannot have by asking.
