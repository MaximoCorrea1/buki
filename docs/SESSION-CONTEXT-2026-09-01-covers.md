# SESSION CONTEXT — 2026-09-01, covers

Pair file: `docs/SESSION-TODO-2026-08-29-statusline-item54.md` (the lane's task table).
Inherited: `origin/main` at `cb4be87`.

---

## OPTION C, TESTED AND REJECTED. Do not re-run this.

**The question.** OpenLibrary holds a perfect metadata record and no cover for a large share
of recent books. Founder, 2026-09-01: *"lets test C"* — add a second cover source.

**The answer: no source clears the bar, and the one that came closest fails on LICENCE
rather than on engineering.** Three probes, all re-runnable, all in `tools/probe/`.

### What a candidate has to clear, and why four bars rather than one

| # | bar | why it is not optional |
|---|---|---|
| 1 | **coverage** | does it actually have the books OpenLibrary lacks |
| 2 | **access** | a mandatory API key is a second billing relationship and a second secret |
| 3 | **CORS** | `rememberCover` reads the bytes with `fetch()`. **Item 56's lesson from the other side:** a source whose bytes cannot be read caches nothing and silently draws a board |
| 4 | **licence** | the shelf carries Amazon and Bookshop affiliate links. Whose artwork may sit beside those is a term, not a preference |

### The results

| source | 1 coverage | 2 access | 3 CORS | 4 licence |
|---|---|---|---|---|
| **Google Books v1** | not measurable | ✗ **HTTP 429 on every keyless call.** The docs are explicit: *"the application must provide either the API key or an OAuth 2.0 token, or both"* | — | thumbnail terms **NOT FOUND** on the terms page |
| **Google Dynamic Links** | ✓ **3 of 3**, real images 10–16KB | ✓ no key | ✗ **`ACAO=null`** | unverified |
| **Apple iTunes Search** | ✓ **3 of the 4** OpenLibrary missed | ✓ no key, ~20 calls/min | ✓ **`ACAO=*`** | ✗ **fails** |

### The coverage number, because it is worth knowing regardless

Ten books, a spread of trade, technical, academic and translated
(`tools/probe/cover-coverage.mjs`):

- **OpenLibrary has no cover for 4 of 10.** That is the size of the problem, and it is large.
- **Apple had 3 of those 4.** The miss was *Modern Mathematical Logic*, a Cambridge
  monograph — academic titles are the gap in both catalogues.
- **9 of 9 aspect-correct**, 223–305 x 400, 19–72KB. Apple's `bb` suffix is a bounding box
  and does NOT letterbox to a square, which was the thing worth checking before believing it.

### Why Apple is out, and it is not close

> artwork may be displayed *"provided such Promo Content: (i) is placed only on pages that
> promote the content on which the Promo Content is based; (ii) is proximate to a 'Download
> on iTunes' badge"* … *"not used for independent entertainment value apart from its
> promotional purpose"*

The shelf is a private reading list carrying **Amazon and Bookshop affiliate links**. That is
Apple's artwork used to promote other goods, with no iTunes badge, on a page that is not
promoting Apple's edition. Three clauses, all against.

### And one finding that would have bitten even if the licence had allowed it

**Apple returned the WRONG BOOK for 1 of 9.** *The Anxious Generation* by Jonathan Haidt
came back as **"The Amazing Generation"** by Jonathan Haidt, Catherine Price and Cynthia Yuan
Cheng. The Search API returns its top hit with **no relevance floor**.

Taking `results[0]` would have put another book's cover on the shelf — the exact lie this
product exists not to tell, and the thing `rank` and `strayWords` in `groundText.ts` were
written to stop for OpenLibrary. Any second source needs that guard before it needs anything
else.

### What remains possible, stated so the option is not lost

**Google Dynamic Links has the best coverage of anything tested and needs no key.** Its bytes
are unreadable by `fetch`, so it can never be cached and can never reach the TRAY, whose
`<img>` obeys the host page's CSP. It could in principle be set as a plain `img.src` on the
SHELF, which is an extension page and needs no CORS for an image.

⚠ **UNVERIFIED, and it is a browser fact node cannot settle:** that the popup's CSP permits a
cross-origin `<img>` (the manifest sets no `content_security_policy`, so the MV3 default
`script-src 'self'; object-src 'self'` should leave `img-src` alone). **And Google's terms for
thumbnail display were NOT found** — the terms page covers fees, content removal and privacy,
and says nothing about artwork. Both would have to be settled before it ships.

**Cost, if it ever were pursued:** one request per artless book (about 40% of them, once,
then cached), a new host in `manifest.json` — which is a permissions justification at store
review — and, for the tray, a proxy hop through `get-buki.vercel.app` and its bandwidth.

---

## What was done instead

Nothing. The measurement is the deliverable: **a second cover source is not a small change,
and the obvious one is not licensed for this use.** The remaining option that costs nothing
and needs nobody's permission is the tray's own drawn board — see the founder's option (b).

---

## ROUND TWO, 2026-09-02. Four more candidates, all out.

Founder pasted four more. Same four bars.

| source | result |
|---|---|
| **bookcover-api** (`bookcover.longitood.com`) | **HTTP 522 on all six requests** - Cloudflare origin unreachable. The public instance was DOWN. It is one hobbyist server every Buki user would depend on, and it **scrapes Goodreads**, which is Amazon-owned. MIT, so self-hostable - which does not fix the scraping |
| **Google Books** | already out in round one: key mandatory, `ACAO=null` |
| **ISBNdb** | paid. Pricing page returned 403, so the tiers are **UNVERIFIED** and are not quoted |
| **Hardcover** | docs returned 403. Needs an account and key. **UNVERIFIED** |

**Seven candidates across two rounds.** The pattern is the finding: every third-party cover
source is licence-encumbered, key-gated, CORS-blocked, or somebody's hobby server. Book
covers are commercially owned assets and the free APIs exposing them assume you are promoting
a seller. **That is the argument FOR item 63**, which needs nobody.

---

## What shipped instead, and the one thing it is NOT

**The tray drew the HIGHLIGHTER value as a whole board** (`da0f7fd`). `generatedCover.ts` had
already written the rule down: the bright CLOTH values *"are a highlighter by comparison"*,
they *"keep their job on spine edges and rows"*, and *"the board gets the deep value of the
same dye"* - cream on bright marigold is 1.9:1, on tobacco 11.2:1. The shelf followed that.
The tray did not, so an artless book rendered as a bright purple swatch on the surface a
first-time user meets first.

The tray now draws the shelf board at a fortieth of the area: deep dye as ground, bright dye
as a 2px spine edge, two stamped rules at half the shelf weight. No weave, no title - at 32px
the weave merges into a bar and a title sets at two pixels.

⚠ **UNVERIFIED VISUALLY. Nothing was rendered.** tsc, the build and 1,192 tests say it
compiles and ships; they cannot say it looks right at 32x47. That is item 3.

**AND IT SETTLED THE CHEAPER OPTION BY MAKING IT UNNECESSARY.** The offer on the table was to
let a multi-book catch show the shared photograph instead of purple - item 60's trade, made
in the other direction. A drawn board is hashed PER BOOK, so three books from one photograph
get three DIFFERENT boards: both not-a-colour and distinguishable. Identical photographs would
have been only the first.

---

## The ISBN, which was found by accident and was worse than the cover

Chasing why two books had no cover surfaced this: `openLibrary.toBook` took `doc.isbn[0]`, and
a search doc is a WORK - that array is every edition it knows, in no promised order. For *The
Nvidia Way* entry zero is `9787521770162`, a **978-7 prefix, which is CHINA**.

`buyLink.ts:38` builds `bookshop.org/a/<affiliate>/<isbn>` from it **verbatim**, and Bookshop
is a US and UK retailer. It is also the Amazon search term, the Goodreads export cell, a dedup
key in `sameBook`, and the seed the shelf colour is hashed from. `goodreadsCsv.ts:96` had
already named the `isbn[0]` cast as a hazard - it read it as an INJECTION surface, not as the
wrong book.

`pickIsbn` prefers English-13, then English-10, then any 13, then whatever is left, and
validates shape at the source. **It only affects NEW catches**; books already on the shelf keep
what was stored unless re-caught.

---

## Instruments that lied, this round

| # | instrument | what it actually measured |
|---|---|---|
| 1 | My own test-file count | I reported **93 files**; it was **92**, and had been. The TEST count was right. `cb4be87`s message carries the wrong figure, corrected by follow-up rather than amended |
| 2 | `node tools/mutate.mjs ... | tail; echo $?` | `tail`s status, not the tool - the pipe-laundering trap, hit in the same session it was documented in. Re-run with `PIPESTATUS[0]` |
| 3 | The first `pickIsbn` mutation run | **5 of 8 survived**, on tests written minutes earlier. Four were real holes; one was genuinely EQUIVALENT. The mutation found the tier-order bug, not the tests |
| 4 | `covers.openlibrary.org` without `default=false` | Answers a MISSING cover with **200 and 43 bytes**. `res.ok` is true. It measures reachability, not existence |
