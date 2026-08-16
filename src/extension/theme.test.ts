import { describe, it, expect } from 'vitest';
import { resolveTheme, THEME_KEY } from './theme';
import popup from '../../popup.html?raw';
import options from '../../options.html?raw';
import popupSource from './popup.ts?raw';
import optionsSource from './options.ts?raw';

/**
 * The extension's mood, and where its wiring is allowed to live.
 *
 * `docs/brand.md` records the landing shipping a theme button that RENDERED, FOCUSED AND
 * DID NOTHING for two days, because its click handler was attached inside the motion IIFE,
 * which opens `if (still || !("IntersectionObserver" in window)) return;`. Nothing about
 * choosing a colour scheme depends on wanting animation. The two only shared a function
 * because they shared a <script>.
 *
 * The same shape is available here and is worse, because it is likelier: `options.ts`'s
 * `main()` opens with `if (!key || !endpoint || !model || !status || !form || !reset ||
 * !store) return;`. A toggle wired after that line would be dead on any future options
 * page that drops one field. So the toggle's wiring lives in `theme.ts` with the thing it
 * toggles, and this file fails the build if it moves back.
 */

describe('resolveTheme', () => {
  it('prefers a stored choice over the operating system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the operating system when nothing has been chosen', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('treats a damaged stored value as no choice at all', () => {
    // localStorage is a string store shared with anything else on this origin, so the
    // value read back is not guaranteed to be one this module wrote.
    for (const junk of ['', 'Dark', 'true', '{}', 'sepia']) {
      expect(resolveTheme(junk, true), `${junk} with a dark OS`).toBe('dark');
      expect(resolveTheme(junk, false), `${junk} with a light OS`).toBe('light');
    }
  });
});

describe('where the mood is decided', () => {
  const SURFACES: Record<string, string> = { 'popup.html': popup, 'options.html': options };

  for (const [name, body] of Object.entries(SURFACES)) {
    it(`${name} settles the mood in the head, before anything paints`, () => {
      const tag = '<script src="dist/theme.js"></script>';
      expect(body, `${name} must load the theme script`).toContain(tag);
      // In the HEAD, and therefore render-blocking. Deferred, it would paint one mood and
      // swap to the other, which is the flash every theme toggle ships with. It cannot be
      // an inline script: MV3's default extension CSP is script-src 'self', which blocks
      // one outright, so an external file in the head is the only way to be synchronous.
      expect(
        body.indexOf(tag),
        `${name}: theme.js must be inside <head>`,
      ).toBeLessThan(body.indexOf('</head>'));
    });
  }

  it('keeps the toggle out of popup.ts and options.ts, where a guard could bury it', () => {
    // The landing's failure, exactly: a control whose wiring sat behind an early return
    // that had nothing to do with it. options.ts main() returns early on a missing field.
    for (const [name, source] of Object.entries({
      'popup.ts': popupSource,
      'options.ts': optionsSource,
    })) {
      expect(source, `${name} must not reach for the theme control`).not.toContain(THEME_KEY);
      expect(source, `${name} must not reach for the theme control`).not.toMatch(
        /getElementById\(\s*['"]theme['"]\s*\)/,
      );
    }
  });
});
