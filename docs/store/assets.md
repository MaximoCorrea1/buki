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

## The five

### 1. The shelf · *"A shelf, not a folder."*

**Lead with it.** It is the one that sells the product, and it is the only shot that shows
what you actually end up with.

- The pile control visible at the top with all four piles populated.
- Two or three full boards, books face out.
- **Sit on `Now`**, not on a search result. A search box with text in it says "I am looking
  for something", and the shot is about having it.

**What ruins it:** a shelf under twelve books, one pile at zero, or a scroll position that
cuts a board in half.

### 2. The multi-book catch · *"One photograph, several books."*

**The differentiator, and no competitor screenshot can show it.** Category A reads page
text and Category C needs the physical book.

- A photograph holding **four or more** books: a stack on a desk, a shelf behind someone.
- The card open with each book found on its own row, **covers resolved**, and the three
  pile buttons unpressed.
- The *Save all* control visible.

**What ruins it:** two books (looks like a coincidence rather than a capability), or a card
caught mid-load with a spinner.

### 3. The search, then the find · *"You saw it. Now you have it."*

**A `split` frame, not a hero: two captures side by side with the mark between them.**
Decided 2026-08-20. It replaced *A catch somewhere that is not X*, which showed only that
the menu opens on another site. This shows a catch HAPPENING and its result, which is the
same claim made in motion. The breadth argument the old shot carried is already made twice,
in the single-purpose statement and in the host justification, and neither needed a picture
to be true.

**Two files, not one:** `zzz-shot-3a.png` (left) and `zzz-shot-3b.png` (right). There is no
`zzz-shot-3.png` and the tool will not ask for one.

- **Left, the reading state.** The *Reading the cover...* toast with the source thumbnail in
  it. It has to be legible as a THING HAPPENING, so catch it while the bar is part way.
- **Right, the result.** The card with the evidence line *read from the cover*, one book
  resolved, and the pile buttons, with one pile already showing *on your shelf*.
- **Same site, same book, both halves.** They are one moment split in two, and two different
  books reads as two screenshots that happen to be adjacent.

**What ruins it:** a left panel that does not obviously show work in progress, and a right
panel for a different book than the left. **Shoot them seconds apart, on the same catch.**

### 4. The button in the action bar · *"One press, where you already are."*

- A post on X with a book cover in it, the action bar visible, **Buki's mark sitting beside
  reply and like**.
- Close crop. This is a detail shot and the detail is that it belongs there.
- The mark is the catcher at 18px, X's own icon size. If it looks like a different size from
  its neighbours, something is wrong — say so rather than shooting around it.

**What ruins it:** a wide shot where the mark is twelve pixels of blue nobody can see.

### 5. The evidence · *"It tells you how often it is right."*

- A book's detail sheet showing where the answer came from, **plus** the masthead's kept
  rate in the same frame if you can get both.
- If not, the masthead count on its own with a full shelf behind it.

**What ruins it:** a detail sheet whose evidence line says *from the post's own words*, the
weakest of the three signals. **Shoot one that says `read from the cover`** - that is the
capability nothing else in the category has, and it is the whole reason this shot exists.

*(This previously warned about a kept rate of 100% or 40%. The masthead stopped showing a
rate on 2026-08-22; the per-catch evidence line is the surviving trust signal and the one
to stage.)*

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
