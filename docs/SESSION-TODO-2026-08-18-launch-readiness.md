# Session TODO — 2026-08-18 (later), launch readiness

**Pair:** `docs/SESSION-CONTEXT-2026-08-18-launch-readiness.md`.
**Not the same session as** `...-2026-08-18-pro-hardening`, which is earlier. See
`OPENWORK.md` §0.

Markers: `[ ]` open · `[x]` done+verified · `[~]` in progress · `[?]` founder decision ·
`[!]` blocked.

> Written at the end of the session rather than appended live — see the note at the top of
> the CONTEXT pair. Content is exact; ordering in the checkpoint log is approximate.

---

## Standing, carried forward BY POINTER

**`OPENWORK.md` is where work survives.** THE LANE is the ordered authority. Live status of
everything this session touched:

| Item | State |
| --- | --- |
| **1** Polar products + benefit activation settings | `[!]` Maximo. Products exist; **verify `Activation limits: enabled`, limit 5, deactivation ON, Usage limit EMPTY, on BOTH products.** Prove with the curl in `launch.md` step 1 |
| **2** The six Vercel variables | `[!]` Maximo. **`vercel env ls` says ZERO are set.** Project is **`shelfy`**, not `buki` |
| **3** The by-hand browser pass, 13 checks | `[!]` **Maximo only.** Now blocked on item 37 as well, or it tests an id nobody will have |
| **9** Five screenshots at 1280x800 | `[!]` Maximo. **Framing, headlines and staging are DONE** — `tools/store-shots.mjs`, `docs/store/assets.md` |
| **26** Gemini spend cap + alert | `[!]` Maximo, Google Cloud. **The only control bounding real money.** Also: check the real per-catch cost; `policy.ts`'s "$0.00011" has no probe |
| **35** Affiliate tags empty | `[ ]` Maximo. One paste. **No blockers, can be done today** |
| **36** Five landing CTAs → store URL | `[ ]` agent, **launch day only**. Three GitHub links must NOT move |
| **37** Extension id changes on publish | `[!]` Maximo then agent. **Draft upload → public key → manifest `key`.** Reorders the launch sequence |
| ~~17, 18, 25, 28, 29, 30, 31, 32, 33, 34~~ | `[x]` all closed 2026-08-18, see below |

---

## Done and verified, 2026-08-18

### The three launch blockers

- [x] **P0: `readPro` dropped the activation id, so item 27's fix never ran** (`3012b30`).
      Written correctly in four places; the storage READER threw it away. Every renewal went
      back to ACTIVATE, so a subscriber still burned a slot a day. **Nothing was red and
      nothing could have been** — optional field, fixture without it, every test passing the
      id in as an argument. New fixture typed `Required<ProState>` so the compiler enumerates
      the interface. **Watched both new tests fail first.**
- [x] **P0: the manifest never granted the proxy host** (`b4118cf`). `visionRoute` and both
      licence call sites post to `${BUKI_HOST}`; `manifest.json` declared neither, no CORS
      headers anywhere, `/api/` excluded from `vercel.json`'s headers. **The paid tier and
      the ten free catches would have failed on the wire.** Verified against Chrome's own
      docs, not recalled. Guard derives the pattern from `BUKI_HOST`.
- [x] **P0 (filed, not fixable by an agent): the extension id changes when you publish**
      (item 37, `b3d132f`). Chrome derives the id from a hash of the public key; unpacked and
      published differ. `policy.ts` compares `Origin` against exactly that string. **403 for
      every real user, on both endpoints.** Fix is a sequencing change: draft upload → public
      key → manifest `key`.

### The agent lane, closed

- [x] **28** `/api/license` rate limit (`c5e3f64`). **TWO ceilings**, 3 activate / 40 validate
      per key per day, because one number cannot bound both. Lands BEFORE the outbound fetch
      and AFTER the key is trimmed; both tested, ordering guard earned with an A/B.
      `src/server/keyCap.ts`, bounded map, FNV-1a digest so no bearer credential sits in
      memory for the isolate's life.
- [x] **29** `proState` single-flight (`b1676e9`). Not a queue — sharing one promise closes
      both halves (double-spend AND the loser holding a stale state). Keyed on the licence
      key. Latch clears on settle, and only if still ours. Module scope in `background.ts`.
- [x] **30** `handleSaveBook` extracted (`99d6cae`). **Mutation-tested against the exact two
      mutations that previously passed 533 tests**: reversing the arguments → 2 FAIL, dead
      code → 3 FAIL. The old `toContain('markRestored')` was REPLACED, not kept beside.
- [x] **31** settled by 28 landing — the oracle is bounded, the differentiated error text
      stays because it tells a customer what to do.
- [x] **32** `ipCap` extracted from `api/vision.ts` (`8e9816f`). 7 tests, four on the
      `x-forwarded-for` chain rule. Shell back to 39 lines. **No eviction rule, deliberately**
      — IPs are bounded by real callers; licence keys are not.
- [x] **33** `entryPoints.test.ts` (`30a4685`). **583 tests had passed on a `content.ts` that
      does not parse.** Now esbuild-transforms the four unimportable entry points, and
      `tools/*.mjs` too after the backtick trap fired a fourth time. Earned against the REAL
      failure.
- [x] **34** the funnel has a till (`1e29a7a`). Both Polar checkout links in
      `src/shared/pricing.ts`, on the Pro card, inside `#pricing` where every extension CTA
      lands. Four guards, incl. "two DIFFERENT links" and "inside the SECTION".
- [x] **17** the privacy documents (`c0a3e00`). `privacy.html`, `README.md` and both Web
      Store answers now name BOTH paths and state what the server keeps. **The landing was
      already correct** — the item was wrong about it.
- [x] **18** Task 15 closed for every part an agent can do (`ee0e52b`). Step 2 stays Maximo's.
      Step 3's DO-NOT-EXECUTE strikes were NOT executed.

### Founder decisions taken

- [x] **25** the ghost fill. **Decided by looking, not by the ratio:** `--sunk` reads as bold
      text with a halo by day. Moved to `--board`; hover to a new `--board-hi`
      (`1a65357`). **A regression was caught on the way** — the hover was already `--board`,
      so the change would have deleted the feedback on four controls, silently.
- [x] **The "Read" collision** → **Finished** (`1a65357`). One word in `PILE_LABEL`; stored
      `Intent` unchanged, so no migration and the export is untouched. Three documents that
      named the piles were corrected in the same commit.
- [x] **The X button** wears the catcher at 18px, X's own icon box (`2b58df2`). Rendered
      beside approximations of X's own glyphs before shipping. **The open-book variant was
      not built** — Maximo's own brand doc rules that shape out by name.

### Corrections to the record

- [x] **The `authorName()` N+1 does not exist** (`8fd948c`). Traced the call graph; the
      multi-book path pays no follow-up. **The obvious fix would have restored a measured
      20s outage.** No code change, a test pins it, three documents corrected.
- [x] **Six live surfaces still called the button a book** (`1e24093`), including the popup's
      EMPTY STATE. Two of the six were copy written hours earlier the same session. Guard
      added to `mark.test.ts`, comment-aware, A/B'd both ways.
- [x] **`polar-setup.md` said "Project `buki`"** — no such project. It is `shelfy`.
- [x] **Item 32 was struck in THE LANE and open in its body; item 36 had a lane row and no
      body.** Both fixed at session end by reconciling the halves.

### Written this session

- [x] **`docs/store/launch.md`** — the ordered sequence, 14 steps, each with the check that
      proves it. Reordered late for item 37.
- [x] **`docs/store/assets.md`** — staging per shot, what RUINS each, the 45-second silent
      captioned video script.
- [x] **`tools/store-shots.mjs`** — the 1280x800 frames. **The store wants 1280x800 and the
      popup is 560px**; every shot is composed, not cropped.
- [x] **`tools/x-button-harness.mjs`** — the button in X's action bar on X's three grounds.
- [x] `docs/store/listing.md` refreshed: four expired facts, and a third submission gate.

---

## Open, carried forward

- [ ] **`policy.ts`'s "$0.00011" per catch has no probe.** Appears once, in the comment that
      uses it. Never measured. Check while setting the spend cap (item 26).
- [ ] **No email capture anywhere.** Every landing visitor not ready to install is lost. The
      ORB gap named in `launch.md`; one field, and it is the difference between a launch that
      ends on launch day and one that compounds.
- [ ] **Product Hunt is deliberately NOT day one.** It rewards preparation and a warm
      audience; revisit once there are real users and a real shelf to screenshot.
- [ ] **Vercel Observability Plus** is `$1.20/1M events`, on by default for teams upgraded
      after 2026-04-03, and applies to EVERY project on the team. **Exclude the noisy
      siblings rather than disabling it** — off drops Pro retention to one day, and the
      client is deliberately uninstrumented.
- [?] **Should the Pro card's primary button become "Buy Pro" rather than "Start free"?**
      Not changed: the install-first flow is a documented deliberate decision. The buy line
      was added beneath it instead. Revisit if the wall→purchase path underperforms.

---

## Checkpoint log

| When | State |
| --- | --- |
| Session start | 550 tests / 53 files, `main` at `d3e5923` |
| After the readPro P0 | 552 / 53, branched to `buki-hardening` |
| After items 29, 30, 28 | 581 / 55 |
| After the manifest blocker + item 17 | 582 / 55 |
| After the X button + founder decisions | 583 / 55 |
| After items 32, 33 | 592 / 57 |
| Merge to `main`, pushed | 15 commits, re-run ON the merge before pushing |
| After the launch docs + store assets | 597 / 57 |
| After item 34, the till | **602 / 57**, tsc 0, build clean |
| Session end | **602 / 57**, `main` = `origin/main`, tree clean, 23 commits, plan 68/17 |

---

## For the next session, in one breath

**Everything left on THE LANE is Maximo's**, except item 36 which is one agent edit on launch
day. The order is `docs/store/launch.md`. The critical path is now:

**developer account → draft upload → manifest `key` (37) → the six variables (2) → deploy and
probe → by-hand pass (3) → screenshots (9) → publish.**

Items 26 and 35 are parallel and unblocked. **Do not set `BUKI_EXTENSION_ID` before the draft
upload** — that is item 37 and it is the third blocker of the same shape found today.
