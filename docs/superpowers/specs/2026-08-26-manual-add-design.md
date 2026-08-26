# Adding a book by hand

**Written 2026-08-26.** Brief: Maximo, *"lets add the feature to manually search and add a
book"*, then **`B`** when offered three placements — a permanent control rather than one that
appears only in empty states.

> **Not served publicly:** `docs/superpowers` is in `.vercelignore` wholesale.

---

## Why this exists

Three separate problems, one control.

1. **Recovery.** `.agents/product-marketing.md` answers *"Will it get the book wrong?"* with
   *"Often enough that nothing is ever saved automatically."* That is honest, and today the
   user's only move when recognition misses is to give up. A manual path is the other half of
   that promise.
2. **Cold start.** A new install opens the popup to an empty board. The shelf IS the product,
   and there is currently nothing a user can do inside the popup to put anything on it. Every
   route in `renderEmpty` sends them back out to a post.
3. **The book that was never a picture.** Heard on a podcast, named in a plain-text
   recommendation thread, remembered from a shop. `product-marketing.md`'s own use-case list
   includes *"a recommendation thread listing ten titles as plain text"*, which the recognizer
   handles only if a picture happens to be attached.

**It is free and unlimited.** Decided by Maximo, 2026-08-26. A manual add never calls the
vision model, so it costs nothing to serve, and gating it would charge a trial slot for free
work. `TRIAL_CATCHES` is untouched. *Catch* stays the paid unit and keeps meaning **Buki
recognised it**, which is what is actually sold.

---

## What this is NOT

Struck deliberately, so nobody re-adds them as "obvious":

- **Not an importer.** No CSV, no Goodreads sync, no bulk paste. Export already exists and is
  one-way on purpose.
- **Not a second search box.** The shelf's existing `Search` still searches *your shelf* and
  its behaviour does not change.
- **Not ISBN entry.** `lookupByIsbn` exists but a person reading a recommendation has a title,
  not a barcode. Revisit only if asked for.
- **Not a way to save a book that is not in OpenLibrary.** No freehand title entry. Everything
  on the shelf stays a real catalogue record with a real cover, because the alternative is a
  shelf of typos that no Buy link and no cover can ever resolve.

---

## Verified before designing, not assumed

Five things were checked in the code. Three of them changed the design.

| Checked | Result | Consequence |
| --- | --- | --- |
| Host permission for OpenLibrary | **`https://openlibrary.org/*` is already in `manifest.json` `host_permissions`** | **No manifest change. No `permissions.md` edit. No new store justification.** |
| Where the OpenLibrary client lives | `background.ts:289`, `withBreaker(createOpenLibraryClient({fetch: net}), catalogue)` | Search goes through the worker and **shares the `catalogue` breaker**. A popup-side client would have bypassed it |
| Whether the save path exists | **It does.** `{ type: 'saveBook'; book; intent; source?; shot? }` and `handleSaveBook` are extracted and tested (item 30) | **No new write path.** Only a read path is new |
| Where provenance is stored | **Nowhere.** `PROVENANCE` is read at `content.ts:1144` only, on the tray's `Card`. It is never persisted | The earlier plan to "add `manual` to `PROVENANCE`" was **wrong**. See below |
| What chrome survives an empty shelf | `paint()` calls `renderEmpty()` and **returns before** building the search row or the pile row | The control **cannot** live in the search row. Only `<header>` persists |

---

## The control

**A `+` button in the masthead, left of Settings.**

The masthead is the only chrome that renders in every state, which is the whole requirement of
placement `B`: a control that lives in the search row is invisible to exactly the new user it
is meant to help.

The masthead is currently `theme toggle · mark + count · Settings`, and popup.ts:323 records
that Settings is *"pinned right, out of the flow, so the mark and the count stay [centred]"*.
The `+` pins the same way, in the same 28px icon box the theme toggle already uses, so the
centring is untouched and no new row appears in a 560px popup.

**Icon only, and quiet.** It gets the theme toggle's visual weight, not Settings'. Buki sells
recognition; a loud *Add a book* would advertise typing over the thing that earns the money.

`renderEmpty` also gains the third route in its copy. It currently names two — *"Press the
Buki button on a post, or right-click any cover image"* — and `docs/brand.md` requires that an
empty state be an invitation. A third route that exists and is unmentioned makes it a worse
invitation, not a better one.

---

## The flow

1. `+` opens **the existing sheet** (`openSheet`/`closeSheet`, scrim, `role="dialog"`,
   `aria-modal="true"`, `data-in` transition). No new overlay primitive.
   *(popup.ts:327's "this popup has no dialog and should not grow one" is about **confirms** —
   it argues for an undo strip over a confirm box. The sheet already sets `role="dialog"`.)*
2. A search field, autofocused, placeholder `Title, or title and author`.
3. Typing debounces at **300ms**, then sends `searchBooks` to the worker.
4. Results render as book rows: cover, title, author, and the three pile buttons unpressed —
   the same shape the catch tray already uses, so there is one idea to learn rather than two.
5. Picking a pile sends the **existing** `saveBook` message, the sheet closes, the shelf
   repaints with the book in it.
6. **Nothing saves without a pile.** *"Nothing reaches your shelf until you pick a pile"* is on
   the listing and in the description. A manual add that saved itself would make that false.

### The states, all four

| State | What it says |
| --- | --- |
| Empty query | The invitation. One line naming what this is for |
| No results | `No book called "<query>".` and the field stays focused so retyping costs nothing |
| Catalogue unreachable | The breaker's own message. Named, never *"something went wrong"* |
| Already on the shelf | The row says which pile it is in, and the pile buttons still work as a **move** |

The last one is not a nicety. `identityOf` already exists and the tray already answers
`alreadySaved`; without it a user re-adds a book they own and gets a duplicate, which is
**item 47's territory** (`ADV-6`, re-catching destroys the good record). This feature must not
open a second door onto that bug.

---

## The protocol

One new message. Additive, no existing shape changes.

```ts
| { type: 'searchBooks'; query: string; seq: number }
```

```ts
export type SearchResponse =
  | { ok: true; seq: number; books: Book[] }
  | { ok: false; seq: number; error: string };
```

**`seq` rather than a cancel message.** `cancelRecognize` exists because a recognition is
expensive, long, and bills money. A catalogue search is one fetch with a timeout and no cost,
so the only real hazard is a *stale response landing after a newer one* and painting the wrong
results. The popup keeps a counter, sends it, and drops any answer whose `seq` is not the
newest. That is smaller than a cancel path and it closes the actual failure.

The handler builds its client exactly as recognition does —
`withBreaker(createOpenLibraryClient({ fetch: net }), catalogue)` — so a failing OpenLibrary
trips one breaker and both paths back off together.

---

## Provenance, corrected

**The original plan was wrong.** It said `PROVENANCE` gains `manual: 'added by hand'`.
`PROVENANCE` is read in exactly one place, `content.ts:1144`, on the catch tray's `Card`, at
the moment of the catch. **It is never written to storage.** `SavedBook.source` is
`{ url, kind }` — a URL, not a label — and the detail sheet renders it as *the post that sold
you*.

So a manually added book **has no `source`**, which is already a legal state that the sheet
already handles by rendering no link. **No `PROVENANCE` change. No migration.**

That leaves one real decision:

**Proposed: `SavedBook` gains `addedBy?: 'hand'`,** and the sheet renders `Added by hand`
where a caught book renders its source link. Optional, so every existing record is valid
unchanged.

**Why not just leave it absent:** the shelf's entire trust claim is that a book tells you
where it came from. Absence is currently indistinguishable from a caught book whose source was
lost, so a silent row makes the sheet ambiguous in the one place the product cannot afford it —
and *"months later you see not just which book you saved, but why you wanted it"* is a
sentence in the store listing.

**Why it might still be YAGNI:** the person who typed the title knows they typed it.

*Maximo decides at spec review. If it goes, delete the field, not the section — the reasoning
is the part worth keeping.*

---

## Testability

`popup.ts` is one of the four files no test can import (item 55, findings M-5/M-6). Putting
this logic there would make it untestable at birth, which is the failure item 43 was filed
about.

**New module: `src/extension/manualAdd.ts`.** It owns the decisions and touches no DOM:

- what a query does. **Fewer than 3 trimmed characters sends nothing** — OpenLibrary answers
  `a` with noise, and a request per keystroke is a request per keystroke against a shared
  breaker that recognition also depends on
- which response to keep (`seq` staleness)
- what a result set means with respect to the shelf (`identityOf`, already-saved → move)
- what a pick writes (the `saveBook` argument, exactly)

Tested against a fake `BooksDb` — the interface already exists, so no mocking framework is
involved. `popup.ts` does DOM wiring only. Same pattern as `activateKey.ts`, `saveBook.ts`,
`ensureTray.ts`.

**Every guard gets mutated before commit**, per `OPENWORK.md` §5. A guard that has not been
watched to fail is not evidence.

---

## What changes, by file

| File | Change |
| --- | --- |
| `src/extension/manualAdd.ts` | **New.** The decisions, tested |
| `src/extension/manualAdd.test.ts` | **New** |
| `src/extension/messages.ts` | `searchBooks` request, `SearchResponse` |
| `src/extension/background.ts` | The handler; same client and breaker as recognition |
| `src/extension/popup.ts` | The `+` button, the sheet contents, DOM wiring only |
| `popup.html` | The `+` in `<header>`, and its styles |
| `src/extension/storage.ts` | `addedBy?: 'hand'` **(pending the decision above)** |
| `docs/store/listing.md` | **The single-purpose statement.** See below |
| `README.md`, `docs/index.html` | Only if they enumerate the ways a book arrives |

**No manifest change. No new permission. No `permissions.md` edit. No pricing surface. No
`TRIAL_CATCHES`. No `mastheadLine`.**

---

## The single-purpose statement, which is the launch-critical part

Today:

> *Buki identifies books shown in pictures on web pages and saves them to a reading list
> stored in the user's own browser.*

`docs/store/listing.md` calls this *"the field most likely to fail review"* and records that
the previous version would have failed, because it was **narrower than the permissions beside
it**. A manual add involves no picture and no web page, so shipping this feature under that
sentence recreates exactly the mismatch that file exists to prevent.

Proposed:

> *Buki identifies books from pictures on web pages, and keeps them on a reading list stored
> in the user's own browser.*

One purpose, not two: the list is the purpose and identifying is what it is *for*. It still
covers every entry point the manifest has, and it now also covers a book put on the list by
hand. **This must land before submission.** Store copy cannot be edited afterwards without
another review cycle, which is the same reason item 45 is at the front of the queue.

---

## Risks

| Risk | Answer |
| --- | --- |
| Advertises typing over recognition | The control is icon-only at the theme toggle's weight, not Settings' |
| Duplicates a book already on the shelf | The already-saved state, using the existing `identityOf`. Guarded, and it is item 47's bug |
| OpenLibrary search quality is poor for vague titles | Author is accepted in the same field. If it is still poor, that is data to gather, not a reason to hand-roll matching |
| Scope, pre-launch, with six blockers open | Real. But the single-purpose sentence is **free to change now and expensive after submission**, which makes now the cheap moment rather than the costly one |
| `PROVENANCE`'s `Record<string, string>` accepts any key silently | Noted, not fixed here. That is item 53 (`TS-1/2/3/4/7`) |

---

## Done means

- `manualAdd.ts` exists, is imported by a test, and every guard in it has been watched to fail
- A book can be found by title and put on a pile, from an empty shelf, with no picture involved
- Re-adding a book already on the shelf **moves** it and never duplicates it
- `TRIAL_CATCHES`, `mastheadLine` and every pricing surface are byte-identical
- The single-purpose statement covers the feature
- `vitest run`, `tsc --noEmit`, `node build.mjs` all clean
