# Session context — 2026-08-16 — iOS pass 3

**Repo** `E:\Projects VS\save-book-extension` · **Branch** `buki-pro` · **Head at open**
`a5734e2`… superseded, see below · **Working tree at open** clean

**Predecessor** `docs/SESSION-CONTEXT-2026-08-16-design-pass-2.md` and the handoff at
`C:\Users\User\AppData\Local\Temp\buki-handoff-2026-08-16-ios-and-bugs.md`, both read at
session start. This file carries the REASONING; the ledger is
`docs/SESSION-TODO-2026-08-16-ios-3.md`.

## What was asked

> "1- we need to make the corners of the extension (the whole extension container)
> rounded. more ios style. 2. the toast overlapp one another. they are not stacking as
> before. 3- we need more ios style directives, transparancies, nice colors, mor
> contrasts. but still keep our buki style (fun, elegant, candy, contrast, ios, plus our
> new logo)"

**Two of the three were claimed fixed the same day** — corners in `3c56521`, the toast
overlap in `f386fa9`. That is the whole shape of this session: a fix that was reported as
done and did not take is worth more than a new bug, because it means the reasoning behind
it was wrong.

## Measured, with the probe beside it

| Measurement | Probe | Value |
| --- | --- | --- |
| Chrome on this machine | `ls "/c/Program Files/Google/Chrome/Application/"` | **151.0.7922.138** |
| A five-book catch card | rendered, `getBoundingClientRect().height` | **680px** |
| The tray on a laptop | `calc(100vh - 36px)`, 768px viewport | **732px** |
| Stack travel when a five-book card arrives | content-space delta, rendered | **387px** |
| Worst overlap at t=0 of that travel | rendered | **436px** |
| Worst overlap at 25% of the travel | rendered | **0px** |
| FLIP teleport when interrupted mid-travel | rendered, content space | **0.0px** |
| Popup corner pixel, as shipped | headless screenshot over a transparent backdrop, pixel (2,2) | **rgba(0,0,0,255)** |
| Popup corner pixel, paint moved to a wrapper | same | **rgba(0,0,0,0)** |

## Beliefs overturned this session

### The popup's corners were never rounded, and both radius declarations are inert

**Believed**, and written into `popup.html` as a comment on 2026-08-16: *"The radius has to
be on `<html>` as well: the popup's canvas is painted from the root element, so rounding
only `<body>` leaves square corners of root background showing through."*

**Measured.** Two pages, identical but for where the paint lives, screenshotted headless
over a transparent backdrop so alpha answers outright:

| | corner pixel (2,2) | centre |
| --- | --- | --- |
| `html`+`body` both rounded, `body` painted — **as shipped** | `rgba(0,0,0,255)` | `rgba(0,0,0,255)` |
| root transparent, a wrapper painted and rounded | `rgba(0,0,0,0)` | `rgba(0,0,0,255)` |

**Root cause.** `html` declares no background, so per CSS Backgrounds §2.11.2 the `body`'s
background **propagates to the canvas** — and a canvas background is painted across the
entire canvas and is **not clipped by anybody's `border-radius`**. The body's own
background is then not painted at all. So the diagnosis was half right (the canvas is the
problem) and the fix was exactly wrong: adding a radius to `<html>` cannot clip a canvas.
**The paint has to leave the root entirely.** Neither element may carry it, because a
transparent root propagates from `body` in turn — it has to be a third element inside.

### The toast overlap is real, the FLIP arithmetic is not the cause, and the fix from this morning works

**Believed:** the overlap was `reflow` discarding an in-flight `translateY`, fixed by
`travelFrom` in `f386fa9`.

**Measured**, by parking each armed transition at a known fraction with
`animation.currentTime` and re-measuring in content space: interrupting a slot at 40% of
its travel with a fresh catch moves it **0.0px**. The invariant `travelFrom` exists to
hold, holds. That fix was correct and is not the regression.

**The actual mechanism.** A new card is inserted at its final layout position *instantly*;
every existing card is then held back at its old position by the FLIP transform and
animates to the new one. So for the front of the travel the stack is drawn across the
incoming card's box **by design**, and the magnitude of that overlap is the incoming
card's own height.

**Why it became visible now.** That was ~200px and gone in a few frames when a card held
at most eight books. `MAX_BOOKS` went **8 → 20** this morning in `3c56521`. A five-book
card measures **680px**; twenty is around 2,600px. So the transient became a 436px sweep —
and worse, **a single card is now taller than the tray it lives in** (680px card, 732px
tray on a laptop, and far less on a scaled display).

**The reusable shape:** *a cap raised for one reason changes the geometry of everything
downstream of it.* The recognizer cap was raised to stop dropping books. Nothing in that
change is wrong. It simply had a consequence in a surface nobody re-measured, because the
surface has no bound of its own. **An element whose height is driven by a list needs a
bound that does not depend on the list.**

### A surface reviewed on five grounds can still be unreviewed

`tools/tray-harness.mjs` renders four fixture cards on five grounds and was used on
2026-08-16 to conclude the tray "needed nothing". Its fixture's tallest card holds three
books. **The harness could not have shown this**: it never overflows, and it never runs
the script.

## Instruments that lied

| Instrument | How it lied | What to do instead |
| --- | --- | --- |
| **`tools/tray-harness.mjs`** | Renders the stylesheet and never runs the script, so no motion bug can appear in it at all; and its fixture never overflows the tray, so no height bug can either | Drive `reflow` directly. See below |
| **A rAF + timer probe under `--virtual-time-budget`** | `frames=3, live=0` — rAF does not fire. This is the trap `OPENWORK.md` §5 already records, walked into for the second session running | Shim `requestAnimationFrame` onto a queue the script drains itself |
| **The same probe with rAF shimmed to a timer** | `frames=313` but `live=1 of 3`: with `--dump-dom` **no frames are produced, so CSS transitions never advance**. Every card sat at `opacity: 0` forever | Do not depend on the transition clock. Park each animation with `animation.currentTime`, which style recalc honours without a frame |
| **My own first FLIP invariant** | Reported a 374px "teleport" that was the deliberate `scrollTop = scrollHeight` pin. Viewport rects are not comparable across a scroll | Measure in CONTENT space: `rect.top + host.scrollTop` |
| **My own first overlap reading** | Reported `settled overlap=61.3` for three plain cards, which was the probe measuring at t=0 of a travel it had armed and never advanced | Park at a known fraction before every read |

Four of those five are instruments this session built. The pattern worth keeping: **a probe
that has never been shown to detect the thing it is looking for is not evidence**, and the
cheapest way to earn that is an A/B where the control is expected to differ.

## Refuted before it was written

`.buki-slot` declares no `flex-shrink`, and a flex column that overflows its `max-height`
compressing its items is a real and common bug. Rendered as an A/B — as shipped, versus
`.buki-slot { flex: none }` — both measured **`slotH = cardH = 448.6`, spill 0.0**. A flex
item's automatic minimum size already prevents it. **The fix was written and thrown away
before it was committed**, which is the only reason it is recorded here.


---

# 2026-08-17 - the catcher, six reports, and the paid tier

*(Continued in this file rather than a fourth pair: one thread of work, and `OPENWORK.md`
section 0 warns that filename order is not a reading order.)*

## What was asked

Four turns, in Maximo's words:

1. *"i added the newLogo.png use that everywhere"* - plus six fixes: rounded corners,
   delete features, toast CTAs/contrast/covers, scrolling between toasts, *"read from the
   cover - unverified ... what is that, remove it"*, and *"buki found x books on this
   image"*.
2. *"the pupils are not showing"* on the toolbar icon and in the right-click menu.
3. *"go. continue building all the features. the pro everything. the landing. the pro ctas
   within the extension, the badges, everything"*.
4. This doc pass and a handoff.

## Measured, with the probe beside it

| Measurement | Probe | Value |
| --- | --- | --- |
| Test suite | `./node_modules/.bin/vitest run` | **515 across 52 files** |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit` | exit 0, now covering `api/` |
| Build | `node build.mjs` | clean, 5 bundles |
| Branch | `git rev-list --count main..buki-pro` | **68** ahead, not merged |
| Tracked files | `git ls-files` piped to `wc -l` | 199 |
| Plan | `grep -c` on the buki-pro plan | **64** done, **21** left (was 37/48) |
| Logo geometry | sampled from `icons/mark-source.png` | ball r50; eyes cx 31.3/68.3, cy 45.9, rx 13.7, ry 19.5; glints cx 35/71.4, cy 35.2, r 3.9 |
| Logo ramp | sampled | `#7bcdfc` to `#4aa3f9` to `#013ebf`; eyes `#091a3b`; glint `#fdfdfd` |
| Catchlight pixels per icon | decoded the shipped PNGs | 16px **0**, 32px 6, 48px 15 - before the fix |
| Cover under a page CSP | rendered under `img-src 'self' data:` | cross-origin **BLOCKED**, `data:` LOADED, `blob:` BLOCKED |
| Tray CTA centring | Range rect vs button box | dx 0.00, dy **-1.00px** before; -0.50px after |
| Intent row width | real harness DOM | row 223 of 267 available before the fix; 267 after |
| Five-book card | rendered | 680px, in a tray that is 732px on a laptop |

## Beliefs overturned

### The popup's corners cannot be rounded, and the previous day's fix made it worse

**Believed** (2026-08-16, and measured): moving the paint off the root onto `.win` makes
the corners round. The corner pixel really did go `rgba(0,0,0,255)` to `rgba(0,0,0,0)`.

**Measured** by the only instrument that could - Maximo, in the browser: *"it still has an
outside container with sharp coorners"*. Chrome's extension popup on Windows is a **square
native window painting its own opaque background**. A transparent canvas does not reveal a
rounded window; it reveals **Chrome's**, with our panel inset inside it and a seam between.

**The surviving rule:** the CSS mechanism established that day is still true and is what
let the right answer be reached in one step. What was wrong was assuming the document was
the outermost thing on screen.

### A confident comment is not a render - for the fourth time

**Believed**, written into `make-icons.mjs` alongside the new mark: a catchlight at 16px
"eats the eye it is supposed to sit in", so they were gated behind `size >= 32`.

**Measured:** rendered at 16px with and without, on a light toolbar and a dark one, the
true-size catchlight is a clean lit pixel and the gated version is the one that looks dead.
`icon16.png` shipped with **zero** catchlight pixels.

**This is the fourth time in this repo that a claim about how something renders was written
without rendering it.** The other three were contrast ratios. The guard is now the shipped
artefact: `src/shared/icons.test.ts` decodes `icons/*.png` and fails if an eye has no lit
spot in it.

### A function can be written, tested, and have no caller

**Believed:** the paid tier's client half was complete after the 2026-08-17 build.

**Measured** during this doc pass, by reconciling the plan's steps against the code:
`needsRenewal` had **no caller**. A Pro session would have expired after 24 hours, ridden
the seven-day grace, and then shown a paying subscriber the wall they had already paid to
pass. **Nothing was red.** Fixed as `ensureSession`, wired into the recognition path,
because an MV3 worker is torn down between clicks and a catch is the only reliable
heartbeat this extension has.

### A plan's checkbox is a claim, and claims get made carelessly

**Believed:** ticking the six tasks built that day was bookkeeping.

**Measured:** four of twenty-nine ticks were on steps nobody had performed - a discriminate
check, a brand-checklist pass, a "look at it in a real page", and a "restructure the page"
that was actually an added section. Three were then done properly (the discriminate check
ran and failed correctly when the guard was removed; the wall was rendered and looked at)
and the restructure was left open and honest.

## Instruments that lied

| Instrument | How it lied | What to do instead |
| --- | --- | --- |
| **My own probe of the intent row** | Said the three labels fitted, measured in a simplified page with no scrollbar. The real card is 26px narrower | Measure in the harness that has the real container |
| **`width: 100%` on a flex item** | Reads as "take the whole line"; it is clamped by what is left ON the line, so the row stayed beside the cover at 223 of 267 | `flex-basis: 100%` is what breaks the line |
| **`flex: 1`** | Reads as "share fairly"; it sets a zero basis and forces EQUAL widths, so the longest label clipped its own last letter | `flex: 1 1 auto` grows from the content basis |
| **The tray harness fixture** | Drifted from the builders three times in one week - button row deleted, nesting stale, copy retyped | It now reads the stylesheet AND the wall's copy out of source |
| **My own icon test's first probe** | Failed with a difference of exactly zero, and the icon was right: `Math.round` on a 0..100 coordinate read pixel 6 where 5.6 lives in pixel 5 | `Math.floor` - the pixel that CONTAINS the coordinate |
| **A test that reads declarations as text** | `background: var(--fill)` sailed past the tray's "nothing see-through" guard on the day `--fill` became an rgba | Resolve tokens before asserting on a value |
| **`.gitattributes`** | Declared `* text=auto eol=lf` with only `*.png` marked binary, so four `.jfif` photographs were tracked as TEXT and a normalisation pass ran through their bytes | Name every binary type; they were restored and verified before the commit |
| **A Python heredoc through Bash** | Broke on quoting for the third recorded time | Write the script with the Write tool and run it |

## Decisions worth not re-deriving

- **The mark is a rich icon with no flat derivative, and that is a change.** The old mark
  needed a cream plate because two ink spines vanished on a dark toolbar. The ball carries
  its own colour and silhouette - 11.98:1 on black, 8.9:1 on white - so `icons/icon.svg`,
  `docs/icon.svg` and `icons/mark.svg` are now the same drawing, and `--mark-spine` and
  `--mark-caught` were deleted from all three surfaces.
- **A filled disc is judged on its ramp, not on any one stop.** The bar is "the best stop
  clears 4.5:1" and "the eyes clear 3:1 WHERE THE EYES ACTUALLY ARE". The naive version
  failed a mark that renders perfectly, which is the same error this repo has now made
  three times in three different shapes.
- **The escape hatch on the wall is real.** Your own key means unlimited cover reading,
  free forever. It is a full-width button because it is true.
- **The licence key never rides a catch.** It is exchanged once a day for a signed session;
  only the session travels. `isLicensed` stays true through the server's grace window, so
  our own outage never signs a subscriber out.
- **The tray card stays opaque forever**, but a control sitting ON it may be translucent:
  its ground is ours, so the composite is computable (#39393d, white label at 11.50:1).

---

# 2026-08-17, after compaction - the listing, and what a pointer costs when it expires

## Measured, with the probe beside it

| Measurement | Probe | Value |
| --- | --- | --- |
| Test suite, on resuming | `./node_modules/.bin/vitest run` | **515 across 52 files**, matching the docs |
| Test suite, at the end | same | **516** |
| Branch | `git rev-list --count main..buki-pro` | **70** ahead, not merged |
| Plan | `grep -c` on the buki-pro plan | **64** done, **21** left |
| Callers of every Pro module | `grep -rn` excluding tests and the declaration | all 13 reach `background.ts`, `popup.ts` or `options.ts` |
| `--mark-caught` in the surfaces it was exempted for | `grep -c -- '--mark-caught:' popup.html options.html` | **0 and 0** |
| The other three exempted tokens | same | `--stamp` 1, `--stamp-dim` 1, `--forest` 1, all live |
| Spine geometry in the three SVG surfaces | `grep -c '<mask' / '<rect' / '<ellipse'` | **0 / 0 / 2** in every one |
| Manifest summary | `manifest.json` → `description.length` | **100**, inside the store's 132 |
| Em-dashes in the new listing | `grep -c '—'` | **0** |

## Beliefs overturned

### The plan's Task 9 is not undone work, it is a route that was superseded

**Believed**, from the plan's own checkboxes: six unticked steps under *Settings learn about
the licence* meant six steps to do, and `OPENWORK.md` item 13 calling Task 9 done was the
error.

**Measured** by reading `settings.ts` and `visionRoute.ts`: the plan wanted `Settings` to
grow `license` and `session` fields and `toVisionConfig` to choose between them. The build
put the licence in `proState`'s own storage key and the choice in `visionRoute`, which is
the better separation - a credential for our server does not belong in the same record as
the endpoint someone typed into a box. **Item 13 is right and the plan is stale.** This is
the fifth time the plan has been wrong about its own details; treat it as intent.

### A guard against dead entries protected one allowlist and not its neighbour

**Believed:** `extensionTokens.test.ts` guards its exemptions, because it visibly does -
there is a test called *exempts only the surfaces that draw a book rather than the panel*
carrying the comment *"if a name in the allowlist stops existing, the exemption is silently
protecting nothing."*

**Measured:** the file holds **two** allowlists. That test asserts `LITERAL_BY_DESIGN`.
`MOOD_INVARIANT`, eight lines further up the same file, had no assertion at all, and within
a day of the mark changing it was exempting `--mark-caught` from the light-dark() rule while
no surface declared it. The guard existed, was correct, and covered half the problem.

### "Every tracked .md reconciled" was true of the sections and false of the pointers

**Believed**, written into this file one stretch ago: the doc pass reconciled every tracked
`.md` against the system.

**Measured:** it reconciled the sections. It did not reconcile what POINTS at them.
`brand.md` banner'd the three-spine mark correctly and then told the reader, in the banner
directly above *THE CATCHER*, to go and read the superseded section. `product-marketing.md`
announced the change in its changelog and left the body describing three spines.
`DESIGN.md` said "two things are no longer true" while three more had expired in its
appendix. Three shipped HTML files described a cord mask above a ball.

**The rule that comes out of it:** superseding a section is half an edit. **A pointer is a
claim and expires like one**, and a banner that ENUMERATES is making a claim about
everything it left out.

## Decisions worth not re-deriving

- **The listing is written FORWARD.** It describes the product at submission, not today,
  because item 22 decided Buki ships only once the paid tier works. Writing it against
  today's product would mean writing it twice, so it carries a DO-NOT-SUBMIT gate naming
  the two things that must be true first, in the same shape as `permissions.md`'s banners.
- **The store takes the name and the summary from `manifest.json`.** The old listing offered
  a `Name` of `Buki: catch books from X` for a box the dashboard does not own, contradicting
  the manifest's `Buki`. The summary is now quoted from the manifest verbatim.
- **`marketing-skills:aso` was invoked and did not fit**, and that is recorded rather than
  hidden: it audits a LIVE Apple or Play listing, scoring ratings, review recency and
  feature graphics. Buki is pre-launch on a third store with none of those. Its transferable
  facts held (the long description is indexed, the first lines carry conversion, no
  "best/#1/free" in a title) and its procedure was not run.
- **The single-purpose statement covers entry points, not sites.** One purpose, phrased so
  the context menu on any page, the book icon on X and the shelf in the popup are all
  instances of it. Saving is not a second purpose; it is what identifying is for.

## The options restructure, and three things only a render could say

| Measurement | Probe | Value |
| --- | --- | --- |
| `#getPro` vs its neighbour | computed styles in Chrome, real page | `<a>` radius **0px**, padding **0px**, height **23.3** against `<button>` `999px / 11px 20px / 35.5` |
| `.ghost` fill, night | same, `--sunk` on `--paper` | **1.15:1** |
| `.ghost` fill, day | screenshot, after the probe lied | **1.08:1** |
| `--board`, the rejected alternative | computed | **1.27:1** day, **1.79:1** night |
| Suite after | `vitest run` | **523 across 53 files** |

**`#getPro` was a square, unpadded box in a row of pills**, because the shape came from a
rule selecting `button` and it is an `<a>`. It sat on the one control that leads to paying,
and no test in this repo could see it: `extensionTokens` reads colours, `fonts` reads
`@font-face`, `mark` reads geometry. `optionsPage.test.ts` now asserts the shape rule names
the anchor, and the page's ORDER, which was equally invisible.

### The instrument that lied this time, and the one that corrected it

**Believed**, from a computed-style probe: `.ghost` measures 16.34:1 in day mode, so the
fill is fine.

**Measured** by taking the screenshot instead: the pills are pale grey on pale paper.
The probe had set `data-theme="light"` and read `getComputedStyle` in the same task; it got
the new `body` background and the **old** `--sunk`, because a `light-dark()` custom property
substituted into a descendant had not re-resolved. Real value **1.08:1**.

**And the harness lied a second way.** Flipping the mood from the parent frame animates
every control's `transition: background-color 140ms`, so one screenshot caught a dark pill
on a light page and read as a contrast bug that was not there. The fix is to inject
`transition: none !important` **before** narrowing the theme.

### A decision that was right, described wrongly for two days

`.ghost` carried a long comment arguing for a `--muted` ring and rejecting `--board` **by
name** at 1.28:1 as "a boundary you cannot see". `git show a40e335` shows the iOS turn
deliberately replaced that ring with a filled surface, which is the Apple idiom and which
`brand.md`'s checklist permits outright: *a control's boundary clears 3:1, or it has a
filled surface instead of an edge.*

So the code took the better decision and the prose kept defending the older one. The
awkward part is only visible once measured: **the fill that replaced the ring is fainter
than the value the comment rejected.** Logged as a founder call (`OPENWORK.md` item 25)
rather than changed, because retouching a deliberate design decision as a side effect of a
restructure is how the unrelated regressions in §5 got in.
