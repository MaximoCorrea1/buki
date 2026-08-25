# Capturing the store assets: what to put on screen, and what ruins each shot

**Written 2026-08-18.** Not served publicly: `docs/store` is in `.vercelignore`.

> **This file owns the STAGING.** The shot list and every dashboard field live in
> `docs/store/listing.md`; the order of the whole launch is `docs/store/launch.md`; what is
> open is `OPENWORK.md`. Nothing here is repeated from those.

**These wait on `OPENWORK.md` item 3, the by-hand browser pass.** Not out of process:
the shots have to show the product as it now is, and two of the five cannot exist until the
endpoints answer.

---

## The problem nobody had hit

**The store wants 1280x800. The popup is 560px wide.**

A raw capture is a small panel adrift in a large empty frame. Upscaling it to fill the space
softens the type, which on a listing whose entire claim is craft is the worst possible first
impression. So every shot is **composed**, not cropped.

`node tools/store-shots.mjs` builds the frames: the ground, the headline, the placement and
the shadow, at exactly 1280x800. **It does not fake the content.** Each frame has a slot for
a real capture, because `listing.md` records the decision that these are shot against a
shelf holding books actually saved — a mocked shelf reads as a mock, and this is a product
whose whole claim is that the list is yours.

```
1. do the by-hand pass (item 3) on a profile you have really used
2. capture the five raw shots below
3. save them in the repo root as zzz-shot-1.png … zzz-shot-5.png
4. node tools/store-shots.mjs
5. screenshot each .frame at 1280x800
```

**The ground is the mark's own cobalt ramp**, read from `tools/mark.mjs` rather than picked.
The landing is on the third generation and the extension on the fourth, deliberately, so
framing one inside the other's world would make the screenshot argue with itself. The cobalt
is one of the two things `.agents/product-marketing.md` records as crossing that line.

---

## Before you capture anything

> ### ⚠ CAPTURE AT 2x. This is the one that cannot be fixed downstream.
>
> The first four real captures, 2026-08-20, came in at **561x600, 353x90, 350x160 and
> 346x538**. They are the right CONTENT and the wrong RESOLUTION. The frame is 1280x800 and
> `tools/store-shots.mjs` deliberately does not upscale, so a 350px capture sits at 350px in
> a 1280px frame: correct, sharp, and far too small to read on a listing.
>
> **Set the device pixel ratio to 2 before capturing** (Chrome DevTools, device toolbar, DPR
> 2), or capture on a HiDPI display. A 560px popup then yields a 1120px image, which fills
> the frame properly and stays crisp on the high-resolution screens the store's own
> guidance says 1280x800 is preferred for.
>
> Everything else about those four was right: a real shelf at **119 books**, a genuine
> **19-book** multi-catch, the reading state and the result card. Do not restage them. Just
> shoot them again at 2x.


| | |
| --- | --- |
| **A real shelf** | Fifteen to twenty-five books you actually caught. Fewer than twelve looks like a demo; a half-empty board is the single most damaging thing in shot 1 |
| **Real covers** | A mix of catalogue art and a few generated cloths is GOOD. It is honest, and the cloth is a piece of design worth showing |
| **Mixed piles** | Every pile with something in it. `Now 6 · Next 9 · Someday 4 · Finished 3` reads as used; `Now 20 · Next 0` reads as unsorted |
| **The masthead count** | `28 books caught`. **It stopped carrying a kept rate on 2026-08-22**, so a shot staged around `87% kept` is staging a masthead that no longer exists |
| **Dark or light?** | **Dark.** The extension is true black at night and it sits better on the cobalt ground. Shoot light only if you prefer it, and then shoot all five that way |
| **Crop to content** | The popup panel and nothing else. Empty space below the last board is dead pixels the frame cannot rescue |
| **No personal data** | Check the source URLs on any detail sheet, and the browser chrome if any is visible |

---

## The five, and they are a STORY now

**Restructured 2026-08-25** on Maximo's second brief: *"instead of repolish the currents
text, change the approach... these screenshots need to convert, sell, be fun, nice, we need
to appeal to our niche, bookworms, tech people on x, Redditors who read."*

The previous five were a feature tour, each frame answering *what does it do?*. They now run
as one story in the order the store shows them: **the loss, the rescue, the relief, the
scale, the offer.** The words live in `tools/store-shots.mjs`; this file owns the staging.

> ### The thing that made it work is not a vocabulary
>
> **Three of the captures are ONE REAL POST.** @Kekius_Sage, 2026-08-20: *"This is a book I
> read recently."* One thousand likes, twenty-six thousand views, and **the title is nowhere
> in the text** - it exists only on the cover in the photograph. That is precisely the
> condition every text-reading rival is blind to, and a reader can verify it without being
> told. Shots 1 and 2 are a setup and its payoff from a single moment.
>
> **Do not restage shots 1 and 2 as different books.** The whole construction is that the
> book you could not name in shot 1 is the book sitting on the shelf in shot 2.

### What goes in each slot

| Slot | Source capture | What it is |
| --- | --- | --- |
| `zzz-shot-1.png` | `screenBookTweet.PNG` | The X post. Title nowhere in the text |
| `zzz-shot-2a.png` | `screenBookTweet1ReadingCover.PNG` | *Reading the cover...* |
| `zzz-shot-2b.png` | `screenBookTweet3FoundBook.PNG` | *Physics and philosophy*, resolved |
| `zzz-shot-3.png` | `screen1.PNG` | The shelf |
| `zzz-shot-4.png` | `screen4.PNG` | The nineteen-book catch |
| *(none)* | - | The `pair` frame renders from the mark and a cover. **It is the fifth upload** |

**The numbering changed with the order.** A capture kept under its old name lands in the
wrong frame silently, because the tool reads position from the filename and cannot know the
picture is wrong. Re-copy from the sources above rather than renaming in place.

### 1. The loss · *"Name this book."*

**Lead with it**, and it replaced the shelf in that position deliberately. The shelf is
beautiful and, at a glance, could be Goodreads. This one is unmistakably a timeline, which
is where the niche already lives, and it poses a question the reader loses in a second.

- The post at full width, **the photograph legible**, and the text visible enough that a
  reader can see for themselves that no title is written in it.
- **Buki's mark must be in frame**, bottom right of the action bar. It is small on purpose:
  this frame does the old shot 4's job without spending words on it, so anyone who looks
  finds it and nobody has to be told.

**What ruins it:** a crop that loses the post's text, which is the entire proof; or a post
whose caption happens to name the book, which quietly destroys the argument.

### 2. The rescue · *"Buki reads the cover."*

**A `split` frame. Two files, `zzz-shot-2a.png` and `zzz-shot-2b.png`, and there is no
`zzz-shot-2.png`.**

- **Left:** the *Reading the cover...* toast with the source thumbnail, caught while the bar
  is part way, so it reads as a thing HAPPENING.
- **Right:** the card with the evidence line *read from the cover*, the book resolved, and
  the three pile buttons unpressed.
- **Same post and same book as shot 1.** Shoot them seconds apart.

**What ruins it:** a right panel showing a different book than shot 1. That is not an
inconsistency, it is the joke failing to land.

### 3. The relief · *"Every book you nearly lost."*

- The pile control visible at the top with **all four piles populated**.
- Two or three full boards, books face out, sitting on `Now` rather than a search result.
- Fifteen to twenty-five books. Fewer than twelve looks like a demo.

> **⚠ THE PILE SPREAD IS PART OF THE COPY.** The sub names Now, Next and Someday, so a shelf
> with 99 of 119 books in Someday makes the frame argue against its own line. The capture of
> 2026-08-20 reads `Now 8 · Next 8 · Someday 99 · Finished 4`, which is what *"Save all to
> Someday"* being the only bulk action produces. **Restaging alone hides that rather than
> fixing it**; it is recorded as a product question, not a photography one.

**What ruins it:** one pile at zero, a scroll position that cuts a board in half, or a
masthead that no longer exists. It reads `N books caught` since 2026-08-22 and the 08-20
capture still shows a bare `119`.

### 4. The scale · *"Nobody types nineteen titles."*

- A photograph holding **four or more** books: a stack on a desk, a shelf behind someone.
- The card open with each book on its own row, **covers resolved**, pile buttons unpressed.
- The *Save all* control visible.

> **⚠ THE COUNT IS IN THE HEADLINE.** The frame reads *"Nobody types nineteen titles."*
> because the capture found **19**. The number is proof rather than a claim, which is the
> whole reason it is there, and it is the one line in the set a reader can falsify without
> leaving the frame. **Reshoot with a different photograph and you must change
> `tools/store-shots.mjs` in the same commit.** `src/shared/storeShots.test.ts` fails if
> this file and the frame stop agreeing.

**What ruins it:** two books, which reads as a coincidence rather than a capability; or a
card caught mid-load with a spinner.

### 5. The offer · the `pair` frame

**It needs no capture and is the fifth upload.** The mark beside a real cover on the cream
ground, the locked motto above, *"Ten catches free. No account, no sync."* below.

This is the only close a swipeable set gets, and until 2026-08-25 the trial appeared on none
of the five. Both sentences are quoted from `docs/brand.md`'s locked motto rather than
written here, and `src/shared/pricing.test.ts` holds the promise to `TRIAL_CATCHES`.

**What ruins it:** putting it on the cobalt ground. See the measurement below.

---

## The ground: cobalt for product, cream for the mark

**Measured 2026-08-20, and it inverts the rule.** The frame ground is the mark's own ramp,
so on any frame containing the MARK, `contrast(deep, deep)` is **1.00:1** - not low
contrast, the identical colour. The first render of the pair composition came back with half
the ball dissolved into the background.

| Ground | vs the mark's deep stop | vs its light stop |
| --- | --- | --- |
| landing, day `#fbf7ec` | **8.03:1** | 1.64:1 |
| toolbar, light `#ffffff` | 8.60:1 | 1.75:1 |
| landing, night `#080d20` | 2.24:1 | 11.00:1 |
| extension night `#000000` | 2.44:1 | 11.98:1 |
| **the frame's cobalt** `#013ebf` | **1.00:1** | 4.90:1 |

A gradient ball always merges one end into any flat ground; what matters is that the other
end separates hard. **Cobalt is right when the content is a popup panel and wrong when the
content is the mark.** The pair frame is on cream for that reason, and a dark cover gains
from it rather than losing.

**The same mistake happened twice in one composition.** The connector between cover and mark
was painted with the cream token, on a cream ground, and vanished. It uses `currentColor`
now, which inherits from the frame and flips with the ground, so neither frame can repeat
it. **If an element has a colour written into it rather than inherited, ask what it is
sitting on.**

---

## The promotional tile, 440x280

`listing.md` specifies it: the catcher on a light ground, wordmark to the right, one line
beneath — *"Catch books before you forget them."*

**Do not put a screenshot in it.** At 440x280 a shrunken popup is illegible, and the tile's
job is recognition rather than explanation.

---

## The video

**45 seconds, silent, captioned.** Silent because X autoplays muted and a listing video is
usually watched with the sound off, and because a voiceover is the part that never gets
recorded. Captions are burned in, not uploaded as a track.

**One take of the real product.** No motion graphics, no zoom effects. The product's own
motion is already designed — the card travels 280ms, the capsules press — and that is what
the video is for.

| Time | What is on screen | The caption |
| --- | --- | --- |
| 0:00–0:04 | A bookmarks folder, scrolled. Dozens of saved posts, none of them legible as a book | *You saved the post.* |
| 0:04–0:07 | Same folder, still scrolling | *You will never find the book.* |
| 0:07–0:14 | A post with a photograph of a book. Right-click, *Save book to shelf*. The card arrives with the title found | *Buki reads the cover, not the caption.* |
| 0:14–0:18 | Press **Read next**. The card settles | *Pick a pile. Nothing is saved until you do.* |
| 0:18–0:27 | A photograph of a STACK of books. One catch, four rows, each with its own cover | *One photograph. Every book in it.* |
| 0:27–0:34 | The popup opens. The shelf, face out, boards full. Move one book between piles | *A shelf, not a folder. It lives in your browser.* |
| 0:34–0:40 | A book's detail sheet: the post it was caught from | *And it keeps the post that sold you.* |
| 0:40–0:45 | The mark, then one line of type | *Buki. Ten catches free.* |

**The rules for it, from `docs/brand.md`:**

- **No em-dashes** in any caption.
- **Never the words** *organise*, *manage*, *seamless*, *AI-powered*, or ***scan*** — scan
  implies a camera and a physical book, which is the competitor's job.
- Full contrast on every caption. Hierarchy is size and weight, **never a fade**.
- The motto is locked. If you open on a line, open on *Find any book you see online,
  instantly.* Do not improvise a new one for the video.

**The one thing the video must not claim:** *no server* or *no data* about the product as a
whole. Reading a cover contacts one, ours by default. The shelf line is the true one and it
is the one to use.

---

## Where these end up

| Asset | Used in |
| --- | --- |
| Five 1280x800 shots | The Web Store listing, and shot 2 is the X launch post |
| 440x280 tile | The Web Store listing |
| The 45-second video | The listing, the X launch post, and the landing if you want it |

**Shot 2 is the launch post.** It is the only image in the set that shows something nothing
else in the category can do, and a launch post has one job.
