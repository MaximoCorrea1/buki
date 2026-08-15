# Buki: the design system

One file, four surfaces. The landing page (`docs/index.html`), the in-page catch tray
(`src/extension/content.ts`), the shelf popup (`popup.html`) and the setup page
(`options.html`) each hold their own copy of these values, because a content script and an
extension page cannot share a stylesheet with a website. **That duplication is the risk
this file exists to manage.** `clothFor` was once defined in two files with two different
hashes, so one book was one colour on the shelf and another in the picker. Change a token
here first, then in every surface that uses it, in the same commit.

## Read this before changing anything

**The landing moved ahead on 2026-08-15 and the extension caught up the same day.** Knowing
which surface is on which generation is the difference between a fix and a regression.

| Surface | Generation | State |
| --- | --- | --- |
| `docs/index.html` | **third** | Manrope, no serif, `light-dark()` palette, floating pill, capsule controls, a light/dark switch. **Complete top to bottom**: one centred axis, one surface language, two radii, every sentence at `--ink`, and four uses of the artwork — hero, the second plate as a full band, pricing, and the close. |
| `popup.html`, `options.html` | **third** | Caught up 2026-08-15. Manrope, sentences at `--ink`, capsules, an iOS segmented control, two radii. **Still a light-only surface with its own paper palette, and that is not drift** — see *Two materials, one identity*. |
| `src/extension/toolbar.ts` | third | A book board on Chrome's own toolbar. Unaffected by the pass: it is a 16px bitmap, not a stylesheet. |
| `src/extension/content.ts` | **first** | The violet-black room with one warm lamp |
| `icons/*.png`, `docs/icon.svg`, `icons/mark.svg` | second | Still the **three-spine** mark. The landing carries Maximo's two-spine drawing. |

**One surface is deliberately behind and one is undecided.** `content.ts` draws inside
*somebody else's page*, so it has to hold up against an arbitrary background rather than one
we chose — a different problem, recorded in OPENWORK item 21. **Do not retheme it by copying
tokens across without solving that first.** The mark is OPENWORK item 24 and waits on Maximo.

### Two materials, one identity

The popup and options page are **light only** and keep their own `--paper` palette. This is
not a surface that missed the `light-dark()` pass.

The landing is the moment of *catching*: a lit shelf in the dark, and a page you meet at any
hour on any machine, so it answers to the reader's own preference. The popup is the moment
of *reading your list*, and a list is read on paper. They are different jobs, so they are
different materials, and the bindings carry the identity across both — which is why the five
dyes are identical everywhere and never respond to a mood.

What the two materials now **share**, after 2026-08-15: one type family, one contrast rule,
capsules with a press, gated hovers, and two radii plus the capsule. What they do not share
is the ground.

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

**And grep for `rgba(` too, which is the same trap wearing gloves.** Dark mode found
thirteen hardcoded `rgba(251, 247, 236, …)` on the landing: the masthead's glass, the hero
scrim, the band quote's halo. Every one is the cream at an alpha, none of them names
`--paper`, so relighting `--paper` would have left thirteen cream veils across a navy page.
They go through `--paper-rgb` now. A colour written as three numbers is still a hardcoded
colour.

---

## The same room, at night

Added 2026-08-13, `docs/index.html` only. Not a second design: the tokens swap roles and
everything downstream follows, because it was already written in tokens.

> **The values below are still correct; the mechanism changed on 2026-08-15.** They shipped
> as a duplicated `@media (prefers-color-scheme: dark)` palette. They are now single
> `light-dark()` declarations, because adding a manual switch would have meant a third copy.
> See *Two moods from one declaration*.

| Token | Day | Night |
| --- | --- | --- |
| `--paper` | `#FBF7EC` | `#080D20` |
| `--paper-2` | `#F3ECD9` | `#111832` |
| `--ink` | `#0A0F33` | `#F5EFDE` |
| `--ink-2` | `#3D477A` | `#BCC4E0` |
| `--blue` | `#1231A8` | `#7F9BEA` |
| `--rule` | `#DED4B4` | `#262E4D` |

| Pair | Ratio |
| --- | --- |
| `--ink` on `--paper` | 16.8:1 |
| `--ink-2` on `--paper` | 11.1:1 |
| `--blue` on `--paper` | 7.1:1 |
| cream on the plate's sky | 7.9:1 |

**The dyes do not appear in that table, and that is the rule.** A binding is a dye, not a
status colour, and a book keeps its cloth in any light. The generated covers, the spines
and the cloth edge are identical in both modes.

**The mark mirrors rather than lightens.** Cream spines with a cobalt catch measures 9.00:1
against 9.58:1 in daylight. Keeping the light blue would have measured 1.69:1 against cream
neighbours and the mark would say nothing, which is the whole reason `--mark-caught` exists
as a token.

**The plates are re-duotoned, never filtered.** `tools/plates-dark.sh`, from the shipped
webp rather than the museum scan, which works because `colorlevels` runs last in
`plates.sh`. The tonal order is kept rather than negated: for a cream headline to clear 7:1
the plate's brightest area must sit at or below 0.0806 relative luminance, and the sky at
`#35457f` is 0.0655. Negating is more dramatic, measures worse under the headline, and
inverts a credited painting's values.

**What stays light on purpose.** The three step mockups. `.frame` is `#faf7f2`, the
extension's own paper, so those panels depict a real light surface. Dimming them to suit
the page would misrepresent the product, exactly as inverting the real book covers would.

## The idea

A library at night. One warm lamp. Most spines are lost to the dark and a few are caught
in the light. That is the product in one picture: the books you saw and lost, and the ones
you kept.

Everything below follows from it. The page is not "dark mode"; it is a room with a light
in it. Surfaces are boards and spines, not cards floating on a gradient.

---

## The mark

> **Two marks are live and they are different objects.** The landing carries Maximo's own
> drawing, supplied 2026-08-15. Everything else still carries the redrawn three-spine mark
> below. Read *The mark Maximo drew* first, then this, which is still the truth for the
> extension, the favicon and the store tile.

### The mark Maximo drew (landing, current)

**Two spines, each crossed by two cords.** Supplied as `brand/logo-maximo.svg`, inlined in
`docs/index.html`. It is a potrace trace of his drawing, so the edges carry his hand rather
than being resampled geometry.

Three things had to be fixed before it could ship, and the first is the one that matters:

| Found | Why it would have broken | Fixed by |
| --- | --- | --- |
| `fill="#000000"` hardcoded on the group | Black on `#080d20` is invisible. **Every dark-mode visitor would have seen no logo**, which is exactly how the previous mark broke on a dark toolbar | `fill="var(--mark-spine)"` |
| A 900×900 box holding art that is only 613×793 | 16% dead padding on every side, so the mark renders small and aligns badly against the wordmark | viewBox tightened to `148 55 613 793` |
| potrace preamble: `<!DOCTYPE>`, `900pt` units | Will not inline cleanly | Stripped; the `translate(0,900) scale(.1,-.1)` transform **stays**, because the path data lives in that flipped tenth-scale space |

It is sized by **height**, width auto, because it is taller than it is wide and pinning the
width shrinks it against the wordmark beside it.

**What this costs, and it is not nothing.** This mark has no caught spine. The three-spine
mark's entire argument was that *catching* is the difference between a lit spine and a dark
one, and that idea is not in the two-spine drawing. The story below is therefore no longer
true of the landing. Rewriting the brand story, and reconciling the favicon, the store tile
and `icons/mark.svg`, is open work rather than done.

### The redrawn mark (extension, favicon, store tile)

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

### Type on the landing: one family, and no serif at all

| Role | Face |
| --- | --- |
| Display and body | **Manrope** variable 200–800, `docs/manrope.woff2`, **25KB** |
| Book titles only | `ui-serif` stack, because that is what the product stamps on a board |

**One family, the way a phone does it.** Petrona (44KB) plus its italic (47KB) plus
Instrument Sans (30KB) came to 121KB. Manrope is 25KB and does all of it, so the page
carries a fifth of the type it used to.

#### Why the serif went, which is the important part

The landing was cream with a high-contrast serif display. That is, precisely, the most
common look in machine-generated design right now: `frontend-design`'s own calibration
names *"a warm cream background near #F4F1EA with a high-contrast serif display"* as the
first of three defaults it warns about.

This page had carefully dodged the AI-default serif **faces** (Fraunces, Instrument Serif,
Playfair) and never noticed it had walked into the default **composition**. The result read
as tasteful editorial, which sits next to both "generated" and "old", and Maximo's word for
it on 2026-08-15 was that the landing looked old.

**The fix was to stop competing.** The one genuinely distinctive asset here is the artwork:
public-domain 18th-century capricci, duotoned from museum scans, that nobody else has. A
vintage typeface next to a vintage engraving is two things saying the same thing. A crisp
current sans next to a baroque etching is contrast, which is how a gallery brands an old
master. **The plates carry the classical weight now, and the type is allowed to be
current.**

So: Bricolage Grotesque (too light) → Bodoni Moda (a didone cannot be round) → Petrona
(right for the second generation) → **Manrope**. Each move was a correction, not a taste
swing, and this one corrected the whole premise rather than the face.

#### The italic, and how its absence is now enforced

**Manrope ships no italic**, which used to be disqualifying. Young Serif was rejected for
exactly that. It stopped mattering the moment emphasis stopped being a slant.

`h1 em` is no longer italic. `forgot` is set in `--ink-2` at the same weight, so **the word
the sentence is about is the one that fades**: the type does what the line says, and the
headline's mass is unbroken. Colour is the better answer in a geometric sans anyway, where
italicising is not the idiom.

`html { font-synthesis: none }` is set globally. That is not tidiness. A faked italic
already reached production here once: the browser sheared the roman, circular bowls stayed
circular, the `f` never gained its descender, and nobody saw it until a `font-synthesis`
test caught it after shipping. With one family and no italic file, this makes that failure
**impossible** rather than unlikely.

### The third generation: pill, capsules, and a switch

Added 2026-08-15, landing only.

**The pill.** The masthead floats rather than sticking to the top edge, because the plate
now fills the viewport and a full-width bar cuts a hard line across the painting. It is the
page's one piece of glass, used once, where it does a job.

It is also the page's **one authored moment**: at rest it spans the shell, and once the
hero has gone past it contracts to a capsule, the way a phone's address bar collapses when
you start reading. It transitions `max-width`, which is layout rather than compositor work,
and that is a deliberate exception to the transform-and-opacity rule: it fires **once per
direction** off the existing IntersectionObserver sentinel, never per frame. There is still
no scroll listener anywhere on this page.

**Capsules.** Every control is `border-radius: 999px` with `transform: scale(0.97)` on
`:active`. The old buttons were 3px rectangles that changed colour on hover and did nothing
on click, which on a touch screen is no feedback at all: hover is the one state a finger
never produces. The press is small enough that nobody consciously sees it and large enough
that the control feels like it heard you.

**Secondary is a tint, not an outline.** The old ghost ring measured **1.38:1** against the
paper, which is a boundary you cannot see and fails the 3:1 bar for a control edge. A
filled surface needs no boundary to read as a control, and it is what a phone actually
does. The options page reached the same conclusion from the opposite direction and had to
keep its ring; see the note under the checklist.

**Motion**, per `emil-design-eng`: `--ease-drawer: cubic-bezier(.32,.72,0,1)` is Ionic's
port of the iOS sheet curve and is used for the one thing that travels a distance. Icons
never animate from `scale(0)`; nothing in the world appears out of nothing.

### Surfaces: a card is not a control

Added 2026-08-15, when the page below the hero was rebuilt. It had **five** radii — 2, 4,
6, 7, 8 and 20px — and three unrelated ways of drawing a panel. It now has two radii and
the capsule:

| Token | Value | For |
| --- | --- | --- |
| `--surface` | `color-mix(in srgb, var(--ink) 4%, transparent)` | a quiet panel: the Free plan, the picker |
| `--ring` | `color-mix(in srgb, var(--ink) 11%, transparent)` | its only boundary, drawn as an **inset** shadow |
| `--navy-card` | `light-dark(#0a0f33, #16204a)` | the one emphasised panel |
| `--r-lg` / `--r-md` | 22px / 14px | a card / a panel or a captured surface |

**A card separates by ring and shadow, not by a 3:1 fill.** The 3:1 boundary bar in this
document is for a **control** — something you press, whose edge tells you where to press.
A surface is not making that promise, and demanding 3:1 of a card fill is what produces a
page of boxes shouting at each other. The pill has always worked this way: a 9%-ink inset
ring plus blur and a shadow.

**Do not draw a page token around a picture of the product.** The three step mockups used
to carry `border: 1px solid var(--rule)`. `--rule` is the *page's* hairline; the frame
contains a screenshot of the *extension*. It also read as a faint rectangle rather than as
a captured thing. Elevation says "this was photographed" without borrowing a colour from
the page to say it.

**Shadows are tokens, because a navy shadow does nothing on a navy page.** `--shadow` and
`--shadow-deep` are `light-dark()` pairs that go black at night, and heavier, because there
is less ground left to darken.

**Glass, when a panel sits on a painting.** `--surface` is a tint of the *page*, so over a
plate the picture shows straight through the card and takes the text with it. A panel on
artwork is `color-mix(in srgb, var(--paper) 84%, transparent)` with a blur, and it is
measured against **the plate's own extreme pixels, sampled out of the file** rather than
estimated. Both plates, both moods, worst case: `--ink` clears 12.4:1 in daylight and
15.5:1 at night. The secondary button does the same at 70% and clears 11.55:1.

### Hierarchy is size and weight. It is never a fade

Added 2026-08-15, after Maximo's note: *"WAY MORE CONTRAST! NO FADED FONTS!"*

He was right and the measurement said otherwise, which is the interesting part. `--ink-2`
was **8.24:1** — AAA, comfortably past every bar in this checklist — and the page still
read washed. The cause was structural: `--ink-2` carried `.sub`, `.step-body`,
`.answers dd`, `.picker p`, `.fine`, `.plan-line`, `.aside` and the footer. **Nearly every
sentence on the page was secondary.**

Two things make that read as faded even at 8:1. Body copy sits two steps below its own
heading, so the eye reads the *relationship*, not the ratio. And `--ink-2` is a different
**hue** — a blue-grey under a near-black heading, which the eye reads as ink that has run
out rather than as ink chosen to recede.

**The rule: every sentence gets `--ink`. Rank by size and weight instead.** This is also
the iOS answer, and it is why a phone's settings screen never looks washed: it sets
near-black at every level and separates a label from its value by size, weight and
position. `--ink-2` survives for **labels and fine print only** — the tier name, the price
qualifier, the plate credit, the step number's caption — and it was darkened to 12.37:1 so
even those are not faded.

**When something has to recede, use colour, not lightness.** `h1 em` fades *forgot* because
the sentence is about forgetting. `.plate-band blockquote span` and `.hero-lede b` use the
**accent**, which emphasises without lightening. That is the whole vocabulary; there is no
third option, and "make it a bit lighter" is not one of them.

**The extension took the same rule on the same day.** `--muted` was the identical `#3d477a`
and carried the identical job: every author name, the empty state, the sheet's byline and
the affiliate disclosure. That last one is the one that mattered — Chrome Web Store policy
permits affiliate links **only when they are disclosed**, and 10.5px of 8.24:1 grey barely
is. A contrast rule was doing compliance work nobody had noticed it was doing.

### Mono is for data that lines up

Monospace survives in exactly three places: the **shelf count**, the **per-pile counts**,
and the **cloth**, which is a character grid and could not be anything else. Lining figures
are the reason — the header must not shift by a pixel when 9 becomes 10.

Everything else moved off it on 2026-08-15. `Settings`, the recognition record and the pile
tag were tracked uppercase mono, which **renders a word as if it were a machine value**. The
segmented control was the worst of them: tracked uppercase mono is a *label* treatment, and
it said "here is a category" when the control's whole argument is that a pile is a place you
stand in. `PILE_LABEL` in `shelfView.ts` has always been sentence case — only the CSS was
shouting, so that fix touched no TypeScript at all.

An API key stays monospace. It is data.

### One axis

Every section head used to sit hard left with 40% of the width empty beside it, above grids
that were already symmetric. **That mismatch, not the grids, is what read as lopsided.**
Section heads, subs, step labels and bodies, the plate quote and the closing band are all
centred on one axis now.

**The hero is the deliberate exception.** It sits on a painting whose architecture is on
the left and whose sky is on the right, so its type goes where the picture has room. A rule
that cannot survive one honest exception is a rule that will be broken quietly later.

### Two moods from one declaration

The palette is written with **`light-dark()`**, one declaration per token:

```css
--ink: light-dark(#0a0f33, #f5efde);
```

The alternative was a second copy of the palette inside `@media (prefers-color-scheme:
dark)` and a **third** under `[data-theme="dark"]` for the manual switch. Three copies of
one palette, in a repo whose recorded failure mode is *the copies drifted*, was not worth
it. The switch changes exactly one property: `color-scheme`.

Two things CSS cannot reach, so `index.html`'s script handles them:

1. **The plates.** `<picture>` chooses its source from the OS preference and knows nothing
   about a manual override, so a reader who overrode would have got the dark page under the
   light painting. Flipping each dark `<source>` between `media="all"` and `"not all"`
   re-runs the browser's own source selection, which keeps **one** plate downloaded rather
   than shipping both and hiding one.
2. **The `theme-color` metas**, by the same mechanism, so the phone's own chrome follows the
   page rather than the system.

The theme is decided by a small **blocking** script in `<head>`. Deferring it shows one mood
and then swaps, which is the flash every theme toggle ships with unless it is done there. It
always writes `data-theme`, even when the choice came from the OS, so the CSS only ever has
to answer one question. **The choice is stored only when it is chosen**: writing it on load
would freeze a reader's OS preference the first time they visited, so a machine that
switched to dark at sunset would keep serving them daylight.

**Veils go through `color-mix`, never raw numbers.** See the trap note above.

**Dark UI raises a surface by LIFTING it, never by darkening it further.** `.plan.pro` was
a flat `var(--navy)`, which reads as a strong dark card on cream and measures **1.04:1**
against the night page: the emphasised plan simply had no edge. `--navy-card` is the same
idea drawn the way each mood draws elevation. This is the one place where "the same token
in both moods" is the wrong instinct.

**A literal is a bug waiting for a retokening, and a grep only ever finds the literal you
grep for.** Dark mode's first pass swept for the cream at an alpha and found thirteen. A
later pass found three more that the sweep could not have caught because none of them were
cream: a 40% **white** veil, a `#fff` sitting on `var(--blue)` (10.34:1 by day, **2.70:1**
by night, because the token flipped and the literal did not), and the `.plan.pro` fill
above. `src/shared/landingTokens.test.ts` now fails the build on a literal colour anywhere
in the landing's page chrome, and allows by name the only two families that are correct:
the step mockups, which depict the extension's own light surface, and the generated covers,
which carry `generatedCover.ts`'s five dyes.

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
- [ ] **A control's boundary clears 3:1, or it has a filled surface instead of an edge**
- [ ] Serif only on book titles
- [ ] One `--lamp` accent, on the thing that is actually lit
- [ ] Focus visible on every control, `2px solid var(--lamp)`
- [ ] **A disabled control looks disabled.** An empty-shelf state lasts days, not 200ms
- [ ] Hover effects gated behind `@media (hover: hover) and (pointer: fine)`
- [ ] **Every pressable thing answers a press**, not only a hover. A finger never hovers
- [ ] `prefers-reduced-motion` honoured
- [ ] No em-dashes in any copy
- [ ] Grid, not stack, for anything that is a list of peers
- [ ] Room tokens changed in `docs/index.html` and `src/extension/content.ts` together
- [ ] Paper tokens changed in `popup.html` and `options.html` together
- [ ] No gradient, and no colour laid over another colour with alpha
- [ ] Anything that is not a book row or a form field sits on the axis
- [ ] **Grep `rgba(` as well as `#` when relighting a token** — and remember a grep only
      finds the literal you grep for. On the landing, `landingTokens.test.ts` does it for you
- [ ] **A surface separates by ring and shadow. Only a control owes 3:1**
- [ ] **Every sentence is `--ink`.** Rank by size and weight; `--ink-2` is for labels and
      fine print. A passing ratio does not mean it does not read as faded
- [ ] **Emphasis is colour, never lightness.** And check the face actually has the style you
      asked for: `font-style: italic` under `font-synthesis: none` is a silent no-op
- [ ] **A panel over artwork is glass, measured against the plate's own extreme pixels**
- [ ] **Mono is data that lines up.** A word set in tracked uppercase mono reads as a
      machine value. Check the casing is in the CSS before changing it in the TypeScript
- [ ] **Deleted a font? `src/shared/fonts.test.ts` is the only thing that will notice.** A
      dangling `@font-face` 404s and falls silently through to `system-ui`, which looks like
      a design decision rather than a bug
- [ ] **Changed an alignment? Grep the media queries for that property.** A block written
      for the old alignment will keep applying below its breakpoint and no desktop
      screenshot will show it
- [ ] **At night a raised surface gets LIGHTER.** Darkening it further is how the emphasised
      pricing card reached 1.04:1 against the page
- [ ] **An animation and a press do not write the same property.** A running animation beats
      a transition, silently, so `:active { transform: … }` under a `transform` keyframe does
      nothing at all and reports no error
- [ ] **Nothing full-bleed and `position: fixed` can take a click**
- [ ] **A component still owns its own colours inside a scoped block**

**On the alpha rule and the third generation.** The flat rule was written for the room and
still governs the extension: no gradient, no colour over colour. The landing's third
generation deliberately breaks it, because transparency is the brief: the pill is glass, the
hero wash is the page ground at an alpha, and the tinted secondary button is `--ink` at 8%.
Those are all **the page's own ground at an alpha**, which is the same reason a modal scrim
was always allowed. It is not licence to tint arbitrary colours over each other, and it does
not apply to `popup.html`, `options.html` or `content.ts`.

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
