/**
 * The two product images Polar's checkout page shows, generated rather than prompted.
 *
 * WHY GENERATED. `marketing-skills:image` is explicit that AI models hallucinate UI, so an
 * AI-generated picture of "a book shelf app" would show a product that does not exist, on
 * the one page where somebody is about to pay for the one that does. Both images here are
 * drawn from the repo's own truth: the mark comes out of `tools/mark.mjs` (the definition
 * six surfaces are asserted against) and the shelf is `tools/popup-harness.mjs` rendering
 * the real `popup.html` with real `dist/popup.js`.
 *
 * WHAT IS DELIBERATELY NOT IN THEM: the price. `src/shared/pricing.ts` owns every number,
 * and `pricing.test.ts` polices the surfaces that repeat one. A PNG is a surface no test
 * can read, so a price baked into it is a number that can go stale silently. Polar shows
 * the real price beside the image anyway.
 *
 * USAGE
 *   node tools/popup-harness.mjs          seeds the shelf these embed
 *   node tools/polar-media.mjs            writes zzz-polar-1.html and zzz-polar-2.html
 *   python -m http.server 8931            they load fonts and the harness by URL
 *   then screenshot each at 1200x630
 *
 * The pages are gitignored. Regenerate rather than committing them; the PNGs go to Polar.
 */
import { writeFileSync } from 'node:fs';
import { markSvg } from './mark.mjs';

/**
 * The landing's world, not the extension's. `docs/brand.md`: the landing is the brand's
 * world and the extension is the tool. A checkout page is neither, so it gets the brand.
 */
const PAPER = '#fbf7ec';
const INK = '#0a0f33';
const INK_2 = '#3d477a';

/**
 * The mark, from the definition. Never redrawn by eye; that is how six slightly different
 * faces happen. `markSvg(id)` returns the INNER content, so it needs its own <svg> around
 * it, and the id has to be unique per page or two gradients with one name collide.
 */
const mark = (px, id) =>
  `<svg width="${px}" height="${px}" viewBox="0 0 100 100" aria-hidden="true">${markSvg(id)}</svg>`;

const shell = (title, body, extraCss = '') => `<!doctype html><meta charset="utf-8">
<title>${title}</title>
<style>
  @font-face {
    font-family: "Buki Manrope";
    src: url("/fonts/manrope.woff2") format("woff2-variations");
    font-weight: 200 800;
    font-display: block;
  }
  html, body { margin: 0; padding: 0 }
  .card {
    width: 1200px; height: 630px; box-sizing: border-box;
    background: ${PAPER}; color: ${INK};
    font-family: "Buki Manrope", system-ui, sans-serif;
    font-synthesis: none;
    display: flex; overflow: hidden; position: relative;
  }
  ${extraCss}
</style>
<body><div class="card">${body}</div></body>`;

/**
 * ONE: the identity card. Its whole job is "you are buying the right thing", so it is the
 * mark, the name, and one sentence saying what changes. Nothing else.
 *
 * The mark is off to the left and large rather than centred over a headline, because the
 * catcher LOOKS at you and a centred logo-over-tagline is the layout every checkout image
 * already uses.
 */
writeFileSync(
  'zzz-polar-1.html',
  shell(
    'Buki Pro, identity card',
    `<div class="wrap">
       <div class="mark">${mark(240, "pm1")}</div>
       <div class="say">
         <p class="name">Buki&nbsp;Pro</p>
         <p class="line">No key to fetch.<br />Buki reads the cover for you.</p>
       </div>
     </div>`,
    `
    /* Centred, and that is a crop decision rather than a taste one. Polar states no fixed
       aspect for product media, so this may be shown square or letterboxed by a layout
       nobody here controls. Left-aligned, the first render left the right third empty and
       a centre-square crop would have cut the sentence in half. */
    .wrap { display: flex; align-items: center; justify-content: center;
            gap: 56px; padding: 0 72px; width: 100% }
    .mark { flex: 0 0 auto; line-height: 0 }
    .mark svg { display: block; width: 240px; height: 240px }
    .name { margin: 0 0 18px; font-weight: 800; font-size: 76px; line-height: 1;
            letter-spacing: -0.03em }
    .line { margin: 0; font-weight: 500; font-size: 30px; line-height: 1.35; color: ${INK_2} }
    `,
  ),
);

/**
 * TWO: what you actually get. The REAL popup, in an iframe, rendered by the real script.
 *
 * `docs/brand.md` records that the landing's step mockups are deliberately NOT dimmed to
 * suit the page, because they depict a real light surface and dimming misrepresents the
 * product. Same argument here: the panel is shown as it renders.
 */
writeFileSync(
  'zzz-polar-2.html',
  shell(
    'Buki Pro, the shelf',
    `<div class="left">
       <div class="mark">${mark(64, "pm2")}</div>
       <p class="head">Your shelf,<br />on your computer.</p>
       <p class="sub">Caught from a picture, filed by when you mean to read it.</p>
     </div>
     <div class="right"><iframe src="/zzz-popup-harness.html" scrolling="no"></iframe></div>`,
    `
    .left { flex: 1 1 auto; padding: 0 0 0 88px; align-self: center }
    .mark { line-height: 0; margin-bottom: 30px }
    .mark svg { display: block; width: 64px; height: 64px }
    .head { margin: 0 0 16px; font-weight: 800; font-size: 54px; line-height: 1.06;
            letter-spacing: -0.03em }
    .sub { margin: 0; font-weight: 500; font-size: 24px; line-height: 1.4; color: ${INK_2};
           max-width: 24ch }
    /* 490, measured rather than guessed: at 620 the popup's own content ended around 485
       and the card showed a hundred pixels of empty black, which reads as a broken
       screenshot rather than as a window. Cut just under the disclosure so the panel
       floats on the cream with its shadow instead of running off the edge. */
    .right { flex: 0 0 560px; align-self: center; margin: 0 60px 0 0;
             border-radius: 18px; overflow: hidden;
             box-shadow: 0 30px 70px -30px rgba(10, 15, 51, 0.45) }
    iframe { display: block; width: 560px; height: 490px; border: 0 }
    `,
  ),
);

console.log('zzz-polar-1.html and zzz-polar-2.html written. Screenshot each at 1200x630.');
