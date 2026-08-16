/**
 * Render popup.html outside an extension host.
 *
 * WHY THIS EXISTS. `popup.html` is `<main id="app"></main>`; every pixel is drawn by
 * `dist/popup.js`, which needs `chrome.storage.local` and `chrome.runtime`. Opened
 * directly in a browser it is a blank panel, so there is no way to look at the shelf while
 * styling it. Chrome stable also refuses `--load-extension`, so loading the real extension
 * headlessly is not an option either.
 *
 * This stubs the three chrome APIs the popup actually touches, seeds a believable shelf,
 * and writes a throwaway page you can screenshot.
 *
 * USAGE
 *   node tools/popup-harness.mjs            writes zzz-popup-harness.html
 *   then point a headless browser at that file
 *
 * The output is gitignored on purpose: it embeds a snapshot of fake data and would rot.
 * Regenerate it rather than committing it.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'zzz-popup-harness.html';
const now = Date.now();

const book = (title, author, id, intent, daysAgo) => ({
  id,
  book: { title, author },
  intent,
  savedAt: now - daysAgo * 86_400_000,
});

/* Real books, so the shelf reads as somebody's rather than as a fixture. Titles of very
   different lengths on purpose: the caption clamps at two lines and that is the case most
   likely to break. */
const shelf = [
  book('The Fountainhead', 'Ayn Rand', 'fountainhead', 'now', 2),
  book('Designing Data-Intensive Applications', 'Martin Kleppmann', 'ddia', 'now', 5),
  book('Ficciones', 'Jorge Luis Borges', 'ficciones', 'now', 9),
  book('The Mom Test', 'Rob Fitzpatrick', 'momtest', 'next', 12),
  book('The Design of Everyday Things', 'Don Norman', 'doet', 'next', 14),
  book('Hackers and Painters', 'Paul Graham', 'hackers', 'someday', 20),
  book('Hopscotch', 'Julio Cortazar', 'hopscotch', 'someday', 26),
  book('Meditations', 'Marcus Aurelius', 'meditations', 'read', 40),
];

const stub = `<script>
(function () {
  var mem = {
    savedBooks: ${JSON.stringify(shelf)},
    visionSettings: { apiKey: 'x', endpoint: '', model: 'gemini-flash-lite-latest', store: 'amazon' },
    recognitionLog: { attempts: 23, kept: 20 }
  };
  window.chrome = {
    storage: { local: {
      get: function (k) {
        var out = {};
        (Array.isArray(k) ? k : [k]).forEach(function (n) { if (n in mem) out[n] = mem[n]; });
        return Promise.resolve(out);
      },
      set: function (items) { Object.assign(mem, items); return Promise.resolve(); }
    } },
    runtime: {
      sendMessage: function () { return Promise.resolve({ ok: true }); },
      lastError: null,
      openOptionsPage: function () {}
    }
  };
})();
</script>
`;

/**
 * THE SHEET COULD NOT BE SEEN EITHER, which is worse than the shelf: it is built entirely
 * by `openSheet` in response to a click, so opening the harness showed the shelf and
 * nothing else. Load with `#sheet` and this picks the first book up for you.
 *
 * It polls rather than waiting on an event because `paint()` is called from an async
 * `refresh()` with no signal when it lands, and adding one to popup.ts for a harness would
 * be the harness leaking into the product.
 */
const openSheet = `<script>
(function () {
  if (location.hash !== '#sheet') return;
  var tries = 0;
  var t = setInterval(function () {
    var pick = document.querySelector('.pick');
    if (pick) { clearInterval(t); pick.click(); }
    else if (++tries > 60) clearInterval(t);
  }, 25);
})();
</script>
`;

const src = readFileSync('popup.html', 'utf8');
const anchor = '<script src="dist/popup.js"></script>';
if (!src.includes(anchor)) {
  console.error('popup.html no longer loads dist/popup.js; update this harness.');
  process.exit(1);
}
writeFileSync(OUT, src.replace(anchor, `${stub}    ${anchor}\n    ${openSheet}`));
console.log(
  `${OUT} written, ${shelf.length} books. Screenshot it at 560px wide. ` +
    `Add #sheet to the url to open a book's detail sheet.`,
);
