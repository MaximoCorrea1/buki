# Open work

**State as of 2026-08-16**, verified by running the commands, not from memory:

| | |
| --- | --- |
| Tests | 345 across 37 files, all passing |
| Typecheck | `tsc --noEmit` exit 0 |
| Build | `node build.mjs` clean |
| Working tree | clean. The landing and the extension are both on the third generation |
| Branch | `buki-pro`, **not merged**. `git rev-list --count main..buki-pro` read **50** as this line was written, so the commit carrying it makes 51 |
| Plan | `grep -c` on `2026-08-09-buki-pro.md`: 37 steps done, **48** left |

*(The 2026-08-15 header said 48 commits and 49 plan steps left; both were re-derived here
rather than carried. **A commit count written into a commit is wrong by one the moment it
lands**, which is how this number has drifted twice, so the probe is given beside it. Run
the probe; do not trust the figure.)*

## 0. Which doc owns which fact

The `maintaining-project-docs` skill names a generic contract set. This repo's filenames
differ, and hunting for a file that does not exist wastes the same time as reading one that
lies. **Put a fact in ONE of these; a fact in two places is a fact that will disagree.**

| The fact | Lives in | Not in |
| --- | --- | --- |
| What is open, who owns it, what it unblocks | **this file** | any handoff |
| The visual contract: tokens, generations, the mark, the checklist | `docs/brand.md` | `DESIGN.md` |
| The mark's geometry and its measured colour values | `tools/mark.mjs` | anywhere else — six surfaces are asserted against it |
| Positioning, ICP, objections, voice | `.agents/product-marketing.md` | the landing copy |
| What the product does today | `README.md` | `DESIGN.md` |
| Tier boundaries, machine-readable | `docs/pricing.md` | the landing |
| Store copy and permission justifications | `docs/store/` | — |
| The paid-tier implementation, step by step | `docs/superpowers/plans/2026-08-09-buki-pro.md` | — |
| Polar setup, field by field | `docs/superpowers/polar-setup.md` | — |
| The competitive landscape | `competitor-profiles/_summary.md` | — |
| This session's reasoning and what was measured | `docs/SESSION-CONTEXT-<date>-<label>.md` | — |
| This session's forget-nothing ledger | `docs/SESSION-TODO-<date>-<label>.md` | — |

**`DESIGN.md` is a dated record, not a contract.** It is the 2026-07-20 design session,
kept because the reasoning explains the product's shape, and it carries its own
`PARTLY SUPERSEDED` banner naming what stopped being true. Do not update it; supersede it.

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

- [ ] **1. Create the Polar product.** **Field by field, with the reasoning and a curl that
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

- [ ] **9. Screenshots for the Web Store.** Five at 1280x800. **Do 8 first**, and item 3,
      so they show the redesigned product doing catch-anywhere rather than the X-only one.
      Shoot against a shelf of books actually saved; a mocked shelf reads as a mock.
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

- [ ] **10. Task 6, the vision proxy.** 5 steps. Needs items 1 and 2.
- [ ] **11. Task 7, exchanging a licence for a session.** 4 steps. Needs item 10.
- [ ] **12. Task 8, the extension holds a licence.** 5 steps.
- [ ] **13. Task 9, settings learn about the licence.** 6 steps. Needs item 11.
- [ ] **14. Task 10, the worker gates a catch.** 6 steps. Needs items 12 and 13.
- [ ] **15. Task 12, the wall.** 9 steps. The paywall UI.
- [ ] **16. Task 13, the options page holds a licence.** 4 steps.
- [~] **17. Task 14, the documents that are now false.** 4 steps. **Half done 2026-08-16**
      — the permission justifications are written; the data-usage declaration and the
      listing still wait on the proxy. *(see §3 below)*
- [ ] **18. Task 15, close the loop.** 4 steps.
- [ ] **19. Merge `buki-pro` into `main`.** 37 commits and counting. Use
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

- [x] **22. Ship free-first, or wait for the paid tier? DECIDED 2026-08-13 by Maximo:
      wait.** The landing copy therefore stays as written and stays true on the day it
      ships. The consequence is that **items 1 and 2 are now the critical path for the
      whole project**, not routine setup: nothing in Part 3 can start until the Polar
      product exists and the five Vercel variables are set. The Web Store review clock does
      not start until then, and that is the accepted cost.

---

## 3. The store documents: permissions are done, the listing is not

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

**`docs/store/listing.md` is untouched and still fails.** It describes the X-only,
bring-your-own-key, no-server product: the name, the short description and the whole
detailed description are the narrow version. **Its `Single purpose` field is the one to
fix first** — it says Buki "identifies books shown in posts on x.com", and a single-purpose
statement scoped to one site sitting next to a manifest that asks for `scripting`,
`activeTab` and an optional `https://*/*` is a contradiction a reviewer is specifically
looking for. The manifest and `package.json` descriptions were corrected on 2026-08-16;
this file is the last place the narrow pitch survives.

That is the rest of item 17.

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
