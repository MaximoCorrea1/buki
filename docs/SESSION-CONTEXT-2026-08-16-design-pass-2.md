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

## Instruments that lied

_(none yet this session)_
