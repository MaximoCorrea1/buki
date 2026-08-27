# Can Buki find a book from a passage? A probe, not a design

**2026-08-27.** Maximo: *"HUGE IDEA: FIND ANY BOOK FROM A PASSAGE, PHRASE, PAGE, IS THAT
DOABLE?"*

> **Not served publicly:** `docs/superpowers` is in `.vercelignore` wholesale.

**Short answer: reading the passage is easy, and that was never the hard part. Grounding it
is the hard part, and the obvious way of doing it does not work.** The probe is below and it
overturned my own first assessment, which is the reason it was run before anything was built.

---

## Why grounding decides this

Reading a page is free: a photograph of a page is just another image, and the vision model
already takes images. The prompt changes and nothing else does.

But a cover read is **checkable** - title and author against the catalogue, which is what
`recognizeBook` already does and what lets the tray say *read from the cover*. A passage is
not, because the passage text appears nowhere in catalogue metadata.

Without a check, a model asked "what book is this paragraph from" will answer confidently
and often wrongly, and Buki would be shipping a guess wearing the trust story. That is the
opposite of the product. **So the feature is the grounding, not the reading.**

---

## The probe

`https://openlibrary.org/search/inside.json?q="<passage>"` - OpenLibrary's full-text search
over scanned books. Three queries, **one at a time with a 2.5s pause**, because nineteen
concurrent searches earned an HTTP 429 and two minutes of nothing earlier the same day.

| Query | Result |
| --- | --- |
| *"It is a truth universally acknowledged, that a single man in possession of a good fortune"* | HTTP 200, 4850ms, **2,228 hits**. Top three: an untitled record, *WHS Challenge KS3 English Year9*, and *Twentieth century interpretations of Pride and prejudice* |
| *"the sun also ariseth, and the sun goeth down..."* | HTTP 200, 4194ms, 1,100 hits. Top three: *The wisdom of God*, *A treasury of Proverbs*, *The sun do move* |
| *"he opened the door and walked into the room"* (deliberately generic) | HTTP 200, 5025ms, 102 hits, all noise |

### What that says

1. **The endpoint is real and it answers.** It is not a dead path.
2. **THE RANKING IS THE PROBLEM.** The first query is the most famous opening sentence in
   English literature and **Pride and Prejudice is not in the top three.** A textbook and a
   volume of criticism are. That is not a fluke, it is what full-text over a scanned library
   does: anthologies, textbooks, criticism and quotation collections all contain the passage,
   and the source book competes with every one of them on equal footing.
3. **It is slow.** 4.2 to 5.0 seconds, against an existing `TIMEOUT_MS` of 6,000 in
   `openLibrary.ts`. A passage lookup would live permanently at the edge of that timeout.
4. **The response is a raw Elasticsearch document** - `hits.hits[]` with `highlight`,
   `_score`, `_id`, `fields` - not a curated API. Titles are frequently absent and authors
   always are, so every hit costs a second lookup to become a book.
5. **The generic sentence returned noise rather than a confident wrong answer**, which is the
   one encouraging result: the failure mode is "nothing useful", not "the wrong book stated
   firmly".

**Conclusion: the obvious design - search the passage, take the top hit - does not work.**
It would put a KS3 revision guide on the shelf and call it Jane Austen.

---

## The design that might

**Invert the query.** Instead of asking the catalogue *"which of two thousand books contains
this passage?"*, ask the model first and use full text only to CHECK it:

1. The vision model reads the passage and names a book. It is good at this for anything
   well known, and this is the step it is actually suited to.
2. Full-text search is then scoped to that book, asking a **precision** question - *is this
   passage in this book?* - rather than a ranking one.
3. Confirmed becomes a catch. Unconfirmed says so, in the tray's own voice, and offers
   nothing rather than a guess.

This is the same shape `recognizeBook` already has, which is the argument for it: the model
proposes and the catalogue disposes. It fails the same honest way too, landing on
`unverified` rather than on a wrong book.

**What has NOT been probed, and must be before any of this is designed:** whether
`search/inside` can be scoped to a work or edition at all. If it cannot, this design has no
floor and the answer becomes Google Books full text, which has better ranking, a key, and a
quota - a different set of trade-offs entirely.

---

## Recommendation

**After launch, and the next step is one more probe rather than a spec.** Scoping is what
decides whether the inverted design exists at all, and it is a single request to find out.

Filed as `OPENWORK.md` item 57.

**It stays worth doing.** Passage and quote screenshots are more common on X than photographs
of covers, and the positioning bends to fit without breaking: *reads the picture, not the
caption* becomes *reads the picture, whether it is a cover or a page.* The reason to wait is
not that the idea is weak; it is that the version of it that could be built today would put
the wrong book on the shelf with a straight face.
