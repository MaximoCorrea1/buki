# Session TODO — 2026-08-18, hardening the paid tier

**Pair:** `docs/SESSION-CONTEXT-2026-08-18-pro-hardening.md`.

Markers: `[ ]` open · `[x]` done+verified · `[~]` in progress · `[?]` founder decision ·
`[!]` blocked.

## Standing, carried forward BY POINTER

`OPENWORK.md` is where work survives. Live status of what this session touches:

| Item | State |
| --- | --- |
| **27** the renewal spends a slot a day | `[!]` **blocks launch**, and outranks 1 and 2 |
| 28 `/api/license` unthrottled | `[ ]` same change as 27 |
| 29 `proState` has no write queue | `[ ]` |
| 26 spend cap on the Gemini key | `[ ]` Maximo, in Google Cloud |
| 1, 2 Polar product + Vercel variables | `[~]` products created 08-17; token being rotated |
| 3, 9 by-hand browser pass, screenshots | `[ ]` Maximo, cannot be automated |
| 25 is the ghost fill filled enough | `[?]` |

## Raised and answered, 2026-08-18

- [x] **Polar re-checked with context7.** The P0 holds and sharpens. Two endpoint families;
      `activate` costs a slot every call and is optional without an activation limit;
      `validate` is per-session and takes the `activation_id`. Written up as
      `polar-setup.md` §2.1. **Do not set `increment_usage`** — it would create a second
      hidden limit disagreeing with `entitlement.ts`.
- [x] **Redis or a DB? Neither, for user data.** A KV of ephemeral counters is what items 26
      and 28 want. Reasoning in the context doc.
- [x] **Hundreds of books: measured, 398 bytes each.** 1,000 books is 3.8% of the quota.
- [x] **Request efficiency swept.** `createLookupMemo` dedupes concurrent catches, covers are
      fetched once and pruned off the shelf by `pruneCovers` (verified it has a caller,
      `popup.ts:128` — the first grep used the wrong name and found nothing, which would
      have been a false alarm).
- [x] **Five-agent review run and merged.** Fixed: `wirePro` hoisted to module scope, the
      relink chained before `sendResponse`, two brittle tests rebuilt structurally, two
      `markRestored` cases added. Recorded not fixed: items 27, 28, 29.

## Open, 2026-08-18

- [x] **ITEM 27 FIXED.** Activate once, persist the `activation_id`, validate daily. The
      handler branches on whether an id arrived; the id travels back in the response;
      `ProState` persists it; `ensureSession` and the options page both hand it over.
      **The two Polar response shapes are inverted** and reading one as the other 403s every
      renewal, so the schema was fetched rather than assumed.
      **It was nearly undone at the wiring:** `background.ts` supplied
      `exchange: (key) => ...` and an arrow with fewer parameters is assignable in
      TypeScript, so it compiled, passed every test, and dropped the id. Both call sites
      forward it now, asserted in `proState.test.ts`.
- [x] **THE MOTTO IS LOCKED** and live in the hero, rendered and looked at.
      *"Find any book you see online, instantly. Buki reads the cover, not the caption, and
      saves it so you never forget a book you wanted to read."* Plus
      *"Ten catches free. No account, no sync. Your shelf never leaves your browser."*
      `docs/brand.md` owns the wording; `.agents/product-marketing.md` v10 points at it.
      **Maximo chose the shelf-scoped privacy line** and framed the true version himself:
      *"the user data never touches our server"*. Correct, and it is what the line says.
- [x] **The honesty problem inside it, resolved.** Maximo: *"since all of this is self
      hosted. no server, no data. we should add that our motto as well. main one is find any
      book you see online instantly find and save"*. The main line is good. **"No server, no
      data" is not true of the whole product** and must not ship as written: reading a cover
      contacts a server, ours by default. It IS true of the shelf. A tagline is locked copy
      per `docs/brand.md`, so the wording is a founder decision.
- [ ] **`authorName()` is an N+1.** One extra request per book to turn an OpenLibrary author
      key into a name. Batch it, or drop the follow-up.
- [ ] **The `?raw` guard's blind spot.** Extract `handleSaveBook(msg, deps)` in the
      `(request, env) => response` shape `src/server/` already uses, so the call can be
      spied on instead of string-matched. `OPENWORK.md` §5.
