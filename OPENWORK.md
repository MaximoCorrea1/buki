# Open work

Everything raised in the session of **2026-08-09/11** that is not finished. Written at
`39b2059`, on branch **`buki-pro`** (18 commits ahead of `main`, not merged).

State: **284 tests across 26 files, typecheck clean, build clean, working tree clean.**

Each item says what it is, why it matters, what "done" looks like, and which file to open.
The first section is the only thing standing between this branch and a shippable product,
and none of it can be done by an agent.

For what the product does, read `README.md`. For the design system, `docs/brand.md`. For
positioning and voice, `.agents/product-marketing.md`. For the paid rail's reasoning,
`docs/superpowers/specs/2026-08-09-buki-pro-design.md`, and for its remaining tasks,
`docs/superpowers/plans/2026-08-09-buki-pro.md`.

---

## 1. Blocked on Maximo, and it is the critical path

Tasks 6, 7 and 9 of the plan cannot start until all three of these exist. Tasks 1 to 5 are
done, so **there is no other code to write.**

### 1.1 The Vercel rename

The project still answers on `shelfy-pearl.vercel.app`, from the product's old name.
`DEFAULT_SETTINGS.endpoint` gets compiled into every installed copy, and renaming a Vercel
project retires the old domain **immediately**. So the rename has to happen before the
endpoint is chosen, or the first shipped build points at a domain that is about to 404.

Plan Task 0 has the exact steps, including creating `src/shared/host.ts` so the host is
defined once rather than in nine files.

### 1.2 Five environment variables

Set in the Vercel dashboard, all environments. **None of these may ever appear in a file
under `src/extension/`**: that is a leak, not a shortcut.

| Name | Notes |
| --- | --- |
| `GEMINI_API_KEY` | a **paid tier** key, not the free tier. The free tier throttles, and "faster, and it does not throttle" is a line on the pricing page. |
| `BUKI_TOKEN_SECRET` | 32+ random bytes, `openssl rand -base64 32` |
| `BUKI_EXTENSION_ID` | the published Chrome Web Store id |
| `POLAR_ACCESS_TOKEN` | organisation access token |
| `POLAR_ORGANIZATION_ID` | from Polar settings |

### 1.3 The Polar product

One product, **Buki Pro**, two prices: **$4/month and $29/year**. Add the **License Key**
benefit, activation limit 5 (a person has more than one browser), usage limits off because
Pro is unlimited by design.

Polar restructured its fees on 2026-05-27 and a new organisation lands on **Starter, 5% +
50c**, plus 1.5% on non-US cards. At $4/month that is 17.5% gone to fees and at $29/year it
is 6.7%, which is why annual is the number to push.

### 1.4 Chrome Web Store screenshots

1280x800, at least one, up to five. **None exist.** Take them against a shelf with books
actually caught, not demo data: a mocked shelf reads as a mock.

---

## 2. The plan, unfinished

`docs/superpowers/plans/2026-08-09-buki-pro.md`. Tasks 6 to 15 remain, 57 unticked steps.
Every one has complete code in the plan.

| Task | What | Gated on |
| --- | --- | --- |
| 6 | `api/vision.ts`, the recognition proxy | §1.1, §1.2 |
| 7 | `api/license.ts`, licence to session token | §1.1, §1.2, §1.3 |
| 8 | `src/extension/license.ts` | nothing, but pointless before 7 |
| 9 | Settings gain `license` and `session` | §1.1 |
| 10 | The worker gates a catch | 8, 9 |
| 11 | Catch anywhere, `scripting` + `activeTab` | nothing |
| 12 | The wall, with two doors | 10 |
| 13 | Options page holds a licence | 9 |
| 14 | Privacy, permissions, listing, README | nothing |
| 15 | Close the loop | everything |

**Task 11 is DONE as of `e1b014c`.** Catch-anywhere shipped: the context menu is no longer
scoped to X, the worker injects a tray on demand under `activeTab`, and it asks for one
host origin only when the image actually needs one. This closes the gap where the landing
claimed "any picture, anywhere on the web" and the code only worked on X.

**One box in Task 11 is still open and only Maximo can tick it: Step 5, by hand in a real
Chrome.** Chrome stable refuses `--load-extension`, so there is no headless substitute and
no agent can verify it. The plan carries six specific checks. The one most likely to be
wrong is the permission prompt, because `permissions.request` needs the click's user
gesture and no unit test can prove the gesture survived the await.

### 2.1 Goodreads and StoryGraph export is promised and does not exist

The pricing page and the tier table both say "Export to Goodreads and StoryGraph". There
is no task for it and no code. **It must ship before Pro is advertised with that line**, or
the page is selling something that is not there. Goodreads closed its write API in 2020, so
a Goodreads-format CSV is the only route into both.

---

## 3. The landing

### 3.1 Provenance of the plates. RESOLVED 2026-08-11

The supplied plates were named `HPbW-r-bUAAPm2l.jfif` and similar, which is X's media
naming, and the rights were never established. That was flagged twice and never answered,
so **the plates were replaced rather than left as an open legal risk on a commercial
page.**

Both current plates are public domain 18th-century capricci from Wikimedia Commons:
Marieschi's *Capriccio with Ruins and an Antique Arch* and Panini's *An Architectural
Capriccio of the Roman Forum*. The footer credits both. This also fixed the image quality
complaint, because the new sources are 4000px museum scans rather than social media
re-compressions, and the halftone that made the old plates alias is gone. See
`docs/brand.md` and `tools/plates.sh`.

**No action is outstanding here.** If the plates are ever swapped again, the bar is the
same: public domain or licensed, and re-run the contrast pass.

### 3.3 The extension surfaces still look like the old product

The landing is now cream and cobalt with Bodoni Moda. `popup.html`, `options.html`
and `src/extension/content.ts` are still the paper-and-lamp system from before, and they
carry the mark in its paper values. **They are not wrong, they are just from a different
year.** Decide whether the extension follows the landing or the landing is the marketing
skin. `docs/brand.md` now documents both and says plainly that they diverge.

### 3.4 The store listing and privacy policy are stale in a way that fails review

`docs/store/listing.md` and `docs/store/permissions.md` still describe the X-only,
BYO-key, no-server product. `docs/privacy.html` still implies no Buki server exists.
**An inaccurate data-usage declaration fails Chrome Web Store review**, and the privacy
policy would be a lie the moment the proxy is live. Plan Task 14 covers it.

---

## 4. Known limits, deliberately not fixed

### 4.1 The ranking tie-break does not cover every title shape

`rank` in `src/recognizer/groundText.ts` now breaks a score tie on stray words, which fixed
the confirmed bug where catching *Dune* shelved *Children of Dune*. Six shapes are still
wrong, measured on 2026-08-09 and listed in §1.0 of this file's previous revision and in the
commit message for `3bef3fe`: dash, semicolon and bracket subtitles, bare series words, an
edition tag before the title, and nested parentheses.

The sharpest one is where stripping a subtitle **deletes the differentiator** rather than
noise. Widening `stripEditionNoise` is not obviously right, because every separator added is
another chance to delete signal. **The better route is that `VisionGuess` already carries
`title` and `author` as separate fields**, so a title-to-title comparison is available and
this code has never used it. That is a redesign, not a patch.

### 4.2 The trial can deliver eleven catches, not ten

`decide` answers from a snapshot and `trial.spend()` increments after the vision call
returns. Two concurrent catches at nine both pass. `trial.ts`'s write queue guarantees
neither increment is lost, which makes the overshoot land rather than preventing it.
Holding a reservation across an async recognition to protect two hundredths of a cent is not
worth the machinery. Documented in `entitlement.ts`.

### 4.3 Constant-time comparison is not provable by test

`equalInConstantTime` in `src/server/token.ts` XOR-accumulates over the full length. Nothing
in the suite would catch a regression to a short-circuiting compare, because timing is not
observable from a test. If that function is ever edited, it needs a human reading it.

---

## 5. Engineering, unblocked, not done

### 5.1 The right-click flow does not share the lookup CARD

Still true. Both flows share the recognition memo, so the same post is not looked up twice,
but the right-click path does not reuse the card the button path opened.
**File:** `src/extension/content.ts`, the `tweetContextFor` / `catchOpen` path.

### 5.2 `groundText`'s per-line search is unchanged

Fires up to `MAX_QUERIES = 6` searches concurrently and takes the first that grounds. It
predates the circuit breaker and the best-effort-grounding change and has not been
re-examined. Low priority.

### 5.3 Keyless setup is what this whole branch is for

Recognition needs the user's own key until the proxy holds one. That is Tasks 6 and 7.

---

## 6. Settled this session, so nobody reopens it

- **What is sold.** Ten hosted catches free, then $4/month or $29/year. Free forever:
  retailer-link catches, the entire local shelf, and bring-your-own-key recognition. The
  two audiences are disjoint, so keeping the free key path cannibalises nothing and defuses
  "they paywalled an MIT extension" before anyone says it.
- **The local shelf is never gated.** Not after the trial, not after a cancellation. It is
  the user's data on the user's disk. This is also the risk reversal that no competitor with
  a server-side shelf can copy.
- **A trial catch is only spent on a reading that came back.** A timeout, a no-match, a
  refused grounding or a dismissed card is free.
- **No database.** A Polar licence is exchanged once a day for an HMAC session token, and
  that token is the only state. A Polar outage is invisible to paying customers for seven
  days via the grace window.
- **Ten free catches, not five.** Books stand four to a board, so eight to ten is where the
  shelf stops being a list and becomes furniture. One catch costs about **$0.00011**, so the
  number is a design decision, not an economic one.
- **Pro is unlimited, not a monthly quota.** A per-user quota cannot be counted without a
  database and would guard a resource where an abusive user costs about $1.10 against $4
  collected.
- **The differentiator.** Every book scanner assumes the book is in your hands. Buki is for
  the ones you will never hold. Research in `competitor-profiles/_summary.md`; the empty
  quadrant is real and provenance ("the post that sold you") is the part nobody can copy
  cheaply.
- **The webfont ban is lifted, for self-hosted files only.** It existed because the page
  claimed nothing about you was collected. A file served from our own domain never broke
  that, and the claim has changed anyway.
