# Session TODO — 2026-08-16 — design pass 2

Forget-nothing ledger. Markers: `[ ]` open · `[x]` done+verified · `[~]` in progress ·
`[?]` needs a founder decision · `[!]` blocked.

Reasoning lives in `docs/SESSION-CONTEXT-2026-08-16-design-pass-2.md`. Work that must
survive this session is folded into `OPENWORK.md`.

## Standing (carried forward by pointer)

- `OPENWORK.md` §0 — the doc-ownership map. Read before looking for any file.
- Maximo's three, unchanged and still the whole critical path: **1** (Polar), **2** (five
  Vercel variables), **3** (the eight-check browser pass, now nine — see below).

## Raised and closed

- [x] Activate the Flowy overlays; read the 2026-08-15 handoff in full
- [x] Create both session ledgers, print both paths
- [x] Read the system: 160 tracked files, every contract doc, the spec, the plan, all four
      design surfaces, the mark definition and its test
- [x] Re-probe every status line rather than inherit it
- [x] **The mark was defined once for shape and not for colour.** `tools/mark.mjs` said
      `#2f7fd6` for `landing, day`; `docs/index.html` shipped `#7cc0fd`. `cd5d6f2`
- [x] **Closed the hole in `mark.test.ts`.** It compared six surfaces for *shape* and
      `MARK.grounds` against *itself* for contrast, and never read a colour out of a
      surface. Proved to discriminate on all three declaration shapes
- [x] **Corrected my own claim from that fix.** See the CONTEXT doc. `a7d5eee`/`c76cf19`
- [x] **Item 17, the writable half.** `scripting`, `activeTab` and the optional host
      permission justified; the x.com answer no longer says "Buki only operates on these
      sites". `9e05ee9`
- [x] **Four stale docs and two shipped artefacts.** `product-marketing.md` v6,
      `manifest.json` + `package.json` descriptions, README, `pricing.md`,
      `competitor-profiles/_summary.md`. `7b8082f`
- [x] **The extension gets night.** popup + options, `light-dark()`, a switch in each,
      `theme.ts` as its own entry point. Overturns *Two materials, one identity*. `a7d5eee`
- [x] **Six colour literals tokenised BEFORE the palette moved**, named by a test written
      first. `extensionTokens.test.ts`
- [x] **A shelf that looks like a shelf.** The 3px hairline plank became a board with a lit
      edge and a cast shadow; books cast shadows and lift
- [x] **The catch tray: reviewed on all five grounds and it needed nothing.** `c76cf19`
- [x] **`tools/tray-harness.mjs` and `tools/mark-sizes.mjs` committed**, and README gained
      a table for all three harnesses

## The iOS turn, second half of the session

- [x] **Apple's neutrals top to bottom, true black at night.** Cobalt accent and the five
      dyes kept; the landing untouched. `a40e335`
- [x] **Departed from Apple on one value and said so:** iOS secondaryLabel is 4.30:1 on the
      light fill, which loses to "NO FADED FONTS". `--muted` clears 7:1 on its worst ground
- [x] **The selected pile never read as chosen** — 1.18:1 by day, 1.12:1 at night. Its own
      `--thumb` token now, carried by two shadows
- [x] **The sheet had two axes.** Rebuilt as one centred column; Buy is full width and names
      its destination; the pile control comes first
- [x] **A drawn cover broke mid-word** at 96px: *Fountainhe / ad*. `.stamp` is `cqw` now
- [x] **Transparency in exactly two places**, both real layers: the masthead and the scrim.
      Never the tray
- [x] `--mark-caught` collapsed to one value in both moods, measured and asserted twice
- [x] The tray's neutrals followed, on an elevated grey rather than true black
- [x] The popup harness can open the sheet (`#sheet`). It could not before, which is why
      none of this had been seen

## Open

- [ ] **A ninth check for item 3, added by this session.** Open the popup on a machine set
      to dark, press the switch in the top-left, reopen the popup. The mood must hold, and
      the setup page must agree. `localStorage` is the store and **no unit test can prove a
      real Chrome extension page persists it** — the harness proves it over http, which is
      not the same origin kind.
- [ ] The plate quote's dead `font-style: italic` was one instance. **The grep for other
      dead declarations was still never run.**
- [ ] `icons/icon48.png` is generated and referenced only in `manifest.json`. Harmless.
- [ ] **The rest of item 17:** `docs/store/listing.md`, and its `Single purpose` field
      first — "identifies books shown in posts on x.com" beside a manifest asking for
      `scripting`, `activeTab` and optional `https://*/*` is the contradiction a reviewer
      looks for. The data-usage declaration still waits on the proxy.
- [?] **F.** `docs/superpowers/specs/2026-08-09-buki-pro-design.md` still carries no STALE
      banner while three other superseded docs do. Its tier table says export is Pro-only.
      Maximo's call whether a dated spec earns one.
- [!] **1, 2, 3, 9, 10–18** — Maximo's, or waiting on Maximo's.
- [?] **19.** Merge `buki-pro` → `main`. Maximo's call on timing.

## Checkpoint log

| # | Marker | What |
| --- | --- | --- |
| 1 | ✅ | Ledgers created; full read of the system done |
| 2 | ✅ | Status re-probed, all green, 49 commits not 48; seven findings recorded |
| 3 | ✅ | The mark, and the colour-shaped hole in its guard (`cd5d6f2`) |
| 4 | ✅ | Four stale docs, two shipped artefacts (`7b8082f`) |
| 5 | ✅ | Permission justifications, item 17 split (`9e05ee9`) |
| 6 | ✅ | The extension gets night, and a board (`a7d5eee`) |
| 7 | ✅ | Tray reviewed on five grounds, harnesses committed (`c76cf19`) |
