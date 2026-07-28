# Design: prove recognition works

Date: 2026-07-28
Status: APPROVED
Owner: Maximo

## Why now

Recognition was swapped from local OCR (Tesseract, measured at ~5% on real covers) to a
vision model. In the same change both flows were rewired through the background worker,
the offscreen document was deleted, and the message contracts changed.

None of it has run in a browser. The 26 passing tests all inject fakes, so they prove the
logic is right given a well-behaved API and prove nothing about the seams between
contexts - which is exactly where both previous first-run bugs lived, while the suite was
green throughout.

Everything else on the roadmap (a keyless proxy, CSV export, store submission) is
guesswork until recognition is known to work and known to be good enough.

## Goals

1. Confirm the vision path works end to end in Chrome.
2. Make the product's behavior follow the strength of its evidence, rather than always
   auto-saving the top guess.
3. Measure quality from real use, without turning dogfooding into grading homework.

## Non-goals

- The keyless proxy (Cloudflare Worker). Deferred until recognition is proven.
- CSV export, store listing, billing. Each gets its own cycle.
- Improving the recognizer itself. This cycle measures; tuning comes after, informed by
  what the log shows.

## Success criteria

Judged after **~30 real catches**, not on day one.

| Measure | Bar | Why this bar |
| --- | --- | --- |
| Kept rate on cover-photo catches | **>= 70%** | The hard case. Below this the product is a chore rather than a reflex. |
| Wrong saves at `high` confidence | **0** | Trust is the asset. A confident wrong answer costs more than ten misses, because it makes the whole shelf suspect. |
| Time from right-click to saved | **< 6s** warm | Longer than that and it stops feeling like a capture tool. |

Missing the kept-rate bar means tuning, not abandoning. Missing the zero-wrong-at-high
bar means the confidence rule is wrong and must be tightened before anyone else uses it.

## Design

### 1. Evidence decides behavior

Confidence is currently computed inside `recognizeBook` and then discarded: the
background's `recognize()` returns bare `Book[]`. `groundText` likewise computes a match
score per candidate and throws it away. Both need to carry that evidence outward.

- `groundText` returns `GroundedBook[]` (`{ book, score }`) instead of `Book[]`.
- `recognizeBook` derives confidence from the top candidate's score.
- The background's `recognize()` returns the full `RecognitionResult`.

Rules, from strongest evidence to weakest:

| Evidence | Confidence |
| --- | --- |
| Retailer link resolved an ISBN | `high` |
| Vision guess, top candidate scores >= 2 | `high` |
| Vision guess, top candidate scores exactly 1 | `medium` |
| Post text only (no image evidence) | `medium` |
| No candidates | `low` |

"Score" is `groundText`'s existing match score: the number of words of four or more
characters shared between the query and the candidate's title plus author. No new
metric is introduced - the value is simply carried out instead of discarded.

Post text alone never reaches `high`. A tweet listing ten books can ground a line to a
real book that isn't the one being discussed, and that failure is invisible.

**Only the right-click flow changes.** The tweet button already shows the picker every
time, so confidence has nothing to alter there.

- Right-click + `high` -> save immediately, as today.
- Right-click + `medium` or `low` -> show the picker anchored to the image that was
  right-clicked, so the panel appears at the thing being pointed at.

Showing a picker from the right-click flow needs a new background -> content message
carrying the candidates and the source image URL. The content script already locates that
image by URL path for permalink resolution; the same lookup positions the panel.

If that lookup finds no matching image - the feed re-rendered, or the image was replaced
mid-flight - the panel anchors to the viewport's bottom-right instead of being dropped.
Losing a recognized book because its anchor moved would be the worst possible outcome of
a feature meant to stop books getting lost.

### 2. Recognition log

One record per attempt, appended locally:

```ts
interface RecognitionEvent {
  at: number;
  /** Wall-clock cost of the whole attempt. Without this the latency bar is unmeasurable. */
  ms: number;
  flow: 'button' | 'contextmenu';
  source: 'link' | 'vision' | 'text' | 'none';
  confidence: 'high' | 'medium' | 'low';
  guess?: { title: string; author: string };
  outcome: 'auto-saved' | 'confirmed' | 'dismissed' | 'no-match';
  savedId?: string;
  wrong?: boolean;
}
```

Constraints:

- **Local only.** Never transmitted. Clearable from the options page.
- **Bounded** to the most recent 200 events, as a ring buffer. An unbounded log in
  `chrome.storage.local` is a slow quota failure; the same unbounded-growth problem was
  already flagged against the shelf itself.
- **Serialized through the same write queue as the shelf.** Two unsynchronized
  read-modify-write paths against one storage area is the exact bug that lost saved books
  before.

`savedId` links an event to its `SavedBook`. When a book is removed **within 10 minutes**
of being saved, its event is marked `wrong: true`. Later removals are treated as changing
your mind, not as a bad match.

### 3. Stats

A single line in the popup masthead: `23 caught · 78% kept`.

Kept rate = saved events not marked wrong / saved events. Hidden below 5 events, because
a percentage of three is noise.

## Error handling

Unchanged in shape - each stage already reports its own failure rather than blaming OCR
for a network error. Additions:

- A failed recognition still writes an event (`outcome: 'no-match'`, `source: 'none'`), so
  the miss rate is visible rather than silently absent.
- A log write that fails must never block or fail a save. The shelf is the product; the
  log is diagnostics. Wrap it and swallow, with a `console.error`.

## Testing

Unit-testable, and therefore test-first:

- Confidence derivation from score and source, per row of the table above.
- Ring-buffer trimming at the 200 cap.
- The delete-to-`wrong` inference: inside the window marks wrong, outside does not.
- Kept-rate maths, including the below-5-events hidden case.

Not unit-tested, verified by hand: the new background -> content picker message, and the
panel anchoring to a right-clicked image. Both are chrome-glue, consistent with the
existing decision not to build a fake-chrome harness for a solo project.

## Dogfood protocol

1. Add a Gemini key in options.
2. Confirm one clear cover end to end before anything else. If this fails, stop and fix -
   the rest of the protocol is meaningless until it passes.
3. Use it on the real feed for a week, catching books normally.
4. Delete wrong matches as they appear, which is both the fix and the measurement.
5. Read the stats line at ~30 catches and compare against the bars above.

## What this unblocks

A measured recognizer makes the next cycle decidable: if quality holds, the keyless proxy
is worth building because other people can be given something that works. If it does not,
the log says which cases fail, and tuning is aimed rather than guessed.
