# Buki: the design system

One file, four surfaces, two materials. The landing page (`docs/index.html`), the in-page
catch tray (`src/extension/content.ts`), the shelf popup (`popup.html`) and the setup page
(`options.html`) each hold their own copy of these values, because a content script and an
extension page cannot share a stylesheet with a website. **That duplication is the risk
this file exists to manage.** `clothFor` was once defined in two files with two different
hashes, so one book was one colour on the shelf and another in the picker. Change a token
here first, then in every surface that uses it, in the same commit.

---

## The idea

A library at night. One warm lamp. Most spines are lost to the dark and a few are caught
in the light. That is the product in one picture: the books you saw and lost, and the ones
you kept.

Everything below follows from it. The page is not "dark mode"; it is a room with a light
in it. Surfaces are boards and spines, not cards floating on a gradient.

---

## Colour

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
