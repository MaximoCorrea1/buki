import { describe, it, expect } from 'vitest';
import { fromRealUser, onRealClick } from './realClick';

/**
 * A click Buki will act on, and one it will not.
 *
 * `grep -rc isTrusted src/` returned ZERO across the whole tree until 2026-08-25. The tray
 * is injected into pages Buki does not control — `background.ts` runs
 * `executeScript({files:['dist/content.js']})` on ANY tab on a context-menu click, which is
 * the catch-anywhere flow working as designed — and once it is there, every button it draws
 * sits in the host page's DOM where `element.click()` reaches it.
 *
 * `isTrusted` is the browser's own answer to "did a person do this": true only for an event
 * the user agent dispatched, and false for anything script called. It cannot be forged from
 * page script. It is therefore the whole defence against the synthetic-drive class, and one
 * `if` at one seam is the whole implementation.
 *
 * These are REAL events on a REAL EventTarget, both of which Node has. Nothing is mocked,
 * so what passes here is what the browser does.
 */

/** What the browser produces when a page calls `.click()`. */
const synthetic = (): Event => new Event('click');

/** What the browser produces when a person presses the button. */
const real = (): Event => {
  const event = new Event('click');
  // The only lie in this file, and it lies in the direction the browser does for a person.
  Object.defineProperty(event, 'isTrusted', { value: true });
  return event;
};

describe('fromRealUser', () => {
  it('rejects the event a page dispatches at us', () => {
    expect(fromRealUser(synthetic())).toBe(false);
  });

  it('accepts the event the browser dispatches for a person', () => {
    expect(fromRealUser(real())).toBe(true);
  });

  it('rejects an object that merely claims to be truthy', () => {
    // `isTrusted` is a boolean on a real Event. Anything else reaching this is a shape we
    // did not expect, and the safe answer to an unexpected shape on a spend path is no.
    expect(fromRealUser({ isTrusted: 1 } as unknown as Event)).toBe(false);
    expect(fromRealUser({ isTrusted: 'yes' } as unknown as Event)).toBe(false);
    expect(fromRealUser({} as unknown as Event)).toBe(false);
  });
});

describe('onRealClick', () => {
  it('does not run when the page presses the button itself', () => {
    // The attack, in three lines. A forged article, a Save button Buki injected into it,
    // and `button.click()` from the page's own script. That used to spend one of the
    // user's ten free catches and persist an attacker-chosen URL as a book's cover.
    const button = new EventTarget();
    let ran = 0;
    onRealClick(button, () => ran++);

    button.dispatchEvent(synthetic());

    expect(ran, 'a synthetic click drove the tray').toBe(0);
  });

  it('runs when a person presses the button', () => {
    const button = new EventTarget();
    let ran = 0;
    onRealClick(button, () => ran++);

    button.dispatchEvent(real());

    expect(ran).toBe(1);
  });

  it('hands the handler the event, so a caller can still stop it', () => {
    const button = new EventTarget();
    let seen: Event | null = null;
    onRealClick(button, (event) => {
      seen = event;
    });

    const event = real();
    button.dispatchEvent(event);

    expect(seen).toBe(event);
  });

  it('listens for a click and nothing else', () => {
    const button = new EventTarget();
    let ran = 0;
    onRealClick(button, () => ran++);

    const other = new Event('mousedown');
    Object.defineProperty(other, 'isTrusted', { value: true });
    button.dispatchEvent(other);

    expect(ran).toBe(0);
  });
});

describe('onRealClick and the capture phase', () => {
  /**
   * X DELEGATES CLICKS FROM HIGH UP THE TREE, so a bubble-phase listener on our own button
   * can be pre-empted by their handler before it ever runs. The Save button has always
   * bound in the capture phase for that reason, and losing the flag would not throw — the
   * button would simply stop working on some posts and not others.
   *
   * This asserts the flag is FORWARDED rather than the phase ordering, and that is a real
   * limit worth naming: there is no DOM in this suite, and a bare `EventTarget` has no tree
   * for a phase to be observable in. What is checked is the one thing that can silently
   * regress — the argument going missing. The trust decision itself is checked above,
   * against real events.
   */
  const recording = (): { calls: unknown[][]; target: EventTarget } => {
    const calls: unknown[][] = [];
    const target = {
      addEventListener: (type: string, handle: unknown, options?: unknown) =>
        calls.push([type, options]),
    } as unknown as EventTarget;
    return { calls, target };
  };

  it('binds in the bubble phase by default', () => {
    const { calls, target } = recording();
    onRealClick(target, () => {});
    expect(calls).toEqual([['click', false]]);
  });

  it('binds in the capture phase when asked', () => {
    const { calls, target } = recording();
    onRealClick(target, () => {}, true);
    expect(calls).toEqual([['click', true]]);
  });

  it('still refuses a synthetic click in the capture phase', () => {
    const button = new EventTarget();
    let ran = 0;
    onRealClick(button, () => ran++, true);
    button.dispatchEvent(new Event('click'));
    expect(ran).toBe(0);
  });
});
