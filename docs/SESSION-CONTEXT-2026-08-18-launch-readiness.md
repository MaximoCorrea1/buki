# 2026-08-18 (later) — launch readiness: three blockers, the till, and the store assets

**Pair:** `docs/SESSION-TODO-2026-08-18-launch-readiness.md`.
**Immediately previous:** `docs/SESSION-CONTEXT-2026-08-18-pro-hardening.md` — **same date,
different session.** That one covers the five-agent review, the item-27 renewal P0 and the
merge of `buki-pro` into `main`. This one is later and carries the live state.
`OPENWORK.md` §0 disambiguates them; filename order is not a reading order.

> **A HONEST NOTE ON THIS FILE.** `maintaining-project-docs` says to create the session pair
> before the first substantive tool call. **They did not exist for this session** and were
> written at the end, from the full record, on Maximo's instruction. Everything below is
> reconstructed from commits, tool output and the transcript rather than appended live, so
> treat the checkpoint log in the TODO as approximate on ordering and exact on content.

---

## What was asked, in order

1. Read the entire project, then continue the lane from the 08-18 pro-hardening handoff.
2. Work business, backend, features, efficiency, optimisation and design; act as senior
   engineer **and** as an Apple / German / Teenage Engineering designer. Close to launching.
3. (mid-session) Plan and do all three of: launch sequence + store listing, landing/pricing
   pass, video and screenshots prepared.
4. (mid-session) *"tell me what polar data you need and ill give it to you. i already have
   both products configured."*
5. (mid-session) The two checkout URLs, plus: *"check if we already have access token on our
   env vars as well as org id. for the gemini key"*.
6. (end) *"deleted that save-book-extension. now give me the variables to add on vercel. also,
   how do i deactivate observability on vercel? it seems its spending much money."*

**Standing instruction carried from the handoff and honoured:** no process overkill. For work
with a concrete brief, gate on direct questions rather than a spec-and-plan pair, and **say so
in the routing receipt rather than skipping silently.** `superpowers:brainstorming` and
`writing-plans` were declined explicitly on those grounds, every time.

---

## Measured, with the probe beside it

| Measurement | Probe | Value |
| --- | --- | --- |
| Test suite, session start | `./node_modules/.bin/vitest run` | **550 / 53 files** |
| Test suite, session end | same | **602 / 57 files** |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit` | exit 0 throughout |
| Build | `node build.mjs` | exit 0 throughout |
| Commits this session | `git rev-list --count d3e5923..HEAD` | **23** |
| Plan progress | `grep -c '^- \[x\]'` / `'^- \[ \]'` on `2026-08-09-buki-pro.md` | **68 done / 17 left** |
| Open numbered items | `grep -c '^- \[ \] \*\*[0-9]' OPENWORK.md` | **8**: 1, 2, 3, 9, 26, 35, 36, 37 |
| Vercel env vars set | `vercel env ls` | **zero.** "No Environment Variables found" |
| Vercel project serving the domain | `vercel project ls` | **`shelfy`**, not `buki` |
| Popup width vs store requirement | `grep width popup.html` vs `listing.md` | **560px** vs **1280x800** |
| Extension bundles | `ls -la dist/` | ~193KB across 5 files, **unminified** |
| Landing GitHub links | `grep -c 'github.com/MaximoCorrea1/buki' docs/index.html` | **8** — 5 install CTAs, 3 that must not move |
| Mark on X's grounds, best ramp stop | `tools/mark.mjs` `contrast()` | white **8.60:1**, dim **9.41:1**, lights-out **11.98:1** |
| Ghost fill, shipped vs candidate | same | `--sunk` 1.08:1 day / 1.15:1 night; `--board` **1.27 / 1.79** |
| New `--board-hi` hover step | same | **1.19:1** day, **1.28:1** night, away from the ground in both |
| Buy links on the Pro card | same | `--on-navy-accent` **6.89:1**, the line around it **10.73:1** |
| Label contrast on the new ghost | same | **11.19:1** day, **9.12:1** night |

---

## Beliefs overturned

### 1. Item 27 was fixed. It was not — the fix never ran.

**Believed:** `cdda054` closed the "activate once, validate forever" P0. Four places were
correct: the handler branches, the id travels back in the response, `writePro` stores it,
both call sites forward it.

**Measured:** `readPro` rebuilds a *sanitised subset* of `ProState` and was never extended,
so the activation id was written on every exchange and **dropped on every read**.
`ensureSession` handed `undefined` to the server, the server took the ACTIVATE branch, and a
subscriber still burned a slot a day and met the wall on day five.

**Why nothing was red, and nothing could have been:** `activationId` is optional, so a
literal omitting it is a valid `ProState` and `tsc` had nothing to say. The round-trip test's
fixture had no `activationId`. Every `ensureSession` test passed the id in **as an argument**,
bypassing storage — so it flowed perfectly in all 550 tests and never once in production.
And `expect(optionsSrc).toContain('activationId')` is item 30's blind spot, protecting the P0.

Fixed `3012b30`. The new fixture is typed `Required<ProState>`, which makes the COMPILER
enumerate the interface.

### 2. The manifest granted the proxy host. It did not.

**Believed:** the proxy was code-complete and only waiting on variables.

**Measured:** `visionRoute` posts every keyless catch to `${BUKI_HOST}/api/vision`, and both
the worker and the options page post every licence exchange to `/api/license`.
`manifest.json` declared **neither**. Chrome, verified against its own docs rather than
recalled: *"A script executing in an extension service worker or foreground tab can talk to
remote servers outside of its origin, as long as the extension requests host permissions"*,
and a request elsewhere *"will be treated as a cross-origin request unless the extension has
host permissions"*. No `Access-Control-Allow-Origin` anywhere, and `vercel.json` explicitly
excludes `/api/` from its headers block.

**The paid tier and the ten free catches would have failed on the wire**, looking like a
broken proxy rather than a missing manifest line. Fixed `b4118cf`.

**Why nothing caught it:** `host.test.ts` globs `manifest.json` and asks *"does any shipped
file name the WRONG host?"* — the manifest passed by naming **no** host at all.

### 3. The `authorName()` N+1 exists. It does not.

**Believed**, in three documents (OPENWORK's lane, the 08-18 TODO, the handoff): *"one extra
OpenLibrary request per book… a 20-book photo means 20 follow-ups."*

**Measured** against the call graph: the multi-book path is `groundText` → `books.search()`,
and `search.json` is asked for `author_name` in `FIELDS`, so it costs **one request per title
and no follow-up**. `authorName()` is reached only from `lookupByIsbn`, called once from a
single `if (isbn)` branch, for ONE book, on the retailer-link path that skips vision entirely.

**And the fix would have been a regression:** removing it means resolving the ISBN through
`search.json?q=isbn:`, which is exactly what was measured timing out for 20s+ on 2026-08-04.
No code change; a test pins the fact (`8fd948c`).

### 4. Both the privacy page and the landing's data section were false. Only one was.

**Believed:** OPENWORK item 17 said both described the picture going straight to the user's
own provider.

**Measured:** the landing has said *"the picture goes to Buki and on to the vision model"*
since `5faadb9`. Only `docs/privacy.html` was wrong — plus `README.md` and both Web Store
answers, which the item did not name.

### 5. The extension id you test with is the id that ships. It is not.

**Believed** (implicitly, by everyone including this session until the last hour): set
`BUKI_EXTENSION_ID` from `chrome://extensions` during the by-hand pass.

**Measured** against Chrome's docs: *"The extension ID is generated based on a hash of the
public key."* Unpacked, Chrome invents that key locally; published, the Web Store signs with a
different one. `manifest.json` has no `key` field. `policy.ts` compares
`origin === 'chrome-extension://' + extensionId`, so a mismatch is **403 for every real user
on both endpoints**. Filed as item 37; it reorders the launch sequence.

### 6. "We probably already have the Polar token and org id set."

**Measured:** `vercel env ls` → *"No Environment Variables found"*. **Zero of six.**

---

## Instruments that lied, this session

| Instrument | How it lied | Instead |
| --- | --- | --- |
| The round-trip test for `ProState` | Its fixture had no `activationId`, so it could not see a reader that drops one | Type the fixture `Required<T>` and let the COMPILER enumerate the interface |
| Every `ensureSession` test | Passed the id in as an argument, bypassing storage entirely | At least one test must start at the storage |
| `host.test.ts` over `manifest.json` | Asks "any WRONG host?"; the manifest named no host at all | Assert the thing is PRESENT, not merely not-wrong |
| **The full test suite** | **583 tests passed on a `content.ts` that does not parse** — nothing imports it as a module | `entryPoints.test.ts`, esbuild transform over the unimportable files |
| My first `x-button-harness` | Drew X's icons at OUR `.72` opacity when X renders its own at 1, flattering the comparison | An instrument that agrees with you is the one to distrust |
| Headless Chrome on `#pricing` | 6.4KB screenshot; it will not hold a scroll position (§5 already said so) | Isolate the section and render it from the real stylesheet |
| A contrast ratio for the ghost fill | Measured `--sunk` against `--paper`; three of the four controls sit on `--card`, where the token flips from raised to INSET | Ask what the control actually sits on |
| The item bodies vs THE LANE | Item 32 struck in one and open in the other; item 36 in the lane with no body | Reconcile the two halves whenever either is touched |

---

## Decisions worth not re-deriving

- **`/api/license` gets TWO ceilings, not one.** `validate` creates nothing so its ceiling is
  oracle-probing (40/key/day); `activate` spends a slot for ever so its ceiling is 3/key/day.
  **One number cannot bound both:** anything generous enough for five installs renewing daily
  is generous enough to burn every slot the customer owns.
- **Single-flight, not a write queue, for `ensureSession`.** A queue makes the second caller
  wait then re-read; sharing one promise means there is no second exchange to serialise and
  no losing caller holding a stale state. Both halves of the defect close together.
- **The keeper is at MODULE SCOPE in `background.ts`** and that is load-bearing — built inside
  `recognize()` it is a fresh latch per catch, which is no latch.
- **The extension points at `#pricing`, never straight at a checkout.** Choosing the interval
  is the customer's decision and the landing is the only surface showing both.
- **A line, not two more capsules, for the buy links.** Three buttons on one card destroys the
  hierarchy; this is a different action for a different reader.
- **`Finished`, not `Read`.** One word in `PILE_LABEL`; the STORED `Intent` stays `'read'`, so
  no migration and the Goodreads export is untouched.
- **The open-book mark variant was NOT built**, and the reason is Maximo's own brand doc:
  *"must never become a book glyph, an open book, a bookmark ribbon, or a letter B."*
  Overrulable, but knowingly.
- **No ADR directory was created.** `OPENWORK.md` §0 lists `docs/adr/` among the files this
  repo deliberately does not have; decisions live in numbered items, §5 traps and code
  comments. `documentation-and-adrs` says to match the existing convention and surface the
  conflict rather than introduce a second scheme. This is that surfacing.
- **Do not minify before submitting.** `build.mjs` does not, and 193KB of readable commented
  JavaScript is an advantage at review, not an oversight.

---

## The three launch blockers, as one pattern

All three were **written, tested, and inert on the one day that matters**, and they share a
shape worth naming because it will recur:

> **A value can be correct in every environment except the one that matters.**

| Blocker | Correct in | Wrong in |
| --- | --- | --- |
| `readPro` dropping the activation id | every test (fixtures carry it) | production (storage does not) |
| The manifest's missing host | every test (`fetch` is stubbed, no CORS) | a real browser |
| `BUKI_EXTENSION_ID` | the developer's machine | every customer's |

**None could fail a test, because in each case the test environment supplies the value the
production environment withholds.** The tell is a value that crosses a boundary the test suite
never crosses. **Item 3's by-hand pass is the only instrument that sees any of them.**

---

## What was verified clean

- No secret reaches the client. The checkout links that DO enter the repo are public by
  design — Polar issues them to be clicked — and the comment says so beside them.
- `git ls-files | grep -i env` → only `api/env.d.ts`. No `.env` file exists locally or is
  tracked.
- The Polar access token was never requested in chat. `vercel env ls` prints names without
  values, which is how the question was answered safely.
- Every guard added this session was earned with an A/B where the control was expected to
  differ, and two were mutation-tested against the exact mutations that previously passed
  533 tests.
- `.vercelignore` already covers `docs/store` and both session-ledger globs, so nothing
  written this session is publicly served.
