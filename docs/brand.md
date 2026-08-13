# Buki: the design system

One file, four surfaces. The landing page (`docs/index.html`), the in-page catch tray
(`src/extension/content.ts`), the shelf popup (`popup.html`) and the setup page
(`options.html`) each hold their own copy of these values, because a content script and an
extension page cannot share a stylesheet with a website. **That duplication is the risk
this file exists to manage.** `clothFor` was once defined in two files with two different
hashes, so one book was one colour on the shelf and another in the picker. Change a token
here first, then in every surface that uses it, in the same commit.

## Read this before changing anything

| Surface | State |
| --- | --- |
| `docs/index.html` | current: cobalt on cream, Petrona and Instrument Sans |
| `popup.html`, `options.html` | current, realigned 2026-08-12 |
| `src/extension/toolbar.ts` | current: a book board on Chrome's own toolbar. See below |
| `src/extension/content.ts` | **previous generation:** the violet-black room with one warm lamp |

### The fifth surface: Chrome's toolbar

Added 2026-08-13. When a catch cannot start at all, because the origin prompt was declined
or the page is one no extension may touch, the toolbar badge is the only channel left.
There is no tray to put a card in and no content script to ask.

**It is drawn with the binding rule, not with a new colour.** Cream `#FAF7F2` on the
coral cloth `#FF5A47` measures **3.09:1** and cannot be read, which is the exact problem
bindings exist to solve. On oxblood `#4A1414`, the binding coral pairs with, the same cream
measures **14.2:1**. So the badge is a book board at 16px with one character stamped on it.

This is the second dye allowed to carry a status, and it earns it the same way jade does:
it appears nowhere else in that role. The reason lives in the tooltip rather than the
badge, because a badge holds about four characters and Voice says errors are never vague.

The popup and the setup page were the paper-and-lamp system until 2026-08-12. The
divergence was narrower than it looked: paper was already effectively the same, and what
actually differed was the accent, gold against the landing's cobalt, plus warm neutrals
against cool. So the ink, the muted tone and the accent moved and the paper metaphor
stayed, because a list is read on paper and the landing is paper too.

**The catch tray in `content.ts` has not been touched and is the last surface still on the
old system.** It is also the only one that renders inside somebody else's page, which is a
different problem: it has to hold up against an arbitrary background rather than one we
chose. Do not retheme it by copying tokens across without solving that first.

**One trap, learned the expensive way.** A retokening that changes an accent's LIGHTNESS
invalidates every hardcoded colour sitting on it. Moving `--accent` from a light amber to
cobalt left `options.html`'s save button at `#241705` on `#1231a8`, which measures 1.69:1
and is an unlabelled button. Grep for hex literals near any token you relight.

## The idea

A library at night. One warm lamp. Most spines are lost to the dark and a few are caught
in the light. That is the product in one picture: the books you saw and lost, and the ones
you kept.

Everything below follows from it. The page is not "dark mode"; it is a room with a light
in it. Surfaces are boards and spines, not cards floating on a gradient.

---

## The mark

**Three spines. One pulled out and lit.**

Drawn by Maximo (`brand/logo-source.jpg`) and redrawn as geometry in `icons/mark.svg`:
bars measured off the 900x900 raster and divided by 9, so the proportions are his and the
edges are exact rather than resampled. The tilt is 10 degrees, which is what the original
measures. The two rules are the stamped cords every generated cover carries, so the mark
and the covers are the same object at two sizes.

| Part | Value | Why |
| --- | --- | --- |
| The two shelved spines | `#0a0f33`, the page ink | Solid, not faded. At 16px an opacity-reduced spine is a smudge |
| The caught spine | `#7cc0fd` | Light, so it separates from its neighbours |
| The cords | `#fbf7ec` | The same two rules stamped on every generated board |
| The tilt | `10°` | A shelf nobody has straightened. Upright spines read as a UI element, not as books |

### Why the caught spine is a light blue and not the cobalt accent

This looks like a palette violation and is not. The two candidates are exact mirrors:

| | against the cream page | against the ink spines |
| --- | --- | --- |
| `#7cc0fd` | 1.81 | **9.58** |
| `--blue` `#1231a8` | 9.66 | **1.80** |

**The caught spine has to separate from the other spines, not from the page.** That
separation is the entire meaning of the mark. In cobalt it would sink into its neighbours
and the mark would say nothing, while the page ground is already handled by the two ink
spines framing it.

### Two files, and using the wrong one breaks it

| File | Use |
| --- | --- |
| `icons/mark.svg` | Anywhere the page owns its background. Accepts `--mark-spine`, `--mark-caught`, `--mark-cord` |
| `icons/icon.svg` | Everywhere else: favicon, tab strip, Chrome toolbar, store tile |

`icon.svg` carries a cream plate with a 22% corner radius, and it is not decoration.
**Rendered transparent on navy the mark breaks:** both ink spines vanish into the ground
and all that survives is one pale bar with two floating cords. Chrome's toolbar and tab
strip are dark in dark mode, so a transparent icon fails for every user who runs one. The
plate makes the ground ours rather than the host's.

Inline marks at 22 to 26px omit the cords. A 0.62-unit rule at that size is well under a
pixel and renders as grey dirt rather than a cord; the icon files keep them, because at
128 they read.

**What it must never become:** a book glyph, an open book, a bookmark ribbon, a magnifying
glass over a book, or a letter B. Every one of those is the mark of a reading app in
general. This one is about *catching*, and catching is the difference between a lit spine
and a dark one.

---

## The plates (the landing, current)

Two duotone plates, both 18th-century architectural capricci, both **public domain**,
sourced from Wikimedia Commons as 4000px museum scans and duotoned by `tools/plates.sh`.

| Where | Painting | Source scan |
| --- | --- | --- |
| Hero | Michele Marieschi, *Capriccio with Ruins and an Antique Arch* | 4896x3264 |
| Band | Giovanni Paolo Panini, *An Architectural Capriccio of the Roman Forum* | 4501x3255 |

**Both are a threshold**: you stand under an arch and look through it at something you
want, which is the product's whole gesture. They are the argument, not the wallpaper.

Public domain was a requirement, not a coincidence. The previous plates came from X media
ids with unknown rights, which was an open legal risk on a commercial page for two
sessions. Anything that replaces these must clear the same bar, and the credit line in the
page footer names both paintings and both sources.

### The palette is SAMPLED, then pushed apart

| Token | Value | Sampled from |
| --- | --- | --- |
| `--paper` | `#FBF7EC` | the stock, lifted for contrast |
| `--paper-2` | `#F3ECD9` | a sunk surface |
| `--ink` | `#0A0F33` | the deepest cobalt in the arch |
| `--ink-2` | `#3D477A` | secondary text |
| `--blue` | `#1231A8` | the lit cobalt. The one accent. |
| `--rule` | `#DED4B4` | hairlines |

Using the artwork's own values is what lets a full-bleed plate meet the page **with no
seam**. The values are then pushed apart until every pair clears AAA, because sampled and
legible are two different tests and the first does not imply the second.

| Pair | Ratio |
| --- | --- |
| `--ink` on `--paper` | 17.4:1 |
| `--ink-2` on `--paper` | 8.2:1 |
| `--blue` on `--paper` | 9.7:1 |
| `--cream` on `--navy` | 16.2:1 |

The old pair `--ink-soft` on the old cream was 6.0:1, which passed AA and was the weakest
thing on the page. Secondary text is most of the words, so that was the number worth
moving.

**If the plates are ever replaced, resample and then re-run the ratios.** The palette is
downstream of the art, so new art means new hex values and a fresh contrast pass.

### The one rule that came out of getting it wrong

> **A plate carries a statement. The cream carries the reading.**

The first pass set the lede, the button and a whole answer paragraph over column detail and
statuary, where none of it could be read. The picture gets one sentence; anything you have
to read more than once goes on the page. The same rule moved the masthead off the plate,
because laid over the picture the mark sat on a column and vanished, and a logo you have to
hunt for is not a logo. It also chose which plate carries the claim: the arcade's dye is far
more saturated than the cypress's and swallowed type whole.

### Type, and the webfont ban being lifted

| Role | Face |
| --- | --- |
| Display | **Petrona** variable at 800, `docs/petrona.woff2` + `petrona-italic.woff2`, 91KB |
| Body and UI | **Instrument Sans** variable, `docs/instrument.woff2`, 30KB |
| Book titles only | `ui-serif` stack, because that is what the product stamps on a board |

**Self-hosted, 121KB, no third party.** The old ban existed because the page claimed nothing
about you was collected, and a Google Fonts request would have made that a lie above the
fold. A file served from our own domain never broke that promise, and the promise has
changed anyway now that recognition is hosted. **The ban still stands for any third-party
font host.**

### Why Petrona, after two other faces

The display face has changed twice, and each move was a correction rather than a taste
swing. **Bricolage Grotesque** was not carrying enough weight. **Bodoni Moda** was bolder
and elegant, but a didone is *sharp*, and the brief that followed was explicitly "bolder
and rounder, still classic". A didone cannot become round.

Petrona is a warm, bookish, classical text serif with generous curves. At 800 it carries
real weight without losing the period feeling that ties the page to the capricci. It is
also not in the AI-default editorial serif cluster, which matters: that cluster is
Fraunces, Instrument Serif and Playfair, and this page has spent real effort staying out
of it.

**Young Serif was the roundest candidate and was rejected on one fact: it ships no
italic.** See the rule below for why that was disqualifying rather than a minor gap.

### The italic is not optional, and this is how to check

`docs/index.html` loads the roman **and** the italic as two separate `@font-face` blocks.
With only the roman, the browser fakes the slant by shearing the upright: circular bowls
stay circular instead of becoming ovals, and the `f` never gains its descender. The one
italic word in the headline is the most looked-at glyph run on the page.

**To test any future face, set `font-synthesis: none` on a sample.** If the italic word
renders fully upright, the family has no italic face and the page has been faking it. That
is exactly how the fake was caught here, after it had already shipped.

The headline italic also needs `line-height: 1.06` plus a padding reserve, or the
descender of *forgot* clips against the 0.94 leading.

### Images, and the halftone that had to go

The first generation of plates carried a **halftone dot screen baked in at 1400px**, and
that single decision was the reason they looked soft. Three things compounded:

1. **A regular grid cannot be rescaled.** Fit a baked dot screen to a retina hero and the
   dots beat against the pixel grid into moire. No re-encode recovers it, because the
   detail was destroyed at authoring time and not at encode time.
2. **1400px was upscaled about 2x** on any current laptop.
3. The sources were already-compressed social media images, so there was nothing to
   recover even in principle.

**The plates now carry no screen at all.** They are duotoned from 4000px scans, and the
print tooth is applied in CSS as random `feTurbulence` grain, which has no period and
therefore cannot alias. It is the same grain the popup already uses.

`yuv420p` is kept and costs nothing here, which is worth writing down because it looks
wrong: a duotone carries all its detail in luma, which 4:2:0 keeps at full resolution, and
the chroma it halves is nearly flat. Lossless triples the file for a difference that is
not visible on a two-colour image.

The pipeline is `tools/plates.sh`, with the exact commands that produced the shipped files
in its header. **The one ordering rule: shape the channel spread first, clamp with
`colorlevels` last.** Reversed, the blue curve lifts the highlights past the cream and the
plate goes cold lavender.

### Real book covers

The shelf on the landing shows **real covers, fetched from OpenLibrary**, which is the same
catalogue the extension queries. They are shipped locally as webp rather than hotlinked, so
the page does not depend on a third party being up and OpenLibrary does not carry our
traffic. Covers are shown to identify the books they are the covers of, and the footer says
so.

The books are chosen to read as one person's actual shelf, not a stock grid: Rand, Borges,
Cortazar, Kleppmann, Norman, Graham, Fitzpatrick, Thiel, Marcus Aurelius, Harari, Kahneman,
Hunt and Thomas. **A shelf that reads as a mock undoes the argument the section is making.**

---

## Colour (the room, previous generation)

| Token | Value | What it is |
| --- | --- | --- |
| `--ink` | `#0F0D10` | The room. The page sits on this and nothing else. Sampled from the landing's hero photograph, so the picture has no visible edge against the page. It was `#0E0A14`, a violet black chosen before there was a photograph. |
| `--board` | `#1B1424` | A raised surface: a shelf, a card, an inset well. |
| `--rule` | `#3A2E4D` | Hairlines and borders. Bright enough to actually read. |
| `--paper` | `#FFFFFF` | Headlines and book titles. Nothing else gets pure white. |
| `--chalk` | `#EDE7F4` | Body text on ink. |
| `--faded` | `#B4A6C8` | Secondary text, labels, captions. |
| `--lamp` | `#FFC24D` | The one light. Primary button, focus ring, the lit spine. |

Those seven are the **room**. The four surfaces do not all use them; see Paper, below.

Contrast on `--ink`: paper 19:1, chalk 16:1, faded 8.9:1, lamp 11:1. All well past AA, and
`--faded` was raised from a previous `#A396B8` (6:1) specifically so secondary text is not
the thing people squint at.

**One accent, and it is a light source.** `--lamp` marks the thing that is lit: the primary
action, the focused control, the caught book. If everything glows, nothing is caught.

### Paper

Two materials, because there are two jobs. The **room** is the moment of *catching*: the
landing page and the card that appears in the feed, a lit shelf in the dark. **Paper** is
the moment of *reading your list*: the shelf popup and the setup page. A list is read on
paper, and the shelf is the one surface you open on purpose.

The cloth spines carry the identity across both, which is what stops this being two
products. Nothing else crosses.

| Token | Value | What it is |
| --- | --- | --- |
| `--paper` | `#FAF7F2` | The page. |
| `--card` | `#FFFFFF` | A raised surface. |
| `--board` | `#E3DCD2` | Hairlines and the shelf board. |
| `--ink` | `#14100E` | Headings and book titles. 17:1. |
| `--muted` | `#5C5349` | Secondary text. 7.2:1. |
| `--accent` | `#8A5A00` | The lamp, darkened until it reads on paper. 6.5:1. |
| `--sunk` | `#F2EDE4` | Inset wells. |

The accent is the same hue as `--lamp` and a different value, because `#FFC24D` on white is
1.6:1 and unreadable. An accent that cannot be read is decoration.

**No blended colour.** No gradient, and no colour laid over another colour with alpha. A
spine is one solid ink; a rule is one solid hairline; the gilt cords are one solid white
line each rather than a highlight stacked over a shadow. Shadows are allowed, because a
shadow is depth rather than colour.

Two things are allowed under that same reading, and nothing else is:

- **A modal scrim.** `rgba(20, 16, 14, 0.4)` behind the shelf's detail sheet. It is
  depth, like a shadow: it says the sheet is in front, not that the shelf changed colour.
- **The cloth on a generated cover.** White at `opacity: 0.13` over one solid binding
  resolves to one solid value, because there is nothing else underneath it. CSS cannot
  compute a per-book tint without `color-mix`, and five hand-written tints is five more
  places for the palette to drift out of step.
- **Grain.** Noise is texture, not colour. See below.

### Grain

```css
--grain: url("data:image/svg+xml,…feTurbulence…");
```

One inline SVG `feTurbulence`, tiled. No file to request, no script, and the browser
rasterizes it once. It is cheaper than a PNG and far cheaper than a CSS `filter`.

It goes on the **background**, never in a layer over the page. Grain across type costs
legibility and buys nothing, and a full-bleed overlay is how the popup once shipped with
nothing clickable (see the checklist). On paper it is the tooth of the sheet, at
`opacity: 0.1`, and it should be felt rather than noticed. The room does not need it: its
hero is a photograph that already carries real film grain.

**Symmetry.** Everything that is not a book row sits on the page's axis: the mark, the
name, the count, the pile labels, and a catch card's provenance line. Book rows stay
left-aligned, and so do form fields. A title is read from its first letter, and centring a
list of names is how a list stops being scannable.

On the catch card the dismiss control is taken out of the flow and pinned to the corner,
so a centred head is centred on the card rather than on whatever space is left beside a
button.

### Bookcloth

| | |
| --- | --- |
| coral | `#FF5A47` |
| marigold | `#FFAE12` |
| jade | `#22B584` |
| peri | `#6274FF` |
| plum | `#B45CE0` |

These are **binding colours, not status colours.** A book keeps its cloth forever, derived
from the book itself (`clothFor`), because a shelf looks like a shelf when the bindings
differ. Never colour-code Now / Next / Someday with them: the grouping already says which
pile a book is in, and a second signal for the same fact is noise.

Jade doubles as the "already on your shelf" marker. That is the one exception, and it
earns it by never appearing anywhere else in that role.

### Bindings

| | | pairs with |
| --- | --- | --- |
| oxblood | `#4A1414` | coral |
| tobacco | `#4A3208` | marigold |
| forest | `#0C4033` | jade |
| indigo | `#1B2570` | peri |
| aubergine | `#3A1550` | plum |

The same five dyes at binding strength, for anything that is a whole board rather than an
edge: the generated cover is the only user today. Same hash, so a book's board and its
spine are the same book.

They exist because cream on bright cloth cannot be read. `#FAF7F2` on marigold is 1.9:1;
on tobacco it is 11.2:1, and every binding clears 10.9:1. So a face-out cover gets one
ink on five grounds instead of five exceptions. This is not a tint of the cloth laid over
it, which the flat rule forbids. It is a second solid value of the same dye.

**Two inks on a binding, and no more.** `#FAF7F2` for the title, `#D6CEC2` for the rules
(7.4:1 on the worst ground). Not `--lamp`: gilt on every cover would spend the one-accent
rule a dozen times per shelf.

---

## Type

No webfonts. Google Fonts logs the visitor's IP, and this page's whole claim is that
nothing about you is collected. A tracking request in the `<head>` would make that a lie
before the reader reached the sentence.

| Role | Stack |
| --- | --- |
| `--sans` | `system-ui, -apple-system, "Segoe UI", sans-serif` |
| `--serif` | `ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif` |
| `--mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |

**Serif appears only where a real book does.** Book titles, spine labels, and exactly one
word in the headline. Everywhere else is the interface, and the interface is sans. This is
the rule that keeps the serif meaning something instead of becoming decoration.

**Mono is for data and for controls that are verbs.** Counts, rates, provenance labels,
and the Now / Next / Someday buttons. It reads as a machine reporting, which is what those
things are.

### Scale

| Step | Size | Weight | Tracking |
| --- | --- | --- | --- |
| hero | `clamp(2.75rem, 7.5vw, 5.25rem)` | 800 | `-0.045em` |
| section label | `0.8125rem` | 700 | `0.14em`, uppercase |
| subhead | `1.125rem` | 700 | `-0.02em` |
| lede | `1.1875rem` | 400 | normal |
| body | `1rem` | 400 | normal |
| tag | `0.6875rem` | 600 | `0.1em`, uppercase, mono |

The hero is the only place type gets loud. It is set tight and heavy on purpose: the
sentence is the hero, so it has to carry the page without a stock photograph under it.

---

## Space

**No large unused spaces.** Two rules do most of the work:

1. Anything that reads as a list of peers goes in a grid, not a stack. Three "how it
   works" steps down a single narrow column is a scroll with nothing in it.
2. Section gaps are `44px`, not `58px+`. Air between sections is structure; air inside a
   section is a gap somebody forgot to fill.

Page width is `1060px` with a `620px` reading measure for prose. Prose does not get wider
than its measure just because the page is.

---

## Motion

Rationed by how often a surface is seen. This is the whole rule, and it is why the 📚
button has no entrance animation while a catch card does: the button is pressed dozens of
times a day and the card appears once per catch.

| Curve | Value | Used for |
| --- | --- | --- |
| `--ease` | `cubic-bezier(.23, 1, .32, 1)` | entrances, presses, hovers |
| `--drawer` | `cubic-bezier(.32, .72, 0, 1)` | things travelling to a new position |

- Entrances 180ms, exits 190ms. **Exit is never slower than entrance**: the system
  responding must not feel slower than the system arriving.
- Transitions, not keyframes, for anything that can be interrupted. Catches arrive in
  bursts, and a keyframe restarts from zero where a transition retargets from wherever it
  got to.
- `prefers-reduced-motion` drops every duration to 1ms and skips position animation
  entirely. Opacity stays: it aids comprehension and does not cause motion sickness.

---

## Signature

**The cloth edge.** A 4px spine down the left of anything that represents a book, in that
book's cloth, with two gilt cords across it. One solid white line each: a gold line
vanishes on marigold cloth, which is how this detail shipped invisible once, and a
highlight stacked over a shadow is a blend, which the flat rule above rules out. White on
saturated cloth reads on all five bindings and on either material.

It appears on the shelf rows, the popup rows, and the catch card. It is the one thing that
should be recognisably Buki at a glance, so nothing else in the interface gets to be that
loud.

---

## Voice

Write from the reader's side of the screen. Say what happens.

- **No em-dashes.** Use a period, a colon, or a comma, and take the extra word if the
  sentence needs it. They pile up and turn every sentence into an aside.
- Sentence case everywhere except mono labels, which are uppercase because they are tags.
- Active voice. A control says what it does: "Save all to Someday", not "Submit".
- The same action keeps the same name through the whole flow. The button that says Save
  produces a card that says Saved.
- Errors do not apologise and are never vague. "OpenLibrary did not answer within 6s" beats
  "something went wrong", because one of them tells you whether to try again.
- An empty state is an invitation. "No book on that cover" is a wall until it is followed
  by "Try the post's words".

---

## Checklist before shipping a surface

- [ ] Contrast: body text at least 7:1 on its background
- [ ] Serif only on book titles
- [ ] One `--lamp` accent, on the thing that is actually lit
- [ ] Focus visible on every control, `2px solid var(--lamp)`
- [ ] Hover effects gated behind `@media (hover: hover) and (pointer: fine)`
- [ ] `prefers-reduced-motion` honoured
- [ ] No em-dashes in any copy
- [ ] Grid, not stack, for anything that is a list of peers
- [ ] Room tokens changed in `docs/index.html` and `src/extension/content.ts` together
- [ ] Paper tokens changed in `popup.html` and `options.html` together
- [ ] No gradient, and no colour laid over another colour with alpha
- [ ] Anything that is not a book row or a form field sits on the axis
- [ ] **Nothing full-bleed and `position: fixed` can take a click**
- [ ] **A component still owns its own colours inside a scoped block**

That last one is not a style rule, and it is here because it shipped. `#sheet` at
specificity (1,0,0) beat the browser's own `[hidden] { display: none }` at (0,1,0), so a
closed sheet stayed laid out over the entire popup and **every control was dead**. Neither
check in the repo could see it: a screenshot cannot click, and `element.click()` dispatches
straight at the node without hit-testing. Both passed against a completely dead UI.

Scope the layout to `:not([hidden])` AND spell out `[hidden] { display: none }`. Then
verify with `?demo&probe` on the dev server, which calls `elementFromPoint` on every
control and prints what is actually on top of it. `popupChrome.test.ts` guards the CSS
shape; the probe is the only thing that proves the behaviour.

**The second-to-last one is the same failure wearing different clothes, and it also
shipped.** The landing's primary call to action is an `<a class="btn">` inside the
masthead nav. `.top nav a` is specificity (0,1,2) and `.btn` is (0,1,0), so the nav rule
repainted the button: `--ink-2` on `--ink` measures **2.11:1**, and on hover `.btn:hover`
set the background to `--blue` while the nav rule set the text to `--blue` as well, which
measures **1.00:1**. The label was not faint, it was gone. It also dropped the button from
weight 600 to 500.

Both take the same answer, and it is worth stating as a rule: **when a scoped block styles
a bare element, exclude the components living inside it with `:not()`. Never raise the
component's own specificity to win back its colours**, because that starts a war the
component loses again the next time a block is scoped around it. `landingChrome.test.ts`
guards this one, and it is worth grepping any block that styles a bare `a`, `p` or `button`
inside a container class for the same trap.
