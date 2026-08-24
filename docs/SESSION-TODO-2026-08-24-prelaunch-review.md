# Session TODO — 2026-08-24, the pre-launch review

**Pair:** `docs/SESSION-CONTEXT-2026-08-24-prelaunch-review.md`
**The findings themselves:** `docs/REVIEW-2026-08-24-prelaunch.md` — that is the record; this
is the ledger.

Markers: `[ ]` open · `[x]` done+verified · `[~]` in progress · `[?]` founder decision ·
`[!]` blocked.

> **HONEST NOTE, and the same one as last time.** `maintaining-project-docs` says to create
> this pair before the first substantive tool call. **It did not exist for this session** and
> was written at the end, from the full record, on Maximo's instruction. Content is exact;
> the checkpoint log's ordering is approximate. This is now the second consecutive session
> where the pair was written at the end — see the CONTEXT pair's closing note.

---

## Standing, carried forward BY POINTER

**`OPENWORK.md` is where work survives.** THE LANE is the ordered authority. Live status of
everything this session touched or filed:

| Item | State |
| --- | --- |
| **38** `/api/vision` forwards the body verbatim | `[ ]` **agent, unblocked, FRONT OF QUEUE.** Must land before item 37 completes |
| **39** Polar 5xx → 403 → session deleted | `[ ]` agent, unblocked. **Both halves**, server and client |
| **40** No rate limit on the licensed path | `[ ]` agent, unblocked |
| **41** A hostile page can drive the tray | `[ ]` agent, unblocked. Three small edits |
| **42** The card's × is a free-read button | `[ ]` agent, unblocked |
| **43** Options-page slot reuse deletable, green | `[ ]` agent, unblocked. Fix by EXTRACTION |
| **1** Polar benefit activation settings | `[!]` Maximo. Unchanged |
| **2** The six Vercel variables | `[!]` Maximo. Five set 2026-08-19; `BUKI_EXTENSION_ID` waits on 37 by design. **Re-probe with `vercel env ls` — that is a report, not a measurement** |
| **26** Gemini spend cap | `[!]` Maximo. **Promoted in importance by item 38**: with 38 unfixed the cap IS the loss ceiling and it will be reached rather than approached |
| **37** Extension id / manifest `key` | `[!]` Maximo then agent. **Now gated on 38 and 26 landing first** — see `launch.md` step 4.5 |
| **3** The by-hand pass, 13 checks | `[!]` Maximo only |
| **9** Five screenshots at 1280x800 | `[!]` Maximo. Frames, headlines, staging and the shoot list all done |
| **35** Affiliate tags | `[ ]` Maximo. One paste, no blockers |
| **36** Five landing CTAs → store URL | `[ ]` agent, launch day. **Its guard is proven blind** — see below |

---

## Done and verified, 2026-08-24

### Before the review — the tray redesign (`46b62fb`)

- [x] **The catch tray gained a second mood**, following the extension's own choice. Measured
      and symmetric: a dark card on a black essay is 1.10:1 against the page, a light card on
      a white docs site is 1.00:1. Each mood vanishes into exactly one ground; the ring carries
      it. Rendered on all five grounds in both moods before it landed.
- [x] **A recorded decision was overturned knowingly.** `theme.ts` said the tray "does not read
      this and must not". That was written when the tray had ONE mood; what it actually argues
      is that the card stays opaque with its own ring and shadow, which is still true twice.
- [x] **The theme could not be read at all** — a content script's `localStorage` belongs to
      x.com. Choices now mirror into `chrome.storage.local`; `localStorage` stays authoritative
      for the pages because it must be synchronous before first paint.
- [x] **The coloured strip was drawing a RETIRED LOGO.** Its own comment called it "the mark's
      own spine, with the mark's own two cords" — the three-spine mark, replaced 2026-08-17.
      Removing it was a correction. It also fixed the centring for free: the padding reserved
      21px for a spine that no longer existed.
- [x] **A serious bug caught in the build, not by a test.** Importing `./theme` into the content
      script would have set `data-theme` on **x.com's own root element**. `tsc` and the bundler
      were both happy; the only evidence was `setAttribute("data-theme")` in `dist/content.js`.
      Pure half extracted to `themeChoice.ts`; `contentChrome.test.ts` fails the build if the
      entry point returns.
- [x] **A time bomb defused.** `visionRoute.test.ts` declared `const NOW = Date.UTC(2026,7,17)`
      and never passed it, so it measured a session against the real wall clock. Its two sibling
      tests pass it; this one forgot. Green for seven days, then red on its own with no code
      change, mid-redesign, looking like collateral damage.
- [x] **Four traps recorded in §5**, including the counter-interpolated-twice bug that made the
      harness lie and sent a real design detour.

### The review itself

- [x] **Ten reviewers dispatched in parallel**, scope adapted because `git diff origin/main`
      was EMPTY — everything is merged, so the skill's diff-based scoping would have produced
      an empty review.
- [x] **Six P0s found, ALL VERIFIED by me against source**, not taken on an agent's word. Two
      agent claims were narrowed on re-reading.
- [x] **Filed as items 38-43** in `OPENWORK.md`, with LANE rows.
- [x] **`docs/REVIEW-2026-08-24-prelaunch.md` written** — the permanent record.
- [x] **`.vercelignore` gained `docs/REVIEW-*`** in the same commit. That file names every open
      vulnerability by file and line; `docs/` is the public site root.
- [x] **`launch.md` gained step 4.5** — the model pin and the spend cap must both be live
      BEFORE `BUKI_EXTENSION_ID` is set.
- [x] **The "no agent work left" note in THE LANE was rewritten, not deleted.** True on 08-18,
      false since 08-24.

### Verified independently, by me, not by an agent

- [x] **Zero secrets in the full git history**, all branches: `polar_oat_`, `AIza…`, `sk-…`
      all 0 hits. No tracked `.env`.
- [x] **Zero secret-shaped literals in the shipped bundle**; it talks to exactly six hosts,
      all declared.
- [x] **Zero runtime dependencies** — `dependencies: {}`, 132 lockfile entries all dev-only.
- [x] **`.vercelignore` holds in production**: `/SESSION-CONTEXT-…md` → **404**,
      `/superpowers/polar-setup.md` → **404**.
- [x] **`/api/vision` on a bare GET → 405, empty body.** No stack trace, no env names.
- [x] **`/privacy` served**, both new sections present, dated 2026-08-20.
- [x] **The mutation agent's tree was clean** — `git status` and `git diff HEAD` both verified
      after it reported reverting six mutations.
- [x] **`tools/mark-sizes.mjs` crashes** — confirmed by running it.

---

## Open, carried forward

- [ ] **THE STORE ZIP HAS NO PACKAGING STEP.** `launch.md` step 4 says "zip the extension
      directory" and there is no script and no definition of which files that means. The repo
      root holds `.git`, `node_modules`, `docs/`, `.context/`, `.vercel/project.json` and the
      scratch `screen*.PNG`. **The extension needs exactly 12 files**: `manifest.json`,
      `popup.html`, `options.html`, `dist/{background,content,popup,options,theme}.js`,
      `icons/icon{16,32,48,128}.png`. **`fonts/` is NOT among them** — `build.mjs` inlines
      Manrope as a data URI, verified in `dist/content.js`. Proposed: `npm run package` guarded
      by a test that derives the list from `manifest.json` itself.
- [ ] **THE STORE ICON IS THE WRONG SHAPE.** Google: *"96x96 for square icons; an additional 16
      pixels per side should be transparent padding."* `icons/icon128.png` is full-bleed 128
      (IHDR read, and looked at). Correct as a TOOLBAR icon, wrong as a store icon — it will
      sit visibly larger than every neighbour. Needs a SEPARATE padded asset;
      `tools/make-icons.mjs` makes it an inset parameter, not a redraw.
- [ ] **THE PROMO TILE CONTRADICTS GOOGLE'S RULE.** Guidance is *"Avoid text"* + *"works even
      when shrunk to half size"*. Decision taken 2026-08-19: the tagline goes, the wordmark
      stays as a knowing deviation.
- [ ] **PINTEREST IS AN UNTESTED CLAIM.** Named on shot 3 and in the description; the only
      platform not in `.agents/product-marketing.md`. Works the same way (right-click) but has
      never been through the by-hand pass. **Add it to item 3.**
- [ ] **THE CAPTURES ARE THE RIGHT CONTENT AND THE WRONG RESOLUTION.** 350-561px against a
      1280px frame that deliberately does not upscale. **Shoot at device pixel ratio 2.**
      Also: `Someday 99` of 119 reads as one dumped pile, and the second board is cut mid-cover.
- [ ] **`item 36`'S GUARD IS PROVEN BLIND.** Mutation-tested: the launch-day find-and-replace
      ships "Source" pointing at the Web Store with 620/620 green. `host.test.ts:144` asserts
      link TEXT, not destination. **Fix the guard before doing item 36, not after.**
- [ ] **`policy.ts`'s "$0.00011" per catch.** Now MEASURED at $0.000135 by the threat model
      against Google's published pricing — so the number was very nearly right. What it does
      NOT survive is item 38: it is a property of the body our extension happens to send, not
      one the server enforces.
- [ ] **The `polar_oat_` token from 2026-08-17 — rotation still unconfirmed.** It never entered
      the repo (verified again this session by a full-history scan) but it is in a chat
      transcript.
- [ ] **No email capture anywhere.** Unchanged. The ORB gap named in `launch.md`.
- [ ] **Product Hunt is deliberately NOT day one.** Unchanged.
- [ ] **Vercel Observability Plus** — exclude the noisy sibling projects rather than disabling.
- [?] **Should the Pro card's primary button become "Buy Pro"?** Unchanged, still open.
- [ ] **UNVERIFIABLE STATICALLY: the `covers.openlibrary.org → archive.org` redirect chain.**
      `permissions.md:153` asserts every hop answers with permissive CORS. **Probe it once
      against a real cover before submitting** — if wrong, every shelf cover silently falls
      back to the drawn board and nothing would tell you.

---

## Checkpoint log

| When | State |
| --- | --- |
| Session start | 620 / 58, `main` at `46b62fb` — the tray redesign already landed |
| Ten reviewers dispatched | scope adapted: `git diff origin/main` was empty |
| Independent checks while they ran | history clean, bundle clean, deps zero, `.vercelignore` holds live, `/privacy` served |
| First two agents in | two P0s, both verified against source |
| All ten in | ~100 findings, six P0s, five surviving mutations |
| Docs written | review record, items 38-43, LANE, header, `launch.md` step 4.5, `.vercelignore` |
| Session end | **620 / 58, tsc 0, build 0**, `main` = `origin/main`, 14 open items |

---

## For the next session, in one breath

**Nothing was fixed. That was the instruction.** Six P0s are filed as items 38-43, all agent
work, all unblocked, all verified. **Start with 38** — it is the one that makes item 26's spend
cap mean something, and it must land before item 37 completes.

The recommended first move, offered and not yet accepted: **fix 38-41 with tests first, in one
batch, then re-run and hand over a diff.** ~40 lines of source plus the tests that pin them.

**Read `docs/REVIEW-2026-08-24-prelaunch.md` section 1 before touching any of it.** The six
share one shape, and knowing it changes how you fix them.
