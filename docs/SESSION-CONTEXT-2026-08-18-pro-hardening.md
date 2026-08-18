# 2026-08-18 — hardening the paid tier before it can be switched on

**Pair:** `docs/SESSION-TODO-2026-08-18-pro-hardening.md`.
**Previous pair:** `docs/SESSION-CONTEXT-2026-08-16-ios-3.md` (it carries both 08-16 and
08-17). `OPENWORK.md` §0 warns that filename order is not a reading order.

## What was asked

1. A light multi-agent review of the 08-17 work ("4 agents, maybe 1 more").
2. Re-check Polar's documentation with context7.
3. Redis or a database, for minimal user data?
4. Do hundreds of books hurt `chrome.storage.local`?
5. Are the requests efficient — cover requests especially?
6. Start a dev server for the landing, and add a motto.

## Measured, with the probe beside it

| Measurement | Probe | Value |
| --- | --- | --- |
| One typical `SavedBook` | `JSON.stringify` of a realistic record (long title, ISBN, x.com source, pbs.twimg shot) | **398 bytes** |
| One short `SavedBook` | same, "Dune" | 323 bytes |
| 1,000 books | 398 x 1000 against a 10MB quota | **389 KB, 3.80%** |
| 5,000 books | same | 1,943 KB, 18.98% |
| Books to fill the quota | derived | roughly **26,000** |
| Recognition log ceiling | `MAX_EVENTS` in `recognitionLog.ts` | **200 events**, ring buffer |
| Test suite | `./node_modules/.bin/vitest run` | **536 across 53 files** |

## Beliefs overturned

### The renewal loop spends a licence slot every day

**Believed:** the paid tier's client half was complete and correct; `ensureSession` renews a
session daily and that is routine.

**Measured**, first by an adversarial reviewer and then re-checked against Polar's own
documentation via context7: `activate` **creates an activation** every time it is called,
and it is the **only** Polar endpoint this codebase calls. `validate` is the "for each
session" call, takes the `activation_id` that activate returned, and creates nothing.

So a subscriber burns one of five slots per day of use and is shown the wall on day five.
`OPENWORK.md` item 27; the contract is in `docs/superpowers/polar-setup.md` §2.1.

**The premise was already written down here.** `polar-setup.md` §7 said *"Each `curl`
consumes one of the five activation slots on that key"* — the same call the extension makes
daily. The fact was recorded and the conclusion was never drawn.

### A `?raw` source-text guard cannot see control flow

**Believed:** `expect(background).toContain('markRestored')` is a reasonable stand-in for a
file that cannot be imported.

**Measured** by a reviewer mutating the source and re-running: wrapping the call in
`if (false && ...)` left the suite green, and **swapping the arguments — which reverses
every undo — left all 533 tests green.** The guard proves two identifiers exist in a file.

### A comment can name the right lesson from the wrong side of the guard

**Believed**, and written into `options.html` on 08-17: the licence section is wired
independently of `main()`'s provider guard.

**Measured:** `void wirePro();` sat *inside* `main()`, below a guard on seven provider ids.
The comment cited the theme switch's two days inside a `prefers-reduced-motion` guard as
the reason it was safe. Now at module scope, asserted at column 0.

## Decisions worth not re-deriving

- **No database, and no user data.** Identity requires accounts, and "no account, your shelf
  never leaves your browser" is in the listing, the landing and the privacy policy. What the
  open items actually want is **ephemeral counters with a TTL** for rate limiting (items 26
  and 28) — no PII, no schema, no migration, nothing to export or leak. That is a KV, not a
  database, and the distinction is the whole point.
- **Storage is a non-issue and three earlier decisions are why:** cover bytes live in the
  Cache API rather than `chrome.storage.local`, the recognition log is a 200-event ring
  buffer, and `shot` stores a URL rather than image bytes. Checked specifically that a
  `data:` URL cannot reach a saved record — it cannot; those exist only for the tray's
  `<img>`, are capped at 512KB, and are never persisted.
- **The one real request inefficiency is `authorName()`**, an extra HTTP call per book,
  because OpenLibrary's search returns an author *key* rather than a name. A photograph of
  twenty books can mean twenty sequential follow-ups. It already degrades to a nameless book
  rather than failing the catch.
