# The shelf, and the piles: design

**Status:** proposed, awaiting review
**Supersedes:** the popup's current single-scroll list of rows grouped by intent

---

## The problem

Two complaints, one from each side of the product.

**The shelf does not look like a shelf.** It is a list of rows. The reference Maximo
gave is the old iBooks bookcase: covers face-out, standing on wooden boards, four or five
to a shelf. He picked that over a spine-out alternative.

**The piles are unusable.** All four of these were reported, plus a fifth in his own
words:

1. Moving a book between piles is hard. The only controls are mark-as-read and delete, so
   promoting Someday to Now means re-catching the book.
2. Finished is a dumping ground. Read books stay in the same view forever with nothing to
   show for having read them.
3. No sense of progress or priority. Forty Someday books say nothing about what is next.
4. Hard to find a specific book. There is a filter box and nothing else.
5. **"No clear separation or easy navigation."**

Number 5 is the one that decides the architecture. The other four are features; that one
says the current information architecture is wrong. One scroll containing four groups
means the piles are a typographic convention rather than places. You cannot be *in* Now.

---

## The shape

**Piles become places, not headings.** A segmented control at the top, one segment per
pile, and the view below shows that pile and only that pile.

```
┌──────────────────────────────────────────────────────┐
│                        Buki                          │
│                 23 caught · 87% kept                  │
│  ┌────────┬────────┬─────────┬────────┐   ┌────────┐ │
│  │ NOW  1 │ NEXT 2 │ SOMEDAY │ READ 7 │   │ search │ │
│  └────────┴────────┴─────────┴────────┘   └────────┘ │
├──────────────────────────────────────────────────────┤
│    ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐            │
│    │      │  │      │  │      │  │      │            │
│    │ cover│  │ cover│  │ cover│  │ cover│            │
│    │      │  │      │  │      │  │      │            │
│    └──────┘  └──────┘  └──────┘  └──────┘            │
│  ══════════════════════════════════════════          │
│    Signals    Dune      SICP     Ficciones           │
│    Oppenheim  Herbert   Abelson  Borges              │
│                                                      │
│    ┌──────┐  ┌──────┐                                │
│    │      │  │      │                                │
│    │ cover│  │ cover│                                │
│    └──────┘  └──────┘                                │
│  ══════════════════════════════════════════          │
│    Ubik       Neuromancer                            │
└──────────────────────────────────────────────────────┘
```

- **Width goes to 560px.** Chrome allows 800. At the current 360, four covers across is
  78px each and the title under one is unreadable, so you would be browsing by colour.
  560 gives ~118px covers, which is the smallest a title reads at.
- **Four per shelf**, then a board, then the next four. The board is the row separator and
  the only piece of skeuomorphism kept: a solid 3px rule with a hard shadow beneath it, in
  the paper palette. **No wood.** iBooks dropped the wood in 2013 and it now reads as
  pastiche rather than as identity.
- **Title and author sit under the cover, not on it.** The reference puts them on the
  cover because those are real covers. Half of ours will be generated, and a generated
  cover with the title on it plus a caption repeating the title is the same word twice.

### Search is a filter across every pile

Typing in the search box leaves the segmented control and searches the whole shelf,
showing results as one shelf with a pile tag under each book. Clearing it returns you to
the pile you were in. Finding a book is a different job from browsing a pile, and it
should not require you to guess which pile you filed it in.

### Read is a different room

The Read segment is not "a fifth pile of books you are not going to open". It shows what
the other segments cannot:

- A count and the current year: **"7 books, 2026"**.
- Books ordered by when they were finished, newest first, with the month under each.
- Nothing else. No move controls, no buy link. A finished book is a record, and a record
  is not an inbox item.

That is the whole answer to "finished is a dumping ground": it stops being a pile and
becomes a receipt.

---

## Picking a book up

Clicking a cover opens a sheet over the shelf. Not a new page: you are still on the shelf,
you have just taken one book off it.

```
┌──────────────────────────────────────────────────────┐
│                                                  ×   │
│      ┌────────────┐   Dune                           │
│      │            │   Frank Herbert                  │
│      │   cover    │                                  │
│      │            │   the post that sold you  ↗      │
│      │            │   Buy                     ↗      │
│      └────────────┘                                  │
│                                                      │
│      ┌──────┬──────┬─────────┬────────┐              │
│      │ NOW  │ NEXT │ SOMEDAY │  READ  │              │
│      └──────┴──────┴─────────┴────────┘              │
│                         ← the pile it is in is lit   │
│                                                      │
│                 Remove from shelf                    │
└──────────────────────────────────────────────────────┘
```

**Moving a book is the same control that tells you where it is.** One segmented control,
the current pile lit, press another to move. That answers complaint 1 without adding a
menu, and it uses the same component as the top-level navigation, so there is one idea to
learn rather than two.

`Remove from shelf` is set apart and is not red. Red is for danger; removing a book you
chose to save is a decision, not an accident. The existing ten-minute `markWrong` window
still applies, so a removal shortly after a save still teaches the recognition log.

### Order within a pile

Newest catch first, which is what exists today. **No manual ordering, no drag.** Priority
inside a pile is the problem Now/Next/Someday already solves; adding a second ordering on
top of it means maintaining two answers to the same question, and dragging in a 560px
popup is miserable. If a Someday pile of forty still feels unordered after this, that is a
separate problem and gets its own spec.

---

## The generated cover, and the aesthetic

**This is the distinctive part, and it is load-bearing rather than decorative.**

OpenLibrary has no cover for a large share of books, and it spent 2026-08-04 returning
nothing at all. A face-out shelf where a third of the covers are missing looks broken.
So a book without cover art gets a cover that Buki draws, from the book itself, and it has
to look deliberate enough that you do not read it as a failure.

**Built, rendered at 118px, and looked at (2026-08-05).** The section below is what
survived; `src/extension/generatedCover.ts` is the module and the picture is in the
session scratchpad as `cover-lab.png`. Three things the drawing got wrong are recorded at
the end, because each of them looked reasonable in prose.

```
┌──────────────┐
│ ══════════   │  two stamped rules, the cords seen face-on
│ ░ ▒░  ▒ ░▒ ░ │
│ ▒░ ░▒▓ ░  ░▒ │  the cloth: the book's own character tile, repeated,
│ ░▒ ▒ ░  ▒░ ░ │  in ONE lighter solid value of the board
│  ░ ░▒ ░▒  ▒  │
│              │
│  Dune        │  serif, cream, bottom-anchored, three sizes
└──────────────┘
```

- **The board is a deep dyed binding, not the bright cloth.** Five values, one per cloth,
  same hash: oxblood `#4A1414`, tobacco `#4A3208`, forest `#0C4033`, indigo `#1B2570`,
  aubergine `#3A1550`. The bright cloth keeps its existing job on spine edges and rows.
- **Two stamped rules across the top**, in `#D6CEC2`. Cream rather than gilt, because a
  gold line on every cover would spend the one-accent rule twelve times per shelf.
- **The title in the serif, cream, anchored to the bottom.** Three sizes chosen from the
  title's length AND its longest word, never a continuous fit.
- **No author on the board.** The caption underneath already carries it.
- **The character grid is the cloth.** The book's 7x7 tile, repeated across the whole
  board at a 5px cell in one lighter solid value, half-dropped so alternate tile rows
  shift sideways.

**Why cream type on a deep board and not on the cloth.** White on bright marigold is
1.9:1 and cannot be read; on tobacco it is 11.2:1. Every one of the five deep bindings
clears 10.9:1, so the type is legible on all of them with one ink rather than five
exceptions. Rendering the bright-cloth version confirmed the arithmetic: it reads as a set
of highlighters, not as a shelf.

**Why a character grid rather than a generated image or a gradient.** It is the one
texture that is genuinely Buki's: mono is already the utility face, the shelf already
reports in it, and a character grid costs nothing to render, needs no network, and cannot
half-load. A gradient would be the generic answer and is also banned by the flat rule in
`brand.md`.

### What the drawing got wrong

- **Texture, not a portrait, and not an emblem either.** The open question in the first
  draft was texture versus portrait. Rendered, there is a third answer and it is the one
  that works: the tile is neither a wash nor a picture, it is *the cloth*, so the
  characters are the material rather than an ornament sitting on it. A single stamped
  device was also tried, at two sizes. It reads as an audio equalizer, because mirroring
  left to right leaves only four independent columns and the eye finds them instantly. It
  is cut.
- **A hashed grid has to be blurred or it is a broken image.** Rolling each cell
  independently gives a middle that is denser on average and still renders as static, and
  static is the exact thing a drawn cover must never look like. Each cell now takes the
  average of its neighbourhood, so ink arrives in areas.
- **A straight repeat is corduroy.** Tiling the square lines the seams up into vertical
  ribbing. The half-drop is what a real textile repeat does and is what makes it read as
  woven.

---

## What this does not change

- **The catch card in the feed.** It is the room, it is dark, it was just redesigned, and
  it is a different job.
- **The storage shape.** `savedBooks` keeps its keys. `intent` already carries all four
  piles including `read`. This is a rendering and navigation change, and it must not
  become a migration.
- **The landing page.**

---

## Risks

- **560px popups feel large.** Worth checking against a real Chrome popup before building
  the whole shelf. Cheap to test: change the width, load it, look.
- **The generated cover has to be good, not tolerable.** If it reads as a placeholder,
  the face-out shelf is worse than the list it replaced, because the list never pretended
  there was cover art. This is the piece to prototype first and judge on its own.
- **Four segments plus a search box in 560px** is a tight masthead. If it crowds, search
  becomes an icon that expands.

---

## Build order

1. ~~The generated cover, on its own, rendered at 118px and looked at.~~ **Done. It
   holds.** A deep binding with a stamped title and a woven character ground reads as a
   book that lost its jacket, which is a real object, rather than as art that failed to
   load. The face-out direction survives its own riskiest piece.
2. ~~The shelf: width, four-up grid, boards, captions.~~ **Done.**
3. ~~The segmented control and per-pile views.~~ **Done.**
4. ~~The detail sheet, including move-between-piles.~~ **Done.**
5. ~~Search across piles.~~ **Done.**
6. ~~The Read view.~~ **Done.**

---

## Built: where it departs from the above

Recorded so nobody has to rediscover why. Plan:
`docs/superpowers/plans/2026-08-05-face-out-shelf.md`.

- **Read keeps its move control.** The spec said a finished book gets no move controls.
  Built that way, a book marked Read by mistake can only be deleted, which throws away
  its source and its place on the shelf to fix a mis-tap. The buy link is gone, which was
  the part that actually made Read read as an inbox. The four-way control stays as the
  only control.
- **The caption carries the title even though the drawn board stamps it.** The spec
  called that "the same word twice". Rendering settled it: a board with no words on it is
  a swatch, not a book (this is variant A in the cover lab, and it is the worst of the
  three). And real cover art at 118px is often unreadable, so the caption is the only
  place a title is guaranteed. A shelf where some books are captioned and some are not is
  worse than saying it twice.
- **The masthead stacks instead of sharing a line.** Four segments plus a search box on
  one line at 560px is the crowding the spec's own risk list predicted. Piles on one
  line, search on the next.
- **Covers align at the top of their slot, not the bottom.** Bottom alignment lines up
  the SLOT, and a two-line caption then shoves its cover a line upward, so a row of books
  stopped resting on the board. Every cover is the same aspect ratio at the same width,
  so aligning tops aligns bottoms.
- **Still unverified: 560px in a real Chrome popup frame.** A headless page at 560px is
  not a popup. It is one declaration in `popup.html`, so it is a one-line change.
