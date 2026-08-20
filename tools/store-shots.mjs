/**
 * The Chrome Web Store screenshots, framed at 1280x800.
 *
 * WHY THIS EXISTS, and it is a problem nobody had hit. **The store wants 1280x800 and the
 * popup is 560px wide.** A raw capture is a small panel adrift in a large empty frame, and
 * upscaling it to fill the space makes the type soft, which on a listing whose whole claim
 * is craft is the worst possible first impression. Every shot needs composing, and the
 * composition is a design decision rather than a cropping one.
 *
 * WHAT THIS DOES AND DOES NOT DO. It builds the FRAME: the ground, the headline, the
 * placement, the shadow. It does not fake the CONTENT. Each frame carries a slot for a real
 * capture, because `docs/store/listing.md` records the decision that these are shot against
 * a shelf holding books actually saved: a mocked shelf reads as a mock, and this is a
 * product whose entire claim is that the list is yours.
 *
 * FOUR LAYOUTS, added 2026-08-20 on Maximo's brief - *"we need some way to design those
 * carefully and nice"*. One centred panel per frame is the safe composition and it is also
 * the reason five screenshots look like five of the same screenshot. What changed:
 *
 *   hero    one capture, centred. Right when the capture IS the story (a full shelf).
 *   pair    a real cover beside the mark at size. The input and the thing that reads it.
 *   split   two panels, left to right, with a connector. The search, then the find.
 *   detail  one capture plus a magnified inset. For a detail too small to see at 1280.
 *
 * THE MARK IS GENERATED, NEVER SPELLED. `markSvg()` is imported from `tools/mark.mjs`, the
 * same definition the six markup surfaces are asserted against in `src/shared/mark.test.ts`.
 * Those six SPELL the drawing because markup cannot import; this file can, so it must.
 * A pasted SVG literal here would be an eighth uncontrolled copy of a drawing that has
 * already drifted once, and `src/shared/storeShots.test.ts` fails if one appears.
 *
 * THE GROUND IS THE MARK'S OWN RAMP, read from `tools/mark.mjs` rather than picked. The
 * landing is on the third generation (cream, plates) and the extension is on the fourth
 * (iOS neutrals), deliberately - see `docs/brand.md`, *The iOS turn*. Framing one in the
 * other's world would make the screenshot argue with itself. The cobalt is the one thing
 * `.agents/product-marketing.md` records as crossing that line, along with the five book
 * dyes, so it is the only ground that belongs to both.
 *
 * USAGE
 *   node tools/store-shots.mjs          writes zzz-store-shots.html
 *   1. capture the raw shots by hand, per docs/store/assets.md
 *   2. drop them in the repo root as zzz-shot-1.png ... zzz-shot-5.png
 *      split layouts take zzz-shot-Na.png and zzz-shot-Nb.png INSTEAD of zzz-shot-N.png
 *      detail layouts also take zzz-shot-Nz.png for the magnified crop
 *   3. re-run, then screenshot each .frame at 1280x800
 *
 * Gitignored. Regenerate rather than commit.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { MARK, markSvg } from './mark.mjs';

/** The landing's cream and ink, read rather than retyped. */
function landingToken(name) {
  const src = readFileSync('docs/index.html', 'utf8');
  const m = new RegExp(`--${name}:\\s*light-dark\\(([^,]+),`).exec(src);
  if (!m) throw new Error(`token --${name} not found in docs/index.html`);
  return m[1].trim();
}

const CREAM = landingToken('paper');
const INK = landingToken('ink');
/**
 * The approved grounds, from `tools/mark.mjs`, where each one's contrast against the mark is
 * already recorded. A frame may pick from these; it may not invent one.
 */
const DAY = MARK.grounds['landing, day'].ground;
const DEEP = MARK.ramp.stops[MARK.ramp.stops.length - 1].color;
const MID = MARK.ramp.stops[1].color;

/**
 * A real cover, from the set the landing already ships.
 *
 * Not a placeholder rectangle and not a generated cloth. The brief was a COVER beside the
 * mark, and the whole argument of the pair frame is that Buki reads real book art, so a
 * grey box with the word "cover" in it would be arguing the opposite.
 */
const COVER = 'docs/covers/ficciones.webp';

/**
 * The mark at size, wrapped in its own viewBox.
 *
 * `markSvg` draws in a 0-100 space with no outer element, which is what lets six surfaces
 * scale it differently. Each call needs a unique gradient id: two marks in one document
 * sharing an id means the second silently takes the first one's fill, and this document has
 * several.
 */
const mark = (id, px) =>
  `<svg class="mark" width="${px}" height="${px}" viewBox="0 0 100 100" aria-hidden="true">${markSvg(id)}</svg>`;

/**
 * One headline per shot, and they are not captions.
 *
 * SIMPLIFIED 2026-08-20 on Maximo's brief: *"the language idk, should be simple. more
 * straightforward."* Every sub is now under eight words, because a sub is read in a store
 * grid at a glance and *"a stack on a desk gets a row and a decision each"* is a nice
 * sentence nobody finishes. The platforms are named rather than implied, which is not a new
 * direction: `docs/index.html` has said *"You see a book on X, on Reddit, in a newsletter"*
 * all along and `.agents/product-marketing.md` targets exactly those readers. The store copy
 * was the only surface that went abstract.
 *
 * SHOT 4 SAYS "ON X" AND MEANS IT. The button is X-only; Reddit and Pinterest are
 * right-click, which is what shot 3 says. Naming a platform in one frame and a gesture in
 * the other is what keeps the pair honest.
 *
 * The store shows these at size and a listing is read by someone deciding in about four
 * seconds, so each frame gets ONE claim in the product's own voice. They are drawn from
 * `.agents/product-marketing.md`'s differentiators rather than written fresh, because the
 * positioning is settled and a screenshot is the wrong place to reopen it.
 *
 * `docs/store/assets.md` carries what to actually put on screen for each.
 */
const SHOTS = [
  {
    n: 1,
    layout: 'hero',
    head: 'A shelf, not a folder.',
    sub: 'Every book you caught, face out, in your browser.',
    note: 'The one that sells it. Lead with it.',
  },
  {
    n: 2,
    layout: 'hero',
    head: 'One photo. Every book in it.',
    sub: 'It reads the cover, not the caption.',
    note: 'The differentiator. No competitor screenshot can show this.',
  },
  {
    // WAS "Anywhere there is a picture", a single hero capture of a catch on a non-X site.
    // Maximo replaced it on 2026-08-20 and the trade is a good one: this shows a catch
    // HAPPENING and its result, where the old one showed only that the menu opens somewhere
    // else. The breadth argument it carried is made twice already, in the single-purpose
    // statement and in the host justification, and neither needed a screenshot to be true.
    n: 3,
    layout: 'split',
    head: 'You saw a book. Now you have it.',
    sub: 'On X, on Reddit, on Pinterest. Right-click it.',
    note: 'The search, then the find. Needs zzz-shot-3a.png and zzz-shot-3b.png.',
    a: 'The picture you found',
    b: 'The book, on your shelf',
  },
  {
    n: 4,
    layout: 'detail',
    head: 'On X, it is one tap.',
    sub: 'Buki sits beside reply and like.',
    note: 'Shows people where it lives. The inset is why this is a detail layout.',
    zoomLabel: 'Actual size: 18px, X’s own icon box',
  },
  {
    n: 5,
    layout: 'hero',
    head: 'It shows you where it looked.',
    sub: 'Every catch says where the answer came from.',
    note: 'Nothing else in this category publishes its own accuracy.',
  },
];

/**
 * Compositions that do not need a product capture to be judged, so they can be designed now
 * rather than after item 3.
 *
 * THIS IS THE POINT OF THE ALTERNATES BLOCK. The five above are all blocked on a real
 * browser and a real shelf; these two are not, because their content is a cover, the mark
 * and type, all of which exist today. Render, look, decide. Then the only thing left to do
 * by hand is capture.
 */
const ALTERNATES = [
  {
    id: 'pair',
    layout: 'pair',
    ground: 'day',
    head: 'Find any book you see online, instantly.',
    sub: 'A picture is enough. No title, no link, no typing.',
    note: 'The brand frame. Also the source for the 440x280 tile: crop to the pair.',
  },
];

const missingSlot = (file, note) =>
  `<div class="missing"><b>${file}</b><span>${note}</span></div>`;

const capture = (file, note, cls = '') =>
  existsSync(file) ? `<img class="${cls}" src="${file}" alt="" />` : missingSlot(file, note);

/** hero: one capture, centred. The original composition, kept because it is right for a shelf. */
const heroStage = (s) => `<div class="stage">${capture(`zzz-shot-${s.n}.png`, s.note)}</div>`;

/**
 * pair: a real cover beside the mark at size.
 *
 * THE ORDER IS COVER FIRST, MARK SECOND, and it is a reading order rather than a gaze.
 * An earlier version of this comment claimed the mark looks left at the cover because its
 * eyes sit left of the ball's axis. **That is false and `src/shared/mark.test.ts` asserts
 * the opposite**: both eyes are symmetric about `MARK.ball.cx` to within a pixel, so the
 * mark looks straight out at the reader from any placement. The left-to-right order earns
 * its keep as "here is a picture, here is the thing that reads it", which is the sentence
 * the frame is making, and nothing about the drawing needs to be true for that to work.
 *
 * THE GROUND IS CREAM HERE, NOT COBALT, and this is the one measured decision in the file.
 * The cobalt ground IS the mark's own ramp, so `contrast(deep, deep)` is **1.00:1** - the
 * ball's lower right is not low contrast against the frame, it is the identical colour, and
 * the first render came back with the mark half dissolved into the background. Cobalt is
 * right for a frame whose content is a popup panel and exactly wrong for one whose content
 * is the mark. On cream the mark's deep end reads at 8.03:1, and a dark cover gains rather
 * than loses. Measured with `contrast()` from `tools/mark.mjs`, then rendered and looked at.
 */
const pairStage = (s) => `
    <div class="stage pair">
      <div class="cover"><img src="${COVER}" alt="" /></div>
      <div class="arc" aria-hidden="true"></div>
      ${mark(`pair-${s.id}`, 260)}
    </div>`;

/** split: two panels, left to right, with a connector between them. */
const splitStage = (s) => `
    <div class="stage split">
      <div class="panel">
        ${capture(`zzz-shot-${s.n ?? s.id}a.png`, 'the picture, before')}
        <span class="tag">${s.a}</span>
      </div>
      <div class="arrow" aria-hidden="true">
        ${mark(`split-${s.n ?? s.id}`, 54)}
      </div>
      <div class="panel">
        ${capture(`zzz-shot-${s.n ?? s.id}b.png`, 'the shelf, after')}
        <span class="tag">${s.b}</span>
      </div>
    </div>`;

/**
 * detail: one capture plus a magnified inset.
 *
 * FOR THE ONE SHOT WHERE THE SUBJECT IS 18 PIXELS. `docs/store/assets.md` says a wide shot
 * of the action bar leaves the mark as twelve pixels of blue nobody can see, and that a
 * close crop is the answer. A close crop alone loses the context that makes it mean
 * anything, which is that the button sits in X's own row. The inset is both.
 */
const detailStage = (s) => `
    <div class="stage detail">
      ${capture(`zzz-shot-${s.n}.png`, s.note)}
      <div class="inset">
        ${capture(`zzz-shot-${s.n}z.png`, 'the magnified crop', 'zoom')}
        <span class="tag">${s.zoomLabel}</span>
      </div>
    </div>`;

const STAGES = { hero: heroStage, pair: pairStage, split: splitStage, detail: detailStage };

const frame = (s) => {
  const stage = STAGES[s.layout];
  if (!stage) throw new Error(`unknown layout ${s.layout}`);
  return `
  <figure class="frame${s.ground ? ` on-${s.ground}` : ''}" id="shot-${s.n ?? s.id}">
    <div class="copy">
      <h2>${s.head}</h2>
      <p>${s.sub}</p>
    </div>
    ${stage(s)}
  </figure>`;
};

const html = `<!doctype html>
<meta charset="utf-8">
<title>Buki store screenshots, 1280x800</title>
<style>
  @font-face {
    font-family: "Manrope";
    src: url("docs/manrope.woff2") format("woff2");
    font-weight: 200 800; font-display: swap;
  }
  :root { --cream: ${CREAM}; --deep: ${DEEP}; --mid: ${MID}; }
  body { margin: 0; background: #3a3a3a; font-synthesis: none; }

  /* EXACTLY 1280x800. Screenshot each .frame at this size and it needs no cropping. */
  .frame {
    margin: 0 0 24px; width: 1280px; height: 800px; position: relative; overflow: hidden;
    display: flex; flex-direction: column; align-items: center;
    background: radial-gradient(120% 90% at 22% 8%, var(--mid) 0%, var(--deep) 62%);
    color: var(--cream);
    font-family: "Manrope", system-ui, -apple-system, sans-serif;
  }
  /* The grain the landing uses, so the ground is the brand's rather than a flat fill. */
  .frame::after {
    content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .05;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E");
  }

  /* The cream ground, for a frame whose subject is the MARK rather than a screenshot.
     Its own ramp is the cobalt, so the mark cannot separate from the default ground: the
     deep stop and the ground are the same colour, measured at 1.00 to 1. Text flips to ink
     with it, or the headline goes cream on cream and the frame loses its first line. */
  .frame.on-day { background: ${DAY}; color: ${INK}; }
  .frame.on-day .arc { opacity: .4; }

  .copy { padding: 64px 72px 0; text-align: center; max-width: 940px; }
  /* Size and weight carry the hierarchy. brand.md: never a fade. */
  h2 { margin: 0 0 10px; font-size: 44px; line-height: 1.06; font-weight: 800; letter-spacing: -0.02em; }
  p  { margin: 0; font-size: 19px; line-height: 1.45; font-weight: 500; opacity: .92; }

  /* The min-height zero below is load-bearing. A flex item defaults to min-height auto and
     refuses to shrink below its content, so a max-height of 100% on the image inside is
     ignored and a tall capture runs straight out of the 800px frame. Caught by rendering
     it, not by reading it.
     NO BACKTICKS IN THIS BLOCK. It is a template literal, and a backtick in a CSS comment
     ends it with a parse error elsewhere in the file. Fourth occurrence 2026-08-18, in a
     file written hours after the third was fixed. Prose, not code voice. */
  .stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
           width: 100%; padding: 34px 0 54px; box-sizing: border-box; }
  /* NOT upscaled. The popup is 560px and it is shown at 560px: soft type on a listing
     whose claim is craft is the worst first impression available. The frame fills the
     space instead, which is what the frame is for. */
  .stage img { display: block; max-width: 1100px; max-height: 100%; width: auto; height: auto;
               object-fit: contain; border-radius: 16px;
               box-shadow: 0 40px 90px -30px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.07); }

  /* pair. The cover sits slightly low and tilted, the mark rides slightly high, so the two
     are a composition rather than two objects on a shelf edge. */
  .stage.pair { gap: 46px; padding-bottom: 66px; }
  /* A div, not a figure. The frame is itself a figure and a nested one of the same name
     breaks every naive scan-to-the-closing-tag over this output, which is how the first
     render of this composition came back with the mark missing. It carries no caption, so
     the semantic element bought nothing and cost that. */
  .pair .cover { margin: 0; transform: rotate(-3.5deg) translateY(14px); }
  .pair .cover img { width: 300px; max-width: none; border-radius: 10px;
                     box-shadow: 0 46px 90px -26px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.1); }
  .pair .mark { transform: translateY(-10px); filter: drop-shadow(0 26px 46px rgba(0,0,0,.55)); }
  /* The connector is a dotted arc rather than an arrow: an arrow says this BECOMES that,
     which is wrong. The cover does not turn into the mark, it is read by it. */
  /* currentColor, not the cream token. The token is the ground on a cream frame, so the
     connector painted itself in the background colour and disappeared - the SECOND time in
     one composition that an element was coloured to match the surface it sits on, after the
     mark against its own ramp. currentColor inherits from .frame and flips with the ground,
     so neither frame can repeat it. */
  .arc { width: 96px; height: 2px; align-self: center;
         background: repeating-linear-gradient(90deg, currentColor 0 7px, transparent 7px 15px);
         opacity: .5; }

  /* split. Two panels of equal weight, so neither reads as the main one. */
  /* A GRID, NOT A COLUMN, and the reason is visible the moment you render it. Two panels
     of different heights, each centring its own content, put the two captions at different
     y positions: 517 and 552 in the first render, which reads as a misalignment rather than
     as a pair. One shared row track bottom-aligns both captures and puts both tags on one
     line, whatever heights the captures happen to be. */
  .stage.split { gap: 30px; align-items: stretch; padding-inline: 60px; }
  .split .panel { flex: 1; min-width: 0; display: grid; grid-template-rows: 250px auto;
                  align-content: center; justify-items: center; gap: 16px; }
  .split .panel img { max-width: 100%; align-self: end; }
  .split .panel .missing { align-self: end; }
  .split .arrow { display: flex; align-items: center; padding-bottom: 34px; }
  .tag { font-size: 15px; font-weight: 600; opacity: .78; letter-spacing: .01em; }

  /* detail. The inset is bottom-right, off the capture rather than on top of it, so it
     never covers the thing it is magnifying. */
  .stage.detail { position: relative; }
  .detail .inset { position: absolute; right: 74px; bottom: 58px;
                   display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .detail .inset img.zoom { max-width: 300px; max-height: 220px; border-radius: 14px;
                            box-shadow: 0 26px 54px -18px rgba(0,0,0,.8), 0 0 0 2px rgba(255,255,255,.16); }
  .detail .inset .missing { width: 300px; height: 180px; }

  .missing {
    width: 620px; height: 320px; border: 2px dashed rgba(255,255,255,.28); border-radius: 16px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    font-size: 15px; text-align: center; padding: 0 30px;
  }
  .missing b { font-size: 19px; font-weight: 800; }
  .missing span { opacity: .85; max-width: 420px; line-height: 1.4; }

  .label { color: #fff; font: 12px/1 system-ui; padding: 14px 0 6px; opacity: .75; }
  .rule { color: #fff; font: 700 13px/1 system-ui; letter-spacing: .14em; text-transform: uppercase;
          padding: 40px 0 4px; opacity: .95; }
</style>

${SHOTS.map((s) => `<p class="label">shot ${s.n} &nbsp;·&nbsp; ${s.layout} &nbsp;·&nbsp; 1280x800 &nbsp;·&nbsp; ${s.note}</p>${frame(s)}`).join('\n')}

<p class="rule">Alternates &nbsp;·&nbsp; these need no capture, so they can be judged now</p>
${ALTERNATES.map((s) => `<p class="label">${s.id} &nbsp;·&nbsp; ${s.layout} &nbsp;·&nbsp; 1280x800 &nbsp;·&nbsp; ${s.note}</p>${frame(s)}`).join('\n')}
`;

writeFileSync('zzz-store-shots.html', html);
// A split shot has no zzz-shot-N.png and never will, so asking for one reports a file that
// is not missing, it is not the filename. Each layout is asked for its own slots.
const slotsFor = (s) =>
  s.layout === 'split' ? [`zzz-shot-${s.n}a.png`, `zzz-shot-${s.n}b.png`] : [`zzz-shot-${s.n}.png`];
const missing = SHOTS.flatMap(slotsFor).filter((f) => !existsSync(f));
console.log('wrote zzz-store-shots.html');
console.log(
  missing.length ? `waiting on real captures: ${missing.join(', ')}` : 'every slot filled',
);
console.log('alternates need no capture:', ALTERNATES.map((a) => a.id).join(', '));
