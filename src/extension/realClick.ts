/**
 * A click Buki will act on, and one it will not.
 *
 * **`grep -rc isTrusted src/` returned ZERO across the whole tree until 2026-08-25**, and
 * that is the finding: every button the catch tray draws lived in a page Buki does not
 * control, with no check that a person had pressed it.
 *
 * THE TRAY IS IN SOMEBODY ELSE'S DOM BY DESIGN. `ensureTray` → `background.ts` runs
 * `executeScript({ files: ['dist/content.js'] })` on ANY tab when the right-click menu is
 * used, which is catch-anywhere working exactly as intended. What follows from it is that
 * the host page can reach every element we inject and call `.click()` on it — spending one
 * of the user's ten free catches, sending page-chosen text and images to the model on our
 * key, and persisting a page-chosen URL as a book's cover, which the popup then fetches on
 * every open, for ever.
 *
 * `isTrusted` is the browser's own answer to "did a person do this". It is true only for an
 * event the user agent dispatched, false for anything script called, and it cannot be
 * forged from page script — the one property in the DOM that carries that guarantee.
 *
 * ONE SEAM, so there is one place to get it right. Every click binding in `content.ts` goes
 * through this, and `contentSafety.test.ts` proves the absence of any that does not:
 * a guard that can only be satisfied by there being no second way in.
 */

/**
 * Did a person do this?
 *
 * Compared to `true` rather than read as truthy. `isTrusted` is a boolean on a real Event;
 * anything else arriving here is a shape we did not expect, and on a path that spends money
 * the safe answer to an unexpected shape is no.
 */
export function fromRealUser(event: Event): boolean {
  return (event as { isTrusted?: unknown }).isTrusted === true;
}

/**
 * Run `handle` when a person clicks `el`, and never when a script does.
 *
 * `capture` is passed through because X delegates clicks from high up the tree, so a
 * bubble-phase listener on our own button can be pre-empted by their handler before it ever
 * runs. The Save button has always bound in the capture phase; losing that flag would not
 * throw, it would just make the button stop working on some posts and not others.
 */
export function onRealClick(
  el: EventTarget,
  handle: (event: Event) => void,
  capture = false,
): void {
  el.addEventListener(
    'click',
    (event) => {
      if (fromRealUser(event)) handle(event);
    },
    capture,
  );
}
