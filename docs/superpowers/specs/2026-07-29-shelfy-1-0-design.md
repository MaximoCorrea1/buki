# Design: Shelfy 1.0 — the shippable release

Date: 2026-07-29
Status: DRAFT — awaiting review
Owner: Maximo

## Why now

Recognition works in a browser. The remaining gap between "works on my machine" and
"someone else installs it" is identity, legibility, and the two or three things a person
does with a book *after* catching it.

This is the release that goes to the Chrome Web Store.

## Decisions already taken

- **Name: Shelfy.** The product is a shelf; the name, the spine motif and the UI now agree.
- **Money: affiliate now, hosted recognition later.** A quiet buy link ships in 1.0. No
  billing, no cap, no infrastructure. Saving is free forever — it is the user's own data
  on the user's own machine, and there is no cost to recover.
- **Never cap saves.** A save cap and affiliate revenue pull in opposite directions: the
  cap limits the number of books a user can ever buy through us.

## Goals

1. A visual identity that could not be mistaken for a generic extension.
2. A shelf that stays legible at 100 books and leaves room for sections it does not have yet.
3. Close the loop: a book can be *finished*, not only saved or deleted.
4. Everything the Chrome Web Store requires, including honest disclosure.

## Non-goals

- The keyless proxy and the $3 tier. Blocked on the dogfood numbers, and 1.0 does not need them.
- CSV export. Wanted, but not what stops a stranger installing this.
- Any surface beyond twitter.com / x.com.

## Design

### 1. The visual system

The current palette is espresso-dark. Pastels go muddy on dark grounds, so the shelf
flips to light and the **spines carry the colour**.

```
--paper   #F4F2FB   pale periwinkle — deliberately not the cream every generated design lands on
--board   #E2DEF0   the shelf edge each book rests on
--ink     #171526   near-black with a blue cast; ~14:1 on paper
--muted   #6B6785   secondary text; clears 4.5:1
--gilt    #C8871F   cords and accents — graphic only, never body text
cloth     #FF6B5A coral · #FFB020 marigold · #2FB88A jade · #6C7BFF periwinkle · #B265D9 plum
```

Cloth stays hashed from the book itself, so a shelf looks varied the way a real one does.

**Dark mode is built in from the start**, not retrofitted: ground, board and ink swap
under `prefers-color-scheme: dark`; the cloth colours are chosen to hold on both. Doing
this upfront costs a token swap; adding it later means re-auditing every rule.

**Type is system; identity comes from the mark, not from letterforms.** "Bolder and
clearer" is weight, size and tracking — 700-weight titles, 11px/0.14em uppercase group
headings — and costs no bytes. A bundled display face would add a binary, a licence
attestation on the store listing and a build asset to letter one word; hand-drawing
"SHELFY" as bezier paths would look exactly as amateur as it sounds. The wordmark is set
in the system stack at 800 weight with tight tracking, sitting beside the SVG mark (§6),
and the mark is what carries the brand.

### 2. The shelf row

Each row keeps the spine you liked *and* gains the cover:

```
┌────────────────────────────────────────────────┐
│ ▌ ┌────┐  Signals and Systems                  │
│ ▌ │cover│ Alan V. Oppenheim            ✓   ×   │
│ ▌ └────┘  from the tweet · buy                 │
│ ────────────────────────────────────────────── │  board + hairline shadow
```

- **Spine edge** (8px, cloth-coloured, two raised cords) stays on every row — it is what
  makes a list read as books.

  The cords are **not** flat gilt. A single gold line disappears against marigold cloth,
  which is precisely how the first shelf design shipped with its signature detail
  invisible. Each cord is a 1px `rgba(255,255,255,.55)` highlight over a 1px
  `rgba(0,0,0,.25)` shadow — which reads on every cloth colour, and is what a raised cord
  actually looks like.
- **Cover thumbnail** (36×54) from `book.coverUrl`, which OpenLibrary already returns.
  `loading="lazy"`, so a hundred rows do not fire a hundred requests at once.
- **No cover** → the slot fills with cloth and the title's initial. The motif does a job
  rather than decorating.
- **Board separator** — a 1px `--board` line with a hairline shadow beneath, so books rest
  on something. One line, no more; "simple, not overkill" is the brief.

A cover thumbnail also does real work: **a wrong match becomes obvious at a glance**,
which is exactly the feedback the kept-rate measurement depends on.

**Popup widens 316px → 360px.** The current width cannot hold a thumbnail, two actions and
a title without truncating everything.

### 3. Finished

`Intent` gains a fourth value, `'read'`, shown as a **Finished** group.

- A `✓` on each row moves the book there. `×` still removes it.
- The picker still offers only Now / Next / Someday — you are recording an intention when
  you catch a book, not a completion.
- Marking finished must **not** flag the recognition as wrong. Only removal does that.

This is the missing half of the loop. Today there is no reason to ever reopen the popup
except to delete; finishing a book is the reason.

### 4. Surviving a big shelf

- Group headings become **sticky**, each with a count.
- A **filter field appears only past 15 books** — never a chrome-heavy search box on a
  shelf of four. Matches title or author, case-insensitive.
- The entrance stagger **caps at the first 8 rows**. A hundred books must not spend three
  seconds cascading.
- The popup is built as **stacked sections** so Finished, stats, or settings slot in
  without a rewrite.

### 5. The quiet buy link

A low-emphasis `buy` link sits beside the existing source link, at the same weight. It
appears on a book you have **already chosen to save** — it never suggests, ranks or pushes.

- Prefer the **ISBN** when we have one; fall back to a title + author search.
- The affiliate tag lives in one module and **may be empty**. With no tag the link still
  works as a plain link, so the feature is useful before any affiliate account exists.
- Bookshop.org is the default (~10% and a better fit for an indie reading tool), Amazon
  the fallback.

**Disclosure is not optional.** A line in the popup footer, a line in the store listing,
a line in the privacy policy. Undisclosed affiliate links are a takedown risk under Chrome
Web Store policy, quite apart from being dishonest.

### 6. The mark

Three spines of unequal height — coral, jade, periwinkle — crossed by a single gilt cord.
Drawn as SVG, rendered to `icons/*.png` by the existing icon tool. It must read at 16px,
where it reduces to three coloured bars and one gold line.

### 7. Shipping to the store

Each is a real blocker, not a nicety:

- **Privacy policy** at a public URL (GitHub Pages off this repo). Must state: the shelf is
  local; cover images and post text go to the configured vision provider and to
  OpenLibrary; the recognition log never leaves the machine; affiliate links are used.
- **Permission justifications** for each host permission.
- **Screenshots** (1280×800) and listing copy.
- **Icons** regenerated for the new mark.
- Manifest `name`, `description`, `version` → Shelfy 1.0.0.

**Four of these are yours, not mine**, and the release cannot ship without them: the
$5 Chrome developer registration, the Bookshop and/or Amazon affiliate account (including
checking that either pays out usefully to Argentina — if it is gift-cards-only, the
affiliate plan needs rethinking), publishing the privacy policy to GitHub Pages, and
taking screenshots of a shelf with your own real books on it. I will write the policy
text, the listing copy and the justifications; I cannot create accounts or hold a camera.

## Error handling

Unchanged in shape. Additions:

- A cover that fails to load falls back to the cloth block. An `onerror` handler, not a
  broken-image icon.
- A book with no ISBN and no title cannot produce a buy link; the link is omitted rather
  than pointing at an empty search.

## Testing

Unit-testable, therefore test-first:

- Buy-link construction: ISBN preferred, search fallback, tag present and absent, and a
  book that can produce no link at all.
- `'read'` round-trips through the library and groups under Finished.
- Marking finished does not mark the recognition wrong.
- The filter matches title and author, and is case-insensitive.
- Kept-rate maths is unaffected by finished books.

Verified by hand, as before: the visual system, the sticky headers, the stagger cap.

## What this unblocks

A store listing. After that the numbers say whether the keyless tier is worth building —
and by then the dogfood log will have said whether recognition is worth charging for.
