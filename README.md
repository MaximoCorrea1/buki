# Shelfy

Catch books you see on X into your own shelf, before they get lost in your bookmarks.

You spot a book in a post, save it, and never see it again — it sinks under memes and
threads with no way to tell the ones you meant it about from the impulse saves. Shelfy
gives those books a place: it recognizes the book, keeps the post that sold you
on it, and files it under **Now / Next / Someday**.

## Two ways to catch a book

**Right-click a cover image → "Save book to shelf."** The cover and the post's words go
to a vision model together, the guess is grounded against OpenLibrary, and a strong
match is saved outright. A weaker one opens the picker at the image so you decide. This
is the one that works on a photo with no link and no title in the text.

**Hit 📚 on a post.** Reads the post's links and text, shows you the candidates, and
you pick the intent. Fastest when the post links to a retailer or names the book.

Your shelf lives in the extension. Nothing is synced anywhere.

## Install (development)

```bash
npm install
node build.mjs
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select this folder. Requires Chrome 110+.

**One-time setup.** Reading a cover from a photo is the only thing Shelfy can't do
on your machine, so it needs a vision model. The options page opens on install: paste a
free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (about two
minutes, no billing details). Google's free tier covers normal use and the key never
leaves your computer.

Any OpenAI-compatible endpoint works instead — Gemini, Cloudflare Workers AI, OpenRouter,
or your own proxy. A proxy that holds its own credential lets you leave the key blank,
which is how a hosted build keeps users keyless.

Without a key, links and post text still resolve books; only cover reading is off.

## Scripts

| Command | What it does |
| --- | --- |
| `node build.mjs` | Typechecks and bundles into `dist/` |
| `npm run build` | Same thing, via npm |
| `npm test` | Runs the vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run icons` | Regenerates `icons/*.png` |

The build typechecks first and refuses to bundle on a type error — esbuild only strips
types, it never checks them.

**On Windows:** prefer `node build.mjs`. It works from PowerShell *and* Git Bash, while
`npm run <script>` hands the script to `cmd.exe`, whose shim quoting can fail from a
Git Bash session with `"node" is not recognized`. Everything is deliberately reachable
through a single `node` entry point for that reason.

## How recognition works

Cheapest, highest-precision signal first:

1. **A retailer link** in the post (Amazon/Goodreads/Bookshop) → resolve the ISBN
   directly. Free and near-certain, so it skips everything below.
2. **The cover and the post's words together** → a vision model names the book. Sending
   both matters: the caption is often the clue that makes an unreadable cover legible.
3. **The post's text**, grounded line by line: each line is tried as a search until one
   resolves to a real book. A post listing ten books has its titles on separate lines, so
   searching the whole blob finds nothing while searching each line finds plenty.

Whatever the source, a match must share a real word with what was searched, and how
*many* words it shares decides what happens next: a strong match saves outright, a
one-word match asks first. Only a link or a cover the model and the books database agree
on is ever saved without asking, and **every entry can be removed** with the `×` button.

Local OCR (Tesseract) was tried first and measured at roughly **5%** on real covers — it
reads characters, and cover typography is exactly what it's worst at. It also added 30 MB
to the extension for a capability that needed the network anyway, since grounding is a
lookup. A vision model reads the picture instead of the letters.

## What it doesn't do (yet)

- Only runs on twitter.com / x.com. The right-click menu is scoped there deliberately:
  elsewhere there's no content script, so a save would happen with no visible feedback.
- No sync, no export. A Goodreads-format CSV export is the planned bridge — Goodreads
  closed its write API in 2020, so importing a CSV is the only route into both Goodreads
  and StoryGraph.
- No keyless setup. Recognition needs your own key until there's a proxy that holds one.

## Privacy

Everything is local except book lookups: recognized cover text and post text are sent
to **openlibrary.org** as search queries to identify the book. No account, no telemetry,
no analytics. Your shelf never leaves `chrome.storage.local`.

Shelfy also keeps the last 200 recognition attempts on your computer — what it
guessed, how confident it was, and whether you kept the book — so the shelf can show how
often it gets it right. That log is never transmitted, and you can clear it from the
options page.

## Third-party

Book data from the [OpenLibrary API](https://openlibrary.org/developers/api), a project
of the Internet Archive.

## Shipping

| What | Where |
| --- | --- |
| Landing page + privacy policy, served by GitHub Pages from `/docs` | [`docs/index.html`](docs/index.html), [`docs/privacy.html`](docs/privacy.html) |
| Store listing copy, screenshot shot-list, promo tile | [`docs/store/listing.md`](docs/store/listing.md) |
| Permission justifications and the data-usage declaration | [`docs/store/permissions.md`](docs/store/permissions.md) |

The affiliate disclosure appears in the popup footer, the options page and the privacy
policy. Chrome Web Store policy permits affiliate links only when they are disclosed, so
none of those three may be removed.

## License

MIT — see [LICENSE](LICENSE).
