/**
 * Render the catch tray on the grounds it actually has to survive.
 *
 * WHY THIS EXISTS. The tray is the one Buki surface that draws inside SOMEBODY ELSE'S
 * page, and it is the only one nobody could look at. `popup.html` has a harness;
 * `docs/index.html` is a page you can open; the tray needed a real X post, a real
 * extension host, and Chrome stable refuses `--load-extension`. So it was styled blind
 * through three design generations, and a throwaway harness was rebuilt from scratch each
 * time somebody touched it. The 2026-08-15 handoff says in as many words: worth committing
 * if you touch the tray again.
 *
 * WHAT IT PROVES AND WHAT IT DOES NOT. The stylesheet is read out of `content.ts` rather
 * than copied, so it cannot drift from what ships. The MARKUP is a fixture: `content.ts`
 * registers `chrome.runtime.onMessage` at module scope, so it cannot be imported at all,
 * exactly like `background.ts`. Class names here therefore have to be kept in step with
 * the builders by hand. `src/extension/contentChrome.test.ts` is what actually guards the
 * rules; this is for looking.
 *
 * THE GROUNDS ARE THE POINT. `docs/brand.md` lists what the tray is handed: X in daylight,
 * X at night, a white documentation site, a black photo essay, a photograph. That is the
 * whole argument for the card being opaque and owning its own ground, and it is precisely
 * what a screenshot of one page cannot show.
 *
 * USAGE
 *   node tools/tray-harness.mjs      writes zzz-tray-harness.html
 *
 * The output is gitignored. Regenerate it rather than committing it.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('src/extension/content.ts', 'utf8');

// The same slice contentChrome.test.ts takes, so the two cannot disagree about what the
// stylesheet is.
const open = src.indexOf('const STYLE = `');
const close = src.indexOf('\n`;\n', open);
if (open === -1 || close === -1) {
  console.error('content.ts no longer holds `const STYLE = ` ... `;` - update this harness.');
  process.exit(1);
}
const STYLE = src.slice(open + 'const STYLE = `'.length, close);

/** The five dyes, from generatedCover.ts, so a card's spine is a real binding. */
const CLOTH = { coral: '#ff5a47', jade: '#22b584', peri: '#6274ff', plum: '#b45ce0' };

const card = (inner, cloth, book = true) => `
  <div class="buki-slot">
    <div class="buki-card buki-in${book ? '" data-book=""' : '"'} style="--cloth:${cloth}">
      ${inner}
    </div>
  </div>`;

const closeBtn = `<button class="buki-x" title="Dismiss" aria-label="Dismiss this catch">&times;</button>`;

const row = (title, author, cloth, shelved) => `
      <div class="buki-find">
        <div class="buki-thumb" style="--cloth:${cloth}"></div>
        <div class="buki-who">
          <div class="buki-t">${title}</div>
          <div class="buki-a">${author}${
            shelved ? ` <span class="buki-shelf">on your shelf &middot; ${shelved}</span>` : ''
          }</div>
          <div class="buki-row">
            <button class="buki-intent">now</button>
            <button class="buki-intent"${shelved === 'next' ? ' disabled data-here=""' : ''}>next</button>
            <button class="buki-intent">someday</button>
          </div>
        </div>
      </div>`;

/**
 * The bounded list the rows live in. `foundBody` wraps them in this, so the fixture has to
 * as well or the harness draws a card that cannot exist - which is exactly how it missed a
 * five-book card being 680px in a 732px tray.
 */
const books = (...rows) => `<div class="buki-books">${rows.join('')}</div>`;

/** One card per state the tray can actually be in. */
const TRAY = [
  // A photograph holding several books: the case the batch button exists for.
  card(
    `<div class="buki-head">
        <div class="buki-who">
          <div class="buki-eyebrow">read from the cover</div>
          <div class="buki-count">3 books in this picture</div>
        </div>${closeBtn}
      </div>
      ${books(
        row('Ficciones', 'Jorge Luis Borges', CLOTH.coral),
        row('The Left Hand of Darkness', 'Ursula K. Le Guin', CLOTH.peri, 'next'),
        row('Pale Fire', 'Vladimir Nabokov', CLOTH.plum),
      )}
      <button class="buki-act">Save all to Someday</button>`,
    CLOTH.coral,
  ),
  // TWENTY, which is what MAX_BOOKS allows since 2026-08-16 and what the old fixture could
  // not show. This is the card the height bound exists for: without it, 2,600px in a tray
  // that is 732px on a laptop.
  card(
    `<div class="buki-head">
        <div class="buki-who">
          <div class="buki-eyebrow">read from the post</div>
          <div class="buki-count">20 books in this picture</div>
        </div>${closeBtn}
      </div>
      ${books(
        ...Array.from({ length: 20 }, (_, i) =>
          row(`Book number ${i + 1}`, 'A. N. Author', Object.values(CLOTH)[i % 4]),
        ),
      )}
      <button class="buki-act">Save all to Someday</button>`,
    CLOTH.peri,
  ),
  // One book, already on the shelf: the "it saved a book I already saved" answer.
  card(
    `<div class="buki-head">
        <div class="buki-who"><div class="buki-eyebrow" data-shelf="">a link in the post</div></div>${closeBtn}
      </div>
      ${row('Solaris', 'Stanisław Lem', CLOTH.jade, 'next')}`,
    CLOTH.jade,
  ),
  // Looking, and the empty state, which is an invitation rather than a wall.
  card(
    `<div class="buki-head">
        <div class="buki-who"><div class="buki-t buki-plain">Reading the cover&hellip;</div></div>${closeBtn}
      </div>
      <div class="buki-wait"></div>`,
    CLOTH.peri,
    false,
  ),
  card(
    `<div class="buki-head">
        <div class="buki-who">
          <div class="buki-eyebrow">nothing on the cover</div>
          <div class="buki-t buki-plain">No book on that cover.</div>
        </div>${closeBtn}
      </div>
      <button class="buki-act">Try the post's words</button>`,
    CLOTH.plum,
    false,
  ),
];

/**
 * The grounds brand.md names. A photograph is the one that matters most: it is the reason
 * the card is opaque, because a translucent card there has a contrast decided by an image
 * nobody has seen.
 */
const GROUNDS = [
  ['a white documentation site', '#ffffff', '#1b1b1f', 'none'],
  ['X in daylight', '#f7f9f9', '#0f1419', 'none'],
  ['X at night', '#000000', '#e7e9ea', 'none'],
  ['a black photo essay', '#0b0b0c', '#f2f2f2', 'none'],
  [
    'a photograph',
    '#6d7f8c',
    '#ffffff',
    // A busy synthetic backdrop, so the card is judged against something that fights it.
    "repeating-linear-gradient(38deg,#c9b48a 0 38px,#5c6f7e 38px 76px,#e8e2d2 76px 104px,#2f3a44 104px 150px)",
  ],
];

const panels = GROUNDS.map(
  ([label, bg, fg, image]) => `
<section style="position:relative;height:840px;overflow:hidden;background:${bg};background-image:${image};color:${fg};padding:22px">
  <p style="margin:0;font:600 13px/1.4 system-ui,sans-serif">${label}
    <span style="opacity:.75">&mdash; ${bg}</span></p>
  <p style="margin:8px 0 0;max-width:46ch;font:15px/1.55 Georgia,serif">
    Whatever this page is, the tray did not choose it. The card brings its own ground,
    which is the whole decision recorded in docs/brand.md under
    <i>The one surface with no ground of its own</i>.
  </p>
  <div class="buki-tray" style="position:absolute">${TRAY.join('')}</div>
</section>`,
).join('');

writeFileSync(
  'zzz-tray-harness.html',
  `<!doctype html><meta charset="utf-8"><title>the catch tray, on five grounds</title>
<style>
  /* The tray registers this at RUNTIME with the FontFace API, from a data URL esbuild
     inlines into content.js - it cannot reference an extension file from a page it does
     not own. None of that happens here, because this harness renders the stylesheet and
     never runs the script. Loading the same file from disk is what keeps the preview
     honest; without it this page shows the system fallback and reads as a regression
     that is not there. */
  @font-face {
    font-family: "Buki Manrope";
    src: url("fonts/manrope.woff2") format("woff2-variations");
    font-weight: 200 800;
  }
  body { margin: 0 }
  /* The real tray is position: fixed and bounded by the viewport. Here each panel hosts
     its own and is bounded by the PANEL, so five grounds fit on one page. That swap is the
     only thing overridden; everything else is content.ts's own stylesheet. */
  .buki-tray {
    position: absolute !important;
    inset: auto 18px 18px auto !important;
    max-height: calc(100% - 36px) !important;
  }
${STYLE}
</style>
<body>${panels}</body>`,
);
console.log(
  `zzz-tray-harness.html written: ${TRAY.length} card states on ${GROUNDS.length} grounds. ` +
    `Stylesheet read from content.ts (${STYLE.length} chars), markup is a fixture.`,
);
