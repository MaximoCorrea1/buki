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

/**
 * The mark, for the fixture. `content.ts` builds this with `markNode()`; this file's markup
 * is hand-kept, so a card here without it would be a card the product does not have.
 * Unique gradient id per instance for the same reason markNode has one: every url(#id) in
 * a document resolves to the FIRST match, so a shared id means every ball after the first
 * loses its fill the moment that node is removed.
 */
let markSeq = 0;
const MK = () => {
  // ONE READ, INTO A VARIABLE. This was `${++markSeq}` written directly into both the id
  // and the url, and a template interpolates each occurrence separately: the counter ran
  // twice per call, so the gradient was declared as h1 and referenced as h2. The ball then
  // had a fill pointing at nothing and vanished, leaving two eyes floating on the card.
  //
  // It cost a real detour, because it looked exactly like a design problem: the mark read
  // as two dots, which is precisely what a mark whose light end is 1.64:1 on white WOULD
  // look like. Two plausible causes, and the measurement pointed at the wrong one.
  // `markNode()` in content.ts has always done it this way, so THE PRODUCT WAS CORRECT AND
  // THIS HARNESS WAS THE THING THAT LIED.
  const n = ++markSeq;
  return `<svg class="buki-mk" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="h${n}" x1="14" y1="8" x2="82" y2="94" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7bcdfc"/><stop offset="0.46" stop-color="#4aa3f9"/><stop offset="1" stop-color="#013ebf"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#h${n})"/><ellipse cx="31.3" cy="45.9" rx="13.7" ry="19.5" fill="#091a3b"/><ellipse cx="68.3" cy="45.9" rx="13.7" ry="19.5" fill="#091a3b"/><circle cx="35" cy="35.2" r="3.9" fill="#fdfdfd"/><circle cx="71.4" cy="35.2" r="3.9" fill="#fdfdfd"/></svg>`;
};


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

/**
 * The wall's words, READ OUT OF trayCopy.ts rather than retyped.
 *
 * Same technique as the stylesheet above, and for the same reason: this fixture has
 * drifted from the builders three times in one week. Copy is the easiest thing to let
 * rot, because a stale sentence still renders.
 */
const copySrc = readFileSync('src/extension/trayCopy.ts', 'utf8');
const wallBlock = copySrc.slice(
  copySrc.indexOf('export const WALL'),
  copySrc.indexOf('} as const;', copySrc.indexOf('export const WALL')),
);

/**
 * The constants the wall's sentences interpolate, read from where they are defined.
 *
 * Two of the five fields are TEMPLATE literals rather than plain strings, and the first
 * version of this extractor only understood `'...'`. It rendered `[head unreadable]` and
 * `[act unreadable]` — loudly, which is why the fallback says that rather than returning
 * an empty string. A harness that silently draws a blank headline is worse than one that
 * refuses to draw at all.
 */
const priceSrc = readFileSync('src/shared/pricing.ts', 'utf8');
const constant = (name) =>
  priceSrc.match(new RegExp(`${name} = '?([^';\n]+)'?;`))?.[1]?.trim() ?? `[${name}?]`;
const SUBS = {
  TRIAL_SPELLED: constant('TRIAL_SPELLED'),
  PRO_MONTHLY_USD: constant('PRO_MONTHLY_USD'),
};

/**
 * Every quoted run that follows `<name>:`, joined, with `${CONST}` resolved.
 *
 * Joined rather than taken singly because `body` is two concatenated literals, kept that
 * way to stay inside the line length. A reader that took only the first would render half
 * a sentence — the quiet wrongness this whole file exists to prevent.
 */
const wallWord = (name) => {
  const at = wallBlock.indexOf(`${name}:`);
  if (at === -1) return `[${name} is not in trayCopy.ts any more]`;
  const upto = wallBlock.slice(at, wallBlock.indexOf(',\n', at) + 1 || undefined);
  const parts = upto.match(/'[^']*'|`[^`]*`/g);
  if (!parts) return `[${name} unreadable]`;
  return parts
    .map((p) => p.slice(1, -1))
    .join('')
    .replace(/\$\{(\w+)\}/g, (whole, key) => SUBS[key] ?? whole);
};

/** The five dyes, from generatedCover.ts, so a card's spine is a real binding. */
const CLOTH = { coral: '#ff5a47', jade: '#22b584', peri: '#6274ff', plum: '#b45ce0' };

const card = (inner, cloth, book = true) => `
  <div class="buki-slot">
    <div class="buki-card buki-in${book ? '" data-book=""' : '"'} style="--cloth:${cloth}">
      ${inner}
    </div>
  </div>`;

const closeBtn = `<button class="buki-x" title="Dismiss" aria-label="Dismiss this catch">&times;</button>`;

/**
 * One book row. `.buki-row` is a SIBLING of `.buki-who`, not a child - `bookRow` in
 * content.ts appends it that way so `.buki-find` can wrap it onto its own full-width line.
 * This fixture has drifted from the builder three times in one session; when a card looks
 * wrong here, check the nesting against `bookRow` before believing the stylesheet.
 */
const row = (title, author, cloth, shelved) => `
      <div class="buki-find">
        <div class="buki-thumb" style="--cloth:${cloth}"></div>
        <div class="buki-who">
          <div class="buki-t">${title}</div>
          <div class="buki-a">${author}${
            shelved ? ` <span class="buki-shelf">on your shelf &middot; ${shelved}</span>` : ''
          }</div>
        </div>
        <div class="buki-row">
          <button class="buki-intent">Read now</button>
          <button class="buki-intent"${shelved === 'next' ? ' disabled data-here=""' : ''}>Read next</button>
          <button class="buki-intent">Read someday</button>
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
          ${MK()}
          <div class="buki-eyebrow">read from the cover</div>
          <div class="buki-count">Buki found 3 books in this picture</div>
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
          ${MK()}
          <div class="buki-eyebrow">read from the post</div>
          <div class="buki-count">Buki found 20 books in this picture</div>
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
          ${MK()}
          <div class="buki-eyebrow">read from the cover</div>
          <div class="buki-t buki-plain">No book on that cover.</div>
        </div>${closeBtn}
      </div>
      <button class="buki-act">Try the post's words</button>`,
    CLOTH.plum,
    false,
  ),
  // THE WALL. The only card that asks for money, and the reason its words are read out of
  // trayCopy.ts above rather than typed here.
  card(
    `<div class="buki-head">
        <div class="buki-who">
          ${MK()}
          <div class="buki-eyebrow">${wallWord('eyebrow')}</div>
          <div class="buki-t buki-plain">${wallWord('head')}</div>
          <div class="buki-note">${wallWord('body')}</div>
        </div>${closeBtn}
      </div>
      <button class="buki-act buki-buy">${wallWord('act')}</button>
      <button class="buki-act">${wallWord('free')}</button>`,
    CLOTH.jade,
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

/**
 * BOTH MOODS, on every ground, since 2026-08-24.
 *
 * The tray had one mood, so this rendered one tray per ground and that was the whole
 * matrix. It now follows the extension's choice, which means the interesting cell is not
 * "the card on a photograph" any more, it is A LIGHT CARD ON A WHITE PAGE and A DARK CARD
 * ON A BLACK ONE. Those two are measured at 1.00:1 and 1.10:1 against the page: the ring
 * and the shadow are the only things separating card from document, and there is no way to
 * check that except by looking at it.
 */
const MOODS = ['dark', 'light'];

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
  ${MOODS.map(
    (mood, i) => `
  <div class="buki-tray" data-theme="${mood}" style="--mood-x:${18 + i * 372}px">
    <p style="margin:0 0 6px;font:600 11px/1 system-ui,sans-serif;letter-spacing:.12em;
       text-transform:uppercase;opacity:.7;pointer-events:none">${mood}</p>
    ${TRAY.join('')}
  </div>`,
  ).join('')}
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
    /* --mood-x, not a literal, because this rule is !important and the two moods have to
       sit SIDE BY SIDE. Setting right inline lost to this and stacked one exactly on top
       of the other, which looked like a single tray and hid the whole light mode. */
    inset: auto var(--mood-x, 18px) 18px auto !important;
    max-height: calc(100% - 36px) !important;
  }
${STYLE}
</style>
<body>${panels}</body>`,
);
console.log(
  `zzz-tray-harness.html written: ${TRAY.length} card states x ${MOODS.length} moods on ${GROUNDS.length} grounds. ` +
    `Stylesheet read from content.ts (${STYLE.length} chars), markup is a fixture.`,
);
