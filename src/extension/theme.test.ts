import { describe, it, expect, vi } from 'vitest';
import { resolveTheme, rememberTheme, start, THEME_KEY } from './theme';
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

/**
 * THE TRAY CANNOT SEE localStorage, and that is not a bug in the tray.
 *
 * `popup.html` and `options.html` are extension-origin pages, so they share one
 * `localStorage`. The catch tray is a content script: its `localStorage` belongs to x.com,
 * or to whatever page it landed on. Reading the mood from there would hand Buki whatever
 * the HOST SITE happened to store under the same key, which is a stranger's data deciding
 * our colours.
 *
 * So the choice is MIRRORED into `chrome.storage.local`, which every extension context
 * shares. localStorage stays authoritative for the pages, because it is synchronous and
 * `theme.ts` exists to settle the mood before first paint - `chrome.storage` is async and
 * would reintroduce exactly the flash this module was written to remove.
 *
 * Two stores, one direction, and the mirror is written only when somebody CHOOSES.
 */
describe('rememberTheme', () => {
  it('writes the choice where the extension pages read it', () => {
    const store: Record<string, string> = {};
    const local = { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) };

    rememberTheme('dark', {
      setLocal: (k, v) => {
        store[k] = v;
      },
      area: local,
    });

    expect(store[THEME_KEY]).toBe('dark');
  });

  it('ALSO mirrors it where the tray reads it', () => {
    // The whole point. Without this the tray has no way to know the mood at all.
    const local = { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) };

    rememberTheme('light', { setLocal: () => {}, area: local });

    expect(local.set).toHaveBeenCalledWith({ [THEME_KEY]: 'light' });
  });

  it('still writes the page store when the mirror is unavailable', () => {
    // A content script is not the only context without chrome.storage: a test, a harness,
    // and a page whose extension APIs were torn down mid-unload all hit this. Losing the
    // mirror must never cost the user the choice they just made.
    const store: Record<string, string> = {};

    rememberTheme('dark', {
      setLocal: (k, v) => {
        store[k] = v;
      },
      area: undefined,
    });

    expect(store[THEME_KEY]).toBe('dark');
  });

  it('survives a page store that refuses to write', () => {
    // Storage disabled on the origin throws rather than returning. The mirror must still
    // be attempted: the two stores fail independently.
    const local = { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) };

    expect(() =>
      rememberTheme('dark', {
        setLocal: () => {
          throw new Error('storage disabled');
        },
        area: local,
      }),
    ).not.toThrow();

    expect(local.set).toHaveBeenCalledWith({ [THEME_KEY]: 'dark' });
  });
});

describe('start, the live path', () => {
  /**
   * `theme.ts:106` SAYS THIS IS WHY `start` IS EXPORTED — *"Exported and taking its document
   * so the live path is reachable from a test, and so the module has no side effect at
   * import."* **No test ever called it.**
   *
   * The review's mutation deleted the click handler and the suite stayed 620/620 green. The
   * consequence is the exact failure `docs/brand.md` records costing two days on the
   * landing: **a theme button that renders, focuses, and does nothing.** The module was
   * restructured, given its own bundle entry and a docblock about that very incident, and
   * the assertion that would have caught it was never written.
   *
   * There is no DOM in this suite, so the document is a small fake — which is precisely what
   * `start(doc)` taking its document was FOR. The control flow under test is real: the
   * listener registration, the DOMContentLoaded pass, the flip, and the write.
   */
  interface FakeButton {
    attrs: Record<string, string>;
    clicks: (() => void)[];
    setAttribute(name: string, value: string): void;
    addEventListener(type: string, run: () => void): void;
  }

  const fakeDoc = (withButton = true) => {
    const root: Record<string, string> = {};
    const button: FakeButton = {
      attrs: {},
      clicks: [],
      setAttribute(name, value) {
        this.attrs[name] = value;
      },
      addEventListener(type, run) {
        if (type === 'click') this.clicks.push(run);
      },
    };
    const ready: (() => void)[] = [];
    const doc = {
      documentElement: {
        setAttribute: (name: string, value: string) => void (root[name] = value),
        getAttribute: (name: string) => root[name] ?? null,
      },
      getElementById: (id: string) => (withButton && id === 'theme' ? button : null),
      addEventListener: (type: string, run: () => void) => {
        if (type === 'DOMContentLoaded') ready.push(run);
      },
    } as unknown as Document;
    return { doc, root, button, load: () => ready.forEach((r) => r()) };
  };

  it('settles the mood before the page is ready, which is the whole reason it exists', () => {
    // Before DOMContentLoaded. A theme decided after first paint is the flash this module
    // was made a separate entry point to remove.
    const { doc, root } = fakeDoc();
    start(doc);
    expect(root['data-theme']).toMatch(/^(light|dark)$/);
  });

  it('WIRES THE BUTTON, and pressing it flips the mood', () => {
    // THE MUTATION. Deleting the click handler leaves everything above still passing.
    const { doc, root, button, load } = fakeDoc();
    start(doc);
    load();

    expect(button.clicks.length, 'the theme button has no click handler').toBe(1);

    const before = root['data-theme'];
    button.clicks[0]!();
    expect(root['data-theme'], 'pressing the theme button did nothing').not.toBe(before);

    button.clicks[0]!();
    expect(root['data-theme'], 'the second press did not come back').toBe(before);
  });

  it('labels the button by what pressing it will DO, not by what is showing', () => {
    // The convention a screen reader needs in order to decide whether to press it.
    const { doc, root, button, load } = fakeDoc();
    start(doc);
    load();

    const expected = (): string =>
      root['data-theme'] === 'dark' ? 'Switch to light' : 'Switch to dark';
    expect(button.attrs['aria-label']).toBe(expected());

    button.clicks[0]!();
    expect(button.attrs['aria-label']).toBe(expected());
  });

  it('does not throw on a page with no theme button', () => {
    // `privacy.html` has none, and neither does a torn-down page.
    const { doc, load } = fakeDoc(false);
    expect(() => {
      start(doc);
      load();
    }).not.toThrow();
  });
});
