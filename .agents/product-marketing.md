# Product Marketing Context

**Document version:** v9
**Last updated:** 2026-08-17

## Product Overview

**One-liner:** Catch a book from any image on the web into a shelf that is yours.

**What it does:** Buki is a Chrome extension that recognises a book from a *photograph*,
not from the text around it. Right-click any cover image anywhere on the web, or press the
book icon on a post on X, and Buki reads the picture, confirms the book against
OpenLibrary, and files it on a face-out shelf under Now, Next, Someday or Read. It keeps
the post you caught it from, so months later you can see not just which book you saved but
why you wanted it. The shelf lives in the browser and is never synced anywhere.

**Product category:** Book capture. Sits beside "reading list" and "book tracker" in how
people search, but the job is upstream of both: trackers begin after you already know the
title. Buki is how you get the title.

**Product type:** Chrome extension (MV3), local-first, MIT licensed. Freemium with a
hosted recognition service.

**Business model:**
- **Free forever:** unlimited catches from retailer links, the entire shelf, export to
  Goodreads/StoryGraph, and unlimited cover-photo recognition with your own API key.
- **10 hosted catches free**, no key, no card, no account. Zero setup at install.
- **Pro $4/month or $29/year:** hosted instant recognition with no key and no throttling,
  and sync plus backup when it ships.
- Affiliate revenue from Buy links (disclosed in three places, never reorders results).

## Target Audience

**Target customers:** Individual readers who spend time on X, Reddit, YouTube, newsletters
and blogs, who see books recommended in passing and mean to read them. Not organisations.
No buying committee.

**Primary use case:** You see a book in a post, you save the post, and the book disappears
into a bookmark folder you will never open again.

**Jobs to be done:**
- "When I see a book I want, help me keep it somewhere I will actually look."
- "When I look at my list later, remind me *why* I wanted this one."
- "Tell me what this book is when the picture is the only clue."

**Use cases:**
- A photo of a stack of books on someone's desk, no titles in the text
- A shelf behind someone's head in a video thumbnail
- A cover in a Reddit post, a newsletter screenshot, a friend's blog
- A recommendation thread listing ten titles as plain text

## Personas

Not applicable. Consumer product, single buyer, no committee.

## Problems & Pain Points

**Core problem:** Bookmarks are where books go to die. A saved post is not a saved book:
it has no title you can search, no cover you can recognise, no sense of whether you meant
it or impulse-saved it, and it sinks under everything saved after it.

**Why alternatives fall short:**
- **Google Lens** identifies the book, then hands you a search page that evaporates. It
  answers "what is this?" and never "and I want to read it."
- **TBR Bookmarker and similar extensions** read the *text* of a page. A photograph of a
  book with no title written anywhere is invisible to them, which on X is most books.
- **Phone scanner apps** (TroveScore, Shelf Scan, ScanMyBook) use the same recognition
  technology but assume the book is physically in your hands. They cannot help at 11pm
  when the book is on a screen.
- **Goodreads and StoryGraph** begin after you already know the title and are willing to
  type it. That typing is the step where the intention dies.

**What it costs them:** Books they genuinely wanted to read, never read. Not measurable in
dollars, which is why the product is priced low and sold on relief rather than ROI.

**Emotional tension:** The quiet guilt of a bookmark folder. Knowing there were good things
in there and no longer being able to find them, or trust which ones you meant.

## Competitive Landscape

**Direct:** TBR Bookmarker (Bookship) reads page *text* only, so it cannot see a book that
exists only as a photograph. BookFinder requires you to highlight the title as selectable
text.

**Secondary:** Google Lens. Free, pre-installed, in the same right-click menu, and better
at recognition than Buki can afford. Falls short because it produces an answer, not a list.
No shelf, no intent, no provenance, nothing to return to.

**Indirect:** Chrome's own Reading List and plain bookmarks save *pages*, not books. This
is the behaviour Buki replaces, and it is the real competitor.

Full research in `competitor-profiles/_summary.md`.

## Differentiation

**Key differentiators:**
1. **Reads the picture, not the caption.** The whole category above either reads text or
   needs the physical book.
2. **Works anywhere there is an image.** Not one website. Not a phone camera.
3. **Keeps the post that sold you on it.** No competitor found stores *why* you saved a
   book. This is the hardest to copy and the reason a shelf gets opened in March.

**How we do it differently:** The picture and the post's words go to a vision model
together, because the caption is often what makes an unreadable cover legible, and the
guess is then confirmed against OpenLibrary rather than trusted. Nothing is ever saved
without you choosing a pile.

**Why that's better:** You end up with books, filed by intention, with their reason
attached, instead of a folder of links.

**Why customers choose us:** It is the only thing that works at the moment the book appears
on the screen.

## Objections

| Objection | Response |
| --- | --- |
| "Google Lens does this for free." | Lens tells you what the book is. It does not keep it. Close the panel and it is gone. Buki is the shelf, not the answer. |
| "Why pay when the code is MIT and free?" | You never have to pay. Bring your own recognition key and it is unlimited, forever. Pro is for people who would rather not hold a key. |
| "Is my reading list being harvested?" | There is no account and no sync. The shelf is in your browser. Only the picture you ask us to identify leaves your machine, and only when you ask. |
| "Will it get the book wrong?" | Often enough that nothing is ever saved automatically. You confirm every book, and the shelf shows its own kept rate so you can see how much to trust it. |
| "$4 a month for an extension?" | Ten catches free, no card, no account. If it has not earned it by then, do not pay. |

**Anti-persona:** Someone who wants a social reading network, ratings, reviews, challenges
or friends' shelves. Buki has no social layer and is not going to grow one. Send them to
StoryGraph or Goodreads, and give them a CSV so they can take their shelf with them.

## Switching Dynamics

**Push:** A bookmark folder that has become useless. The specific memory of a book they
wanted and cannot name.

**Pull:** Recognition from a photo, which nothing else in the browser does, and a shelf
that looks like a shelf.

**Habit:** Bookmarking is one keystroke and costs nothing in the moment. That is the real
incumbent.

**Anxiety:** "Another list I will abandon." Answered by zero setup, zero account, and the
shelf being visibly small and finite rather than an inbox.

## Customer Language

**How they describe the problem (verbatim, founder as first user):**
- "I was tired of seeing books on X and saving them but they stayed hidden in my bookmarks."
- "They stayed hidden in my bookmarks."

**How they describe us:**
- "It reads the cover."
- "It doesn't need to stay on X. I can use it everywhere."

**Words to use:** catch, shelf, pile, the post that sold you, face out, read the picture,
yours.

**Words to avoid:** *organise*, *manage*, *productivity*, *AI-powered*, *seamless*,
*game-changing*, *revolutionise*. Also avoid *scan*: it implies a camera and a physical
book, which is the competitor's job, not ours. No em-dashes anywhere (see `docs/brand.md`).

**Glossary:**

| Term | Meaning |
| --- | --- |
| Catch | One act of recognising and saving a book. The unit of value and of price. |
| Shelf | The user's whole collection, face out, in the popup. |
| Pile | Now, Next, Someday, Read. A place you stand in, not a label. |
| The post that sold you | The source a book was caught from, kept with it. |
| Cloth / binding | The generated cover drawn when no art exists. |

## Visual Identity

Established 2026-08-11, rebuilt 2026-08-15, and **the extension turned again on
2026-08-16**. **Full system in `docs/brand.md`, which owns this. Everything here is a
pointer; if the two disagree, `brand.md` wins.**

**The landing and the extension are on different generations, deliberately.** The landing
is third: the world of the plates, cream sampled from the artwork. The popup, the setup
page and the catch tray are **fourth**: Apple's system neutrals top to bottom with true
black at night, materials on the masthead and the scrim, and a detail sheet rebuilt as one
centred column. The landing is the brand's world; the extension is the tool, and it should
feel native to the browser it lives in.

**Two colours cross that line and they are the ones that matter:** the cobalt accent and
the five book dyes. Those carry the identity, so the extension going neutral costs nothing
and the covers got louder against a grey ground than they ever were against beige.

Copy written against any earlier identity is still true about the *product*; only the look
changed.

**What changed and why it matters to positioning.** The landing was cream with a serif
display, which is the single most common look in machine-generated design, and it read as
old. The plates are the only genuinely distinctive asset here, so the type stopped
competing with them: **Manrope, one family, no serif in the interface at all**, the plate
full-bleed at 100svh, a floating glass pill for navigation, capsule controls with a real
press, and a light/dark switch. Font payload fell from 121KB to 25KB on the landing and
49KB on the extension.

**The world:** two duotone plates, both 18th-century architectural capricci, both public
domain, duotoned from 4000px museum scans. Both are a threshold you look through, which is
the product's gesture. The palette is sampled from the artwork and then pushed apart until
every text pair clears AAA.

**Type:** **Manrope**, one variable family, 25KB, self-hosted, doing display and body on
every surface. No third party, because a Google Fonts request would log the visitor's IP on
a page whose whole claim is that nothing about them is collected. It ships no italic and
`font-synthesis: none` forbids a faked one, so **emphasis is the accent colour, never a
slant and never a fade**. The only serif left is the system serif, and it sets book titles
and nothing else, because that is what a real book stamps on a board.

**The mark: the catcher — a blue ball with two big eyes and a catchlight in each.** Drawn by
Maximo (*"i added the newLogo.png use that everywhere"*), sampled rather than redrawn, and
**defined once in `tools/mark.mjs`** with six surfaces asserted against it. It looks at you,
and that is the entire argument: the thing Buki does is **see** a book in a picture, which
is what separates it from a reading list. It must never become a book glyph, an open book, a
bookmark ribbon, or a letter B.

It did not cost the product its colour: the ramp's deep end is within a hair of the cobalt
accent. **Copy may say it looks at you; do not describe it as a book, a shelf or spines.**

*(Superseded on 2026-08-17: three spines, two shelved and one pulled out and lit. That mark
is retired on every surface, its `--mark-spine` / `--mark-caught` tokens are deleted, and
`brand.md` keeps the drawing only as a dated record. Any line leaning on "one spine pulled
out and lit" is describing a logo that no longer ships. **This paragraph said otherwise for
a day after v8's own changelog announced the change** — the changelog was updated and the
body was not, which is what a fact kept in two places does.)*

**The rule that governs every layout:** a plate carries a statement, the cream carries the
reading. Anything a person has to read more than once belongs on the page, never on the
picture.

**Hierarchy is size and weight, never a fade.** Every sentence is set at full contrast on
every surface. This is a compliance matter as well as a taste one: the affiliate disclosure
used to be small grey text, and Chrome Web Store policy permits affiliate links **only when
they are disclosed**.

**Surface consistency:** one system, four surfaces. The in-page catch tray takes two thirds
of it and refuses one third, and the refusal is a decision rather than drift: it renders
inside somebody else's page, so it stays **opaque** (a translucent card over an unknown
photograph has a contrast nobody chose) and ships **no webfont** (Manrope would need
`web_accessible_resources` matching `<all_urls>`, which is a wider exposed surface than a
340px card is worth immediately before store review).

## Brand Voice

**Tone:** Plain, warm, unhurried. Writes from the reader's side of the screen.

**Style:** Says what happens. Active voice. Errors state the fact, never apologise, never
say "something went wrong." Empty states are invitations.

**Personality:** Made by a person. Quiet. Literate. Honest about limits. Never salesy.

Full rules in `docs/brand.md`.

## Proof Points

**Metrics:** The shelf reports its own kept rate on the masthead (`23 caught · 78% kept`),
which is a rare thing for a recognition product to publish about itself. Local OCR
(Tesseract) measured ~5% on real covers, which is why a vision model is used instead.

**Customers:** None yet. Pre-launch, zero users. Do not fabricate any.

**Testimonials:** None yet. The founder is the only documented user, and the origin story
is his own.

**Value themes:**

| Theme | Proof |
| --- | --- |
| Reads the picture | Vision model plus OpenLibrary grounding; multi-book from one photo |
| Yours, not ours | No account, no sync, `chrome.storage.local`, MIT source |
| Nothing saved by accident | Auto-save was built, then deliberately removed |
| It remembers why | `SavedSource` keeps the post, unique in the category |

## Goals

**Business goal:** First paying customers. Validate that removing setup friction converts,
before building sync.

**Conversion action:** Install from the Chrome Web Store, then upgrade at the tenth catch.

**Current metrics:** Zero users, zero revenue. Baseline is being set now.

## Changelog

*Newest first. One line per revision: what changed and why.*
- v9 (2026-08-17). **A correction, not a change: v8 contradicted itself.** Its changelog
  announced that the three-spine mark was retired while its Visual Identity section went on
  describing three spines, two cords and the caught spine's per-ground values as current —
  and the body is the half a copy task actually reads. The mark paragraph now describes the
  catcher and keeps the retired drawing as a dated note. **Positioning, audience, pricing,
  objections and customer language are unchanged**, so copy built against v1–v8 is still
  true about the product; only a line leaning on spines is not. Also fixes the header, which
  said v8 was last updated 2026-08-16 while the v8 entry below is dated 2026-08-17.
- v8 (2026-08-17). **The paid tier exists in code, and the mark changed.** Two things a
  copy task must not get wrong now. First, the Pro tier is no longer a plan: the wall, the
  entitlement gate, the licence exchange and both serverless handlers are written and
  tested, and what remains is a Polar product and five Vercel variables. Copy may describe
  Pro as real; it may NOT yet describe it as available, because nobody can buy one.
  Second, **the three-spine mark is retired** — the mark is the catcher, a blue ball with
  two eyes, on every surface. Any positioning line that leans on "three spines, one caught"
  is describing a logo that no longer ships. The trial number, the price and the anchor the
  extension links to are all asserted by `src/shared/pricing.test.ts`; do not restate a
  price here.
- v7 (2026-08-16). **Visual Identity only, again, and it is a real change rather than a
  correction.** The extension turned to iOS system neutrals: Apple's greys, true black at
  night, materials where it has real layers, and a detail sheet rebuilt as one centred
  column. The landing is untouched and the two are now on different generations on
  purpose. The cobalt accent and the five dyes cross that line and nothing else does.
  **Positioning, audience, pricing, objections and customer language are unchanged**, so
  copy built against v1–v6 is still true about the product.
- v6 (2026-08-16). **Visual Identity only, and it was four expired claims, not a
  repositioning.** v5 was written mid-session and outlived its premises within hours: it
  said the mark has *two* spines and the brand story needed rewriting (resolved the same
  day, it is three, and the story never needed rewriting), that the type is *Petrona and
  Instrument Sans* (contradicting its own paragraph four lines above naming Manrope), that
  the extension had not reached the third generation (it did, that day), and that the catch
  tray is not part of the system (it is, minus two named exceptions). **Positioning,
  audience, pricing, objections and customer language are all unchanged**, so copy built
  against v1–v5 is still true about the product. The section is now a pointer to
  `docs/brand.md` rather than a second copy of it, which is what let it drift. Also records
  the caught spine's per-ground values after the 2026-08-16 fix.
- v5 (2026-08-15). **Visual identity rebuilt on the landing only.** The cream-plus-serif
  composition was the first of the three looks generated design defaults to, and it read as
  old; the serif is gone, Manrope does display and body, the plate is full-bleed, and there
  is a light/dark switch. The mark is the three-spine one, redrawn as geometry
  on the landing. **Positioning, audience, pricing and objections are all unchanged**, so
  copy built against v3 or v4 is still true. Two things are now open: the brand story still
  says "three spines, one pulled out and lit", and the icon set still carries that mark.
- v4 (2026-08-13). Export to Goodreads/StoryGraph **shipped and moved to Free**. It was
  advertised as a Pro feature while `docs/pricing.md` simultaneously said the paid tier
  gates one thing only and the shelf is never gated; the contradiction was resolved in
  favour of the latter, so "you would rather not hold a key" is once again the entire
  difference between the tiers. Positioning and audience unchanged. Two advertised things
  still do not exist: the hosted proxy and the ten free catches.
- v3 (2026-08-13). Visual Identity rewritten after the mark shipped and the extension
  surfaces were realigned to the landing. Positioning, audience and pricing are unchanged,
  so copy built against v1 or v2 is still valid. Records that three advertised features do
  not exist yet: the hosted proxy, the ten free catches, and Goodreads export. *(Goodreads
  export shipped in v4.)*
- v2 (2026-08-11). Added Visual Identity after the landing was rebuilt twice: the duotone
  plates, the sampled palette, the self-hosted type, and the plate-versus-cream rule.
  Positioning and audience are unchanged, so downstream copy built against v1 is still
  valid. Records that the plates' provenance is unconfirmed.
- v1 (2026-08-09). Initial context. Captures the repositioning from an X-only free tool
  to "any image anywhere" with a freemium hosted tier, and records the competitor research
  that identified provenance ("the post that sold you") as the defensible differentiator.
