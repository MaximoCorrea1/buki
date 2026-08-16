# The book-capture landscape

**Generated:** 2026-08-09 · **Depth:** quick scan · **Method:** web search plus primary
pages. Firecrawl and DataForSEO were not connected, so there are no traffic, backlink or
keyword figures here. Everything below is either a claim from the product's own page
(sourced) or an inference, and inferences say so.

---

## The two axes that matter

Every product in this space answers two questions. Nobody has answered both the way Buki
does.

```
                       A LIST THAT IS YOURS
                                │
        TroveScore              │              ← BUKI
        Shelf Scan              │                (empty until now)
        ScanMyBook              │
        SmartBookshelf          │
  ──────────────────────────────┼──────────────────────────────
   BOOK IS IN YOUR HANDS        │        BOOK IS ON A SCREEN
                                │
        Goodreads scanner       │              Google Lens
        Bookscouter             │              (an answer, then nothing)
                                │
                          JUST AN ANSWER
```

The top-right quadrant was empty. That is the whole finding.

---

## Category A: extensions that save books from web pages

### TBR Bookmarker (Bookship)

| | |
| --- | --- |
| URL | chromewebstore.google.com/detail/tbr-bookmarker-extension/fmejmbhmojmdkbdincpdemceagieomjl |
| What it does | "Reads" the **text** of the page you are on, works out which books are mentioned, shows their cover art in a panel |
| Then what | Click out to Bookshop.org or Amazon, or tap to read a description |
| Ties to | Companion to the TBR Booklist Tracker app, but works standalone |

**The gap, and it is the whole gap:** it reads *text*. A post that is a photograph of a
book with no title written anywhere is invisible to it. That is precisely the case Buki
was built for, and it is not a rare case: it is most of what a book looks like on X.

### BookFinder: Smart reading list manager

Highlight text, right-click, "Find Book", save to a reading list. Requires you to already
have the title **as selectable text**. Same blind spot, one step more manual.

### Chrome's built-in Reading List

Saves *pages*, not books. A page about a book is not the book, which is exactly how a
bookmark becomes a place things go to die. This is the behaviour Buki exists to replace.

---

## Category B: Google Lens, the real threat, stated honestly

Right-click any image in Chrome, "Search with Google Lens", results open in the side
panel without leaving the page.

**Where Lens beats Buki, and will keep beating it:**
- Free, already installed, already in the exact right-click menu Buki wants
- Better recognition than Buki can afford to buy
- No setup, no key, no payment, ever

**What Lens does not do, and shows no sign of doing:** it gives you an *answer*. A side
panel of search results that evaporates when you close it. There is no shelf, no pile, no
intent, no record that you wanted the book, and no way to find it again in March. Lens
answers "what is this?" It has never tried to answer "and I want to read it."

**Inference (not sourced):** this gap is structural rather than an oversight. Lens is a
search entry point, and search entry points are measured on queries served, not on lists
kept. A shelf is the opposite of a query.

---

## Category C: mobile book scanners, same tech, different moment

TroveScore, Shelf Scan, AI Book Scanner, ScanMyBook, SmartBookshelf.io, Bookscouter Shelf.

These use the same core capability Buki uses: identify a book from cover or spine art with
no barcode. Several do it well, and Shelf Scan reads multiple spines from one photo, which
is the same trick as Buki's multi-book catch.

**And every one of them assumes the book is physically in front of you.** They are camera
apps. You point them at a shelf you own, or a table in a shop. That is a completely
different moment from seeing a book in a post at 11pm on a laptop, and the products are
not substitutes: the phone app cannot help you at the moment Buki exists for.

---

## Category D: trackers

Goodreads (barcode scanner, mobile), StoryGraph, Libib, LibraryThing.

All of them begin *after* you already know what the book is. You type a title into a
search box. They are the destination, not the capture. StoryGraph Plus is $4.99/mo or
$49.99/yr; Goodreads is free.

**Not really competitors. Potential destinations.** A Goodreads-format CSV export makes
Buki the front door to the tracker someone already uses, rather than a fifth list.

---

## Where Buki is alone

Three things, and only the third is hard to copy.

1. **It reads the picture, not the caption.** Category A cannot. Category D does not try.
2. **It happens where you already are.** Category C needs the physical object.
3. **It keeps the post that sold you on it.** Nobody else stores *why* you saved a book.
   In three months "23 caught" is a list; "the post that sold you" is the reason you
   actually open one. This is already built (`SavedSource` in `storage.ts`) and no
   competitor found has any equivalent.

## Threats

- **Google adds "save" to Lens.** Low effort for them, and it would take the capture half.
  The defence is the shelf, the piles and the provenance, not the recognition.
- **TBR Bookmarker adds image recognition.** They already have the audience and the
  companion app. Vision APIs are cheap now. This is the most likely competitive move.
- **Buki's recognition is worse than Lens and always will be.** Competing on accuracy is a
  losing line. Competing on what happens *after* the answer is not.

## The opportunity this research turned up, and it was taken

**As written on 2026-08-09:** Buki was scoped to twitter.com and x.com. Every product above
is either everywhere (Lens, TBR) or nowhere near a browser (Category C). **Scoping to one
site is the single largest self-inflicted limit on the product**, and the right-click flow
already works on any image; only the feedback surface is missing.

**Shipped 2026-08-12**, and the diagnosis was right: the missing piece was the feedback
surface, not the recognition. The tray is now injected on demand under `activeTab`, so the
right-click menu works on any image on any site, with an optional host permission asked for
the first time a cover sits on a CDN that is not the tab's own origin. No `<all_urls>`
content script and no broad host permission at install.

**What that changes about this landscape.** Buki has left the row it shared with Category A:
TBR Bookmarker and BookFinder are still page-bound and still read text. The top-right
quadrant in the diagram above is no longer "empty until now" as an aspiration, it is
occupied. **The threat list below is unchanged and is now the whole competitive question** —
particularly *TBR Bookmarker adds image recognition*, which remains the most likely move and
is not defended by being everywhere, only by the shelf, the piles and the provenance.
