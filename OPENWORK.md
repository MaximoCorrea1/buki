# Open work

Everything raised in the session of **2026-08-05/06** that was discussed, decided, or
discovered, and **not done**. Written at commit `9c7cdc0`.

Each item says what it is, why it matters, what "done" looks like, and which file to open.
Items are grouped by what unblocks them, not by size: the first group is code that is
wrong today, the second is work only Maximo can do, the third is design calls waiting on
his answer.

For what the product *does*, read `README.md`. For the design system, `docs/brand.md`.
For the shelf's reasoning, `docs/superpowers/specs/2026-08-05-shelf-and-piles-design.md`.

---

## 1. Ranking

### 1.0 FIXED 2026-08-09, with known limits worth reading

§1.1 below is **fixed** across `5335566`, `e0ebbba` and `f640412`. `rank` now breaks a
score tie on stray words: significant words in the result's title that the query never
mentioned. Catching *Dune* no longer shelves *Children of Dune*.

Two things are worth knowing before anyone touches this again.

**It took three commits, and the middle one shipped a regression.** `e0ebbba` stripped
punctuation everywhere so that `Dune:` would match `dune`. That splits `X-Men` into two
pieces which are both under the four-character significance threshold, so a cover reading
only `X-MEN` produced an empty word set and grounded to **nothing at all**, which is worse
than the bug being fixed. `f640412` trims punctuation from each token's edges instead.
Edge punctuation is noise; punctuation inside a token is part of the word.

**The tie-break is a heuristic and it does not cover every title shape.** These were
measured against the real `rank` on 2026-08-09 and are still wrong. None is a regression:
each is the pre-existing behaviour the tie-break simply does not reach.

| Shape | What happens |
| --- | --- |
| `Dune - Special Edition` (dash) | wrong book wins |
| `Dune; Special Edition` (semicolon) | wrong book wins |
| `Dune [Deluxe Edition]` (square brackets) | wrong book wins |
| `Dune Series Book 1` (bare series words) | wrong book wins |
| `Deluxe Edition: Dune` (tag BEFORE the title) | wrong book wins. `split(':')[0]` keeps whatever is left of the colon, and here that is the noise |
| `Dune (Deluxe (2021) Edition)` (nested parens) | tie, order-dependent |

**The sharpest one**, because stripping actively destroys signal rather than merely missing
it: querying `Dune Frank Herbert` against `Dune Saga: Book One` and
`Dune: Sandworms of Dune` picks the second. The wrong book's real differentiator sits
after its colon, so removing the subtitle erases the very words that should have demoted
it.

`stripEditionNoise` handles only the colon and round-parenthesis shapes. Widening it is
not obviously right: every separator added is another chance to delete a differentiator.
If this is revisited, the better fix is probably to stop guessing from a concatenated
string. `VisionGuess` already carries `title` and `author` as **separate fields**, so a
title-to-title comparison is available and was never used.

### 1.1 The wrong book gets saved when a work has sequels (FIXED, see 1.0)

**Catching a photo of *Dune* puts *Children of Dune* on the shelf.**

Found while measuring cover art for the face-out shelf, verified against the live API and
against the real `rank()` on 2026-08-06:

```
query: "Dune Frank Herbert"          (what the vision model returned)
OpenLibrary's top 3, in its order:
  score 3  Children of Dune          <- WINNER
  score 3  God Emperor of Dune
  score 3  Heretics of Dune
```

**Why.** `matchScore` in `src/recognizer/groundText.ts` counts significant words (4+
characters) shared between the query and `title + author`. "Children of Dune" by Frank
Herbert shares *dune*, *frank*, *herbert* with the query: three. So does every other book
in the series. `rank` sorts by score alone, `Array.prototype.sort` is stable, and so
**OpenLibrary's relevance order silently decides which book you get.** The real *Dune* was
not even in the first three results.

This is not a cover problem. The wrong TITLE reaches the shelf, and the card reports
`high` confidence while doing it, because three shared words is a strong score.

**The shape of the fix.** Scoring needs to notice that the result's title contains words
the query does not. A candidate whose title is exactly the query's title should beat one
that merely contains it. Something like: keep `matchScore` as the floor (it correctly
rejects unrelated hits at 0), then break ties on title distance, penalising significant
words in the result title that the query never mentioned.

**Done looks like:** a test in `src/recognizer/groundText.test.ts` that feeds `rank` the
three real results above and asserts *Dune* wins once it is in the list, plus the existing
tests still green. Prove it discriminates by putting the old scoring back and watching
only the new test fail. This repo does that on every invariant.

**Watch out for:** the same function ranks the text-grounding path, where queries are raw
OCR lines rather than a clean title. Do not make an exact-title match *mandatory*, or
`groundText` stops finding anything. It is a tie-break, not a filter.

**Files:** `src/recognizer/groundText.ts` (`matchScore`, `rank`),
`src/recognizer/groundText.test.ts`, and `src/recognizer/recognizer.ts:72` is the caller
that takes `[0]`.

---

## 2. Blocked on Maximo

Nothing here can be finished by an agent.

### 2.1 The popup width in a real Chrome popup frame

The shelf is **560px**, chosen so four covers across are 118px, the smallest a title
reads at. It has never been seen inside an actual Chrome popup, only in a headless page at
that width, and a popup frame is not a page.

**Do this first**, it is thirty seconds: `chrome://extensions` → Developer mode → Load
unpacked → open the popup and look. If it feels oversized, it is **one declaration**:
`body { width: 560px }` in `popup.html`. Dropping to 480 gives four 100px covers, which is
below the readable-title threshold, so the honest alternative at a narrower width is three
across (`PER_SHELF` in `src/extension/popup.ts`).

### 2.2 Affiliate identifiers

`src/extension/buyLink.ts` ships with both IDs empty:

```ts
export const AFFILIATE: Affiliate = { amazonTag: '', bookshopId: '' };
```

Links work without them, deliberately, so the feature could be tested before an account
existed. But **Buki earns nothing until these are filled in**, while the affiliate
disclosure is already shipping in three places.

- Amazon Associates signup, then put the tag in `amazonTag`.
- Bookshop.org affiliate signup for `bookshopId`. The disclosure already promises
  Bookshop as the independent-bookshop alternative, so this is not optional if that
  sentence stays.

### 2.3 The Vercel rename

The host is still **`shelfy-pearl.vercel.app`**, from the product's old name.

Renaming the Vercel project changes the domain and retires the old one **immediately**, so
every reference has to move in the same pass. A privacy-policy URL that 404s fails Chrome
Web Store review.

Exact list, current at `9c7cdc0`:

| File | What |
| --- | --- |
| `docs/index.html` | 4 references: `canonical`, `og:url`, `og:image`, `twitter:image` |
| `README.md` | 2: the Live link and the privacy link |
| `docs/store/listing.md` | 1: the privacy URL that goes into store review |
| `DESIGN.md` | 1, inside the historical record. Leave it, or annotate rather than edit |

**`og:image` and `twitter:image` are new this session** and point at the old domain. If
the rename happens without updating them, every share card breaks.

### 2.4 Chrome Web Store screenshots

1280×800, at least one, up to five. The shot list in `docs/store/listing.md` was updated
this session to match the face-out shelf, but **no screenshots exist**. Take them against
a shelf with books actually caught, not the demo data: a mocked shelf reads as a mock.

---

## 3. Design calls waiting on an answer

These were raised, and Maximo has not ruled. Each is cheap to change and none is blocking.

### 3.1 The caption repeats the cover's title

On a generated cover the title is stamped on the board **and** printed in the caption
about a centimetre below.

The spec originally called this "the same word twice" and said captions should carry it
instead. Prototyping killed the alternative: a board with no words on it is a swatch, not
a book (that was variant A in the cover lab, and it was the worst of three). And real
cover art at 118px is frequently unreadable, so the caption is the only place a title is
*guaranteed* to appear.

So it says it twice, on purpose. **Worth your eye**, since it is the one thing about the
shelf that looks like a mistake and is not. If it bothers you, the options are: drop the
caption title and keep only the author (breaks for books with real art), or drop the
stamped title (returns the swatch problem).

**File:** `src/extension/popup.ts`, `renderSlot`.

### 3.2 The hero photograph's bottom-left edge

Matching the page black to the image's black (`#0f0d10`) made the right two-thirds of the
hero seamless. The bottom **left** still shows a hard horizontal cut, because that is
where the lit desk is, and no colour match can hide a lit area ending.

Left as-is: a photograph having an edge is honest, and the usual fix is a gradient fade,
which `brand.md` forbids. If it bothers you, that is the place to look.

**File:** `docs/index.html`, `.hero img`.

### 3.3 Should the room's secondary text warm up?

`--chalk #EDE7F4` and `--dim #B4A6C8` are violet-tinted, chosen when the room was an
imagined aubergine-black and there was no photograph. The photograph is warm.

They still pass contrast comfortably (8.9:1 for `--dim`), and the two-temperature result
is arguably deliberate rather than accidental. Not changed, because it would touch the
landing and `src/extension/content.ts` together and you did not ask for it. A warm
equivalent that still clears 7:1 is roughly `#B9A894` (8.5:1).

### 3.4 Webfonts, if you want the redesign skill's typography

The skill you asked me to apply specifies **Geist / Manrope**. I did not use them:
`brand.md` bans webfonts because Google Fonts logs the visitor's IP, and the landing's
entire claim is that nothing about you is collected. A tracking request in the `<head>`
would make that a lie above the fold.

**The honest route is self-hosting**: download the Geist woff2 files into `docs/`, declare
`@font-face` with `font-display: swap`, and ship them from your own domain. No third party
sees the visitor. Cost is roughly 40-80KB per weight. Say the word and it is a small job.

### 3.5 "For the landing we can make it simpler"

You said this, I asked which kind of simpler, and the image arrived instead. The redesign
already cut the 26-spine CSS wall, one whole section, and a step from the how-it-works
list. **Still unanswered:** whether more should go. The candidates, in the order I would
cut them:

1. The affiliate disclosure note (required by store policy in the *popup*, options page
   and privacy policy, but arguably not on the landing).
2. The three "beats" beside the shelf, down to two.
3. The `Privacy` ghost button in the hero, since the footer already links it.

---

## 4. Engineering, unblocked, not done

### 4.1 The right-click flow does not share the lookup CARD

Deferred by design, and still true. The two flows share the recognition memo, so the same
post is not looked up twice, but the right-click path does not reuse the *card* the button
path opened. Right-clicking a cover on a post you already pressed 📚 on can produce a
second card for the same book.

**File:** `src/extension/content.ts`, the `tweetContextFor` / `catchOpen` path.

### 4.2 `groundText`'s per-line search is unchanged

It fires up to `MAX_QUERIES = 6` searches, one per line of a post, concurrently, and takes
the first that grounds. It works, and it predates the circuit breaker and the
best-effort-grounding change, so it has not been re-examined since. Low priority.

### 4.3 The hero has no 2x asset

`hero-1600.webp` is the largest. On a 1440px retina laptop the browser wants ~2880px and
gets 1600, so the photograph is slightly soft on exactly the machines most likely to be
looking. A `hero-2400.webp` at q0.72 would be roughly 300KB.

**Fix:** add to the `srcset` in `docs/index.html`. Regenerate with the scratchpad
converter described in §5.

### 4.4 Store permissions declaration may be stale

`docs/store/permissions.md` was written before covers were cached in the Cache API and
before the caught picture was stored as a book's cover. **Verify** the data-usage
declaration still describes what the extension does before submitting. Not checked this
session.

### 4.5 Goodreads/StoryGraph export

README lists it as the planned bridge. Goodreads closed its write API in 2020, so a
Goodreads-format CSV is the only route into both. Nothing built.

### 4.6 Keyless setup

Recognition needs the user's own key until a proxy holds one. `buyLink.ts`-style
configuration already supports leaving the key blank when a proxy carries the credential,
so this is deployment work rather than extension work.

---

## 5. Tooling that dies with the session

All of this lives in the session scratchpad and **will not survive**. It earned its keep
this session, and each piece is small enough to rebuild. Promote any of it into `tools/`
if it should last.

| What | Does | Rebuild cost |
| --- | --- | --- |
| `serve.mjs` | Static server on :5050 rooted at the repo, plus `/lab/<file>` from the scratchpad and `POST /write/<name>` which writes a data-URL body into `docs/` | ~120 lines |
| `?demo` | Injects a `chrome.*` stub with a 13-book shelf so `popup.html` renders populated. Without it the popup correctly says "the shelf didn't load", which tells you nothing about how a shelf looks | ~40 lines |
| `?demo&probe` | **The important one.** Calls `elementFromPoint` on every control and prints what is actually on top of it, into the page. This is what found the dead popup | ~30 lines |
| `?demo&pile=read`, `?demo&q=…`, `?demo&sheet` | Drive the popup into a given state so it can be photographed | ~20 lines |
| `towebp.html` | `?src=&out=&w=&q=`, using Chrome's canvas as the image library: resamples and re-encodes to WebP or JPEG, then POSTs the result to the server. This produced every image on the landing | ~30 lines |
| `cover-lab.mjs` | Renders the real `generatedCover` module three ways at 118px on a fake 560px popup, for judging the drawn cover by eye | ~150 lines |

### Two traps these encode, which cost real time

- **`--virtual-time-budget` fast-forwards past real async work.** A screenshot taken with
  it fires while `await` chains are still pending; taken *without* it, the screenshot
  fires at load, which is even earlier. Neither can photograph a surface that resolves
  asynchronously. The answer is to **poll for a condition and report into the page**, which
  is what `?demo&probe` does.
- **A screenshot cannot click, and `element.click()` does not hit-test.** Both of the
  checks in this repo passed against a popup where *nothing was clickable*. Only
  `elementFromPoint` sees an invisible overlay. This is now a line in `brand.md`'s
  pre-ship checklist.

---

## 6. Settled this session, so nobody reopens it

- **Texture vs portrait for the generated cover.** The spec offered those two. Rendering
  produced a third and better answer: the character grid is the **cloth**, tiled across the
  whole board, not a mark sitting on it. A single stamped device was tried at two sizes and
  reads as an audio equaliser. Closed.
- **The character portrait on the landing.** The spec parked the idea there. The
  photograph took that job. Closed.
- **Auto-save.** Removed in `a06e7ba`. Three documents were still promising it as of this
  session; all fixed. Do not reintroduce it: a save you did not make is a save you cannot
  learn to distrust.
- **Face-out vs spine-out.** Maximo chose face-out over a spine-out alternative. Recorded
  in the spec with the trade-offs so the argument is not had twice.
- **560px popup width.** Chosen for the 118px cover. Still needs the real-frame check in
  §2.1, but the reasoning is settled.
