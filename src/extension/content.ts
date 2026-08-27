// Buki content script: inject a Save button on tweets, scrape + recognize, and render the
// catch tray - the extension's only in-page surface. Both flows (the mark button and the
// worker's right-click menu) put their catches in the same tray.
import type { Book, RecognitionSource, Tweet } from '../recognizer/types';
import { identityOf, type Intent, type SavedSource } from './storage';
import { clothFor } from './cloth';
import { shotFor } from './coverSource';
import { shiftOf, travelFrom } from './slotTravel';
import { foundHeading, INTENT_LABEL, PROVENANCE, WALL } from './trayCopy';
import { resolveTheme, THEME_KEY } from './themeChoice';
import manrope from '../../fonts/manrope.woff2';
import { createCatchTray, type Candidate, type Card } from './catchTray';
import { postKey } from './lookupMemo';
import { onRealClick } from './realClick';
import { isFeedHost } from './feedHost';
import { keepTweetMedia } from './twitterImage';
import type { AttemptDraft, PendingEvent } from './recognitionLog';
import type {
  BackgroundRequest,
  BackgroundResponse,
  ContentRequest,
  ShelfResponse,
  Shelved,
  TweetContext,
} from './messages';

const BTN_CLASS = 'buki-save-btn';

/**
 * THE TRAY GETS THE PRODUCT'S TYPEFACE, as of 2026-08-16.
 *
 * It was the one surface still on the system stack while the popup, the setup page and
 * the landing all ran Manrope - which on Windows means Segoe UI, and reads exactly as
 * dated as it was reported to be.
 *
 * The reason it was held back has been removed rather than overruled. A content script
 * cannot reference an extension file from CSS without a `web_accessible_resources` entry
 * matching <all_urls>, and widening the exposed surface immediately before store review
 * was the trade docs/brand.md refused. Inlining the font as a data URL at build time
 * needs no such entry: nothing is exposed, the manifest is untouched, and the bytes were
 * already shipping in the package.
 *
 * Registered on the PAGE's font set, under a name no page will have, and only when a tray
 * is actually created - so a tab that never catches a book never pays for it. A page whose
 * own CSP refuses a data: font simply falls through to the stack below, which is precisely
 * what shipped before this existed.
 */
const FONT_FAMILY = 'Buki Manrope';
let fontAsked = false;

function ensureFont(): void {
  if (fontAsked) return;
  fontAsked = true;
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  try {
    const face = new FontFace(FONT_FAMILY, `url(${manrope}) format("woff2")`, {
      // A variable face: one file covers the whole range the tray uses.
      weight: '200 800',
    });
    void face
      .load()
      .then((loaded) => document.fonts.add(loaded))
      .catch(() => undefined);
  } catch {
    // Refused by the page. The system stack is the fallback and always was.
  }
}

/**
 * Boundary tracing. This extension coordinates three isolated contexts, so a failure
 * anywhere in the chain looks identical from the page: nothing happens. Logging each
 * hand-off is what makes "it does nothing" diagnosable.
 * Silence it with: localStorage.bukiQuiet = '1'
 */
const trace = (...args: unknown[]): void => {
  try {
    if (localStorage.getItem('bukiQuiet') === '1') return;
  } catch {
    /* storage can be blocked; log anyway */
  }
  console.info('[Buki]', ...args);
};

/**
 * One stylesheet rather than inline cssText: :active press feedback, hover gating and
 * prefers-reduced-motion cannot be expressed inline, and those are the parts that decide
 * whether this reads as part of the page or bolted onto it.
 *
 * THE THIRD GENERATION, and this surface reaches it last on purpose. It is the only Buki
 * surface that renders inside SOMEBODY ELSE'S page: X in daylight, X at night, Reddit, a
 * newsletter, a black photo essay, a white docs site. Every other surface chooses its own
 * background; this one is handed one.
 *
 * SO THE TRANSPARENCY HALF OF THE THIRD GENERATION STOPS HERE, deliberately.
 * The landing's glass works because the page owns what is behind it and the contrast was
 * measured against it. Here the backdrop might be a photograph. The card owns its ground
 * instead — the same argument icons/icon.svg makes for its cream plate: where the ground
 * is not ours, we bring one. src/extension/contentChrome.test.ts fails the build if a
 * surface that carries text ever becomes see-through.
 *
 * AND THE WEBFONT STOPS HERE TOO. Manrope would need a web_accessible_resources entry
 * matching <all_urls>, because catch-anywhere injects this script into any tab. Widening
 * the extension's exposed surface immediately before store review, to change the face on
 * a 332px card, is the same trade OPENWORK item 7 refused for the downloads permission.
 * The system stack is also the honest choice here: on a Mac it resolves to SF, which is
 * the thing Manrope is reaching for in the first place.
 *
 * WHAT DOES ARRIVE: the palette, which is now the landing's night rather than the old
 * violet-black room with an amber lamp; capsules with a press on every control; sentences
 * at full contrast; two radii; and the mark's own spine and two cords down the edge.
 *
 * Motion is rationed by how often a surface is seen. The button is hit dozens of times a
 * day, so it only ever presses — no entrance animation. A card appears once per catch, so
 * it can afford one.
 */
const STYLE = `
.buki-btn {
  cursor: pointer; background: transparent; border: 0; padding: 4px 6px;
  margin-left: 4px; border-radius: 999px;
  opacity: .72; transition: opacity 140ms cubic-bezier(.23,1,.32,1),
    transform 140ms cubic-bezier(.23,1,.32,1), background-color 140ms ease;
}
/* 18px is X's OWN icon box, not a number we liked. The mark sits in a row of five host
   controls, so it takes the host's grid; sizing it to us would make it the one thing in
   the bar that is a different size, which reads as a plugin rather than as a button.
   The svg is a block because an inline one sits on the text baseline and leaves a few
   pixels of descender gap under it, which would put the mark off-centre in a row whose
   other icons are centred. The font size and line height went with the emoji they were
   sizing: a declaration that no longer does anything still reads as deliberate.
   NO BACKTICKS IN HERE. This is a template literal, and a backtick in a CSS comment ends
   it with a parse error a hundred lines away. Third time, 2026-08-18. Prose, not code. */
.buki-btn svg { display: block; width: 18px; height: 18px; }
.buki-btn:active { transform: scale(.9); }
.buki-btn:focus-visible { outline: 2px solid #7f9bea; outline-offset: 1px; opacity: 1; }
@media (hover: hover) and (pointer: fine) {
  .buki-btn:hover { opacity: 1; background: rgba(127,155,234,.18); }
}

/* ------------------------------------------------------------------ the tray

   One column, bottom-right, newest nearest the corner. Unlimited by count and bounded
   only by the screen: catching six books in a row should show six cards, and the stack
   that used to cap at three quietly dropped the rest of your afternoon. */
.buki-tray {
  /* iOS NEUTRALS, 2026-08-16, so the tray, the popup and the setup page are one product.
     These were the landing at night, navy for navy; the extension went to Apple's system
     greys and a navy card floating over a neutral one would have read as two apps.

     THE GROUND IS AN ELEVATED GREY, NOT TRUE BLACK, and that is the difference between
     this surface and the popup. The popup owns its whole window so it can be #000; this
     is a CARD that lands on somebody else's page, including a black one. Measured against
     the five grounds docs/brand.md names: 17.01:1 on a white docs site, 16.10:1 on X in
     daylight, 4.10:1 mid-photograph, and 1.23:1 on a black essay - where the ring and the
     shadow are what carry it, which is why the ring got heavier here.

     Measured on --bg: --ink 17.01:1, --ink-2 7.21:1, --jade 10.54:1. --accent is a FILL
     and a RING in this stylesheet and never body text, so its bar is its label's: black
     on it is 7.78:1, where the old #0a0f33 would be 6.30:1. */
  /* COLOUR MOVED OUT OF HERE ON 2026-08-24. Every colour token now lives in one of the
     two mood blocks below; only the shape, motion and type tokens stay in this rule.
     A colour left behind here would be a colour that cannot answer the second mood. */

  --ease: cubic-bezier(.23,1,.32,1);
  --drawer: cubic-bezier(.32,.72,0,1);
  --r-lg: 16px;
  --book: ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --ui: "Buki Manrope", system-ui, -apple-system, "Segoe UI", sans-serif;

  position: fixed; right: 18px; bottom: 18px; z-index: 2147483000;
  display: flex; flex-direction: column; gap: 10px;
  width: 340px; max-width: calc(100vw - 36px); max-height: calc(100vh - 36px);
  overflow-y: auto; overscroll-behavior: contain;
  scrollbar-width: thin; scrollbar-color: #48484a transparent;
  /* The column is transparent to clicks so it never swallows one meant for the page.
     Each card opts back in. */
  pointer-events: none;
}
.buki-tray, .buki-tray * { box-sizing: border-box; }
/* MANROPE SHIPS NO ITALIC, and the other three surfaces have said so since 2026-08-15.
   This one had not, so a future <em> in a book title would have been sheared into the
   counterfeit docs/brand.md records reaching production once. Scoped to the tray rather
   than <html>: this stylesheet is injected into somebody else's page and must never
   change how THEIR type renders. */
.buki-tray, .buki-tray * { font-synthesis: none; }
/* Bottom-aligned by margin, not justify-content: a flex-end column clips its own
   overflow at the TOP, which hides the oldest card instead of letting you scroll to it. */
/* THE TWO MOODS, added 2026-08-24 on Maximo's call.
   The tray used to have one, and theme.ts said in as many words that it must never follow
   the extension's choice, because it owns its ground in every mood. What that argument
   actually requires is that the card stay OPAQUE and carry its own ring and shadow, and
   that is still true - it is now true twice, once per mood.
   MEASURED, because the trade is real and symmetric. A dark card on a black essay is
   1.10 to 1 against the page; a light card on a white docs site is 1.00 to 1, the
   identical colour. Each mood vanishes into exactly one ground and the ring is what
   carries it there, which is why the light ring is heavier than a hairline would be.
   Dark is also the default: an unthemed tray is the one that already shipped, never an
   unstyled flash. */
.buki-tray,
.buki-tray[data-theme="dark"] {
  /* Darker than the #1c1c1e it replaced. Still not #000: this is a CARD on somebody
     else's page, and true black has nothing left to separate it from a black one. */
  --bg: #0f0f11; --lift: #1c1c1e; --ring: rgba(255,255,255,.16);
  /* NO GREYS. --ink-2 was #b5b5bd and read as faded beside white; at #e6e6ea it is
     15.38 to 1 on this card and still ranks below the title by size and weight, which is
     how brand.md says hierarchy is carried. */
  --ink: #ffffff; --ink-2: #e6e6ea;
  --accent: #8fb0ff; --accent-hi: #a8c2ff; --on-accent: #000000;
  /* A control DARKER than the card it sits on, which is the iOS grouped-list move and the
     opposite of the translucent systemFill this used to take. Composited it is #0a0a0b,
     with a white label at 19.79 to 1. */
  --fill: rgba(0,0,0,.34); --fill-hi: rgba(0,0,0,.52);
  --fill-ring: rgba(255,255,255,.13);
  --jade: #6fe0b6; --jade-bg: #10352a;
  --shade: 0 1px 2px rgba(0,0,0,.30), 0 8px 20px -6px rgba(0,0,0,.55),
           0 28px 60px -22px rgba(0,0,0,.85);
}
.buki-tray[data-theme="light"] {
  --bg: #ffffff; --lift: #f2f2f7;
  /* Heavier than the dark ring on purpose: on a white page this hairline is the ONLY
     thing separating the card from the document, since the two are the same colour. */
  --ring: rgba(0,0,0,.18);
  --ink: #000000; --ink-2: #1c1c1e;
  --accent: #2f5fd8; --accent-hi: #244cb4; --on-accent: #ffffff;
  --fill: rgba(0,0,0,.075); --fill-hi: rgba(0,0,0,.13);
  --fill-ring: rgba(0,0,0,.10);
  /* Jade darkened from the dark mood's #6fe0b6, which is 1.55 to 1 on white and would
     have been a label nobody could read. This one is 5.33 to 1. */
  --jade: #0f7a56; --jade-bg: #d8f3e7;
  --shade: 0 1px 2px rgba(0,0,0,.07), 0 8px 20px -6px rgba(0,0,0,.13),
           0 28px 60px -22px rgba(0,0,0,.22);
}

.buki-slot:first-child { margin-top: auto; }
.buki-slot { width: 100%; pointer-events: auto; }

.buki-card {
  position: relative; width: 100%;
  /* SYMMETRIC SINCE 2026-08-24. It was 13px 32px 14px 21px: 21 on the left to clear the
     spine, 32 on the right to clear the dismiss. So a head that set text-align center was
     centred on a box whose own centre sat 5.5px right of the card's. The spine is gone and
     the dismiss is already out of flow, so neither reserve is owed. */
  padding: 16px 18px 16px;
  background: var(--bg); color: var(--ink);
  border-radius: var(--r-lg);
  /* A ring rather than a border, so the card's height never shifts by a pixel.
     THE DROP IS THREE LAYERS AND LIVES IN THE MOOD BLOCKS. One deep shadow tuned for a
     dark card smears a light one into a grey cloud: contact, lift and ambient each need
     their own falloff, and both moods need their own alphas. */
  box-shadow: inset 0 0 0 1px var(--ring), var(--shade);
  font: 14px/1.45 var(--ui);
  opacity: 0; transform: translateY(10px) scale(.985);
  /* Transitions, not keyframes: catches arrive in bursts, and a keyframe restarts from
     zero when interrupted where a transition retargets from wherever it got to. */
  transition: opacity 180ms var(--ease), transform 180ms var(--drawer), filter 120ms ease;
}
.buki-card.buki-in { opacity: 1; transform: none; }
/* Exit is faster than entrance: the system responding should never be slower than the
   system arriving. */
.buki-card.buki-out { opacity: 0; transform: translateY(4px) scale(.99);
  transition-duration: 190ms; }
/* Blur bridges the two states so "reading" BECOMING "a book" reads as one object
   changing rather than two cards crossfading through each other. */
.buki-card.buki-swap { filter: blur(3px); opacity: .45; }

/* THE SPINE IS GONE, 2026-08-24. It drew a 5px bar down the left edge with two white
   cords stamped across it at 0.646 and 0.729 of the height, and its own comment said "the
   card and the logo are the same object at two sizes".
   THAT STOPPED BEING TRUE ON 2026-08-17, when the mark became the catcher: a blue ball
   with two eyes. It replaced three spines and two stamped cords, and this rule went on
   drawing the retired drawing's signature for a week. Removing it is a correction and not
   only a preference, and the card carries the REAL mark now instead. See .buki-mk. */

/* THE MARK, ON THE CARD. Maximo asked for the logo on the toast, and the spine this
   replaces was already claiming to BE the logo, seven days after the logo changed.
   It is drawn by markNode(), the same builder the X action-bar button uses, so there is
   exactly one catcher in this file and it cannot drift from tools/mark.mjs.
   22px and on the axis, above the eyebrow: a found card's head is already centred, and
   this is that head's masthead. It carries its own colour in both moods, which is the
   whole reason the drawing survives a card that flips from near-black to white. */
.buki-mk { width: 26px; height: 26px; display: block; margin: 0 auto 9px; flex: none;
  border-radius: 50%; }
/* A HAIRLINE ON THE WHITE CARD ONLY. The ramp runs #7bcdfc to #013ebf: the deep end is
   8.03 to 1 on white, but the LIGHT end is 1.64 to 1, so the ball's top-left softens into
   the card. The hairline gives it a clean edge without retinting a drawing that is defined
   once in tools/mark.mjs and is not ours to change per surface. The dark card needs none:
   the light end is 19 to 1 there.
   THE FIRST VERSION OF THIS COMMENT WAS WRONG and is corrected rather than deleted. It
   claimed the mark "read as two dots" and blamed that contrast. It did read as two dots,
   and the cause was a broken gradient reference in tools/tray-harness.mjs, not this ramp.
   The measurement was real and pointed at the wrong culprit, which is the more dangerous
   kind of evidence: it made a plausible story out of a genuine number. */
.buki-tray[data-theme="light"] .buki-mk { box-shadow: 0 0 0 1px rgba(0,0,0,.13); }

.buki-head { display: flex; gap: 12px; align-items: flex-start; }
/* A found card's head is the card's own masthead: where the answer came from, and how
   many books are in it. Both sit on the axis. The rows below stay left-aligned, because
   a title is read from its first letter. */
.buki-card[data-book] .buki-head { display: block; text-align: center; }
/* THE HEAD'S FIRST LINE since 2026-08-27, where it used to be the second and only when a
   card held more than one book. Hierarchy by SIZE AND WEIGHT, never by fading the line
   beneath it: docs/brand.md, "Full contrast on every caption." So this gains weight and
   the provenance keeps its contrast. */
.buki-count { font: 600 13.5px/1.35 var(--ui); color: var(--ink); }
/* Only when it follows the heading. The eyebrow serves three other cards where it is
   still the first line and must not gain a gap above it. */
.buki-count + .buki-eyebrow { margin-top: 2px; }
.buki-thumb {
  position: relative; width: 32px; height: 47px; flex: none; border-radius: 2px 3px 3px 2px;
  overflow: hidden; box-shadow: 0 1px 6px -1px #000;
  /* Flat cloth, not a gradient. It is also the floor rather than a placeholder: a page's
     own CSP can refuse an OpenLibrary cover, and a broken-image glyph would read as the
     extension being broken rather than as a picture that did not load. */
  background: var(--cloth, #3a3a3c);
}
.buki-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.buki-who { flex: 1; min-width: 0; }

/* The eyebrow carries WHERE the answer came from. It is the audit trail: a shelf you
   cannot question is a shelf you stop trusting. It was tracked uppercase mono, which
   renders a sentence as if it were a machine value; mono is for data that lines up. */
.buki-eyebrow { font: 600 11.5px/1.5 var(--ui); color: var(--ink-2); }
.buki-eyebrow[data-shelf] { color: var(--jade); }
.buki-t {
  margin-top: 2px; font: 16px/1.25 var(--book); overflow-wrap: anywhere;
  color: var(--ink);
}
/* A message is the interface talking, not a book title — so it stays in the UI face. */
.buki-t.buki-plain { font: 14px/1.45 var(--ui); margin-top: 0; color: var(--ink); }
.buki-a { margin-top: 3px; font-size: 13px; color: var(--ink-2); }

.buki-x {
  /* Out of the flow, so a centred head is actually centred on the card rather than on
     whatever space is left over beside a button. */
  position: absolute; top: 9px; right: 9px; z-index: 1;
  cursor: pointer; border: 0; border-radius: 999px;
  width: 24px; height: 24px; display: grid; place-items: center;
  background: transparent; color: var(--ink-2); font: 16px/1 var(--ui);
  transition: color 140ms ease, background-color 140ms ease,
    transform 140ms var(--ease);
}
.buki-x:active { transform: scale(.9); }
.buki-x:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
@media (hover: hover) and (pointer: fine) {
  .buki-x:hover { color: var(--ink); background: var(--fill); }
}

/* Still working. Constant motion, so linear — an eased sweep looks like it is being
   pushed rather than running. */
.buki-wait {
  margin: 10px 0 1px; height: 3px; border-radius: 999px; overflow: hidden;
  background: var(--lift);
}
.buki-wait::after {
  content: ''; display: block; height: 100%; width: 38%; border-radius: 999px;
  background: var(--accent);
  animation: buki-sweep 1.15s linear infinite;
}
@keyframes buki-sweep { from { transform: translateX(-105%); } to { transform: translateX(370%); } }

/* The piles. Capsules in sentence case, the same control the popup's segmented row is
   built from. They were tracked uppercase mono at 10.5px, which is a label treatment on
   three things that are actually the card's whole purpose. */
/* FULL WIDTH, on its own line under the book. Three labels reading "Read now",
   "Read next" and "Read someday" do not fit across the 250px left beside a 32px cover:
   they wrapped to two lines and the third clipped its own last letter. The row wraps to
   the card's whole width instead, which is 287px for three, and each label sits on one
   line. flex-basis, NOT width: width: 100% on a flex item is clamped by what is left on
   the line, so the row stayed beside the cover at 223px of the 267 available and the third
   label still clipped. A basis of 100% is what actually forces the line break. Measured,
   because the arithmetic said it should have fitted. */
.buki-row { display: flex; gap: 6px; margin: 11px 0 0; flex-basis: 100%; }
.buki-intent {
  /* CENTRED ON THE BOX, both ways. It was padding: 9px 0 10px, a pixel more underneath
     the label than above it, which put every label a measured 1.00px high - horizontally
     they were already exact. Flex centring with symmetric padding means the box centres
     the label instead of the padding arithmetic having to. min-height rather than
     vertical padding so the pill keeps its height whatever the label's line-height. */
  /* flex: 1 1 auto, NOT flex: 1. flex: 1 sets a zero basis, so all three pills are
     forced to the SAME width and the longest label - "Read someday" - is handed less room
     than its own text and clips. Growing from the content basis lets them share the spare
     space without any of them ending up narrower than what is written on it. */
  /* Corners, not pills, so the three intents and the stacked actions read as one family
     of controls. 10px against the action's 12px: a smaller control takes a smaller radius
     or it starts to look like a lozenge. */
  flex: 1 1 auto; cursor: pointer; border: 0; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  min-height: 36px; padding: 0 8px; white-space: nowrap; background: var(--fill); color: var(--ink);
  font: 600 13px/1 var(--ui); letter-spacing: -.006em;
  box-shadow: inset 0 0 0 1px var(--fill-ring);
  transition: background-color 140ms ease, color 140ms ease,
    box-shadow 140ms ease, transform 140ms var(--ease);
}
.buki-intent:active { transform: scale(.96); }
.buki-intent:disabled { cursor: default; opacity: .5; }
.buki-intent:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) {
  .buki-intent:not(:disabled):hover { background: var(--accent); color: var(--on-accent); }
}
/* The pile it is already in. Stated rather than greyed out: the point is that clicking
   it would change nothing, which is information, not a disabled control. */
.buki-intent[data-here] {
  background: transparent; color: var(--ink-2);
  box-shadow: inset 0 0 0 1px var(--ring);
}

/* FULL WIDTH, so its label sits on the card's own axis.
   It was an inline-block button, which left "Try the post's words" hard against the left
   edge underneath a centred head - two axes on a 340px card, the same defect the popup's
   detail sheet had. A card's action is the width of the card. */
.buki-act {
  /* Full width so its label sits on the card's own axis, and centred on its own box for
     the same reason .buki-intent is: it carried 11px above and 12px below. */
  /* FILLED, NOT OUTLINED, and cornered rather than pilled. An outline on a transparent
     ground is a web button; iOS gives a stacked action a filled surface and a 12px corner,
     and reserves the full pill for a single inline chip. 42px clears the 44px touch target
     once the 2px focus ring is counted. */
  width: 100%; margin: 10px 0 0; cursor: pointer; border: 0; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  min-height: 42px; padding: 0 16px; background: var(--fill); color: var(--ink);
  font: 600 14px/1 var(--ui); letter-spacing: -.01em;
  box-shadow: inset 0 0 0 1px var(--fill-ring);
  transition: background-color 140ms ease, box-shadow 140ms ease,
    transform 140ms var(--ease);
}
.buki-act:active { transform: scale(.97); }
.buki-act:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) {
  .buki-act:hover { background: var(--fill-hi); box-shadow: inset 0 0 0 1px var(--accent); }
}


/* One book among several.

   The hairline between rows is what makes four decisions read as four rather than as one
   long form: the card is a short list, and a list needs its items separated or it is a
   paragraph. */
/* THE LIST IS BOUNDED AND THE CARD IS NOT.

   A card's height is a function of how many books came back, and that cap went 8 -> 20 on
   2026-08-16 so a post listing twenty books stops becoming seven. Nothing in that change
   is wrong; its consequence lands here, on the one surface with no bound of its own.
   Measured the same day: a FIVE-book card is 680px, in a tray that is 732px on a laptop.

   Two things follow, and the second is what got reported as toasts overlapping. A card
   taller than the tray cannot be read without scrolling past its own action. And every
   neighbour a card displaces travels its FULL height - a new card is laid out at its final
   position at once while the stack is held back by the FLIP transform, so the front of
   that travel draws the stack across the newcomer. 436px of overlap for a five-book card,
   gone by 25% of the 280ms travel. At three books that was a couple of hundred pixels and
   a few frames, which is why it was invisible until this week.

   The ceiling is on the LIST rather than the card, so the head and "Save all" stay put:
   a batch card whose batch button scrolls away has lost the reason it exists.

   420px is where three books stop scrolling, which is what a photographed stack usually
   is; 54vh is what keeps the card from filling a short window. It was 380/50 until the
   intent row moved onto its own line on 2026-08-17 and a row grew from 113px to 131px -
   the bound is a function of the row, so it moved with it. There is NO fade at the
   scroll edge, and that is deliberate - a mask over the last 18px of this list sits on
   top of that row's own now/next/someday buttons, and decoration that dims a control is
   not decoration. A part-visible row is its own affordance, and the scrollbar is thin
   rather than hidden for the same reason. */
.buki-books {
  max-height: min(54vh, 420px);
  overflow-y: auto;
  /* NO overscroll-behavior: contain HERE, and its absence is the fix. Containing the
     scroll on the INNER list stopped the wheel chaining outward, so running out of one
     card's books left it dead instead of moving to the next card - "easy to scroll through
     each toast, hard to scroll between toasts". Containment belongs on .buki-tray, which
     is the edge of Buki: chaining past THAT would scroll somebody else's page. */
  scrollbar-width: thin;
  scrollbar-color: var(--ink-2) transparent;
}
.buki-find { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; margin-top: 13px; }
.buki-find + .buki-find { padding-top: 13px; border-top: 1px solid var(--ring); }
/* Per book, not per card: a photographed stack can be half yours already. */
/* The wall's sentence under its headline. It is the only prose on any card, so it gets
   the reading measure the rest of the tray does not need. */
.buki-note {
  margin-top: 6px; font: 13px/1.45 var(--ui); color: var(--ink-2);
}
/* The paid action leads, so it is the only FILLED button in the tray. Everything else is
   a ring on the card's own ground; this one is the accent, which appears nowhere else in
   this stylesheet as a fill. Black on it measures 7.78:1. */
.buki-act.buki-buy {
  background: var(--accent); color: var(--on-accent);
  box-shadow: none; font-weight: 700;
}
@media (hover: hover) and (pointer: fine) {
  /* A TOKEN, not color-mix. contentChrome.test.ts forbids color-mix on this surface
     outright, beside backdrop-filter, and the reason is the same for both: neither
     resolves to a value the guard can compute, so a see-through result could hide inside
     one. The tray is the one surface where "I cannot check this" is disqualifying. */
  .buki-act.buki-buy:hover { background: var(--accent-hi); box-shadow: none; }
}
/* The free way out sits directly under it, same size, no apology. */
.buki-act + .buki-act { margin-top: 8px; }

.buki-shelf {
  display: inline-block; margin-left: 4px; padding: 2px 8px 3px; border-radius: 999px;
  vertical-align: 1px; background: var(--jade-bg); color: var(--jade);
  font: 600 11px/1.5 var(--ui); letter-spacing: -.002em;
}

/* Pressing a post that is already on screen. Nothing new happens by design, so the card
   that already exists has to be the thing that answers. */
@keyframes buki-nudge {
  35% { box-shadow: inset 0 0 0 1px var(--accent),
    0 0 0 3px rgba(127,155,234,.28), 0 2px 6px rgba(0,0,0,.28),
    0 18px 44px -16px rgba(0,0,0,.85); }
}
.buki-card.buki-nudge { animation: buki-nudge 620ms var(--ease); }

@media (prefers-reduced-motion: reduce) {
  .buki-card, .buki-slot, .buki-intent, .buki-act, .buki-x, .buki-btn {
    transition-duration: 1ms !important; animation: none !important;
  }
  .buki-card { transform: none !important; }
  .buki-wait::after { animation: none; width: 100%; opacity: .45; }
}
`;

const styleEl = document.createElement('style');
styleEl.textContent = STYLE;
document.head.appendChild(styleEl);

// ---------------------------------------------------------------- scraping

function tweetPermalink(article: HTMLElement): string | null {
  const link = article.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
  return link?.href ?? null;
}

/**
 * Twitter renders the expanded destination as an anchor's TEXT while the href stays a
 * t.co redirect, so the retailer URL is only visible in the text. That text is
 * attacker-shapeable, so it is only ever a *candidate*: isbn.ts requires a retailer
 * host before trusting one, and a truncated one is dropped here (a clipped ISBN would
 * silently fail the high-confidence path anyway).
 */
function candidateLinks(article: HTMLElement): string[] {
  return Array.from(article.querySelectorAll('a[href]')).flatMap((a) => {
    const el = a as HTMLAnchorElement;
    const shown = (el.textContent ?? '').trim();
    const looksLikeUrl = shown.includes('.') && !shown.includes(' ');
    const truncated = shown.includes('…') || shown.endsWith('...');
    return looksLikeUrl && !truncated
      ? [`https://${shown.replace(/^https?:\/\//, '')}`, el.href]
      : [el.href];
  });
}

function scrapeTweet(article: HTMLElement): Tweet {
  return {
    text: article.querySelector('[data-testid="tweetText"]')?.textContent ?? '',
    // HOST, not substring. `https://attacker.example/twimg.com/media/x.png` passed the
    // old `.includes('twimg.com/media')` and was then saved as a book's cover, which the
    // popup re-fetches on every open. The worker asks the same question again on receipt.
    imageUrls: keepTweetMedia(
      Array.from(article.querySelectorAll('img')).map((img) => img.src),
    ),
    links: candidateLinks(article),
  };
}

// ---------------------------------------------------------------- the worker

/**
 * Was this content script left behind by an extension reload or update?
 *
 * Chrome does not re-inject content scripts into pages that are already open, so after
 * every update the old script keeps running against a background worker that no longer
 * exists, and every message throws "Extension context invalidated". Refreshing the tab is
 * the only fix, so say that rather than "try again in a moment" - which never works.
 */
const orphaned = (err?: unknown): boolean =>
  !chrome.runtime?.id ||
  (err instanceof Error && /context invalidated|receiving end does not exist/i.test(err.message));

const REFRESH = 'Buki just updated. Refresh this page to keep catching books.';

interface Recognized {
  candidates: Book[];
  source: RecognitionSource;
  draft: AttemptDraft;
  alreadySaved: Shelved[];
}

/**
 * Recognition happens in the background worker, not here: it owns the vision key, and
 * cross-origin calls belong where host_permissions apply. It also means this button and
 * the right-click menu resolve books through exactly the same pipeline - including
 * reading the cover image, which this flow previously ignored.
 */
async function recognize(tweet: Tweet, job: string, fromText = false): Promise<Recognized | null> {
  if (orphaned()) {
    tray.fail(job, REFRESH);
    paintTray();
    return null;
  }

  const resp = (await chrome.runtime.sendMessage({
    type: 'recognize',
    tweet,
    job,
    ...(fromText ? { fromText: true } : {}),
  } satisfies BackgroundRequest)) as BackgroundResponse | undefined;

  if (!resp) throw new Error('No response from the recognizer');
  if (!resp.ok) {
    // The wall first: nothing went wrong, so this must not take the failure path.
    if (resp.wall) {
      tray.wall(job);
      paintTray();
      return null;
    }
    // Already phrased for the user, and retrying cannot help - say what is wrong rather
    // than throwing it onto the generic "try again in a moment" path.
    if (resp.needsSetup) {
      tray.fail(job, resp.error);
      paintTray();
      return null;
    }
    throw new Error(resp.error);
  }
  return {
    candidates: resp.result.candidates,
    source: resp.result.source,
    draft: resp.draft,
    alreadySaved: resp.alreadySaved,
  };
}

/**
 * Ask the worker to write to the shelf. It owns `savedBooks` outright: a per-context
 * write queue cannot see a sibling context's write, and two of them interleaving is how
 * a book gets silently dropped.
 */
async function saveBook(book: Book, intent: Intent, source?: SavedSource, shot?: string) {
  const resp = (await chrome.runtime.sendMessage({
    type: 'saveBook',
    book,
    intent,
    ...(source ? { source } : {}),
    // The picture this catch was read from. It becomes the cover on the shelf, because
    // it is the book that was actually seen rather than whatever edition a relevance
    // index put first.
    ...(shot ? { shot } : {}),
  } satisfies BackgroundRequest)) as ShelfResponse | undefined;

  if (!resp) throw new Error('No response from the shelf');
  if (!resp.ok) throw new Error(resp.error);
  if (!resp.saved) throw new Error('Shelf did not return the saved book');
  return resp.saved;
}

/**
 * Hand a finished event to the background, which is the log's only writer. Diagnostics:
 * a failure here must never surface as a failed save.
 */
function report(event: PendingEvent): void {
  void chrome.runtime
    .sendMessage({ type: 'logEvent', event } satisfies BackgroundRequest)
    .catch((err: unknown) => console.error('[Buki] log write failed', err));
}

// ---------------------------------------------------------------- what a catch knows

const tray = createCatchTray();

/** What the user did with a catch. Exactly one of these is ever recorded per attempt. */
type Outcome =
  | { outcome: 'confirmed'; savedId: string }
  | { outcome: 'dismissed' }
  | { outcome: 'no-match' };

interface CatchContext {
  /** Kept so "try the post's words" can re-ask without the worker remembering anything. */
  tweet: Tweet;
  source: SavedSource;
  draft: AttemptDraft;
  settled: boolean;
}

const contexts = new Map<string, CatchContext>();

/**
 * Only a permalink is "the tweet that sold you". Falling back to the feed URL but still
 * labelling it a tweet would put `x.com/home` behind that link, which is the failure the
 * whole source field exists to prevent.
 */
const sourceFor = (permalink: string | null): SavedSource =>
  permalink ? { url: permalink, kind: 'tweet' } : { url: location.href, kind: 'page' };

function remember(job: string, tweet: Tweet, permalink: string | null, draft: AttemptDraft): void {
  contexts.set(job, { tweet, source: sourceFor(permalink), draft, settled: false });
}

/**
 * Record what became of an attempt, once.
 *
 * Every close path used to report a dismissal, so a successful save could be logged twice
 * - once as confirmed and once as not - quietly corrupting the one number the log exists
 * to produce.
 */
function settle(job: string, result: Outcome): void {
  const ctx = contexts.get(job);
  if (!ctx || ctx.settled) return;
  ctx.settled = true;
  report({ ...ctx.draft, ...result });
}

/**
 * Turn the worker's answer into the card's candidates, marking what the shelf already
 * has and where. Both sides key on `identityOf`, so a book the shelf holds under a
 * different edition still matches - that was complaint #4's real cause.
 */
function candidatesOf(books: Book[], shelved: Shelved[]): Candidate[] {
  const where = new Map(shelved.map((s) => [s.identity, s.intent]));
  return books.map((book) => {
    const intent = where.get(identityOf(book));
    return intent ? { book, shelvedIn: intent } : { book };
  });
}

// ---------------------------------------------------------------- rendering the tray

/** How long a message with nothing to decide sits before it leaves. */
const DONE_MS = 2600;
const ERROR_MS = 6000;
/** Leaving, swapping one state for another, and travelling to a new position. */
const LEAVE_MS = 200;
const SWAP_MS = 115;
const TRAVEL_MS = 280;

let trayEl: HTMLElement | null = null;
/** Card id -> the nodes drawing it. The slot travels; the card fades, blurs and holds. */
const drawn = new Map<number, { slot: HTMLElement; card: HTMLElement }>();
/** Per card, not per page: one shared timer let a second swap cancel the first's text. */
const swaps = new Map<number, number>();
/** Transient cards that are already on their way out. */
const leaving = new Map<number, number>();

const motion = (): boolean => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * THE TRAY'S MOOD, and why it takes two reads to settle.
 *
 * The choice lives in `localStorage` on the EXTENSION's origin, which a content script
 * cannot see: our `localStorage` here belongs to x.com. `theme.ts` mirrors every choice
 * into `chrome.storage.local`, which every extension context shares, and this reads that.
 *
 * Synchronously first, from the operating system, so the card never paints in the wrong
 * mood and then flips - the same flash `theme.ts` exists to prevent on the pages. Then
 * asynchronously from the mirror, which outranks the OS whenever a choice was actually
 * made. `resolveTheme` is the same pure function the pages use, so the two surfaces cannot
 * disagree about what a stored value means.
 */
function applyTrayTheme(el: HTMLElement): void {
  const dark = (): boolean =>
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

  el.dataset.theme = resolveTheme(null, dark());

  void chrome.storage?.local
    ?.get(THEME_KEY)
    .then((got: Record<string, unknown>) => {
      const stored = got?.[THEME_KEY];
      el.dataset.theme = resolveTheme(typeof stored === 'string' ? stored : null, dark());
    })
    .catch(() => {
      // No mirror yet, or the API went away mid-navigation. The OS answer already applied.
    });
}

function trayHost(): HTMLElement {
  if (!trayEl) {
    ensureFont();
    trayEl = document.createElement('div');
    trayEl.className = 'buki-tray';
    trayEl.setAttribute('aria-live', 'polite');
    applyTrayTheme(trayEl);
    // A toggle in the popup repaints trays that are already on screen. Registered with
    // the element rather than at module scope, so a page that never catches anything
    // never subscribes to anything.
    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area === 'local' && changes[THEME_KEY] && trayEl) applyTrayTheme(trayEl);
    });
    document.body.appendChild(trayEl);
  }
  return trayEl;
}

/**
 * Move things without teleporting them.
 *
 * A card that becomes a book is twice the height it was, and its neighbours have to go
 * somewhere. Flex reflow is not transitionable, so: measure, mutate, put everything back
 * where it was, and let it travel from there. This is the whole fix for a found card
 * appearing to shove the column rather than push it.
 */
function reflow(mutate: () => void): void {
  if (!motion()) {
    mutate();
    return;
  }
  /**
   * The transform each slot is carrying RIGHT NOW, captured before anything is measured.
   *
   * This is what the old version was missing and it is why one card could land on
   * another. `getBoundingClientRect()` includes the transform, including one still
   * animating, so a slot interrupted mid-travel measures somewhere it is not laid out.
   * Writing a fresh `translateY` then discarded the remaining travel and snapped the slot
   * by that much - over a hundred pixels for a card that had just become a book.
   *
   * Re-entry is the normal path, not a rare race: `swapCard` schedules a reflow at 115ms
   * and a leaving card schedules one at 200ms, both inside the 280ms travel.
   */
  const shift = new Map<HTMLElement, number>();
  const before = new Map<HTMLElement, number>();
  for (const { slot } of drawn.values()) {
    shift.set(slot, shiftOf(getComputedStyle(slot).transform));
    before.set(slot, slot.getBoundingClientRect().top);
  }

  mutate();

  const moved: HTMLElement[] = [];
  for (const { slot } of drawn.values()) {
    const was = before.get(slot);
    if (was === undefined) continue; // brand new: it fades in, it does not travel
    const travel = travelFrom(was, slot.getBoundingClientRect().top, shift.get(slot) ?? 0);
    // Sub-pixel travel is not worth a transition, and rounding to zero also stops a slot
    // that is already home from being re-armed on every repaint.
    if (Math.abs(travel) < 0.5) continue;
    slot.style.transition = 'none';
    slot.style.transform = `translateY(${travel}px)`;
    moved.push(slot);
  }
  if (!moved.length) return;

  requestAnimationFrame(() => {
    for (const slot of moved) {
      slot.style.transition = `transform ${TRAVEL_MS}ms var(--drawer)`;
      slot.style.transform = '';
    }
  });
}

/** Everything the DOM depends on, so a repaint only rebuilds what actually changed. */
const signature = (c: Card): string =>
  [
    c.state,
    c.text,
    c.source ?? '',
    c.image ?? '',
    c.candidates
      .map((x) => `${x.book.title}/${x.book.coverUrl ?? ''}/${x.shelvedIn ?? ''}/${x.savedTo ?? ''}`)
      .join(),
  ].join('|');

/** Reconcile the corner to whatever the tray now says, keyed by card id. */
function paintTray(): void {
  const host = trayHost();
  const cards = tray.list();
  const live = new Set(cards.map((c) => c.id));

  for (const [id, held] of drawn) {
    if (live.has(id)) continue;
    drawn.delete(id);
    window.clearTimeout(swaps.get(id));
    swaps.delete(id);
    held.card.classList.remove('buki-in');
    held.card.classList.add('buki-out');
    // Fade first, then close the gap - so the neighbours travel instead of jumping when
    // the node finally leaves the flow.
    window.setTimeout(() => reflow(() => held.slot.remove()), LEAVE_MS);
  }

  const fresh: HTMLElement[] = [];
  reflow(() => {
    for (const card of cards) {
      if (drawn.has(card.id)) continue;
      const slot = document.createElement('div');
      slot.className = 'buki-slot';
      const el = document.createElement('div');
      el.className = 'buki-card';
      paintCard(el, card);
      slot.appendChild(el);
      host.appendChild(slot);
      drawn.set(card.id, { slot, card: el });
      fresh.push(el);
    }
  });
  // Next frame, so the transition has a starting value to animate from.
  for (const el of fresh) requestAnimationFrame(() => el.classList.add('buki-in'));

  for (const card of cards) {
    const held = drawn.get(card.id);
    if (held && held.card.dataset['sig'] !== signature(card)) swapCard(card);
  }

  tick(cards);
  host.scrollTop = host.scrollHeight;
}

/** Blur out, change what the card is, blur back. One object changing its mind. */
function swapCard(card: Card): void {
  const held = drawn.get(card.id);
  if (!held) return;
  window.clearTimeout(swaps.get(card.id));
  held.card.classList.add('buki-swap');
  swaps.set(
    card.id,
    window.setTimeout(
      () => {
        swaps.delete(card.id);
        reflow(() => paintCard(held.card, card));
        held.card.classList.remove('buki-swap');
      },
      motion() ? SWAP_MS : 0,
    ),
  );
}

/** Only a message with nothing left to decide is allowed to leave on its own. */
function tick(cards: Card[]): void {
  for (const card of cards) {
    if (!card.transient || leaving.has(card.id)) continue;
    leaving.set(
      card.id,
      window.setTimeout(
        () => {
          leaving.delete(card.id);
          contexts.delete(card.job);
          tray.dismiss(card.id);
          paintTray();
        },
        card.state === 'error' ? ERROR_MS : DONE_MS,
      ),
    );
  }
  for (const [id, timer] of leaving) {
    if (cards.some((c) => c.id === id)) continue;
    window.clearTimeout(timer);
    leaving.delete(id);
  }
}

// ---------------------------------------------------------------- what a card looks like

/** Where the answer came from, in the card's own words. */

function paintCard(el: HTMLElement, card: Card): void {
  // The best-read book lends the card its cloth. On a card with no book the cords made
  // the edge look like a dashed line somebody forgot to finish, so they come off too.
  const book = card.candidates[0]?.book;
  el.style.setProperty('--cloth', book ? clothFor(book) : '#3a2e4d');
  if (book) el.dataset['book'] = '';
  else delete el.dataset['book'];
  el.replaceChildren(
    ...(card.state === 'found'
      ? foundBody(card)
      : card.state === 'wall'
        ? wallBody(card)
        : messageBody(card)),
  );
  el.dataset['sig'] = signature(card);
}

/**
 * A picture can hold more than one book, so the card is a short list rather than a single
 * answer. Each book carries its own buttons, because a stack of four is four decisions
 * and they are rarely the same decision.
 */
function foundBody(card: Card): Node[] {
  const head = document.createElement('div');
  head.className = 'buki-head';

  const who = document.createElement('div');
  who.className = 'buki-who';
  // The mark leads the head, then WHAT this is, then how it was found.
  //
  // REORDERED 2026-08-27 on Maximo's note that the head read oddly. It was mark, then the
  // provenance eyebrow, then a count only when there was more than one book - so a
  // single-book card was headed by "read from the cover", a lowercase fragment where a
  // heading belongs, and a nineteen-book card put that fragment ABOVE the sentence that
  // actually said what had happened.
  //
  // `foundHeading` already handles both counts and already names Buki, which matters more
  // than it looks: the card draws inside somebody else's page and the one thing it must
  // never be mistaken for is part of that page. It now heads every found card.
  //
  // The provenance stays, demoted rather than deleted. It is the answer to "will it get a
  // book wrong" in `.agents/product-marketing.md`, and the store description has a whole
  // section built on it. A heading that says what this is and a line beneath saying how it
  // was found are two jobs; the old order had one element doing both, badly.
  const mk = markNode();
  mk.classList.add('buki-mk');
  const count = document.createElement('div');
  count.className = 'buki-count';
  count.textContent = foundHeading(card.candidates.length);
  who.append(mk, count, provenanceOf(card));
  head.append(who, closeButton(card));

  // The rows go in a bounded scroller so the card cannot outgrow the tray it lives in.
  // The head and the batch button stay outside it: a card whose "Save all" scrolls away
  // has lost the reason a batch card exists.
  const books = document.createElement('div');
  books.className = 'buki-books';
  books.append(...card.candidates.map((c, i) => bookRow(card, c, i)));

  const body: Node[] = [head, books];
  // Only worth offering when there is a batch. On one book it would be a second button
  // saying what the three above it already say.
  if (card.candidates.length > 1) body.push(saveAllButton(card));
  return body;
}

/** Looking, empty, error, done: one line of text and whatever it can be acted on with. */
/**
 * THE WALL. The ten free cover readings are spent.
 *
 * It is a state of the card that was about to read THIS cover, so it keeps the card's
 * picture and its dismiss control: it is an answer about this book, not an advert that
 * appeared while you were busy. Every word is in `trayCopy.ts` and asserted there - what
 * it may not say matters as much as what it does.
 *
 * TWO ACTIONS, AND THE FREE ONE IS NOT A FOOTNOTE. With your own provider key, cover
 * reading is unlimited and free forever; that is genuinely true, so it gets a real button
 * rather than a link in small type. The paid one leads.
 */
function wallBody(card: Card): Node[] {
  const head = document.createElement('div');
  head.className = 'buki-head';

  const thumb = photoThumb(card);
  if (thumb) head.append(thumb);

  const who = document.createElement('div');
  who.className = 'buki-who';

  const eye = document.createElement('div');
  eye.className = 'buki-eyebrow';
  eye.textContent = WALL.eyebrow;

  const msg = document.createElement('div');
  msg.className = 'buki-t buki-plain';
  msg.textContent = WALL.head;

  const note = document.createElement('div');
  note.className = 'buki-note';
  note.textContent = WALL.body;

  who.append(eye, msg, note);
  head.append(who, closeButton(card));

  const go = document.createElement('button');
  go.className = 'buki-act buki-buy';
  go.textContent = WALL.act;
  onRealClick(go, () => void openPage('pricing'));

  const own = document.createElement('button');
  own.className = 'buki-act';
  own.textContent = WALL.free;
  onRealClick(own, () => void openPage('options'));

  return [head, go, own];
}

/** Buki's own pages. The worker owns tab creation; a content script cannot. */
async function openPage(page: 'options' | 'pricing'): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'openPage', page } satisfies BackgroundRequest);
  } catch {
    // The worker was asleep and the wake-up raced. Nothing to recover: the card stays.
  }
}

function messageBody(card: Card): Node[] {
  const head = document.createElement('div');
  head.className = 'buki-head';

  const thumb = photoThumb(card);
  if (thumb) head.append(thumb);

  const who = document.createElement('div');
  who.className = 'buki-who';
  if (card.state === 'empty') {
    const eye = document.createElement('div');
    eye.className = 'buki-eyebrow';
    eye.textContent = 'nothing on the cover';
    who.append(eye);
  }
  const msg = document.createElement('div');
  msg.className = 'buki-t buki-plain';
  msg.textContent = card.text;
  who.append(msg);

  head.append(who, closeButton(card));

  const body: Node[] = [head];
  if (card.state === 'looking') body.push(waitBar());
  if (card.state === 'empty' && contexts.has(card.job)) body.push(wordsButton(card));
  return body;
}

/** One book: its cover, its name, where the shelf already has it, and three decisions. */
function bookRow(card: Card, cand: Candidate, index: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'buki-find';
  row.append(coverThumb(cand.book));

  const who = document.createElement('div');
  who.className = 'buki-who';

  const title = document.createElement('div');
  title.className = 'buki-t';
  title.textContent = cand.book.title;

  const author = document.createElement('div');
  author.className = 'buki-a';
  author.textContent = cand.book.author;
  if (cand.shelvedIn) {
    // "IT SAVED A BOOK I ALREADY SAVED." It says so before you touch anything - and per
    // book, because a stack can be half yours already.
    const tag = document.createElement('span');
    tag.className = 'buki-shelf';
    tag.textContent = `on your shelf · ${cand.shelvedIn}`;
    author.append(' ', tag);
  }

  who.append(title, author);
  // A sibling of `who`, not a child: `.buki-find` wraps, so the row lands on its own
  // full-width line under the cover and the title rather than in the column beside them.
  row.append(who, intentRow(card, cand, index));
  return row;
}

/** The picture this catch is reading, for the states that have no book to show yet. */
function photoThumb(card: Card): HTMLElement | null {
  if (!card.image) return null;
  const thumb = document.createElement('div');
  thumb.className = 'buki-thumb';
  const img = document.createElement('img');
  img.src = card.image;
  img.alt = '';
  // The cloth gradient underneath is already the fallback, so a refused picture just
  // leaves a spine rather than a broken-image glyph.
  img.addEventListener('error', () => img.remove());
  thumb.append(img);
  return thumb;
}

/**
 * Where this card's answer came from. It heads the whole card rather than a single book,
 * because the evidence is the picture and the picture is one thing however many books it
 * turned out to hold.
 */
function provenanceOf(card: Card): HTMLElement {
  const eye = document.createElement('div');
  eye.className = 'buki-eyebrow';
  eye.textContent = PROVENANCE[card.source ?? 'none'] ?? 'found';
  return eye;
}

/** A book's own cover. No falling back to the post photo: four books would wear it. */
function coverThumb(book: Book): HTMLElement {
  const thumb = document.createElement('div');
  thumb.className = 'buki-thumb';
  thumb.style.setProperty('--cloth', clothFor(book));
  if (book.coverUrl) {
    /**
     * THE WORKER FETCHES IT, NOT US.
     *
     * This <img> lives in the HOST page's document, so the host's Content-Security-Policy
     * governs it - and a cross-origin cover is blocked on every strict site. Measured in
     * Chrome 151 under `img-src 'self' data:`: the OpenLibrary URL BLOCKED, a data: URL
     * LOADED, a blob: URL BLOCKED. The old code set the URL directly, the load failed, the
     * error handler removed the image and the reader saw the cloth colour underneath.
     *
     * So the worker reads the bytes - it has the host permission and no page CSP - and
     * hands back a data: URL. A page that also forbids `data:` still falls through to the
     * cloth, which is a real design rather than a broken state.
     */
    void chrome.runtime
      .sendMessage({ type: 'coverBytes', url: book.coverUrl } satisfies BackgroundRequest)
      .then((resp: { dataUrl?: string | null } | undefined) => {
        if (!resp?.dataUrl) return;
        const img = document.createElement('img');
        img.src = resp.dataUrl;
        img.alt = '';
        img.addEventListener('error', () => img.remove());
        thumb.append(img);
      })
      .catch(() => undefined);
  }
  return thumb;
}

/** Everything at once, at the pile you reach for least. The batch case is a batch. */
function saveAllButton(card: Card): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'buki-act';
  b.textContent = 'Save all to Someday';
  onRealClick(b, () => void saveAll(card, b));
  return b;
}

function waitBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'buki-wait';
  return bar;
}

function closeButton(card: Card): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'buki-x';
  b.textContent = '×';
  const stopping = card.state === 'looking';
  b.title = stopping ? 'Stop looking' : 'Dismiss';
  b.setAttribute('aria-label', stopping ? 'Stop looking for this book' : 'Dismiss this catch');
  onRealClick(b, () => dismiss(card));
  return b;
}

function intentRow(card: Card, cand: Candidate, index: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'buki-row';
  (['now', 'next', 'someday'] as Intent[]).forEach((intent) => {
    const b = document.createElement('button');
    b.className = 'buki-intent';
    b.textContent = INTENT_LABEL[intent as keyof typeof INTENT_LABEL];
    if (cand.savedTo) {
      b.disabled = true;
      if (cand.savedTo === intent) b.dataset['here'] = '';
    } else if (cand.shelvedIn === intent) {
      // Saving it here again would rewrite the same row with the same value.
      b.disabled = true;
      b.dataset['here'] = '';
      b.title = `Already in ${intent}`;
    }
    onRealClick(b, () => void choose(card, cand, index, intent, row));
    row.append(b);
  });
  return row;
}

/** Re-enable everything the click disabled, except the pile the book is already in. */
const releaseRow = (row: HTMLElement): void =>
  row.querySelectorAll('button').forEach((b) => (b.disabled = b.hasAttribute('data-here')));

/** The text a finished card settles on. One book earns its name; four earn a count. */
function doneText(card: Card, moved: boolean): string {
  const only = card.candidates.length === 1 ? card.candidates[0] : undefined;
  return only
    ? `${moved ? 'Moved' : 'Saved'} · ${only.book.title} → ${only.savedTo}`
    : `${card.candidates.length} books on your shelf`;
}

/** Has every book on this card been dealt with? Only then is the card a receipt. */
function allSettled(id: number): Card | null {
  const card = tray.list().find((c) => c.id === id);
  return card && card.candidates.length && card.candidates.every((c) => c.savedTo) ? card : null;
}

async function choose(
  card: Card,
  cand: Candidate,
  index: number,
  intent: Intent,
  row: HTMLElement,
): Promise<void> {
  // Disable the whole row: a second click would re-enter the save and race the write.
  row.querySelectorAll('button').forEach((b) => (b.disabled = true));
  try {
    const saved = await saveBook(
      cand.book,
      intent,
      contexts.get(card.job)?.source,
      // Only when this picture depicts only this book. See shotFor: one photograph was
      // being written to every book a stack contained, so five books arrived on the
      // shelf wearing the same photograph instead of their own covers.
      shotFor(card.image, card.candidates.length),
    );
    settle(card.job, { outcome: 'confirmed', savedId: saved.id });
    tray.savedOne(card.job, index, intent);
    // Filing one book out of four must not take the other three away with it, so the
    // card only becomes a receipt once there is nothing left on it to decide.
    const finished = allSettled(card.id);
    if (finished) tray.done(card.job, doneText(finished, Boolean(saved.moved)));
    paintTray();
  } catch (err) {
    console.error('[Buki] save failed', err);
    releaseRow(row);
    // On its own card: the decision is still pending, so the card holding it must stay.
    tray.say(orphaned(err) ? REFRESH : "Couldn't save to your shelf.");
    paintTray();
  }
}

/** Everything still undecided on this card, at the pile you commit to least. */
async function saveAll(card: Card, button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  button.textContent = 'Saving…';
  const source = contexts.get(card.job)?.source;
  let firstId = '';
  try {
    // One at a time. The worker serializes shelf writes anyway, so firing four at once
    // only queues them somewhere nobody can see.
    for (const [i, cand] of card.candidates.entries()) {
      if (cand.savedTo) continue;
      const saved = await saveBook(cand.book, 'someday', source, shotFor(card.image, card.candidates.length));
      firstId ||= saved.id;
      tray.savedOne(card.job, i, 'someday');
    }
    // One attempt, one event: the log links a recognition to a book so a later delete can
    // mark it wrong, and the first is the one the model read most clearly.
    if (firstId) settle(card.job, { outcome: 'confirmed', savedId: firstId });
    const finished = allSettled(card.id);
    if (finished) tray.done(card.job, doneText(finished, false));
    paintTray();
  } catch (err) {
    console.error('[Buki] save failed', err);
    button.disabled = false;
    button.textContent = 'Save all to Someday';
    tray.say(orphaned(err) ? REFRESH : "Couldn't save to your shelf.");
    paintTray();
  }
}

function wordsButton(card: Card): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'buki-act';
  b.textContent = "Try the post's words";
  onRealClick(b, () => void tryWords(card));
  return b;
}

/**
 * The cover held nothing, so ask the other question.
 *
 * Grounding the post's text used to happen silently whenever the image failed, which put
 * books on the shelf that were never in the picture with nothing on screen saying so. As
 * a button it is the same capability with the authorship the other way round.
 */
async function tryWords(card: Card): Promise<void> {
  const ctx = contexts.get(card.job);
  if (!ctx) return;
  tray.retry(card.job, 'Reading the post…');
  paintTray();
  try {
    const found = await recognize(ctx.tweet, card.job, true);
    if (!found) return; // recognize() already put the reason on the card
    remember(card.job, ctx.tweet, ctx.source.kind === 'tweet' ? ctx.source.url : null, found.draft);
    tray.resolve(card.job, candidatesOf(found.candidates, found.alreadySaved), found.source);
    if (!found.candidates.length) settle(card.job, { outcome: 'no-match' });
    paintTray();
  } catch (err) {
    console.error('[Buki] lookup failed', err);
    tray.fail(card.job, orphaned(err) ? REFRESH : 'Book lookup failed. Try again in a moment.');
    paintTray();
  }
}

/**
 * Take a card away. A catch still looking is a lookup still running, so dismissing it
 * calls it off - which is the same button, because "stop" and "I'm done with this" are
 * the same intention at two moments.
 */
function dismiss(card: Card): void {
  if (card.state === 'looking') {
    void chrome.runtime
      .sendMessage({ type: 'cancelRecognize', job: card.job } satisfies BackgroundRequest)
      .catch(() => undefined); // an orphaned page cannot cancel; the card still goes
  } else {
    settle(card.job, { outcome: 'dismissed' });
  }
  contexts.delete(card.job);
  window.clearTimeout(leaving.get(card.id));
  leaving.delete(card.id);
  tray.dismiss(card.id);
  paintTray();
}

/** This post is already on screen. Say so with the card that exists, not a second one. */
function nudge(job: string): void {
  const card = tray.list().find((c) => c.job === job);
  const held = card && drawn.get(card.id);
  if (!held) return;
  held.slot.scrollIntoView({ block: 'nearest', behavior: motion() ? 'smooth' : 'auto' });
  held.card.classList.remove('buki-nudge');
  void held.card.offsetWidth; // restart the animation rather than ignore a repeat press
  held.card.classList.add('buki-nudge');
}

// ---------------------------------------------------------------- injection

let injected = 0;

/**
 * THE MARK, and this is the seventh copy of one drawing.
 *
 * The button wore a 📚 emoji, which was the last surface still carrying a book glyph after
 * the catcher replaced the three spines on 2026-08-17. It was also the wrong picture for
 * what the button does: the thing Buki does is SEE a book in a photograph, and a stack of
 * books says "reading list", which is the category it is trying not to be in.
 *
 * MAXIMO'S SECOND IDEA, an open book with the face emerging from it, is deliberately not
 * built. `.agents/product-marketing.md` rules it out by name — the mark "must never become
 * a book glyph, an open book, a bookmark ribbon, or a letter B" — and at 18px in somebody
 * else's action bar, two shapes in eighteen pixels is a smudge. The eyes are tall ovals
 * precisely because that is what survives 16px.
 *
 * The coordinates are `tools/mark.mjs`'s, and `src/shared/mark.test.ts` now counts this
 * file among the surfaces it fails when a copy disagrees. It cannot IMPORT the definition:
 * this script has no `web_accessible_resources`, which is the same trade the tray already
 * makes by refusing Manrope, so the drawing has to be inline.
 *
 * BUILT THROUGH `DOMParser`, NOT `innerHTML`. This runs inside somebody else's page, and a
 * page carrying `require-trusted-types-for 'script'` turns an `innerHTML` assignment into a
 * thrown error. Parsing a string this file wrote and importing the node is not a sink, so
 * it is one fewer way for a strict site to break the button. The tray's typeface already
 * cost this repo one lesson about strict CSP.
 */
let markSeq = 0;

function markNode(): SVGElement {
  // UNIQUE PER BUTTON. X recycles feed nodes in place, and every `url(#id)` in a document
  // resolves to the FIRST match — so one shared gradient id means every other ball on the
  // page loses its fill the moment the node that happened to carry the <defs> is removed.
  const id = `buki-ball-${++markSeq}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">` +
    `<defs><linearGradient id="${id}" x1="14" y1="8" x2="82" y2="94" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#7bcdfc"/>` +
    `<stop offset="0.46" stop-color="#4aa3f9"/>` +
    `<stop offset="1" stop-color="#013ebf"/>` +
    `</linearGradient></defs>` +
    `<circle cx="50" cy="50" r="50" fill="url(#${id})"/>` +
    `<ellipse cx="31.3" cy="45.9" rx="13.7" ry="19.5" fill="#091a3b"/>` +
    `<ellipse cx="68.3" cy="45.9" rx="13.7" ry="19.5" fill="#091a3b"/>` +
    `<circle cx="35" cy="35.2" r="3.9" fill="#fdfdfd"/>` +
    `<circle cx="71.4" cy="35.2" r="3.9" fill="#fdfdfd"/>` +
    `</svg>`;
  // `importNode` rather than appending the parsed node straight in. Insertion adopts a
  // foreign node automatically, but saying so costs one call and removes the question.
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  return document.importNode(parsed, true) as unknown as SVGElement;
}

function addButton(article: HTMLElement): void {
  if (article.querySelector(`.${BTN_CLASS}`)) return;
  const actions = article.querySelector('[role="group"]');
  if (!actions) return;

  const btn = document.createElement('button');
  btn.className = `${BTN_CLASS} buki-btn`;
  // The label lives on the button, and the drawing is hidden from the accessibility tree:
  // a screen reader announcing "image" beside "Save this book to your shelf" is one thing
  // said twice.
  btn.append(markNode());
  btn.title = 'Save this book to your shelf';
  btn.setAttribute('aria-label', 'Save this book to your shelf');

  // Capture phase: X delegates clicks from high up the tree, so a bubble-phase
  // listener can be pre-empted by their handler before it ever runs.
  //
  // Through `onRealClick`, like every other click in this file: this script runs inside
  // pages Buki does not control, and `button.click()` from page script used to run the
  // whole pipeline - a free catch spent, our key used, and a page-chosen URL saved as a
  // book's cover.
  onRealClick(
    btn,
    async (e) => {
      e.stopPropagation();
      e.preventDefault();

      const tweet = scrapeTweet(article);
      // Captured now, not after the await: the feed can recycle this node in place while
      // recognition runs, and re-reading it then attributes the book to another post.
      const permalink = tweetPermalink(article);
      // The catch is named by the POST. That single choice is what makes one card, one
      // lookup and one cancel-handle the same thing however many times this is pressed -
      // it used to take three collaborating maps to approximate.
      const job = postKey(tweet);

      // Flat, not an object: a collapsed console group hides the image count, and the
      // image count is the first number worth knowing when a catch is slow - every extra
      // picture is one the provider has to download before it can start reading.
      trace(`clicked · ${tweet.imageUrls.length} image(s) · ${tweet.links.length} link(s)`, {
        text: tweet.text.slice(0, 60),
        images: tweet.imageUrls,
      });

      if (!tray.open(job, 'Reading the cover…', tweet.imageUrls[0])) {
        nudge(job);
        return;
      }
      paintTray();

      try {
        const found = await recognize(tweet, job);
        if (!found) return; // recognize() already put the reason on the card
        trace('lookup returned', found.candidates.length, 'candidate(s)', found.candidates);

        remember(job, tweet, permalink, found.draft);
        tray.resolve(job, candidatesOf(found.candidates, found.alreadySaved), found.source);
        // A card with nothing to choose has its outcome already; the button it offers
        // starts a fresh attempt with a draft of its own.
        if (!found.candidates.length) settle(job, { outcome: 'no-match' });
        paintTray();
      } catch (err) {
        console.error('[Buki] lookup failed', err);
        // A dismissed catch has no card left, so this quietly does nothing - which is
        // exactly right for a lookup the user called off.
        tray.fail(job, orphaned(err) ? REFRESH : 'Book lookup failed. Try again in a moment.');
        paintTray();
      }
    },
    true, // capture
  );

  actions.appendChild(btn);
  injected++;
}

function scan(root: ParentNode = document): void {
  root.querySelectorAll('article[data-testid="tweet"]').forEach((a) => addButton(a as HTMLElement));
}

// One coalesced pass per frame. X mutates constantly (and our own button/card writes
// re-trigger the observer), so running a full-document query per mutation put real work
// on the same thread as the page's scrolling.
let scheduled = false;
function requestScan(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scan();
  });
}

/**
 * Arm the feed scanner. ONLY WHERE THERE IS A FEED.
 *
 * This used to run at module scope, on every page `content.js` was ever injected into —
 * which is any page at all, because `ensureTray` injects it on a right-click. The observer
 * and the interval then ran for the lifetime of that tab, and there is no `clearInterval`
 * anywhere in this file. Off X that is zero-yield work for ever; on a page that wants it,
 * it is a scanner waiting for forged `article[data-testid="tweet"]` markup.
 *
 * THE TRAY DOES NOT COME THROUGH HERE. It is message-driven — the worker asks for a card —
 * so catch-anywhere is unchanged. Only the injecting of Save buttons into a feed is gated,
 * and off X there was never a feed to inject them into.
 */
function armFeedScan(): void {
  const feed = document.querySelector('main[role="main"]') ?? document.body;
  new MutationObserver(requestScan).observe(feed, { childList: true, subtree: true });
  // Safety net: catches tweets whose nodes are recycled in place (mutating attributes
  // or text only), which a childList-only observer never sees.
  setInterval(scan, 2000);
  scan();
}

const armed = isFeedHost(location.hostname);
if (armed) armFeedScan();
trace(
  `content script ready on ${location.host}; scanner ${armed ? 'armed' : 'off (not a feed)'}; ` +
    `${injected} button(s) injected so far`,
);

// ---------------------------------------------------------------- from the worker

/**
 * Twitter serves the same media under several query strings (?format=jpg&name=small),
 * so the URL the context menu reports rarely equals the `src` in the DOM byte for byte.
 * Compare just the path - that's the media id.
 */
function sameImage(a: string, b: string): boolean {
  try {
    return new URL(a).pathname === new URL(b).pathname;
  } catch {
    return a === b;
  }
}

chrome.runtime.onMessage.addListener((msg: ContentRequest, _sender, sendResponse) => {
  // Answered first and cheaply: this is how the worker decides whether it still needs to
  // inject this file. Getting a reply at all is the whole signal.
  if (msg?.type === 'ping') {
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === 'catchOpen') {
    if (tray.open(msg.job, msg.text, msg.image)) paintTray();
    else nudge(msg.job);
    sendResponse({ shown: true });
    return true;
  }

  if (msg?.type === 'catchResolve') {
    // Only if the card is still here. Dismissing a catch is "I'm done with this one", and
    // the worker needs to know nobody took the answer so it can record that.
    const shown = tray.list().some((c) => c.job === msg.job);
    if (shown) {
      remember(msg.job, msg.tweet, msg.permalink, msg.draft);
      tray.resolve(msg.job, candidatesOf(msg.candidates, msg.alreadySaved), msg.source);
      if (!msg.candidates.length) settle(msg.job, { outcome: 'no-match' });
      paintTray();
    }
    sendResponse({ shown });
    return true;
  }

  if (msg?.type === 'catchFail') {
    tray.fail(msg.job, msg.text);
    paintTray();
    sendResponse({ shown: true });
    return true;
  }

  if (msg?.type === 'catchWall') {
    tray.wall(msg.job);
    paintTray();
    sendResponse({ shown: true });
    return true;
  }

  if (msg?.type === 'tweetContextFor') {
    const img = Array.from(document.querySelectorAll('img')).find((i) =>
      sameImage(i.src, msg.srcUrl),
    );
    const article = img?.closest('article[data-testid="tweet"]') as HTMLElement | null;
    // The post's words are the strongest hint for a hard-to-read cover, so send them
    // along with the permalink rather than making the model work from pixels alone.
    const context: TweetContext = article
      ? { permalink: tweetPermalink(article), ...scrapeTweet(article) }
      : { permalink: null, text: '', links: [] };
    sendResponse({ permalink: context.permalink, text: context.text, links: context.links });
    return true;
  }
  return undefined;
});
