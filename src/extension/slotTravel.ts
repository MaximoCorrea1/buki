/**
 * The arithmetic behind the catch tray's FLIP animation.
 *
 * It lives here rather than in `content.ts` for one reason: that file registers
 * `chrome.runtime.onMessage` at module scope, so no test can import it. This is the same
 * split `ensureTray` and `mayFetch` were pulled out of `background.ts` for, and the tray's
 * reconciliation is exactly the kind of code that needs it - there is no DOM in the test
 * runner, so the geometry is the only part that can be held to account.
 */

/**
 * The vertical translation currently applied to an element, in pixels.
 *
 * `getComputedStyle().transform` always resolves to a matrix, never to the `translateY`
 * that was written, and it reports the value **mid-transition** - which is the point.
 * `getBoundingClientRect()` includes that offset, so a slot measured while it is still
 * travelling is not where the layout thinks it is.
 *
 * Anything unparseable is 0 rather than NaN: a NaN shift would poison every later
 * measurement silently and send the element to an invalid transform, where zero simply
 * degrades to the behaviour this replaced.
 */
export function shiftOf(transform: string): number {
  if (!transform || transform === 'none') return 0;

  const values = transform
    .slice(transform.indexOf('(') + 1, transform.lastIndexOf(')'))
    .split(',')
    .map((n) => Number(n.trim()));

  // matrix(a, b, c, d, tx, ty) puts ty sixth; matrix3d puts it fourteenth. Reading the
  // sixth value out of a matrix3d would return part of the rotation instead.
  const ty = transform.startsWith('matrix3d') ? values[13] : values.length === 6 ? values[5] : undefined;

  return typeof ty === 'number' && Number.isFinite(ty) ? ty : 0;
}

/**
 * The transform to apply so a slot appears to CONTINUE from where it is, rather than
 * jumping, when the column reflows underneath it.
 *
 * `beforeTop` and `afterTop` are both `getBoundingClientRect().top`, so both already carry
 * `shift`. The layout home after the mutation is therefore `afterTop - shift`, and the
 * slot is visually at `beforeTop`. To leave it exactly where the eye last saw it:
 *
 *     (afterTop - shift) + travel = beforeTop
 *     travel = beforeTop - afterTop + shift
 *
 * **The `+ shift` is the fix.** Without it the slot snaps by the whole remaining travel
 * the instant a second reflow arrives, which is how one catch card landed on another. The
 * jump is invisible in the code because `transition: none` makes it instantaneous and the
 * following frame animates smoothly away from the wrong place.
 */
export function travelFrom(beforeTop: number, afterTop: number, shift: number): number {
  return beforeTop - afterTop + shift;
}
