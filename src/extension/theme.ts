/**
 * The extension's mood, and its switch.
 *
 * This is its own entry point rather than a few lines inside `popup.ts`, for two reasons
 * and both of them are recorded failures.
 *
 * IT HAS TO RUN BEFORE THE FIRST PAINT. `popup.js` and `options.js` load at the end of
 * <body>. Deciding the mood there paints one and swaps to the other, which is the flash
 * every theme toggle ships with unless it is settled in the head. It also cannot be an
 * inline <script>: MV3's default extension CSP is `script-src 'self'`, so an inline block
 * is not merely discouraged here, it is blocked and would never run at all. An external
 * file in <head> is the only way to be synchronous on this platform.
 *
 * THE TOGGLE'S WIRING LIVES WITH THE THING IT TOGGLES. `docs/brand.md` records the landing
 * shipping a theme button that rendered, focused and did nothing for two days, because its
 * handler was attached inside an IIFE that returns early on `prefers-reduced-motion`.
 * Nothing about choosing a colour scheme depends on wanting animation; the two only shared
 * a function because they shared a <script>. The same shape is available here and is
 * likelier: `options.ts`'s `main()` opens by returning if any one form field is missing.
 * `theme.test.ts` fails the build if the toggle turns up in either of those files.
 *
 * The preference is shared: `popup.html` and `options.html` are both extension-origin
 * pages, so they see one `localStorage`.
 *
 * THE TRAY NOW FOLLOWS IT TOO, as of 2026-08-24, on Maximo's call. This paragraph used to
 * say the tray "does not read this and must not", on the grounds in `docs/brand.md` that it
 * owns its ground in every mood. That reasoning was written when the tray had ONE mood, and
 * what it actually argues is that the card must stay opaque and carry its own ring and
 * shadow - which is still true, and is still true twice, once per mood. A card that lands
 * on a white page in light mode needs exactly the separation a dark card on a black page
 * already needed.
 *
 * IT CANNOT READ localStorage TO DO IT. A content script's `localStorage` belongs to the
 * page it landed on, so reading the mood there hands Buki whatever x.com happens to store
 * under our key. The choice is mirrored into `chrome.storage.local`, which every extension
 * context shares. localStorage stays authoritative for the pages, because it is synchronous
 * and this module exists to settle the mood before first paint; `chrome.storage` is async
 * and would put back the flash. Two stores, one direction, mirror written only on a choice.
 */

/**
 * THE PURE HALF LIVES IN `themeChoice.ts`, and that split is not tidiness.
 *
 * This file writes to `document.documentElement` at import, on purpose, because settling
 * the mood before first paint is the whole reason it is a separate entry point. That makes
 * it unsafe for the CONTENT SCRIPT to import: there, `document` is the host page's, and
 * Buki would set `data-theme` on x.com's own root. So the decision, the key and the writer
 * moved next door where anything can import them, and `contentChrome.test.ts` fails the
 * build if the tray reaches for this file again.
 *
 * Re-exported so the extension pages keep one import.
 */
export { resolveTheme, rememberTheme, THEME_KEY } from './themeChoice';
export type { Theme, ThemeStores } from './themeChoice';

import { resolveTheme, rememberTheme, THEME_KEY, type Theme } from './themeChoice';

/**
 * The extension pages' own store. Not shared with the tray, which is the entire reason
 * `themeChoice.ts` exists: a content script's `localStorage` belongs to the host page.
 */
function readStored(): string | null {
  // localStorage throws rather than returning null when the origin has storage disabled.
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

/**
 * Written only when the reader CHOOSES, never on load. Storing it on load would freeze
 * their operating system's preference the first time they opened the popup, so a machine
 * that switched to dark at sunset would keep serving them daylight forever.
 */
function remember(theme: Theme): void {
  rememberTheme(theme, {
    setLocal: (k, v) => localStorage.setItem(k, v),
    area: typeof chrome !== 'undefined' ? chrome.storage?.local : undefined,
  });
}

function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Writes the mood, always, even when it came from the operating system, so the CSS only
 * ever has to answer one question instead of two.
 *
 * The button's label says what pressing it will DO, not what is currently showing, because
 * that is the thing someone using a screen reader needs in order to decide whether to
 * press it. The icon follows the same convention: a moon while it is day.
 */
export function applyTheme(doc: Document, theme: Theme): void {
  doc.documentElement.setAttribute('data-theme', theme);
  const button = doc.getElementById('theme');
  if (button) {
    button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light' : 'Switch to dark');
  }
}

/**
 * Settle the mood now, and wire the switch once the button exists.
 *
 * Exported and taking its document so the live path is reachable from a test, and so the
 * module has no side effect at import. `background.ts` is the cautionary tale: it registers
 * its listeners at module scope, which means no test can import it at all, and `ensureTray`
 * and `mayFetch` had to be lifted out of it before either could be covered.
 */
export function start(doc: Document): void {
  applyTheme(doc, resolveTheme(readStored(), prefersDark()));

  doc.addEventListener('DOMContentLoaded', () => {
    const button = doc.getElementById('theme');
    if (!button) return;
    // Re-applied now the button exists, so it starts with the right label.
    const current: Theme = doc.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(doc, current);

    button.addEventListener('click', () => {
      const next: Theme =
        doc.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(doc, next);
      remember(next);
    });
  });
}

// The live call, guarded so the module stays importable in node with no DOM.
if (typeof document !== 'undefined') start(document);
