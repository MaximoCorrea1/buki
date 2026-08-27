# Can Buki find a book from a passage? Probed twice, and the second probe overturned the first

**2026-08-27.** Maximo: *"HUGE IDEA: FIND ANY BOOK FROM A PASSAGE, PHRASE, PAGE, IS THAT
DOABLE?"* Then, later the same day: *"lets see if we cant solve the 'find any book from
phrase, passage, page etc'"*.

> **Not served publicly:** `docs/superpowers` is in `.vercelignore` wholesale.
>
> **Re-runnable:** `node tools/probe/passage-grounding.mjs`, from the repo root. Every number
> below is one query in that file. It hits a live third-party endpoint, so it is a probe and
> not a test: it is not in the vitest suite and its numbers are expected to move. **What it
> must keep proving is the SHAPE.**

---

## ⚠ THE VERDICT CHANGED. Read this before reading anything below it

**Round one concluded the feature had no floor. Round two found the floor.** Both rounds are
kept here, because the reason round one was wrong is the more useful lesson.

| | Round 1 (morning) | Round 2 (afternoon) |
| --- | --- | --- |
| **Can full text be scoped to a book?** | *"has NOT been probed, and must be"* | **YES** — not by field, by bare boolean term |
| **Verdict** | naive design dead, inverted design unproven | **inverted design has a floor and refuses correctly** |
| **The blocker** | thought to be ranking | **is COVERAGE**, and ranking is a solved problem |

---

## Round 1 — what it got right, and it is most of it

Three queries, one at a time with a 2.5s pause, because nineteen concurrent searches earned
an HTTP 429 and two minutes of nothing earlier the same day.

| Query | Result |
| --- | --- |
| *"It is a truth universally acknowledged…"* | HTTP 200, 4850ms, **2,228 hits**. Top three: an untitled record, *WHS Challenge KS3 English Year9*, and *Twentieth century interpretations of Pride and prejudice* |
| *"the sun also ariseth…"* | HTTP 200, 4194ms, 1,100 hits. Top three: *The wisdom of God*, *A treasury of Proverbs*, *The sun do move* |
| *"he opened the door and walked into the room"* (deliberately generic) | HTTP 200, 5025ms, 102 hits, all noise |

**Still true, and round two reproduced all of it:**

1. **The endpoint is real and it answers.**
2. **THE NAIVE DESIGN IS DEAD.** Search the passage, take the top hit, and you put a KS3
   revision guide on the shelf and call it Jane Austen. Round two found the same failure in
   a second book: *"It was a bright cold day in April"* AND nothing else ranks *Nineteen
   Eighty-Four* below an Orwell symposium, a novel called *Wanksy*, and a grammar textbook.
   **Not an Austen-anthology fluke. General.**
3. **The honest failure mode.** The generic sentence returned noise, not a confident wrong
   answer.
4. **The right shape is the shape `recognizeBook` already has:** the model proposes and the
   catalogue disposes.

**One claim was WRONG and round two corrected it.** Round one recorded *"Titles are
frequently absent and authors always are, so every hit costs a second lookup to become a
book."* Every hit carries **`meta_title`, `meta_creator`, `identifier` and `page_num`**. The
second lookup does not exist, and the payload already holds what the check needs.

---

## Round 2 — the probe round 1 said had to happen

### A. Field scoping is dead, and round one nearly mis-read why

`edition_key:OL1234567M` returns 0. So does `meta_title:"Pride and Prejudice"`. So does
`meta_creator:Austen`. **So do the negative controls that were supposed to return 0.**

**When the control and the treatment give the same answer, the instrument told you nothing.**
A wrong field name and an unsupported filter look identical from outside. So the discriminator
was a filter that MUST match everything:

```
"<passage>" AND meta_mediatype:texts     ->  total = 0
```

`texts` is the mediatype of every document in the corpus. A filter that cannot match
everything is not being applied. **The `meta_*` keys are STORED, not INDEXED.** The
`&edition=`, `&ia=` and `&sort=` query parameters are ignored too — all three return the
identical 2,228 and the identical top hit.

*This is the mutation-testing discipline pointed at a probe. A guard never watched to FAIL is
not evidence; a filter never watched to PASS is not evidence either.*

### B. Bare boolean scoping works, and it is enough

```
"<austen passage>"                ->  2,228 hits, book absent from the top 3
"<austen passage>" AND Austen     ->    227 hits, top hit "Pride and prejudice, Jane Austen"
"<austen passage>" AND zzqxwv…    ->      0 hits   (negative control: AND does narrow)
```

**That is the floor round one said might not exist.**

### C. But the COUNT is not the check, and reading it as one would ship the bug

`AND <author>` is not a filter. It is one more relevance term.

```
"<austen passage>" AND Hemingway  ->  115 hits, top "Book girl's guide to cocktails for book lovers"
```

**Hemingway is a cocktail.** Any design that reads *"115 > 0, confirmed"* puts Hemingway on
the shelf wearing the trust story. Same for Melville→Dickens (40 hits, *Great beginnings:
opening lines of great novels*) and Orwell→Tolkien (5 hits, *Caring for your books*).

### D. The TITLES are the check, and they discriminate 5 of 5

The signal was in the payload the whole time. Compare the model's proposed title against the
hit titles — **starts-with, not contains**, because *"Twentieth century interpretations of
Pride and prejudice"* contains the title and is criticism, while *"Pride and prejudice, Jane
Austen"* starts with it and is the book.

| Book | right author | wrong author | discriminates |
| --- | --- | --- | --- |
| Pride and Prejudice | rank 1 | none | ✔ |
| Nineteen Eighty-Four | rank 6 | none | ✔ |
| Moby-Dick | rank 3 | none | ✔ |
| A Tale of Two Cities | rank 1 | none | ✔ |
| Frankenstein | rank 1 | none | ✔ |

**It costs no extra request.** The titles are already in the response that answered the query.

**Three of those five matches are not the book itself** — a companion to *1984*, *Moby-Dick
centennial essays*, and *Frankenstein according to Spike Milligan*. **That is fine, and
saying why is the point:** the hit's title never reaches the shelf. The MODEL's proposal
does, grounded through the existing `recognizeBook` path. The hit is only evidence that *a
book of that name contains this passage*, and a companion to *1984* quoting its opening line
is exactly the evidence you would want. The wrong-author controls produced cocktail guides
and voice-articulation textbooks — **no title relationship at all**, which is the difference
the check reads.

### E. It refuses the mistake a model actually makes

Wrong-author is not the realistic hallucination. **Wrong book by the right author is.**

```
Austen passage, model proposes …
  "Emma"                   -> refused
  "Persuasion"             -> refused
  "Mansfield Park"         -> refused
  "Sense and Sensibility"  -> MATCHED at rank 8  ("Sense and sensibility and Pride
                                                   and prejudice--Jane Austen")
  "Pride and Prejudice"    -> matched at RANK 1
```

Seven of eight refused across Austen and Dickens. **The eighth is closed by taking the BEST
title match rather than ANY title match:** the omnibus sits at rank 8, the right answer at
rank 1.

---

## ⛔ The real blocker, and it is not the one round one named

**COVERAGE.** Round one worried about ranking. Ranking is solved. This is not:

| Passage | total | found |
| --- | --- | --- |
| *The Hunger Games* (Collins) | 1 | **no** |
| *Gone Girl* (Flynn) | **0** | no |
| *The Road* (McCarthy) | 3 | **no** |
| *Normal People* (Rooney) | **0** | no |

**Four modern in-copyright novels, none found, two returning literally zero hits.** The
corpus is scanned-and-open books. Public-domain classics are in it; contemporary fiction is
not.

**This decides what the feature may PROMISE**, and it is a product question before it is an
engineering one: *what do people screenshot passages of on X?* A Kindle highlight of a novel
published last year is the common case, and it is the case this cannot answer. A photographed
page of Dostoevsky is the case it can.

**Second constraint:** latency measured **982ms to 9,983ms** across 19 queries. `TIMEOUT_MS`
in `openLibrary.ts` is **6,000**. The max exceeds it, so some fraction of lookups will time
out no matter what — which is survivable only because the design's failure mode is *"could
not confirm"* rather than a wrong book.

---

## The design, now that it has a floor

1. The vision model reads the passage and proposes **title + author**. It is good at this for
   anything well known, and this is the step it is suited to.
2. **One** full-text query: `"<passage>" AND <author surname>`.
3. **Client-side**, over the ~20 hits already returned: is there a hit whose title
   starts-with the proposed title? Take the **best-ranked** such hit.
4. Confirmed → a catch, grounded through `recognizeBook` exactly as a cover read is.
   Unconfirmed → says so in the tray's own voice and offers **nothing** rather than a guess.

`bookIdentity.ts` already holds the title-comparison machinery (`titleParts`, `normAuthor`),
and the query needs the surname `normAuthor` already extracts. **The pieces exist.**

---

## Recommendation

**Still after launch, and the reason has changed.** It is no longer *"the version buildable
today would put the wrong book on the shelf"* — that risk is now measured and refused. It is
that **coverage caps the feature at the public domain**, and that is a positioning decision
before it is a build.

**What is left to decide, and it is Maximo's:** does *"reads the picture, whether it is a
cover or a page"* survive the sentence that has to follow it — *"for books old enough to be
in the open library"*? If yes, this is a build of known size. If no, the alternative is
Google Books full text, which has better coverage, a key, and a quota — a different set of
trade-offs, and one this probe did not measure.

**`OPENWORK.md` item 57.**
