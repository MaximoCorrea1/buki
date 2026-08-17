# Session TODO — 2026-08-16 → 17 — iOS pass 3, then the catcher

*(2026-08-17 continues in this ledger rather than a fourth pair: it is the same thread of
work, and `OPENWORK.md` §0 warns that filename order is not a reading order.)*

Forget-nothing ledger. Markers: `[ ]` open · `[x]` done+verified · `[~]` in progress ·
`[?]` needs a founder decision · `[!]` blocked.

Reasoning lives in `docs/SESSION-CONTEXT-2026-08-16-ios-3.md`. Work that must survive this
session is folded into `OPENWORK.md`.

## Standing (carried forward by pointer)

- `OPENWORK.md` §0 — the doc-ownership map. Read before looking for any file.
- Maximo's three, unchanged and still the whole critical path: **1** (Polar), **2** (five
  Vercel variables), **3** (the browser pass, 13 checks and now more — see below).
- The landing and the extension are on DIFFERENT design generations on purpose.
  `docs/brand.md`, *The iOS turn*.

## Raised

- [x] Re-read both FLOW files after compaction; reload the two design skills
- [x] Create both session ledgers, print both paths
- [x] **1. The corners were never rounded.** Root cause found and MEASURED as a corner
      pixel, not argued: `body`'s background propagates to the canvas, which is painted
      square and is not clipped by any `border-radius`. Both declarations inert.
- [x] **2. The toast overlap.** Root cause found and measured. NOT the FLIP arithmetic —
      an interrupted slot teleports 0.0px, so `f386fa9` was correct. The overlap is the
      transient one inherent to holding the stack back while the new card lands, and its
      magnitude is the new card's height. `MAX_BOOKS` 8 → 20 made a card 680px.
- [x] **Refuted and thrown away before committing:** `.buki-slot { flex: none }`. Rendered
      A/B, both `slotH = cardH = 448.6`. A flex item's automatic minimum size already
      prevents the shrink.

- [x] **1. The paint moved off the root — SUPERSEDED 2026-08-17, see below.** The CSS was
      right and the measurement was right (corner pixel `rgba(0,0,0,0)`), and it still made
      the popup worse, because what it uncovered was Chrome's own square bubble. Kept
      because the mechanism it established is what let the real answer be reached in one
      step the next day.
- [x] **2. The card's list is bounded** at `min(54vh, 420px)` (was 50vh/380px until the
      intent row grew a line on 2026-08-17 — the bound is a function of the row height). Three books do not scroll;
      twenty scroll inside the card and the head and *Save all* stay put. Verified by
      render: 3, 5 and 20 books all produce the same card height.
- [x] **3. The iOS pass.** Two more materials, both measured first: `--fill` (Apple's
      `systemFill`) under the segmented track, the search field and the sheet's close
      button; and the sheet card itself at 86%. `--muted` re-derived against four grounds.
- [x] **New checks folded into item 3**: the corner check rewritten (it described the wrong
      mechanism), and a twenty-book catch added.
- [x] **A second false finding killed by measurement.** The footer looked amber in a dark
      screenshot. Sampled: `rgb(191,111,0)` and `rgb(0,111,191)` on opposite glyph edges —
      LCD subpixel fringing on white text at 11.5px on black. **The 2026-08-16 pass-2
      conclusion that this was an artifact was correct**; reading the image was not enough.

## Open

- [x] **Verify in a real Chrome popup what is painted OUTSIDE the radius.** Maximo looked,
      2026-08-17: an opaque square container. Answered by the one instrument that could.
- [ ] The plate quote's dead `font-style: italic` was one instance. **The grep for other
      dead declarations is still never run.** Carried from pass 2.
- [ ] **The rest of item 17:** `docs/store/listing.md`, and its `Single purpose` field
      first. Carried from pass 2.
- [?] **F.** `docs/superpowers/specs/2026-08-09-buki-pro-design.md` still carries no STALE
      banner while three other superseded docs do. Carried from pass 2.
- [?] **19.** Merge `buki-pro` → `main`. Maximo's call on timing.
- [!] **1, 2, 3, 9, 10–18** — Maximo's, or waiting on Maximo's.

## Checkpoint log

| # | Marker | What |
| --- | --- | --- |
| 1 | ✅ | FLOWs re-read, design skills reloaded, ledgers created |
| 2 | ✅ | Corners root-caused by corner-pixel A/B; radius proven inert |
| 3 | ✅ | Flex-shrink hypothesis refuted by render; fix discarded unwritten |
| 4 | ✅ | FLIP invariant proven intact (0.0px); overlap traced to card height |
| 5 | ✅ | Both fixes written test-first, watched fail, then pass |
| 6 | ✅ | iOS pass: two new materials, `--muted` re-derived against four grounds |
| 7 | ✅ | Rendered and looked at: shelf, sheet, tray on five grounds with a 20-book card |
| 8 | ✅ | brand.md and OPENWORK.md updated in the same commit as the change |

## 2026-08-17 — the catcher, and six more reports

- [x] **THE MARK IS NOW THE CATCHER.** Maximo's ball-with-eyes replaces three spines on all
      six surfaces plus the rasteriser. Every number SAMPLED from `icons/mark-source.png`,
      never redrawn. Passes 16px on both grounds, rendered before it was believed. The
      plate is gone because the ball needs no ground; `--mark-spine` and `--mark-caught`
      deleted with it.
- [x] **1. Rounded corners: they cannot be had, and Maximo was right.** Chrome's popup is a
      square native window painting its own opaque background. Yesterday's transparent
      canvas did not reveal a rounded window, it revealed CHROME'S square one with our panel
      inset inside it. Reverted to painting edge to edge: no seam, roundness lives inside.
- [x] **2. Remove a book FROM THE SHELF**, with an undo. It existed only inside the sheet.
      `restoreArgs` puts it back in the pile it was in, with the picture it was caught from.
- [x] **3b. Covers showed a colour.** ROOT CAUSE: the tray's `<img>` obeys the HOST page's
      CSP. Measured under `img-src 'self' data:` — cross-origin BLOCKED, data: LOADED,
      blob: BLOCKED. The worker now fetches and hands back a data: URL.
- [x] **3a. CTA text off centre.** Measured 1.00px high from `padding: 9px 0 10px`; now
      0.50px, which is the font's own asymmetry and below a device pixel.
- [x] **4a. Hard to scroll between toasts** — `overscroll-behavior: contain` on the inner
      list, added by me the day before. It belongs on the tray, not the list.
- [x] **4b/5. Copy.** "· unverified" removed; the head reads *Buki found N books in this
      picture*; the three actions carry the verb.
- [x] **The intent row moved to its own full-width line**, because three verb+noun labels
      clip across 250px. Took three measured attempts: `width: 100%` does not break a flex
      line, `flex: 1` forces equal widths, and the harness fixture had drifted.
- [x] **CRLF damage found and undone.** Python writes converted 13 files, which broke the
      tray stylesheet slice to -1 and made two green tests meaningless. Normalised; re-run.

- [x] **The pupils were missing at 16px** — on the toolbar and in the context menu, both
      of which use `icon16.png`. Measured: zero catchlight pixels at 16, six at 32, fifteen
      at 48. Cause was my own `size >= 32` gate, justified by a comment I never rendered.
      Rendered A/B at 16px: the catchlight reads, the gated version looks dead. Gate gone,
      and `src/shared/icons.test.ts` now decodes the shipped PNGs — red-green verified by
      re-adding the gate and watching it fail.

## Open, 2026-08-17

- [?] **The "Read" collision.** The tray now says *Read now / Read next / Read someday*
      while the shelf's fourth pile is called **Read**, meaning finished. Distinguishable in
      context, not distinct words. Renaming that pile to **Finished** would end it. Founder's
      call; noted in `src/extension/trayCopy.ts`.
- [ ] **Undo does not unflag the recognition.** `removeBook` marks the match wrong on the
      way out and nothing clears it on the way back in, so remove-then-undo leaves the kept
      rate one worse. One attempt in a rolling 200. Needs an unflag path through the log.
- [ ] **The tray harness renders with the FALLBACK font under headless file://**, so every
      width measured there is wider than what ships. Fine for catching overflow; wrong for
      judging type.
