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
 * REWRITTEN 2026-08-25, SECOND PASS, and this one changed the approach rather than the
 * wording. Maximo: *"instead of repolish the currents text, change the approach... these
 * screenshots need to convert, sell, be fun, nice, we need to appeal to our niche,
 * bookworms, tech people on x, Redditors who read."*
 *
 * The first pass fixed five sentences and left the structure alone, and the structure was
 * the problem. Every frame answered *what does it do?* A store listing is not a feature
 * tour: it is read by somebody deciding, and what they are deciding is whether this stops
 * something that keeps happening to them. So the five frames now run as one story, in the
 * order the store shows them:
 *
 *   1 the loss   2 the rescue   3 the relief   4 the scale   5 the offer
 *
 * WHAT MADE IT POSSIBLE was not a better vocabulary. It was noticing that three of the
 * captures are ONE REAL POST: @Kekius_Sage's *"This is a book I read recently"*, the cover
 * being read, and Heisenberg landing on the shelf. Shots 1 and 2 are a setup and a payoff
 * from a single moment, which is a thing no amount of rewriting could have produced from
 * five unrelated pictures.
 *
 * NOTHING HERE IS PROOF WE DO NOT HAVE. Zero users, pre-launch, so there are no counts, no
 * testimonials and no ratings, exactly as `.agents/product-marketing.md` requires. The one
 * number in the set is nineteen, and it is printed inside its own capture. The likes on
 * shot 1's post are somebody else's and are never claimed as ours.
 *
 * ---
 *
 * The FIRST pass of 2026-08-25 is kept below because two of its fixes were facts, not
 * taste, and both survive into this set: "tap" was wrong (desktop Chrome, there is nothing
 * to tap) and the house style has NO CONTRACTIONS, only possessives, which is why none of
 * the lines above use one.
 *
 * EDITED 2026-08-25 on Maximo's brief: *"idk if i like the ctas"*. The instinct was right
 * and the diagnosis is that THESE ARE NOT CTAs. A store screenshot has no button on it:
 * the only control on the page is Chrome's own Add to Chrome, above the fold, and it never
 * changes. Written as slogans, five frames were five unrelated claims a reader had to
 * assemble. They now run as ONE ARGUMENT IN FIVE BEATS, in the order the store shows them:
 *
 *   1 what you end up with   2 the proof it works   3 what you do
 *   4 where it lives         5 why to trust it, and what it costs
 *
 * Four changes are worth naming because each fixes something specific rather than taste:
 *
 *   - SHOT 2 CARRIES THE NUMBER. *"Every book in it"* is a claim; *"Nineteen books"* is the
 *     count printed inside the capture beneath it, so the frame proves itself. It is the
 *     one number no competitor's screenshot can show. **It is bound to the capture** and
 *     `src/shared/pricing.test.ts` holds it to `docs/store/assets.md`: reshoot with a
 *     different count and both must move together.
 *   - SHOT 4 SAID "TAP". Buki is a desktop Chrome extension and there is nothing to tap.
 *     A mobile verb on a desktop listing reads as copy written without opening the product.
 *   - SHOT 5 STOPPED SAYING THE SAME THING TWICE. Head and sub were one claim in two
 *     sentences, and the head said it worse ("where it looked" is ambiguous, and it spent
 *     two `it`s on two different subjects). The sub now carries the OFFER, because the
 *     last frame is the only close a swipeable set gets and the trial appeared nowhere in
 *     the five. Trust and price are one argument here, not two: this is how you check the
 *     answer, and checking costs nothing.
 *   - NO CONTRACTIONS, anywhere. `docs/index.html` has none, only possessives, and the
 *     drafts that read best here all leaned on *that's* and *there's*. House style won.
 *
 * Every sub is still under eight words, which is the 2026-08-20 rule and the reason none of
 * this reopened the positioning.
 *
 * `docs/store/assets.md` carries what to actually put on screen for each.
 */
const SHOTS = [
  {
    /**
     * THE LOSS. One real post, and the reason the product exists is inside it.
     *
     * The capture is @Kekius_Sage on 2026-08-20: *"This is a book I read recently."* One
     * thousand likes, twenty-six thousand views, and **the title appears nowhere in the
     * text.** It is on the cover of the photograph and nowhere else, which is the exact
     * condition every text-reading competitor is blind to (`.agents/product-marketing.md`,
     * Competitive Landscape: TBR Bookmarker reads page text; BookFinder needs selectable
     * type). A reader does not have to be told that. They can look.
     *
     * "Name this book." is a CHALLENGE the reader loses in about one second, and losing it
     * is the point. It opens a loop that shot 2 closes, it flatters the niche (identifying
     * books is a thing bookworms enjoy), and it indicts the POST and the BOOKMARK rather
     * than the reader, which matters: nobody installs anything that just made them feel
     * slow. The sub is the founder's own framing of the pain, near verbatim.
     *
     * THIS FRAME ALSO DOES SHOT 4'S OLD JOB. Buki's mark is already in that post's action
     * bar, bottom right, beside bookmark and share. The old set spent a whole frame saying
     * "the button lives here", which is a location rather than a reason. Here it is simply
     * visible to anyone who looks, and the words are free to sell instead.
     */
    n: 1,
    layout: 'hero',
    head: 'Name this book.',
    sub: 'This is how books get lost.',
    note: 'The X post. Title nowhere in the text. The mark is in the action bar, bottom right.',
  },
  {
    /**
     * THE RESCUE, and it closes shot 1's loop with the answer.
     *
     * Same post, same book, seconds apart: the cover being read, then *Physics and
     * philosophy, Werner Heisenberg* with the evidence line **read from the cover**. Shot 1
     * asks and this one answers, so the pair is a setup and a payoff rather than two
     * adjacent features.
     *
     * The sub is in the PAST TENSE on purpose. "You never typed a thing" hands the reader
     * the outcome as something already done to them, which is the thing they are buying:
     * not a capability, the absence of the step where the intention dies. The positioning
     * doc names that step by name under Switching Dynamics.
     */
    n: 2,
    layout: 'split',
    head: 'Buki reads the cover.',
    sub: 'You never typed a thing.',
    note: 'Same post as shot 1, same book, seconds apart. Needs zzz-shot-2a.png and zzz-shot-2b.png.',
    a: 'What you saw',
    b: 'What you have',
  },
  {
    /**
     * THE RELIEF. The old head here was "A shelf, not a folder.", which is a good line
     * about the PRODUCT and says nothing about the reader.
     *
     * "Every book you nearly lost" is the same grid of covers reframed as rescued things,
     * and it is the only frame in the set that pays off the guilt the first one opened.
     * `.agents/product-marketing.md` calls that emotion by name: *"the quiet guilt of a
     * bookmark folder. Knowing there were good things in there and no longer being able to
     * find them."* Loss felt roughly twice as hard as the equivalent gain, so the relief is
     * worth more than the feature it comes from.
     *
     * The sub still names the three piles, because they are the one thing in this frame a
     * stranger cannot decode, and it closes on the contrast the head implies.
     */
    n: 3,
    layout: 'hero',
    head: 'Every book you nearly lost.',
    sub: 'Now, Next, or Someday. Never a folder again.',
    note: 'The payoff. A full shelf, sitting on Now, all four piles populated.',
  },
  {
    /**
     * THE SCALE. Maximo, 2026-08-25, on the previous head "One photo. Nineteen books.":
     * *"thats just an observation of my shelf, not a buki high conversion screenshot."*
     * Correct, and the fix is not a bigger number. A count is a STAT; what sells is the
     * work the reader does not have to do.
     *
     * "Nobody types nineteen titles" names the alternative and dismisses it in four words.
     * It is the only joke in the set that is also the argument, which is the kind worth
     * keeping. Two moments of wit across five frames is the ratio; more would be noise.
     *
     * STILL BOUND TO THE CAPTURE. Nineteen is the count `trayCopy.ts` prints inside
     * zzz-shot-4.png. Reshoot with a different photograph and the word is a lie the reader
     * can check without leaving the frame. assets.md quotes this head and
     * storeShots.test.ts fails if the two stop agreeing.
     */
    n: 4,
    layout: 'hero',
    head: 'Nobody types nineteen titles.',
    sub: 'Buki catches every book in the picture.',
    note: 'The differentiator no competitor can screenshot. Head is bound to the capture count.',
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
    // THE CLOSE, and the fifth thing uploaded to the listing. It needs no capture, which is
    // why the set can ship today: four product frames plus this one.
    //
    // The head is the LOCKED motto (docs/brand.md) and is not up for editing here. The sub
    // used to be "A picture is enough. No title, no link, no typing." That idea now lives
    // in shot 2's sub, said better and in the reader's own past tense, so this slot was
    // spending itself on a duplicate. It carries the OFFER instead, because a swipeable set
    // gets exactly one close and the trial appeared on none of the five.
    //
    // Both sentences are the locked motto's second line, quoted rather than improvised, and
    // pricing.test.ts holds "Ten catches free" to TRIAL_CATCHES so a PNG cannot outlive the
    // number it promises.
    head: 'Find any book you see online, instantly.',
    sub: 'Ten catches free. No account, no sync.',
    note: 'The close, and the brand frame. Also the source for the 440x280 tile: crop to the pair.',
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
