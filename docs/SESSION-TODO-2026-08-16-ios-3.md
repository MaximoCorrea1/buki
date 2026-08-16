# Session TODO — 2026-08-16 — iOS pass 3

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

- [x] **1. The paint moved off the root.** `popup.html` gained `.win`; the scrim restates
      the radius so opening a book does not square the corners off. `options.html` is a
      full tab and deliberately keeps none of it, guarded by its own test. Verified on the
      REAL popup.html in both moods: corner pixel `rgba(0,0,0,0)`, masthead `#f2f2f7` by
      day and `#000000` at night.
- [x] **2. The card's list is bounded** at `min(50vh, 380px)`. Three books do not scroll;
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

- [ ] **Verify in a real Chrome popup** what is painted OUTSIDE the radius. The canvas is
      deliberately transparent now, so that area is Chrome's own base and should follow
      `color-scheme`. Nothing here can prove it: `--load-extension` is refused. In item 3.
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
