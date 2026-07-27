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
npm run build
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select this folder. Requires Chrome 116+.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Typechecks, bundles, and stages the Tesseract assets into `dist/` |
| `npm test` | Runs the vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run icons` | Regenerates `icons/*.png` |

`npm run build` downloads the English OCR model (~11 MB) into `dist/` on first run and
caches it after that.

## How recognition works

Cheapest, highest-precision signal first:

1. **A retailer link** in the tweet (Amazon/Goodreads/Bookshop) → resolve the ISBN
   directly. Free and near-certain, so it skips everything below.
2. **The tweet's text**, cleaned and searched.
3. **OCR of the cover**, using *ground-as-filter*: each line of recognized text is tried
   as a search until one resolves to a real book. Rather than guessing which line is the
   title, the books database decides — garbage lines simply match nothing.

OCR is imperfect on stylized or angled covers, so a match must share a real word with
what was searched before it's saved, and **every entry can be removed** from the shelf
with the `×` button.

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
