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
