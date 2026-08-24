# 2026-08-24 — the tray's second mood, then ten reviewers and six P0s

**Pair:** `docs/SESSION-TODO-2026-08-24-prelaunch-review.md`
**The findings:** `docs/REVIEW-2026-08-24-prelaunch.md` — evidence, attack paths, fixes.
This file is the REASONING: what was measured, which beliefs were overturned, which
instruments lied.

> **THE SAME HONEST NOTE AS THE LAST TWO SESSIONS**, and it is now a pattern rather than an
> incident. `maintaining-project-docs` requires this pair before the first substantive tool
> call. **It did not exist** and was written at the end on Maximo's instruction. Third
> consecutive session. The skill's own baseline records the rule being "written down and
> re-issued twice more" and concludes *"writing it down was not the lever."* That conclusion
> is now confirmed a fourth time, by the agent the rule is addressed to.

---

## What was asked, in order

1. Re-read all flows and context after compaction; re-derive the state.
2. Chrome Web Store listing — every dashboard field.
3. A 1000-character host-permission justification; a real privacy policy link.
4. Screenshot design, then an artifact to shoot against.
5. Audit the descriptions, the screenshot text and the design. *"the ctas look shit, and the
   languaje idk, should be simple. more stragight forwards."*
6. What does `92% kept` mean; what else could go there; remind me of the open tasks.
7. Remove the kept rate from the masthead — *"just add 28 books caught"*.
8. Redesign the catch tray: light and dark, more contrast, iOS buttons, kill the strip, put
   the logo on it.
9. **`/compound-engineering:ce-review` — full pre-launch, all criticals, cybersecurity,
   performance.**
10. Capture everything, push, hand off. **"we solve them on next session."**

---

## Measured, with the probe beside it

| Measurement | Probe | Value |
| --- | --- | --- |
| Test suite, session end | `./node_modules/.bin/vitest run` | **620 / 58 files** |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit` | exit 0 |
| Build | `node build.mjs` | exit 0 |
| Commits since `d3e5923` | `git rev-list --count d3e5923..HEAD` | **33** |
| Open numbered items | `grep -c '^- \[ \] \*\*[0-9]' OPENWORK.md` | **14** (was 8; +6 P0s) |
| Diff available to review | `git diff --name-only origin/main` | **0 files** — everything merged |
| Secrets in full history, all branches | `git log --all -p \| grep -cE 'polar_oat_\|AIza…\|sk-…'` | **0, 0, 0** |
| Runtime dependencies | `package.json` `dependencies` | **`{}`** — zero |
| Hosts in the shipped bundle | `grep -ohE 'https://…' dist/*.js \| sort -u` | exactly **6**, all declared |
| Ledgers public? | live fetch of `/SESSION-CONTEXT-…md` | **404** |
| Internal docs public? | live fetch of `/superpowers/polar-setup.md` | **404** |
| `/api/vision` bare GET | live fetch | **405**, empty body |
| `/privacy` | live fetch | **served**, both new sections, dated 2026-08-20 |
| Store description length | `awk` over the fenced block | **2,902** of 16,000 |
| Combined host justification | `printf '%s' "$(cat …)" \| wc -c` | **953** (965 if CRLF) |
| Store icon geometry | PNG IHDR read + looked at | **128x128 full bleed, no padding** |
| Mark vs its own ground | `contrast()` from `tools/mark.mjs` | **1.00:1** — identical colour |
| Mark on cream, deep end | same | **8.03:1** |
| Tray dark card on a black essay | same | **1.10:1** — the ring carries it |
| Tray light card on a white site | same | **1.00:1** — symmetric |
| `--ink-2` after the retone | same | **15.38:1** (was `#b5b5bd`) |
| Honest catch cost | threat model, vs Google's published pricing | **$0.000135** |
| Attacker request cost | same | **~$3.46** — a **25,000x** ratio |
| 20 concurrent OpenLibrary queries | live, by the performance reviewer | median **1,215ms**, wall **6,072ms** |
| OpenLibrary search with `isbn` field | live | **8,320 bytes** vs **398** without — **20.9x** |
| `weaveOf` at scale | benchmarked in V8 | 119 books 5.12ms · 500 15.98ms · 2000 58.80ms |
| `shelvedAmong` at 2000 books | benchmarked | 40,000 calls, **179ms**, on the response path |
| Surviving mutations | six mutations, suite re-run each time | **5 of 6 survived 620/620 green** |

---

## Beliefs overturned

### 1. "Green means covered." It does not, and now there is proof.

**Believed:** 620 tests across 58 files, tsc clean, build clean — a well-tested product.

**Measured:** the testing reviewer broke six behaviours and re-ran. **Five survived a fully
green suite**, including the activation-slot reuse that protects a customer's five permanent
Polar slots, and the launch-day find-and-replace that item 36's guard was written specifically
to prevent.

**Why.** Every guard asserts that a STRING IS PRESENT, not that a BEHAVIOUR HOLDS.
`toContain('activationId')` passes on a comment. `toContain('>Source<')` passes after the href
changes. The "never leaks the provider key" test mocks an upstream with **no headers**, so it
verifies the mock. The suite's strength is very unevenly distributed: the modules extracted for
testability (`saveBook`, `gate`, `token`, `policy`, `licenseHandler`, `shelfEdit`) are genuinely
excellent — `licenseHandler.test.ts` mocks a HOSTILE upstream. **The weakness is concentrated
exactly at the seams those extractions left behind.**

### 2. "The server pins the model." Three artefacts say so. None of them is true.

**Believed:** `visionRoute.ts:42` — *"The MODEL IS LEFT EMPTY on purpose: the server pins the
alias, and an extension pinning its own would 404 for every user the day that model retired,
which has already happened twice."* Repeated in `polar-setup.md:383`. Asserted by
`visionRoute.test.ts:81`.

**Measured:** `grep -n model src/server/*.ts` returns only a test fixture.
`visionHandler.ts:98` is `body: await request.text()`. And `background.ts:164` — one layer
ABOVE where the test asserts — puts the model back with `route.model || settings.model`, under
a comment claiming it only falls back "when we are talking to a provider directly". **The `||`
never checks the endpoint.** `options.html:537` is a free-text field.

**So a keyless user typing `gemini-2.5-pro` into settings bills us for Pro-tier inference,
through our own UI, with no forgery anywhere.** Found independently by four reviewers.

### 3. "The grace window protects a subscriber through a Polar outage." Only from a socket error.

**Believed:** `licenseHandler.ts:164`'s comment — *"503, NOT 403: a 4xx makes the extension
throw its session away during OUR outage, which is the exact moment the grace window exists to
cover."*

**Measured:** that reasoning guards only the `catch` around the fetch. Eight lines below,
`if (!res.ok)` returns **403 for every non-2xx Polar answer**, including 500/502/503/429 — the
COMMONER outage shape. The client reads 403 as definitive, wipes the session, and the subscriber
meets the wall they paid to pass. `grep -c 'status: 5' licenseHandler.test.ts` → **0**.

### 4. "The tray must never follow the extension's theme." Written when it had one mood.

**Believed:** `theme.ts` — *"The catch tray does not read this and must not. It renders inside
somebody else's page and owns its ground in every mood."*

**Measured:** what the argument actually requires is that the card stay OPAQUE and carry its own
ring and shadow. Still true — and now true twice. The trade is symmetric: dark-on-black
**1.10:1**, light-on-white **1.00:1**. Each mood vanishes into exactly one ground. Overturned
knowingly, on Maximo's instruction, and both moods were rendered on all five grounds before it
shipped.

### 5. "The card's signature is the logo." It stopped being the logo a week earlier.

**Believed:** `content.ts` — *"THE SIGNATURE: the mark's own spine, with the mark's own two
cords stamped across it. The card and the logo are the same object at two sizes."*

**Measured:** the mark became the catcher on 2026-08-17, replacing *three spines and two
stamped cords*. The rule went on drawing the retired drawing's signature for a week. **Removing
it was a correction, not a preference** — and it fixed the centring for free, because the
padding reserved 21px for a spine that no longer existed.

### 6. "`x-forwarded-for[0]` is spoofable, so the IP cap is worthless." Two agents disagreed.

**The security reviewer** flagged it P2-unverified: the code is "correct under one deployment
assumption and worthless under the other, with no test that can tell you which."
**The threat model** settled it with a Vercel docs citation: **Vercel overwrites
`x-forwarded-for` at the edge and does not forward client-supplied values.** Not spoofable
today.

**The synthesis is the better finding than either:** the safety comes from the PLATFORM, not
the code, and `ipCap.ts:38-41` reasons from generic HTTP chain semantics rather than Vercel's
actual behaviour. Move hosts or put a proxy in front and the only automated brake evaporates
silently, with nothing red.

### 7. "The kept rate is safe to remove from the masthead." It cost a proof point.

**Believed:** a masthead simplification.

**Measured:** `.agents/product-marketing.md` listed *"the shelf reports its own kept rate"* as a
proof point — publishing your own accuracy is rare for a recognition product. It is now
displayed nowhere, and `summarize()` still computes `keptPct` while `markWrong` still flags
`wrong`. **A live signal with no reader.** Six live doc claims went false with it and were
rewritten rather than deleted. Done on Maximo's explicit instruction; recorded as a real trade.

---

## Instruments that lied, this session

| Instrument | How it lied | Instead |
| --- | --- | --- |
| **The whole 620-test suite** | **Five of six mutations survived it green**, including two that cost a paying customer their licence | Assert the behaviour, not the string. Extract the decision so it can be spied on |
| `toContain('activationId')` | Passes on the identifier surviving in a spread and four comments | The identical failure §5 already records for `toContain('markRestored')` |
| `host.test.ts:144` | The launch-day find-and-replace ships "Source" → Web Store, 620/620 green. It asserts link TEXT | Assert the DESTINATION, and guard the vacuous pass |
| "never leaks the provider key" | Mocks an upstream with **no headers**, so it verifies the mock | Make the mocked upstream hostile, as `licenseHandler.test.ts` already does |
| `visionRoute.test.ts:81` | Asserts `model === ''` one layer BELOW where the body is assembled | Assert what reaches the wire |
| **`tools/tray-harness.mjs`** | `${++markSeq}` in two interpolations ran the counter twice — gradient declared `h1`, referenced `h2`. The mark rendered as two floating eyes | **The product was correct; the instrument lied.** And a REAL measurement (1.64:1 on white) made a false diagnosis credible |
| `tools/mark-sizes.mjs` | **100% dead since 2026-08-17.** `README.md` lists it as working; `x-button-harness.mjs` cites it as evidence | `entryPoints.test.ts` asserts it PARSES. Parsing is not the failure mode; running is |
| The isolator I wrote mid-session | Matched `class="frame"` literally; when a frame gained a second class it printed MISS — **and I had piped that to `/dev/null`**, so Chrome re-captured the stale file | A silent miss is worse than a crash, because the next step still produces an image |
| `visionRoute.test.ts`'s `NOG` | Declared `const NOW = …` and never injected it. Green for seven days, then red on its own | Grep a clock fixture for its own call sites |
| `git diff origin/main` | Returned **0 files**, which would have made the review empty | Scope is not always a diff |

---

## Decisions worth not re-deriving

- **Category is `Workflow & Planning`, not `Productivity`.** That category no longer exists —
  the store split its categories in mid-2023.
- **The host justification is ONE combined field**, not one per host. 953 chars. If it ever has
  to shrink again, **cut a named host, never the wildcard sentence** — that clause is the whole
  defence.
- **No email address anywhere.** GitHub issues only. The Web Store already publishes the
  developer account's email, so a public indexed address buys nothing a reviewer needs.
- **Shot 3 is the split frame** (the post, then the find), replacing the non-X catch.
- **The pair frame is on CREAM, not cobalt** — the cobalt ground IS the mark's own ramp, so
  `contrast(deep, deep)` is 1.00:1.
- **`currentColor`, not a token, for anything drawn on a surface that flips moods.** The same
  bug occurred twice in one composition before this rule existed.
- **Fix P0-1 SERVER-SIDE ONLY.** Correcting `background.ts:164`'s `||` closes the UI path and
  NOT the vulnerability. The client is not the thing being defended.
- **Fix item 43 by EXTRACTION, not another string guard.** A `?raw` guard is what failed.
- **Do not re-litigate:** unminified build, no accounts or DB, local-only recognition log,
  public Polar checkout links, per-isolate caps, the disproved `authorName()` N+1.

---

## THE PATTERN — the single most valuable thing this session produced

Every P0, and most of the P1s, share one fingerprint:

> **The correct rule is written down, in a comment, within twenty lines of the code that
> breaks it.**

Eight instances are tabulated in the review's §1. This is not carelessness — the reasoning in
this repo is better than most codebases ever produce. **That is the mechanism.** The comments
are load-bearing and unexecuted, and their quality is what stops anyone re-checking the code
beneath them. The tests inherited the habit: a guard that asserts a string is present is
asserting exactly what a good comment already guarantees.

`OPENWORK.md` §5 already knows the adjacent lesson — *"a plan's instructions age exactly like
its snippets"* — but it has never been applied to comments as a class, and the comments are now
load-bearing in at least eight places.

**The countermeasure is not more comments and not more tests. It is converting the six or seven
load-bearing sentences into assertions that can fail.**

---

## What was verified clean

- No secrets in the full git history or the shipped bundle. Zero runtime dependencies.
- No injection sinks; no SSRF; token crypto sound; no credential crosses back to the client.
- Cross-extension messaging closed; a hostile web page cannot reach the server directly.
- `docs/` exclusions hold **in production**, verified by live fetch, not by reading
  `.vercelignore`.
- `/api/vision` bare GET → 405 with an empty body; `/privacy` served with both new sections.
- **The mutation agent's tree was verified clean by me** after it reported reverting six
  mutations — `git status` and `git diff HEAD` both empty.

Full list of twenty clean bills: the review's §6.
