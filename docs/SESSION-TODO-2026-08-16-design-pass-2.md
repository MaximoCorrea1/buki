# Session TODO — 2026-08-16 — design pass 2

Forget-nothing ledger. Markers: `[ ]` open · `[x]` done+verified · `[~]` in progress ·
`[?]` needs a founder decision · `[!]` blocked.

Reasoning lives in `docs/SESSION-CONTEXT-2026-08-16-design-pass-2.md`. Work that must
survive this session gets folded into `OPENWORK.md`.

## Standing (carried forward by pointer)

- `OPENWORK.md` §0 — the doc-ownership map. Read before looking for any file.
- `OPENWORK.md` items 1–24. **Re-probed 2026-08-16, not inherited:** 344 tests / 37 files
  green, `tsc` exit 0, build clean, **49** commits ahead (the file says 48).
- Maximo's three, unchanged and still the whole critical path: **1** (Polar), **2** (five
  Vercel variables), **3** (the eight-check browser pass).

## Ledger

- [x] Activate Flowy overlays (superpowers, growth-marketing) — state file verified
- [x] Read the 2026-08-15 design-pass handoff in full
- [x] Create both session ledgers, print both paths
- [x] Read the system: 160 tracked files, every contract doc, the spec, the plan headings,
      all four design surfaces, the mark definition and its test
- [x] Re-probe the status lines rather than inherit them (table above)

### Found this session, none of it blocked

- [ ] **A. The landing's caught spine is `#7cc0fd` in daylight; the definition says
      `#2f7fd6`.** `docs/index.html:237` against `tools/mark.mjs` `grounds['landing, day']`.
      1.81:1 on the paper, measured. The other three cream grounds were corrected on
      2026-08-15 and the landing was missed. **The mark is not defined once.**
- [ ] **B. `mark.test.ts` has a colour-shaped hole.** Its geometry check greps `x=`,
      `rotate(` and the cord `y=` out of six surfaces; no colour is in that array. Its
      contrast check runs over `MARK.grounds` — data inside `mark.mjs`, never a surface.
      Nothing ties the declared table to the shipped stylesheets. Finding A is exactly what
      it was written to stop.
- [ ] **C. `.agents/product-marketing.md` v5 is four claims stale and self-contradictory**
      (two spines / Petrona+Instrument / extension not third-gen / tray not one system).
      Higher stakes than a normal doc: the growth-marketing overlay routes every copy task
      through it.
- [ ] **D. `manifest.json:5` still advertises the X-only product.** Shipped artefact, not a
      doc, so `OPENWORK.md` item 17 does not cover it.
- [ ] **E. `README.md` says the tray is first-generation (item 21, closed) and 48 commits
      ahead (measured 49).**
- [?] **F. `docs/superpowers/specs/2026-08-09-buki-pro-design.md` carries no STALE banner**
      while `DESIGN.md`, `docs/store/listing.md` and `docs/store/permissions.md` all do.
      Its tier table says export is Pro-only and §6 says export is "listed as a Pro feature";
      both were resolved on 2026-08-13. Maximo's call whether a dated spec earns a banner.
- [ ] **G. `docs/pricing.md` says "Last updated: 2026-08-11"** but its export lines were
      corrected on 2026-08-13. The content is right and the stamp is not.

### Carried from 2026-08-15, still open

- [ ] The plate quote's dead `font-style: italic` was one instance. **One grep for other
      dead declarations was never run.**
- [ ] `icons/icon48.png` is generated and referenced only in `manifest.json`. Harmless.
- [ ] **17 (half).** The permission justifications for `scripting` / `activeTab` /
      optional host can be written NOW; the table is already in `OPENWORK.md` §3. Only the
      data-usage declaration waits on the proxy.
- [!] **1, 2, 3, 9, 10–18** — Maximo's, or waiting on Maximo's.
- [?] **19.** Merge `buki-pro` → `main`. 49 commits. Maximo's call on timing.

## Checkpoint log

- **2026-08-16, session open** — ledgers created; full read of the system done.
- **2026-08-16, after the read** — status re-probed (all green, 49 not 48); seven findings
  recorded above, A and B being the two with teeth.
