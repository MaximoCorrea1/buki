# Open work

**State as of 2026-08-13**, verified by running the commands, not from memory:

| | |
| --- | --- |
| Tests | 329 across 32 files, all passing |
| Typecheck | `tsc --noEmit` exit 0 |
| Build | `node build.mjs` clean |
| Working tree | clean. Items 4, 5, 6, 7, 8, 20 and 22 are committed |
| Branch | `buki-pro`, **34 commits ahead of `main`, not merged** |
| Plan | 37 steps done, 49 left |

**This file is an ordered checklist. Work it top to bottom.** Items are numbered across the
whole document so "do 7 next" is unambiguous. Each one says who can do it and what it
unblocks.

---

## Part 1. Maximo only. Nothing in Part 3 can start until 1 and 2 are done

- [ ] **1. Create the Polar product.** Two products, one per billing interval: Buki Pro
      Monthly $4 and Buki Pro Yearly $29. **Attach the License Key benefit to BOTH** or a
      yearly subscriber pays and gets nothing to paste in. Activation limit 5 on both.
      Also create the API key Polar asks for; that is `POLAR_ACCESS_TOKEN` below.
      The webhook Polar recommends is **not needed**: the design validates on demand and
      stores no subscription state, which is why there is no database.
      *Unblocks: item 2, then Tasks 6, 7, 9.*

- [ ] **2. Set five environment variables** in Vercel, project `buki`, all environments.
      **None of these may ever appear in a file under `src/extension/`.** That is a leak,
      not a shortcut.

      | Name | Notes |
      | --- | --- |
      | `GEMINI_API_KEY` | **Paid tier.** Create at https://aistudio.google.com/apikey then link billing at https://aistudio.google.com/plan_information. The free tier queues rather than erroring, which is what the 12-second hang on 2026-08-12 looked like, and "it does not throttle" is a line on the pricing page. |
      | `BUKI_TOKEN_SECRET` | 32+ random bytes, `openssl rand -base64 32` |
      | `BUKI_EXTENSION_ID` | from `chrome://extensions` with the extension loaded unpacked |
      | `POLAR_ACCESS_TOKEN` | from item 1 |
      | `POLAR_ORGANIZATION_ID` | Polar settings |

      Nothing reads these yet. `/api/vision` does not exist; that is Task 6.

- [ ] **3. Task 11 Step 5: verify catch-anywhere by hand.** Six checks, written out in
      `docs/superpowers/plans/2026-08-09-buki-pro.md` under Task 11. **No agent can ever
      tick this**: Chrome stable refuses `--load-extension` and `--disable-extensions-except`,
      so there is no headless substitute. The check most likely to fail is the permission
      prompt, because `chrome.permissions.request` needs the click's user gesture and no
      unit test can prove the gesture survived the await. Watch the service worker console:
      `could not ask for` means it threw.

      **A seventh check, added 2026-08-13 with item 6.** Decline the permission prompt, and
      right-click an image on `chrome://extensions`. Each should put a mark on the Buki
      toolbar button with the reason in its tooltip, and clear itself after 6 seconds.
      This is unit-tested against a fake `chrome.action` and has **never been seen in a
      real browser**, for the same reason as everything else in this item.

      **An eighth, added with item 7.** Open the popup, press `Settings` in the top right,
      press `Export the shelf`. A `buki-shelf-<date>.csv` should download. Then actually
      feed it to Goodreads' importer at goodreads.com/review/import and check three things:
      the books arrive, `read` books land on the read shelf, and the `buki-*` shelves are
      created. **This is the only check that proves the format**, and no unit test can
      stand in for it.

---

## Part 2. Unblocked. An agent can start any of these right now

Ordered by value. 4 and 5 came out of the code review on 2026-08-13. **4 to 8 are all
done. 9 is the next one an agent can take**, and it waits on item 3 being done by hand.

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
      plain screenshot is NOT the light mode. Neutralise all five `(prefers-color-scheme:
      dark)` occurrences, not just the `@media` block, or you get the dark plate under
      light tokens and it looks like a regression that is not there.

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

- [ ] **9. Screenshots for the Web Store.** Five at 1280x800. **Do 8 first**, and item 3,
      so they show the redesigned product doing catch-anywhere rather than the X-only one.
      Shoot against a shelf of books actually saved; a mocked shelf reads as a mock.
      *Unblocks item 15.*

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

- [ ] **10. Task 6, the vision proxy.** 5 steps. Needs items 1 and 2.
- [ ] **11. Task 7, exchanging a licence for a session.** 4 steps. Needs item 10.
- [ ] **12. Task 8, the extension holds a licence.** 5 steps.
- [ ] **13. Task 9, settings learn about the licence.** 6 steps. Needs item 11.
- [ ] **14. Task 10, the worker gates a catch.** 6 steps. Needs items 12 and 13.
- [ ] **15. Task 12, the wall.** 9 steps. The paywall UI.
- [ ] **16. Task 13, the options page holds a licence.** 4 steps.
- [ ] **17. Task 14, the documents that are now false.** 4 steps. *(see §3 below)*
- [ ] **18. Task 15, close the loop.** 4 steps.
- [ ] **19. Merge `buki-pro` into `main`.** 28 commits and counting. Use
      `superpowers:finishing-a-development-branch`.

---

## Part 4. Decisions only Maximo can make

- [x] **20. The eyebrow conflict. DECIDED 2026-08-13 by Maximo: delete all three.** Done
      the same day. `THE GESTURE`, `WHAT YOU END UP WITH` and `WHAT IT COSTS` are gone,
      along with the `.kicker` rule and its entry in the reveal script's `SINGLES`. The
      section rhythm did not need repair: the gap above a heading comes from
      `.band { padding: 108px 0 0 }`, not from the label. Checked in a real render at
      1440px and at 390px. **Do not reintroduce one**; `index.html` says so where the rule
      used to be.

- [ ] **21. The catch tray is the last surface on the old design system.**
      `src/extension/content.ts` is still the violet-black room with one warm lamp. The
      popup and options page were realigned on 2026-08-12; the tray was deliberately left,
      because it is the only surface that renders **inside somebody else's page**. That is
      a different problem: it has to hold up against an arbitrary background rather than
      one we chose. **Do not retheme it by copying tokens across without solving that
      first.**

- [x] **22. Ship free-first, or wait for the paid tier? DECIDED 2026-08-13 by Maximo:
      wait.** The landing copy therefore stays as written and stays true on the day it
      ships. The consequence is that **items 1 and 2 are now the critical path for the
      whole project**, not routine setup: nothing in Part 3 can start until the Polar
      product exists and the five Vercel variables are set. The Web Store review clock does
      not start until then, and that is the accepted cost.

---

## 3. The store documents are stale and one of them fails review

Both carry banners saying so. `docs/store/listing.md` describes the X-only,
bring-your-own-key, no-server product: the name, the short description and the whole
detailed description are the narrow version.

**`docs/store/permissions.md` is the one that fails review.** It says *"Nothing is
transmitted"*, which stops being true the day the proxy ships, and it does not justify the
three permissions now in the manifest:

| Permission | Why it is needed |
| --- | --- |
| `scripting` | Inject the catch tray into a tab that has no content script |
| `activeTab` | The grant a context-menu click gives, which makes that injection legal without host access at install |
| `https://*/*` optional | Fetch a cover from a CDN that is not the tab's own origin |

The narrowest honest framing is the one to use: `activeTab` plus an optional host permission
requested on first use, **not** a broad host permission at install. Say that explicitly,
because a reviewer comparing the manifest against this file is exactly who it is for.

That is item 17.

---

## 4. Things that are done, so nobody re-opens them

- **The Vercel rename.** Production domain is `https://get-buki.vercel.app`, defined once
  in `src/shared/host.ts`. Every shipped file that carried the old host was updated.
- **Plate provenance.** Both plates are public domain 18th-century capricci from Wikimedia
  Commons, credited in the page footer. The old ones came from X media ids with unknown
  rights and were an open legal risk for two sessions.
- **Catch-anywhere.** Task 11 is built and committed. Only the manual check remains, item 3.
- **The mark.** `icons/mark.svg` and `icons/icon.svg`. See `docs/brand.md` for why the
  caught spine is a light blue and not the cobalt accent, and why the icon has a plate.
- **The popup and options page** follow the landing as of 2026-08-12.

---

## 5. Traps that have already cost time

- **A retokening that changes an accent's LIGHTNESS invalidates every hardcoded colour
  sitting on it.** Moving `--accent` from amber to cobalt left the options save button at
  `#241705` on `#1231a8`, which measures 1.69:1 and is an unlabelled button. Grep for hex
  literals near any token you relight.
- **`str.replace` does not fail when it matches nothing.** Three font swaps silently did
  nothing because the real declaration was `15px/1.55` and the search string said
  `15px/1.5`. Assert the match or diff the result.
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
