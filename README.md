# Book Catcher

Catch books you see on Twitter/X into your own reading list, before they get lost in
your bookmarks.

You spot a book in a tweet, save it, and never see it again — it sinks under memes and
threads with no way to tell the ones you meant it about from the impulse saves. Book
Catcher gives those books a place: it recognizes the book, keeps the post that sold you
on it, and files it under **Now / Next / Someday**.

## Two ways to catch a book

**Right-click a cover image → "Save book to shelf."** The cover is read with OCR
(Tesseract, running locally), the text is grounded against OpenLibrary, and the match is
saved. This is the one that works on a photo with no link and no title in the text.

**Hit 📚 on a tweet.** Reads the tweet's links and text, shows you the candidates, and
you pick the intent. Fastest when the tweet links to a retailer or names the book.

Your shelf lives in the extension. Nothing is synced anywhere.

## Install (development)

```bash
npm install
node build.mjs
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select this folder. Requires Chrome 110+.

**One-time setup.** Reading a cover from a photo is the only thing Book Catcher can't do
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
| `node build.mjs` | Typechecks, bundles, and stages the Tesseract assets into `dist/` |
| `npm run build` | Same thing, via npm |
| `npm test` | Runs the vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run icons` | Regenerates `icons/*.png` |

The build typechecks first and refuses to bundle on a type error — esbuild only strips
types, it never checks them.

It downloads the English OCR model (~11 MB) into `dist/` on first run and caches it
afterwards.

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

Whatever the source, a match must share a real word with what was searched before it's
saved, and **every entry can be removed** with the `×` button.

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
- No cloud vision model. A `VisionClient` seam exists if you want to swap one in.

## Privacy

Everything is local except book lookups: recognized cover text and tweet text are sent
to **openlibrary.org** as search queries to identify the book. No account, no telemetry,
no analytics. Your shelf never leaves `chrome.storage.local`.

## Third-party

OCR by [tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0; its LICENSE
ships in `dist/tesseract/`). Book data from the
[OpenLibrary API](https://openlibrary.org/developers/api), a project of the Internet
Archive.

## License

MIT — see [LICENSE](LICENSE).
