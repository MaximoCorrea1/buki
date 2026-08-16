# Session context — 2026-08-16 — design pass 2

**Repo** `E:\Projects VS\save-book-extension` · **Branch** `buki-pro` · **Head at open**
`a5734e2` · **Working tree at open** clean

**Predecessor** `docs/SESSION-CONTEXT-2026-08-15-design-pass.md` and the handoff at
`C:\Users\User\AppData\Local\Temp\buki-handoff-2026-08-15-design-pass.md` (read in full at
session start). This file carries the REASONING; the ledger is
`docs/SESSION-TODO-2026-08-16-design-pass-2.md`.

## What was asked

> "read my entire project codebase, docs, adrs, everything, vision, competitors, brand.md,
> etc. read open work and session todos — that's my pending work from previous session and
> what we are going to tackle now."

Invoked with `/frontend-design:frontend-design` and `/emil-design-eng`, plus the Flowy
**superpowers** and **growth-marketing** overlays.

## Measured, with the probe beside it

Every number here was produced by running the command in this session.

| Measurement | Probe | Value |
| --- | --- | --- |
| Test suite | `./node_modules/.bin/vitest run` | **344 tests across 37 files**, all passing |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit` | exit 0 |
| Build | `node build.mjs` | clean, 4 bundles, 12ms |
| Branch | `git rev-list --count main..buki-pro` | **49** ahead, not merged |
| Working tree | `git status --porcelain` | clean but for this session's two ledgers |
| Tracked files | `git ls-files \| wc -l` | 160 |
| `prefers-color-scheme: dark` in `docs/index.html` | `grep -c` | **6** (unchanged since 08-15) |
| Plan `2026-08-09-buki-pro.md` | `grep -c "^- \[x\]"` / `"^- \[ \]"` | **37 done, 48 open** |
| Flowy state | `flowy_state_dir` + state file | 2 overlays active: `superpowers`, `growth-marketing` |

## Beliefs overturned this session

### The mark is NOT defined once. The landing disagrees with the definition, in daylight.

**Believed** (`OPENWORK.md` §0, item 24, `docs/brand.md`, `tools/mark.mjs` header): the mark
is one drawing with measured colours, defined once in `tools/mark.mjs`, and
`src/shared/mark.test.ts` fails the build when a copy disagrees.

**Measured:**

| | |
| --- | --- |
| `tools/mark.mjs`, `grounds['landing, day']` | `caught: '#2f7fd6'` |
| `docs/index.html:237` | `--mark-caught: light-dark(#7cc0fd, #1231a8);` |

Contrast re-derived with the repo's own `contrast()` from `tools/mark.mjs`, not recalled:

| Value on `#fbf7ec` paper | vs the paper | vs the shelved spines `#0a0f33` |
| --- | --- | --- |
| `#7cc0fd` (what the landing ships by day) | **1.81:1** | 9.58:1 |
| `#2f7fd6` (what the definition declares) | 3.83:1 | 4.54:1 |

`#7cc0fd` is the exact literal `tools/mark.mjs`'s own header names as the bug that
"shipped as a hardcoded `#7cc0fd` in three of them, one of which measured 1.81:1 on its
own ground." Three of the four cream grounds — `popup.html`, `options.html`,
`icons/icon.svg` + `docs/icon.svg` — were corrected to `#2f7fd6` on 2026-08-15. **The
landing is the one that was missed**, and it is the surface with the largest audience.

**Why `mark.test.ts` cannot see it.** The test does two things and neither closes the gap:

1. The contrast assertions iterate `MARK.grounds` — data *inside* `mark.mjs`. They prove
   the declared table is self-consistent. They never read a colour out of any surface.
2. The "same coordinates everywhere" check greps the six surfaces for a `geometry` array
   holding `x=`, `rotate(`, and the cord `y=` values. **No colour is in that array.**

So the six surfaces are asserted to agree on *shape* and the table is asserted to be
internally sound, and nothing ties the two together. `landing, day` was added to the table
with the corrected value while the stylesheet kept the old one.

**Why it matters at the size it actually renders.** The corrected metric from 2026-08-15
(caught-vs-shelved ≥ 3:1, shelved-vs-ground ≥ 4.5:1) does pass for `#7cc0fd`, so this is
not a contrast-bar failure. It is a *reading* failure at scale: the mark is 25px in the
pill and 22–26px inline. At 25px each spine is about 4.75px wide. A caught spine at 1.81:1
against the cream between it and its neighbours reads as the **gap** between two dark
spines rather than as a third book — which collapses the mark back to the two-spine
drawing item 24 exists to have eliminated.

### `.agents/product-marketing.md` v5 contradicts itself and the system

Four claims in it are expired, and it is the file the growth-marketing overlay routes every
copy task through, so copy written from it today reintroduces retired positioning:

| It says | Measured |
| --- | --- |
| "Maximo supplied his own mark … it has **two** spines, not three … The story needs rewriting" | Resolved 2026-08-15. Three spines. `OPENWORK.md` item 24: "the brand story never needed rewriting and the icon set was never stale" |
| "**Type:** Petrona at 800 for display, Instrument Sans for text" | Manrope, one family. Contradicted by its own paragraph four lines above it |
| "The landing is on a third generation … and the extension is not" | `docs/brand.md` table: every surface is third generation |
| "The in-page catch tray is not [one system], deliberately" | Caught up 2026-08-15, item 21. The deliberate exceptions are now only *opacity* and *the webfont*, not the system |

### Two shipped artefacts still carry the X-only pitch

Both are outside `docs/store/`, so item 17 as written does not cover them:

- `manifest.json:5` — `"Catch books you see on X into your own shelf…"`. This is the string
  Chrome shows in the extensions list and the Web Store reads.
- `README.md:149–151` — "The catch tray still renders on the first-generation design
  system … `OPENWORK.md` item 21." Item 21 closed 2026-08-15.
- `README.md:13` — "**48 commits ahead**". Measured 49.

### I was wrong about WHY the mark value had to change, and the shape of the error is the reusable part

**Believed, and written into a commit message, `docs/brand.md` and `OPENWORK.md`:** that
`#7cc0fd` at 25px "reads as the gap between two dark spines rather than as a third book",
because it measures 1.81:1 against the cream.

**Measured:** rendered at 16, 24, 25, 28, 40 and 120px on the real ground, it is a pale blue
spine between two near-black ones, clearly, every time. The claim was false.

**Root cause:** 1.81:1 is the caught spine against the *page*. The spine is flanked, so what
the eye uses is its contrast against its *neighbours*, which is 9.58:1. **The 2026-08-15
session had already established exactly this** and threw out a caught-versus-ground bar for
scoring the working night mark below the broken cream one. I re-derived the discarded metric
from a ratio a day later, without rendering it. Twice now, in two sessions.

**What survives:** the change itself was right for a reason that was always sufficient.
`tools/mark.mjs` is the single definition, it declares `#2f7fd6` for every cream ground, and
three of the four already agreed. The test gap it exposed is real and is closed.

**What it produced:** `tools/mark-sizes.mjs`, so the next argument about a value starts by
looking at it. And a checklist line in `brand.md`: *a contrast ratio only answers about the
pair you chose to compare.*

### The switch was inert when first wired, and the test I had just written could not see it

**Believed:** `color-scheme: light dark` plus `light-dark()` per token plus a button that
writes `data-theme` is a working theme switch.
**Measured**, with a synchronous probe in the popup harness: `data-theme=light`,
`stored=light`, body background `rgb(8, 13, 32)` — the **night** value.
**Root cause:** `color-scheme: light dark` says the surface *understands* both moods;
`light-dark()` then follows the operating system and nothing else. Without
`:root[data-theme="light"|"dark"] { color-scheme: … }`, `data-theme` is an attribute nobody
reads. The button flipped it, the label updated, and the panel did not move.
**Why the test missed it:** it asserted the mechanism was **available**, never that it was
**wired**. That is the same gap as the mark test's, one layer up: a guard that checks a
capability exists rather than that it is connected. Both are now asserted.

### The catch tray "needed nothing", and half a day later it needed its palette

**Believed**, written into `brand.md` and a commit on the same day: reviewed on all five
grounds, the tray needed nothing, and *"retouching the newest surface to look busy is how a
pass undoes itself."*
**Measured** the moment the popup went to iOS neutrals: a navy card floating over a neutral
panel reads as two different apps.
**What was right and what was wrong.** Its *structure* genuinely needed nothing — the
shadow, the cord gaps, the jade tag and the empty state all held. Its *palette* was never
its own to keep. **A surface can own its layout and not own its palette**, and "leave the
newest work alone" is a good instinct that does not survive a system-wide relight.

### `reflow`'s interruption was not a race, it was the normal path

**Believed:** an overlap needs two catches to collide in an unlucky window.
**Measured**, from the constants: `TRAVEL_MS` 280, and the two reflows that interrupt it
fire at `SWAP_MS` 115 and `LEAVE_MS` 200. Both are *inside* the travel by construction, so
any second catch arriving while the first settles re-enters `reflow`.
**Why it mattered to the fix:** a rare race invites a guard or a retry. A structural one
demands the arithmetic be correct, which is what `travelFrom` does.

### A cap sized for one shape had been silently truncating another

**Believed:** `MAX_BOOKS = 8` protects the reader from a card of fifty decisions.
**Measured:** a photograph of about twenty titles produced **seven** — eight taken,
grounding dropped one. And `groundText` returned the first grounding line's results and
stopped, which is a single-book finder.
**The reusable part:** both caps were correct for the shape they were written against (a
photographed shelf; OCR of one cover). Neither knew about a post that lists twenty books.
**Write down the shape you sized a cap against**, so the next shape is a question rather
than a silent loss.

### A decision's justification can expire without the decision looking stale

**Believed:** `coverSources` prefers the photograph over catalogue art for a measured
reason — on 2026-08-06 the top three hits for "Dune Frank Herbert" were *Children of Dune*,
*God Emperor* and *Heretics*.
**Measured:** that was the **match** being wrong, and `rank` + `strayWords` was written
later to fix exactly it. `coverUrl` belongs to the record that *won* that ranking, not to a
fresh relevance search.
**So the sentence still read true and its premise had gone.** Reversed on Maximo's call.
Because it is a read-time rule it re-covers every book already on the shelf, which is the
intended effect.

## Instruments that lied

| Instrument | How it lied | What to do instead |
| --- | --- | --- |
| **A `file://` screenshot of the popup harness** | Chrome disables `localStorage` on a file origin. `theme.ts` correctly catches the throw and falls through to the OS, which is dark here, so BOTH moods photographed identically and the seed never existed. The two PNGs differed by 80 bytes | Serve it: `python -m http.server`, then a real origin has a real store |
| **A contrast ratio, for a flanked element** | 1.81:1 against the ground reads as a failure and is the wrong pair. Against its neighbours it is 9.58:1, and the neighbours are what the eye uses | `node tools/mark-sizes.mjs`. Render it, then argue |
| **My own probe, on the first pass** | Reported `label="Switch to dark"` under `data-theme=dark`, which looked like a bug. It was the probe running at parse time, before `theme.ts` wires the button on `DOMContentLoaded` | Print both readings. It corrects to "Switch to light" after ready |
| **The tray harness, on the font** | It renders the stylesheet read out of `content.ts` and never runs the script, so after Manrope was registered at runtime with `FontFace` the preview still showed the system fallback — reading as a regression that was not there | The harness now loads the same file from disk, so the preview is honest |
| **A `DOMContentLoaded` + `setTimeout` probe** | Never fired under `--virtual-time-budget`; the readout rendered as an empty bar. This is the trap `OPENWORK.md` §5 already records, walked into anyway | Report synchronously at the end of `<body>`, against markup that does not wait on a paint |
