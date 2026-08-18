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


---

# The five-agent review, in full

Run 2026-08-18 at Maximo's request ("a light 4 agent review... maybe add 1 more"). Five
personas, deliberately fewer than `ce-review`'s default: `project-standards-reviewer` and
`learnings-researcher` were SKIPPED because `OPENWORK.md` §0 records that this repo has no
`CLAUDE.md`, `AGENTS.md` or `docs/solutions/` for them to read.

**Every finding is listed, including the ones not fixed.** An unrecorded finding is a
finding that gets rediscovered at the cost of another review.

| # | Reviewer(s) | Severity | Finding | State |
| --- | --- | --- | --- | --- |
| 1 | adversarial | **P0** | Daily renewal calls Polar `activate`, spending one of five slots per day; subscriber sees the wall on day five | **FIXED** (`cdda054`) |
| 2 | security **+** adversarial | P1 | `/api/license` has no rate limit; Origin is forgeable, so five requests exhaust a leaked key's slots | **OPEN — item 28** |
| 3 | adversarial | P1 | `proState` has no write queue; two catches double-spend a slot and one travels with a stale state | **OPEN — item 29** |
| 4 | adversarial | P1 | `/api/vision`'s IP cap is per-isolate and leaks by design; only real brake is a provider spend cap | **OPEN — item 26** |
| 5 | correctness | P2 | `wirePro()` sat inside `main()`, below a guard on seven unrelated provider ids | **FIXED** (`1357c76`) |
| 6 | kieran-ts **+** correctness | P2 | `markRestored` fire-and-forget before `sendResponse`, where the sibling `markWrong` chains | **FIXED** (`1357c76`) |
| 7 | testing | P1 | The `?raw` source guard cannot see control flow; an argument swap passed all 533 tests | **OPEN — item 30** |
| 8 | testing | P2 | `optionsPage.test.ts` order checks ran over raw HTML including comments | **FIXED** (`1357c76`) |
| 9 | testing | P2 | Pill-shape rule found by a magic padding value rather than by selector | **FIXED** (`1357c76`) |
| 10 | adversarial **vs** correctness | P2 | `markRestored`/`markWrong` match EVERY event sharing a `savedId`. **Reviewers disagreed** | **DECIDED + tested** |
| 11 | security | P3 | Polar's differentiated error text relayed through, so a caller learns a key's *state* | **OPEN — item 31** |
| 12 | security **+** adversarial | — | The grace window keeps a refunded customer served for up to ~8 days | **ACCEPTED — §6** |
| 13 | adversarial | — | No partial brake for Pro traffic; the only lever is deleting the provider key, which 500s everyone | **ACCEPTED — §6** |
| 14 | correctness | — | A failed `markRestored` is permanent and un-retried | **ACCEPTED — §6** |
| 15 | kieran-ts | — | `restoreOf` is an optional string; nothing stops a future caller passing a stale id | **ACCEPTED — §6** |

## The disagreement, and how it was settled

Finding 10 split the panel. **Correctness** called the multi-match clean and consistent with
`markWrong`. **Adversarial** called it P2 state corruption. **Testing** was right about the
framing: *"an accident of the map, not a decision."*

Settled in favour of multi-match, and now carrying a test that says so: `library.add` reuses
an id when `sameBook` matches, so two attempts can legitimately share one shelf slot. A
`savedId` names a SLOT. If the book in that slot was wrong, then every attempt that produced
it was wrong; restoring it makes every one of them right again. Flagging one and not its
twin would be the incoherent state.

## What the reviewers verified CLEAN, which is worth as much as the findings

- No server secret appears under `src/extension/` or in any response body or header, and
  `visionHandler` strips upstream headers before relaying.
- `policy.ts`'s null-vs-empty Authorization distinction is intact and still tested.
- Every refusal path in both handlers lands BEFORE the outbound fetch, so a refusal costs
  neither quota nor an activation slot.
- `delete restored.wrong` is sound under `strict` (the field is optional) and is the right
  idiom for `chrome.storage` — better than `undefined`, which would be stored.
- The `restoreOf?` addition is an additive property on an existing union member, so no
  discriminant or narrowing site broke.
- `licenseHandler` importing `fromExtension` from `policy.ts` is the correct direction with
  no cycle: `policy.ts` was already the shared module.
- No `any`, unsafe cast, or non-null assertion was introduced this session.
- Ruled out by attack: ring-buffer eviction before an undo (safe no-op), double-undo (the
  button disables synchronously AND `sameBook` makes a duplicate harmless), and
  `BUKI_TRIAL_CLOSED` failing open (nothing without a verified HMAC can reach `kind: 'pro'`).

## Instruments that lied, this session

| Instrument | How it lied | Instead |
| --- | --- | --- |
| `expect(background).toContain('markRestored')` | Passed with the call in `if (false && …)` dead code, and passed with the arguments REVERSED | Extract a handler and spy on the call. Item 30 |
| `indexOf` over raw `options.html` | One comment naming `id="key"` flipped two order assertions with no element moved | Strip comments and the `<style>` block first |
| A CSS rule matched on `padding: 11px 20px` | Changing only the padding failed the test with a message about the anchor | Match on the SELECTOR |
| My own `grep` for the cover sweep | Searched `sweepCovers`/`forgetCover`; the function is `pruneCovers`. Nearly reported a phantom dead declaration | Grep the exported name, not a guess at it |
| TypeScript, on the renewal adapter | `(key) => …` is assignable to `(key, activationId?) => …`, so dropping the id compiled and passed 548 tests | Assert the parameters, or restructure |
