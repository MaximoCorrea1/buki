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
