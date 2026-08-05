# Buki: the design system

One file, two surfaces. The landing page (`docs/index.html`) and the in-page catch tray
(`src/extension/content.ts`) hold their own copies of these values because they cannot
share a stylesheet across a browser extension boundary. **That duplication is the risk
this file exists to manage.** `clothFor` was once defined in two files with two different
hashes, so one book was one colour on the shelf and another in the picker. Change a token
here first, then in both places, in the same commit.

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
| `--ink` | `#0E0A14` | The room. The page sits on this and nothing else. |
| `--board` | `#1B1424` | A raised surface: a shelf, a card, an inset well. |
| `--rule` | `#3A2E4D` | Hairlines and borders. Bright enough to actually read. |
| `--paper` | `#FFFFFF` | Headlines and book titles. Nothing else gets pure white. |
| `--chalk` | `#EDE7F4` | Body text on ink. |
| `--faded` | `#B4A6C8` | Secondary text, labels, captions. |
| `--lamp` | `#FFC24D` | The one light. Primary button, focus ring, the lit spine. |

Contrast on `--ink`: paper 19:1, chalk 16:1, faded 8.9:1, lamp 11:1. All well past AA, and
`--faded` was raised from a previous `#A396B8` (6:1) specifically so secondary text is not
the thing people squint at.

**One accent, and it is a light source.** `--lamp` marks the thing that is lit: the primary
action, the focused control, the caught book. If everything glows, nothing is caught.

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
book's cloth, with two gilt cords across it. The cords are a highlight over a shadow, never
flat gilt, because a gold line vanishes on marigold cloth. That detail shipped invisible
once for exactly that reason.

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
- [ ] Tokens changed in `docs/index.html` and `src/extension/content.ts` together
