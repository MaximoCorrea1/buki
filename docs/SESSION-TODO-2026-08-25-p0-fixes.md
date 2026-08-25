# Session TODO — 2026-08-25, the six P0s

**Pair:** `docs/SESSION-CONTEXT-2026-08-25-p0-fixes.md`
**The findings themselves:** `docs/REVIEW-2026-08-24-prelaunch.md` — that is the record; this
is the ledger. `OPENWORK.md` THE LANE is the ordered authority for what is open.

Markers: `[ ]` open · `[x]` done+verified · `[~]` in progress · `[?]` founder decision ·
`[!]` blocked.

> **HONEST NOTE, fourth consecutive session.** This pair was written mid-session, after item
> 43 landed, rather than before the first substantive tool call as `maintaining-project-docs`
> requires. Content is exact and the checkpoint log is in commit order, which is real rather
> than reconstructed. See the CONTEXT pair's opening note for why writing the rule down
> again is not the lever.

---

## Standing, carried forward BY POINTER

**`OPENWORK.md` is where work survives.** Live status of everything this session touched:

| Item | State |
| --- | --- |
| **38** `/api/vision` forwards the body verbatim | `[x]` **DONE** `99a2e4e`. Rebuild, not sanitise. Six mutations, six caught |
| **41** A hostile page can drive the tray | `[x]` **DONE** `16e257f`. Three seams extracted. Seven mutations, seven caught |
| **39** Polar 5xx → 403 → session deleted | `[x]` **DONE** `05bee90`. Both halves; rule shared in `src/shared/retry.ts`. Six mutations, six caught in BOTH directions |
| **40** No rate limit on the licensed path | `[x]` **DONE** `11f2d6f`. Per-licence cap + `BUKI_REVOKED_KEY_IDS`. Six mutations, six caught |
| **42** The card's × is a free-read button | `[x]` **DONE** `2b023a8`. Abort reaches Gemini; attempts bounded. Nine mutations, **one survived and found a real hole** |
| **43** Options-page slot reuse deletable, green | `[x]` **DONE** `f344127`. Extraction of the arithmetic AND the order. Five mutations, five caught |
| **44** The wire contract closes at publication | `[x]` **DONE, same day it was filed.** All four findings plus the fifth the review did not file. Eight mutations, eight caught |
| **26** Gemini spend cap | `[!]` **Maximo. Now the FLOOR, not a second ceiling.** 38 and 40 bound one caller; only the provider cap bounds the aggregate. `launch.md` step 4.5 is half clear and this is the other half |
| **1** Polar benefit activation settings | `[!]` Maximo. Unchanged |
| **2** The six Vercel variables | `[!]` Maximo. `BUKI_EXTENSION_ID` still waits on 37 by design. **Re-probe with `vercel env ls` — that is a report, not a measurement** |
| **37** Extension id / manifest `key` | `[!]` Maximo then agent. **Item 38's half of its gate is now satisfied**; item 26 is not |
| **3** The by-hand pass, 13 checks | `[!]` Maximo only. **Two new things belong in it** — see below |
| **9** Five screenshots at 1280x800 | `[!]` Maximo. Unchanged |
| **35** Affiliate tags | `[ ]` Maximo. One paste, no blockers |
| **36** Five landing CTAs → store URL | `[ ]` agent, launch day. Unchanged |

---

## Done and verified, 2026-08-25

Each item is one commit. Every one was mutation-tested before it was committed, and the
mutation results are in the commit message.

- [x] **38 · `/api/vision` REBUILDS the request body** (`src/server/visionBody.ts`, 24 tests).
      Model pinned, `max_tokens` clamped to 2,048, bytes/images/prompt capped, three-key
      allowlist asserted by its COMPLEMENT. Closed four levers the review did not name (`n`,
      `service_tier`, `extra_body`, `max_completion_tokens`). Client half: `config: route`,
      deleting the second place the model decision lived.
- [x] **41 · The tray cannot be driven by the page it renders in** (`realClick.ts`,
      `feedHost.ts`, `twitterImage.isTweetMedia`, `contentSafety.test.ts`). Every click goes
      through one `isTrusted` seam; the feed scanner arms only on X; the image filter asks
      about the HOST on both sides of the trust boundary. **Closes PERF-9 by the same root.**
- [x] **39 · A bad minute at Polar stays a bad minute** (`src/shared/retry.ts`). One rule,
      three call sites — `licenseHandler`, `license.ts`, `llmVision.ts` — so the two clients
      that had drifted cannot drift again.
- [x] **40 · The licensed path has a ceiling and an off switch** (`src/server/proCap.ts`).
      500/licence/day keyed on the `licenseKeyId` that was already computed and discarded,
      plus `BUKI_REVOKED_KEY_IDS`, the first TARGETED incident lever this product has.
      **Half of AC-4 closed with it**, because a cap keyed on `undefined` is a cap on nobody.
- [x] **42 · The card's × costs something** (`request.signal` upstream + `TRIAL_ATTEMPTS`).
      Both trial ceilings fold into one `trialLeft`, so the wall and the options page cannot
      tell one person two stories.
- [x] **43 · The activation reuse is extracted, order and all** (`activateKey.ts`, 18 tests).
      The review's own mutation now fails six tests.
- [x] **44 · The wire contract, filed and closed the same day** (`visionFailure.ts`,
      `TOKEN_VERSION`, one envelope per endpoint, a `code` on every licence refusal). A 401 no
      longer opens the options page for somebody with no settings; the trial kill switch can
      be pulled without telling every trial user their setup is broken; and a mismatched
      `BUKI_EXTENSION_ID` no longer erases a paying session on every renewal for eight days
      before anyone notices.

### Documents corrected in the same commits as the code

- [x] **`polar-setup.md`**: "No model is pinned anywhere" — **it was true, and that was the
      finding.** Old sentence kept above the new one. `BUKI_REVOKED_KEY_IDS` documented, with
      the note that unset and empty both revoke nothing.
- [x] **`permissions.md`**: the `scripting` answer said the injection "injects the same result
      card", which was incomplete rather than wrong. It is now accurate **because the code was
      changed to match it**, and a note says not to soften the wording.
- [x] **`launch.md`**: step 4.5 half clear; the incident-lever table gains its first targeted
      row; "there is no partial brake for Pro traffic" corrected rather than deleted, because
      the reasoning underneath it is what keeps the new ceiling safe.
- [x] **`OPENWORK.md`**: header re-derived from fresh probes; six items closed with their
      reasoning; item 44 filed; **two new §5 traps** — mutate the guard you just wrote, and a
      mutation that does not compile reports a SMALLER green total that reads as a pass.

---

## Open, and who owns it

- [!] **26 · The spend cap.** Maximo, a dashboard, and it gates `launch.md` step 5.
- [ ] **Everything else in the review.** AC-3, AC-4, AC-7 and AC-8 closed with item 44; the
      REST of the P1s and the whole P2/P3 catalogue are untouched. The review remains the
      record for all of them. **Nothing security-shaped is open.**
- [ ] **Push.** `main` is ahead of `origin/main` by this session’s commits. Nothing has been
      pushed. Run `git log --oneline origin/main..HEAD` rather than trusting a count here.

### Two things that now belong in item 3's by-hand pass

Both are new behaviour that no test in this repo can reach, and both fail SILENTLY:

- [ ] **Catch a book on X with the extension's own key empty.** Proves the rebuilt body is
      one Gemini actually accepts. Every assertion about it runs against a fake provider; the
      shape has never met the real one.
- [ ] **Right-click an image on a non-X page, then scroll that page.** Proves the feed scanner
      being gated did not take the tray with it. The card is message-driven and should be
      unaffected — that is the claim, and it is the claim worth checking by hand.

---

## Checkpoint log

In commit order, which is the real order.

| # | What | Evidence |
| --- | --- | --- |
| 0 | Read the repo: review, OPENWORK, both 08-24 ledgers, launch/pricing/permissions, competitors, the server and the client money paths | — |
| 1 | Baseline probed before touching anything | 620/58, tsc 0, build 0, tree clean at `e7e1ca9` |
| 2 | Gemini's OpenAI-compat contract checked at the source, not from memory | `max_tokens` absent from the docs' tables → the 2,048 decision |
| 3 | **Item 38** | `99a2e4e` · 653/59 |
| 4 | **Item 41** | `16e257f` · 687/62 |
| 5 | **Item 39** | `05bee90` · 700/63 |
| 6 | **Item 40** + half of AC-4 + item 44 filed | `11f2d6f` · 722/64 |
| 7 | **Item 42**, and the first surviving mutation | `2b023a8` · 742/64 |
| 8 | **Item 43**, and the second surviving mutation | `f344127` · 760/65 |
| 9 | This pair written | — |
| 10 | **The review's §3 mutation table closed** — theme, storage, both visionHandler mutations, and the launch-day find-and-replace | `0733ef4` · 772/65. **All six now fail; five used to pass** |
| 11 | **Item 44**, the wire contract, filed and closed the same day | 808/66. AC-3, AC-4, AC-7, AC-8 and the extension-id blind spot. **Eight mutations, eight caught** |

---

## For the next session, in order

1. **Whichever P1s matter to launch.** The review's §4 is the list; PERF-1, PERF-2 and
   PERF-3 are all MEASURED and all on paths a first user will feel. **Nothing
   security-shaped is open any more** — the six P0s and item 44 all closed on 08-25.
2. **Item 36 on launch day, and nothing before it.** Its guard now asserts DESTINATIONS
   rather than link text, and covers the two Polar checkout URLs as well as the three
   GitHub links — a find-and-replace that caught those sends every purchase to a 404.
3. **Do not start any of it before running the three probes.** Every number in this file and
   in `OPENWORK.md`'s header was true when written and is a claim by the time you read it.
