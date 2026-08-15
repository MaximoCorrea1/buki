# Buki

Catch a book from a picture into your own shelf, before it gets lost in your bookmarks.

You spot a book in a post, save it, and never see it again. It sinks under memes and
threads with no way to tell the ones you meant it about from the impulse saves. Buki gives
those books a place: it recognizes the book **from the cover photograph**, keeps the post
that sold you on it, and files it under **Now / Next / Someday**. Mark a book finished when
you're done, and every saved book carries a quiet Buy link.

> **Branch note.** `main` is the shipped extension. **`buki-pro`** is an unmerged branch,
> 35 commits ahead as of 2026-08-15, carrying catch-anywhere, shelf export, a rebuilt
> landing, the new mark, and the decision layer for the paid tier. **This file describes
> `buki-pro`, because that is where the work is.** What is built, what is not, and what is
> blocked is an ordered checklist in `OPENWORK.md`. Read that first.
>
> **Two** things the landing advertises do not exist yet: the hosted proxy and the ten free
> catches. Both wait on `OPENWORK.md` items 1 and 2, which are Maximo's, and both are
> unblocked the moment a Polar product and five Vercel variables exist. Today recognition
> needs the user's own API key. Export to Goodreads and StoryGraph **shipped on 2026-08-13**
> and is free on every tier.

## Two ways to catch a book

**Right-click any cover image, anywhere on the web → "Save book to shelf."** The cover and
the surrounding words go to a vision model together and the guess is grounded against
OpenLibrary. This is the one that works on a photo with no link and no title in the text,
and it is no longer scoped to X: the worker injects the catch tray on demand under
`activeTab`, and asks for one host origin only when the picture needs one.

**Hit 📚 on a post.** Same recognition: link, then cover and words together, then the
post's text.

Either way a card appears in the corner with what it found, and **nothing reaches the shelf
until you choose a pile.** One photo can hold several books, so a stack on a desk gets a row
and a decision each, or you take the lot at once. A book already on your shelf says so, and
says which pile it is in, before you touch anything.

## Your shelf

Books stand **face out**, four to a board, in a popup you open on purpose. The four piles
are places rather than headings: a segmented control at the top, and the view below shows
that pile and only that pile. Search crosses all four at once and tags each hit with where
it lives, because finding a book is a different job from browsing a pile.

Clicking a cover takes the book off the shelf into a sheet, where the same segmented
control that says where it is, moves it.

A cover is the picture the book was caught from. If the catch had no picture, it is the
catalogue's art; if there is neither, Buki draws a board from the book itself: a deep dyed
binding, two stamped rules, and the book's own hashed character grid repeated into cloth.
That last one exists because OpenLibrary has no art for a large share of books and spent
2026-08-04 answering nothing at all, and a face-out shelf where a third of the covers are
missing looks broken.

Your shelf lives in the extension. Nothing is synced anywhere.

## Install (development)

```bash
npm install
node build.mjs
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select this folder. Requires Chrome 116+, because cancelling a lookup combines the job's
abort signal with each client's own timeout via `AbortSignal.any`, which landed in 116.

**One-time setup.** Reading a cover from a photo is the only thing Buki can't do on your
machine, so it needs a vision model. The options page opens on install: paste a free key
from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (about two minutes,
no billing details). Google's free tier covers normal use, and the key is stored locally
and sent only to the provider you configure.

Any OpenAI-compatible endpoint works instead: Gemini, Cloudflare Workers AI, OpenRouter,
or your own proxy. A proxy that holds its own credential lets you leave the key blank,
which is how a hosted build keeps users keyless.

Without a key, Buki still catches books from retailer links and from a post's own words.
Only reading a cover from a photo needs one.

## Scripts

| Command | What it does |
| --- | --- |
| `node build.mjs` | Typechecks and bundles into `dist/` |
| `npm run build` | Same thing, via npm |
| `npm test` | Runs the vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run icons` | Regenerates `icons/*.png` |

The build typechecks first and refuses to bundle on a type error, because esbuild only
strips types, it never checks them.

**On Windows:** from Git Bash, `npm run <script>` and `npx` both fail. npm hands the script
to `cmd.exe`, whose shim quoting breaks with `"node" is not recognized`. They all work from
PowerShell. From Git Bash use the `node` entry points directly:

| Instead of | Run |
| --- | --- |
| `npm run build` | `node build.mjs` |
| `npm test` | `./node_modules/.bin/vitest run` |
| `npm run typecheck` | `node node_modules/typescript/bin/tsc --noEmit` |
| `npm run icons` | `node tools/make-icons.mjs` |

Only the build has a real single-file entry point; the other two are invoked directly
because they are third-party binaries.

## How recognition works

Cheapest, highest-precision signal first:

1. **A retailer link** in the post (Amazon/Goodreads/Bookshop) → resolve the ISBN directly.
   Free and near-certain, so it skips everything below.
2. **The cover and the post's words together** → a vision model names the book. Sending
   both matters: the caption is often the clue that makes an unreadable cover legible.
3. **The post's text**, grounded line by line: each line is tried as a search until one
   resolves to a real book. A post listing ten books has its titles on separate lines, so
   searching the whole blob finds nothing while searching each line finds plenty.

Whatever the source, a match must share a real word with what was searched, and how *many*
words it shares becomes the confidence the card reports. Ties are broken on **stray words**,
significant words in the result's title that the query never mentioned, because otherwise
every book in a series scores identically and the catalogue's own ordering silently decides
which one you get. That is how a photo of *Dune* used to shelve *Children of Dune*. Six
title shapes still defeat the tie-break; they are listed in `OPENWORK.md` §4.1.

**Nothing is ever saved without being chosen.** Auto-save was removed, because a save you
did not make is a save you cannot learn to distrust. Every entry can be removed from its
detail sheet, and doing so also flags the recognition, so the kept rate on the masthead
stays honest.

Grounding is best-effort. When OpenLibrary answers nothing at all, measured at over 20s,
uncontended, on 2026-08-04, a cover that was read correctly is still offered, marked
`unverified` rather than thrown away. A dead catalogue costs the extension 0ms after three
consecutive failures, because a circuit breaker stops asking until a probe says it is back.

Local OCR (Tesseract) was tried first and measured at roughly **5%** on real covers. It
reads characters, and cover typography is exactly what it's worst at. It also added 30 MB
to the extension for a capability that needed the network anyway, since grounding is a
lookup. A vision model reads the picture instead of the letters.

## What it doesn't do (yet)

- No sync. The shelf lives in one browser and stays there.
- No keyless setup. Recognition needs your own key until there's a proxy that holds one.
  **That proxy is the point of `buki-pro`.**
- The catch tray still renders on the first-generation design system. It is the only surface
  that draws inside somebody else's page, so it has to hold up against an arbitrary
  background, which is a different problem from choosing a background. `OPENWORK.md` item 21.

**Two things on this list shipped and are worth not re-planning.** Catch-anywhere landed on
2026-08-12: the right-click menu works on any image on any site, using `scripting` plus
`activeTab` and an optional host permission asked for on first use, never a broad host
permission at install. Export landed on 2026-08-13: a Goodreads-format CSV, which is the
only route into both Goodreads and StoryGraph since Goodreads closed its write API in 2020,
reachable from the options page and free on every tier.

## Privacy

Two things leave your computer, and only when you ask for a catch:

1. **The picture**, to the vision provider you configured with your own key. Buki resizes
   it to 768px first, so what is sent is smaller than what is on screen.
2. **The recognized title and author**, to **openlibrary.org** as a search query, to confirm
   the book exists.

That is all. No account, no telemetry, no analytics, no Buki server. Your shelf never leaves
`chrome.storage.local`, and the covers it caches sit in the browser's own Cache API bounded
by what is on the shelf.

Buki also keeps the last 200 recognition attempts on your computer: what it guessed, how
confident it was, and whether you kept the book, so the shelf can show how often it gets it
right. That log is never transmitted, and you can clear it from the options page.

> **This section changes when `buki-pro` ships.** A hosted recognition proxy means the
> picture goes to Buki before it goes to the model. The privacy policy, the store data-usage
> declaration and this section all have to be rewritten in the same commit as the proxy, and
> an inaccurate declaration fails Chrome Web Store review. Plan Task 14.

## Third-party

Book data from the [OpenLibrary API](https://openlibrary.org/developers/api), a project of
the Internet Archive.

## Shipping

**The production domain is `https://get-buki.vercel.app`**, defined once in
`src/shared/host.ts`. Anything that needs the host imports it from there rather than
spelling it out, because this host has been renamed once already and was spelled out in
seven files when it happened.

Vercel serves `docs/` as the site root (see `vercel.json`). Deploy with
`vercel deploy --prod`. Raw deployment URLs are SSO-protected on this account, so only the
project's production domain is public: always link the production domain.

| What | Where |
| --- | --- |
| Landing page and privacy policy, served by Vercel from `/docs` | [`docs/index.html`](docs/index.html), [`docs/privacy.html`](docs/privacy.html) |
| Design system, all surfaces, and which generation each is on | [`docs/brand.md`](docs/brand.md) |
| Polar setup, field by field, with a curl that proves it | [`docs/superpowers/polar-setup.md`](docs/superpowers/polar-setup.md) |
| Positioning, voice, objections | [`.agents/product-marketing.md`](.agents/product-marketing.md) |
| Competitor research | [`competitor-profiles/_summary.md`](competitor-profiles/_summary.md) |
| Store listing copy, screenshot shot-list, promo tile | [`docs/store/listing.md`](docs/store/listing.md) |
| Permission justifications and the data-usage declaration | [`docs/store/permissions.md`](docs/store/permissions.md) |

The affiliate disclosure appears in the popup footer, the options page and the privacy
policy. Chrome Web Store policy permits affiliate links only when they are disclosed, so
none of those three may be removed.

## License

MIT. See [LICENSE](LICENSE).
