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

Derived from `clothFor`'s existing hash, so a book's generated cover never changes:

- The cloth as the ground, flat.
- The title in the serif, set large, left-aligned, wrapping. The author beneath in mono.
- Two gilt cords across the top, the signature already used everywhere else.
- A character-grid pattern filling the space under the text, drawn from the hash: the
  ASCII idea, used as a texture rather than as a picture.

```
┌──────────────┐
│ ══════════   │  the cords
│              │
│  Dune        │  serif, large
│              │
│  F. HERBERT  │  mono, small
│              │
│ ░▒▓█▓▒░▒▓█   │  hashed character grid
│ ▓█▓▒░▒▓█▓▒   │  in a lighter tint of the cloth
│ ▒░▒▓█▓▒░▒▓   │
└──────────────┘
```

**Why a character grid rather than a generated image or a gradient.** It is the one
texture that is genuinely Buki's: mono is already the utility face, the shelf already
reports in it, and a character grid costs nothing to render, needs no network, and cannot
half-load. A gradient would be the generic answer and is also banned by the flat rule in
`brand.md`.

**Open question for review:** whether the character grid is a texture (a wash of blocks,
as drawn above) or a *portrait* built from characters. The texture is safer and reads at
118px. A portrait is more memorable and is likely mud at that size. Recommendation:
texture in the popup, and keep the portrait idea for the landing page, where there is room
for it.

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

1. The generated cover, on its own, rendered at 118px and looked at. If it is not good,
   stop and reconsider the whole face-out direction.
2. The shelf: width, four-up grid, boards, captions.
3. The segmented control and per-pile views.
4. The detail sheet, including move-between-piles.
5. Search across piles.
6. The Read view.
