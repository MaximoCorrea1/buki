import { describe, it, expect } from 'vitest';
import { shiftOf, travelFrom } from './slotTravel';

/**
 * The arithmetic behind the catch tray's FLIP animation, pulled out of `content.ts` so it
 * can be tested at all: that file registers `chrome.runtime.onMessage` at module scope and
 * cannot be imported, the same reason `ensureTray` and `mayFetch` were lifted out of
 * `background.ts`.
 *
 * THE BUG THIS EXISTS FOR. Reported 2026-08-16: "i just saw a toast overlap a previous
 * one." `reflow()` measures each slot with `getBoundingClientRect()`, which INCLUDES any
 * transform currently applied - including one still animating from a previous reflow. It
 * then set `transition: none` and wrote a fresh `translateY`, which discards the in-flight
 * offset and SNAPS the element by exactly that amount.
 *
 * It is not a rare race. It is the normal path:
 *
 *   TRAVEL_MS = 280   a reflow's transition runs this long
 *   SWAP_MS   = 115   swapCard fires a reflow INSIDE that window
 *   LEAVE_MS  = 200   a card leaving fires another one, also inside it
 *
 * So any second catch arriving while the first is still settling re-enters `reflow`, and
 * the jump is the size of the remaining travel. A card that becomes a book doubles in
 * height, so that is over a hundred pixels: far enough to land on its neighbour.
 */

describe('shiftOf', () => {
  it('reads the vertical translation out of a 2D matrix', () => {
    // getComputedStyle always resolves `translateY(-42px)` to a matrix.
    expect(shiftOf('matrix(1, 0, 0, 1, 0, -42)')).toBe(-42);
    expect(shiftOf('matrix(1, 0, 0, 1, 0, 17.5)')).toBe(17.5);
  });

  it('reads it out of a 3D matrix, where it is the fourteenth value', () => {
    // A compositor-promoted element reports matrix3d. Taking index 5 here, as the 2D
    // shape does, would read part of the rotation and produce nonsense.
    const m3d = 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -88, 0, 1)';
    expect(shiftOf(m3d)).toBe(-88);
  });

  it('is zero when nothing is applied, which is most of the time', () => {
    expect(shiftOf('none')).toBe(0);
    expect(shiftOf('')).toBe(0);
  });

  it('is zero rather than NaN when handed something it cannot parse', () => {
    // A shift that comes back NaN would poison every later measurement silently, and the
    // element would vanish to an invalid transform. Zero degrades to the old behaviour.
    expect(shiftOf('perspective(400px)')).toBe(0);
    expect(shiftOf('matrix(1, 0, 0, 1, 0)')).toBe(0);
  });
});

describe('travelFrom', () => {
  it('is zero when the slot did not move', () => {
    expect(travelFrom(100, 100, 0)).toBe(0);
  });

  it('starts the slot where it used to be, so it travels rather than teleports', () => {
    // Layout moved it 30px down. It must begin 30px UP from its new home and animate to 0.
    expect(travelFrom(100, 130, 0)).toBe(-30);
  });

  it('carries an in-flight travel across the interruption, which is the whole fix', () => {
    // A slot is mid-travel, 20px above its layout home, when a second catch reflows the
    // column and moves that home 30px further down.
    //
    //   visual before = layoutOld - 20        (the rect includes the transform)
    //   visual after  = layoutOld + 30 - 20   (same transform, new layout)
    //
    // The old arithmetic was `before - after` = -30, which puts the slot at its layout
    // home + (-30) = layoutOld: a 20px JUMP from where it visually was. The remaining
    // travel has to be added back, so it continues from exactly where the eye left it.
    expect(travelFrom(80, 110, -20)).toBe(-50);
  });

  it('carries a large interruption, which is the one that overlaps a neighbour', () => {
    // A card that became a book was 180px into a travel when the next catch arrived.
    // Without the shift the slot snaps 180px and lands on top of the card below it.
    const withShift = travelFrom(500, 500, -180);
    const oldArithmetic = 500 - 500;
    expect(withShift).toBe(-180);
    expect(withShift - oldArithmetic).toBe(-180);
  });
});
