# Session TODO — 2026-08-15, the design pass

**The forget-nothing ledger.** Every task, idea and aside raised this session, with a
marker. Appended as said, not summarised at the end.

`[ ]` open · `[x]` done+verified · `[~]` in progress · `[?]` needs Maximo · `[!]` blocked

> Status that must SURVIVE this session lives in `OPENWORK.md`. This file is the capture;
> that file is where work survives.

---

## Raised and closed

- [x] Finish the landing below the hero — OPENWORK item 23
- [x] Three measured dark-mode contrast failures (`.plan` 2.93:1, `.plan.pro` 1.04:1,
      `.flag` 2.70:1); `landingTokens.test.ts` now fails the build on a literal
- [x] Close the page on the hero's plate
- [x] Promote every sentence to `--ink`; darken `--ink-2` to 12.37:1
- [x] One centred axis for every band
- [x] Four uses of the artwork — hero, plate band, pricing, close
- [x] Glass pricing cards, measured against the plates' sampled extreme pixels
- [x] **No light mode** — root-caused, fixed, guarded (`landingTheme.test.ts`)
- [x] `forgot` and other faded text → the accent
- [x] Hero centred; then the *headline text* centred (`text-align`, not margin)
- [x] Secondary CTA readable on the plate in both moods (the ring carries it)
- [x] Pill narrowed 1220px → 940px
- [x] Step copy: name the situation first
- [x] Drawn boards read as bindings (cords were ~2:1)
- [x] Pricing: Pro's footnote implied the button charges you
- [x] SEO: "Chrome extension" in title/description/first-100-words, `max-image-preview:large`,
      enriched `SoftwareApplication` schema
- [x] `realLLOGO.png` → the three-spine mark, redrawn as geometry, defined once in
      `tools/mark.mjs`, asserted across six surfaces
- [x] Toolbar icons regenerated — they were the **first-generation** mark
- [x] Extension to third generation: popup + options (Manrope, contrast, capsules,
      segmented control, −49KB of fonts)
- [x] Catch tray to third generation — OPENWORK item 21, the last surface
- [x] `fonts.test.ts` — a dangling `@font-face` fails silently to `system-ui`
- [x] `contentChrome.test.ts` — the tray must stay opaque on a page we do not control
- [x] Authored + invoked the `maintaining-project-docs` skill
- [x] Session ledgers created; doc-ownership map written into `OPENWORK.md` §0

## Asides worth not losing

- [x] `docs/type.html`, `docs/_type/`, three `.woff2` — deleted, `docs/` 4.3MB → 3.6MB
- [x] `.hero-below`, `.lede`, `.actions` — dead CSS from the first rebuild
- [x] `summary:hover` ungated **under a comment claiming the sweep was done**
- [x] `.why` spine restated the card's radius and read pinched
- [x] `raw.d.ts` gained a keys-only `import.meta.glob` overload
- [x] The `prefers-color-scheme: dark` count moved 5 → 6; both docs now say COUNT them
- [ ] **The plate quote's `font-style: italic` was a silent no-op** for as long as the
      family has been Manrope. Worth one grep for other dead declarations
- [ ] `icons/icon48.png` is generated but referenced in `manifest.json` only — no surface
      renders it. Harmless, noted

## Open, and who owns them

- [!] **1. Polar product** — Maximo. Gates all of Part 3
- [!] **2. Five Vercel env vars** — Maximo. Gates all of Part 3
- [!] **3. Manual browser pass, 8 checks** — Maximo. No agent can ever tick it
- [!] **9. Web Store screenshots** — waits on 3
- [!] **10–18. The paid tier** — waits on 1 and 2
- [ ] **17. Store docs** — the permission justifications are writable NOW; the data-usage
      declaration must wait for the proxy. Split it
- [?] **19. Merge `buki-pro` → `main`** — 48 commits. Maximo's call on timing

---

## Checkpoint log

| # | Marker | What |
| --- | --- | --- |
| 1 | ✅ | Landing below the hero committed (`3b10199`) |
| 2 | ✅ | Second pass: contrast, axis, four plates (`785ee03`) |
| 3 | ✅ | Extension caught up, −49KB fonts (`02af036`) |
| 4 | ✅ | Light mode fixed; three-spine mark restored (`c13a75d`) |
| 5 | ✅ | Mark defined once; toolbar icons were the wrong logo (`f840190`) |
| 6 | ✅ | Catch tray — the last surface (`48b3dd2`) |
| 7 | ✅ | Doc reconciliation, this pass |
