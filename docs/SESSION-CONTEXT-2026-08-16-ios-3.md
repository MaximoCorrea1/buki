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
