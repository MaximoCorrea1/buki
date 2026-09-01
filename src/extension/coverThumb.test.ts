import { describe, it, expect } from 'vitest';
import { thumbPlan } from './coverThumb';

const CATALOGUE = 'https://covers.openlibrary.org/b/id/8231856-M.jpg';
const PHOTO = 'https://pbs.twimg.com/media/abc123.jpg';

describe('thumbPlan', () => {
  it('shows the photograph in the same paint as the book', () => {
    // THE WHOLE POINT, and it is a measured one. The catalogue cover is a 302 into a 302
    // into an archive.org node that extracts the JPEG from a ZIP: median 2,140ms on
    // 2026-09-01, and the repeat is not faster. Nothing makes that arrive with the card.
    // The photograph is already decoded in the host page, so it costs zero and lands now.
    const plan = thumbPlan({ coverUrl: CATALOGUE }, PHOTO, 1, 1);

    expect(plan.instant).toBe(PHOTO);
  });

  it('upgrades to the catalogue cover, which is what the shelf keeps', () => {
    const plan = thumbPlan({ coverUrl: CATALOGUE }, PHOTO, 1, 1);

    expect(plan.upgrade).toBe(CATALOGUE);
  });

  it('refuses the photograph when the post held several pictures', () => {
    // C-9's surviving half. `content.ts` opens the card with imageUrls[0] whatever the post
    // holds, and a VisionGuess carries no image index, so a four-picture post yielding one
    // book would show picture one even when the book was read from picture three. A cover
    // showing the wrong book is the exact lie this product exists not to tell.
    const plan = thumbPlan({ coverUrl: CATALOGUE }, PHOTO, 1, 4);

    expect(plan.instant).toBeUndefined();
    expect(plan.upgrade).toBe(CATALOGUE);
  });

  it('keeps the photograph when the catalogue has no art at all', () => {
    // The founder's rule, 2026-08-27 and again 2026-09-01: no cover book, use the original
    // image. This is the case that currently renders as a flat colour.
    const plan = thumbPlan({}, PHOTO, 1, 1);

    expect(plan.instant).toBe(PHOTO);
    expect(plan.upgrade).toBeUndefined();
  });

  it('plans nothing when there is neither, so the caller draws a board', () => {
    const plan = thumbPlan({}, undefined, 1, 1);

    expect(plan.instant).toBeUndefined();
    expect(plan.upgrade).toBeUndefined();
  });

  it('does NOT repeat one photograph across several books from the same picture', () => {
    // The tray already gives every book a DISTINCT cloth colour. Three books from one
    // photograph wearing three IDENTICAL thumbnails is less legible than three different
    // colours - it is item 60's complaint arriving two seconds earlier, and in the one
    // moment the reader is deciding which of the three to keep.
    //
    // So the instant frame is for the case it actually helps: one book out of one picture,
    // which is what a photograph of a cover is. This is deliberately STRICTER than
    // `shotFor`, and the two answer different questions - see the module docblock.
    expect(thumbPlan({}, PHOTO, 3, 1).instant).toBeUndefined();
  });

  it('still upgrades every book of a multi-book catch to its own catalogue art', () => {
    // The distinct part must survive the rule above: refusing the shared photograph must
    // not also refuse the covers, which are what makes the three rows tell apart.
    expect(thumbPlan({ coverUrl: CATALOGUE }, PHOTO, 3, 1).upgrade).toBe(CATALOGUE);
  });

  it('refuses a url that is not http, the same rule coverSources applies', () => {
    // One place decides what a usable picture is. Two places is how they come to disagree.
    expect(thumbPlan({ coverUrl: 'javascript:alert(1)' }, 'data:image/png;base64,AAAA', 1, 1)).toEqual({});
  });

  it('omits the keys rather than setting them undefined', () => {
    // exactOptionalPropertyTypes is on, and this shape crosses no wire — but the repo has
    // already paid for `undefined` surviving as a PRESENT key once, when an activationId
    // vanished from a signed claim and spent a permanent slot per renewal.
    expect(Object.keys(thumbPlan({}, undefined, 1, 1))).toEqual([]);
  });
});
