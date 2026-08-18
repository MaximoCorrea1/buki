/**
 * The five Chrome Web Store screenshots, framed at 1280x800.
 *
 * WHY THIS EXISTS, and it is a problem nobody had hit. **The store wants 1280x800 and the
 * popup is 560px wide.** A raw capture is a small panel adrift in a large empty frame, and
 * upscaling it to fill the space makes the type soft, which on a listing whose whole claim
 * is craft is the worst possible first impression. Every shot needs composing, and the
 * composition is a design decision rather than a cropping one.
 *
 * WHAT THIS DOES AND DOES NOT DO. It builds the FRAME: the ground, the headline, the
 * placement, the shadow. It does not fake the CONTENT. Each frame carries an <img> slot for
 * a real capture, because `docs/store/listing.md` records the decision that these are shot
 * against a shelf holding books actually saved: a mocked shelf reads as a mock, and this is
 * a product whose entire claim is that the list is yours.
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
 *   1. capture the five raw shots by hand, per docs/store/assets.md
 *   2. drop them in the repo root as zzz-shot-1.png ... zzz-shot-5.png
 *   3. re-run, then screenshot each .frame at 1280x800
 *
 * Gitignored. Regenerate rather than commit.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { MARK } from './mark.mjs';

/** The landing's cream and ink, read rather than retyped. */
function landingToken(name) {
  const src = readFileSync('docs/index.html', 'utf8');
  const m = new RegExp(`--${name}:\\s*light-dark\\(([^,]+),`).exec(src);
  if (!m) throw new Error(`token --${name} not found in docs/index.html`);
  return m[1].trim();
}

const CREAM = landingToken('paper');
const DEEP = MARK.ramp.stops[MARK.ramp.stops.length - 1].color;
const MID = MARK.ramp.stops[1].color;

/**
 * One headline per shot, and they are not captions.
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
    head: 'A shelf, not a folder.',
    sub: 'Face out, four to a board, in your browser. Nothing is synced anywhere.',
    note: 'The one that sells it. Lead with it.',
  },
  {
    n: 2,
    head: 'One photograph, several books.',
    sub: 'It reads the cover, not the caption. A stack on a desk gets a row and a decision each.',
    note: 'The differentiator. No competitor screenshot can show this.',
  },
  {
    n: 3,
    head: 'Anywhere there is a picture.',
    sub: 'Reddit, a newsletter, a blog, a video thumbnail. Right-click and it is caught.',
    note: 'Proves the single-purpose statement rather than asserting it.',
  },
  {
    n: 4,
    head: 'One press, where you already are.',
    sub: 'Buki sits in the post’s own row, beside reply and like.',
    note: 'Shows people where it lives.',
  },
  {
    n: 5,
    head: 'It tells you how often it is right.',
    sub: 'Every catch names its evidence, and the shelf publishes its own kept rate.',
    note: 'Nothing else in this category publishes its own accuracy.',
  },
];

const frame = ({ n, head, sub, note }) => {
  const shot = `zzz-shot-${n}.png`;
  const has = existsSync(shot);
  return `
  <figure class="frame" id="shot-${n}">
    <div class="copy">
      <h2>${head}</h2>
      <p>${sub}</p>
    </div>
    <div class="stage">
      ${
        has
          ? `<img src="${shot}" alt="" />`
          : `<div class="missing"><b>zzz-shot-${n}.png</b><span>${note}</span><em>docs/store/assets.md, shot ${n}</em></div>`
      }
    </div>
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

  .missing {
    width: 620px; height: 320px; border: 2px dashed rgba(255,255,255,.28); border-radius: 16px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    font-size: 15px; text-align: center; padding: 0 30px;
  }
  .missing b { font-size: 19px; font-weight: 800; }
  .missing span { opacity: .85; max-width: 420px; line-height: 1.4; }
  .missing em { font-style: normal; opacity: .6; font-size: 13px; }

  .label { color: #fff; font: 12px/1 system-ui; padding: 14px 0 6px; opacity: .75; }
</style>

${SHOTS.map((s) => `<p class="label">shot ${s.n} &nbsp;·&nbsp; 1280x800 &nbsp;·&nbsp; ${s.note}</p>${frame(s)}`).join('\n')}
`;

writeFileSync('zzz-store-shots.html', html);
const missing = SHOTS.filter((s) => !existsSync(`zzz-shot-${s.n}.png`)).map((s) => s.n);
console.log('wrote zzz-store-shots.html');
console.log(
  missing.length
    ? `waiting on real captures: ${missing.map((n) => `zzz-shot-${n}.png`).join(', ')}`
    : 'all five captures present',
);
