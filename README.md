# Buki

Catch a book from a picture into your own shelf, before it gets lost in your bookmarks.

You spot a book in a post, save it, and never see it again. It sinks under memes and
threads with no way to tell the ones you meant it about from the impulse saves. Buki gives
those books a place: it recognizes the book **from the cover photograph**, keeps the post
that sold you on it, and files it under **Now / Next / Someday**. Mark a book finished when
you're done, and every saved book carries a quiet Buy link.

> **State, 2026-08-18.** `buki-pro` was merged into `main` and is history; work happens on
> `main`. What is built, what is not, and what is blocked is an ordered checklist in
> `OPENWORK.md`, which opens with THE LANE. **Read that first**, and run its probes rather
> than trusting the numbers written beside them.
>
> **The paid tier is written and is not yet switched on.** The whole client half exists (the
> entitlement gate, the trial counter, the wall, the licence exchange, the plan badge) and so
> do both serverless functions, with four-line shells in `api/`. **What is missing is not
> code.** It is a Polar product and **six** Vercel environment variables, one of which stays
> unset on purpose. Those are `OPENWORK.md` items 1 and 2 and they are the critical path.
> Until they exist `${BUKI_HOST}/api/vision` answers nothing, so a user with no key of their
> own gets no cover reading, which is why the landing's "ten catches free" is still a promise
> rather than a fact.
>
> Export to Goodreads and StoryGraph **shipped on 2026-08-13** and is free on every tier.

## Two ways to catch a book

**Right-click any cover image, anywhere on the web → "Save book to shelf."** The cover and
the surrounding words go to a vision model together and the guess is grounded against
OpenLibrary. This is the one that works on a photo with no link and no title in the text,
and it is no longer scoped to X: the worker injects the catch tray on demand under
`activeTab`, and asks for one host origin only when the picture needs one.

**Press the Buki mark on a post.** It sits in the action bar beside reply and like, at X's own icon size. Same recognition: link, then cover and words together, then the
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

Three tools for looking at surfaces no browser will show you directly. All three write a
gitignored `zzz-*.html`; regenerate rather than commit.

| Command | What it shows |
| --- | --- |
| `node tools/popup-harness.mjs` | The shelf, with a stubbed `chrome` and a believable set of books. `popup.html` is `<main id="app">` and draws nothing outside an extension host |
| `node tools/tray-harness.mjs` | The catch tray, on the five grounds it actually has to survive: a white docs site, X in daylight, X at night, a black photo essay, a photograph. Chrome stable refuses `--load-extension`, so this is the only way to see it |
| `node tools/mark-sizes.mjs` | The mark at every size it ships at, on every ground in `tools/mark.mjs`. Pass `--extra "#hex"` to try a candidate. Written because a caught-spine value was argued about twice from a contrast ratio without anyone rendering it |
| `node tools/x-button-harness.mjs` | The save button in X's action bar, on X's three grounds, beside approximations of X's own reply/retweet/like/share glyphs. The mark alone was never the question: a filled disc among thin outline icons is, and only the row answers it |

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
3. **The post's text**, grounded line by line: every line is tried as a search and every
   line that resolves contributes a book. A post listing ten books has its titles on
   separate lines, so searching the whole blob finds nothing while searching each line
   finds all ten. Until 2026-08-16 this stopped at the first line that resolved, which
   found one book and its runners-up however many the post named.

Whatever the source, a match must share a real word with what was searched, and how *many*
words it shares becomes the confidence the card reports. Ties are broken on **stray words**,
significant words in the result's title that the query never mentioned, because otherwise
every book in a series scores identically and the catalogue's own ordering silently decides
which one you get. That is how a photo of *Dune* used to shelve *Children of Dune*. The
title shapes it has to survive are enumerated as tests, in `src/recognizer/groundText.test.ts`
under `rank tie-breaking` — which is where they belong, because a shape nobody can run is a
shape nobody checks. *(This used to point at `OPENWORK.md` §4.1, a section that does not
exist and may never have.)*

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
- No keyless setup **yet**. Recognition needs your own key until the proxy is switched on.
  The proxy is **written** — `src/server/visionHandler.ts` and `licenseHandler.ts`, with
  shells in `api/` — and waits on a Polar product and **six** Vercel variables, which are
  `OPENWORK.md` items 1 and 2. The sixth, `BUKI_TRIAL_CLOSED`, is the emergency brake and
  stays unset.

**Three things that were on this list shipped, and are worth not re-planning.**
Catch-anywhere landed on 2026-08-12: the right-click menu works on any image on any site,
using `scripting` plus `activeTab` and an optional host permission asked for on first use,
never a broad host permission at install. Export landed on 2026-08-13: a Goodreads-format
CSV, which is the only route into both Goodreads and StoryGraph since Goodreads closed its
write API in 2020, reachable from the options page and free on every tier. And the catch
tray reached the current design system on 2026-08-15, last and on purpose: it is the only
surface that draws inside somebody else's page, so it takes the palette, the capsules and
the contrast rule and deliberately refuses the transparency and the webfont. `docs/brand.md`,
*The one surface with no ground of its own*.

## Privacy

Two things leave your computer, and only when you ask for a catch.

**1. The picture, and the words around it.** Where they go is the user's choice, and it is
the one place the wording has to stay precise:

| Their setting | Where the picture goes |
| --- | --- |
| They added their own API key | Straight from their browser to the provider they configured. **Buki's server is not in the path.** |
| They did not | To `${BUKI_HOST}/api/vision`, which forwards it to Google Gemini and returns the answer. This is what makes the extension work with no setup. |

Either way it is resized to 768px first, so what is sent is smaller than what is on screen.

**2. The recognized title and author**, to **openlibrary.org** as a search query, to confirm
the book exists.

That is all. No account, no sign-in, no sync, no telemetry, no analytics. The shelf never
leaves `chrome.storage.local`, and the covers it caches sit in the browser's own Cache API
bounded by what is on the shelf.

Buki also keeps the last 200 recognition attempts on the user's computer: what it guessed,
how confident it was, and whether they kept the book, so the shelf can show how often it
gets it right. That log is never transmitted, and it can be cleared from the options page.

**What the proxy keeps: nothing about the book, and nothing that names anybody.** No
database, nothing written to disk. Two things sit in the instance's memory and vanish when
it recycles: the caller's IP with a daily count, which is how free readings are counted, and
a scrambled short form of a licence key with a daily count, which is what stops a leaked key
being used to exhaust its owner's activations.

> **"No server" and "no data" are true of the SHELF, and are not true of the product as a
> whole.** Reading a cover contacts a server, ours by default. The two places the stronger
> claim holds literally are the own-key path, which never touches us, and the proxy being
> open source in this repo. `docs/brand.md` owns that wording; do not widen it.

`docs/privacy.html`, `docs/store/permissions.md` and this section were rewritten together on
2026-08-18 and say the same thing on purpose. If they ever disagree, the code decides.

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
