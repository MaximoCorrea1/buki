/**
 * The mood, as a DECISION. No DOM, no storage, no side effect at import.
 *
 * WHY THIS IS ITS OWN FILE, and it is a bug caught in the build on 2026-08-24.
 *
 * `theme.ts` ends with `if (typeof document !== 'undefined') start(document);`, and
 * `start` sets `data-theme` on `document.documentElement`. In `popup.html` that line is
 * the entire point: it settles the mood before first paint, which is the flash the module
 * exists to remove.
 *
 * Then the catch tray needed the same decision, and the obvious import was `./theme`.
 * **In a content script `document` is the HOST PAGE'S document.** Importing it put
 * `data-theme` on x.com's own root element, which on any site using that very common
 * convention flips the whole site's theme merely because Buki is installed. It also read
 * the host's `localStorage` under our key, so a page could have chosen our colours.
 *
 * `tsc` was happy. The bundler was happy. The only evidence was `setAttribute("data-theme")`
 * turning up in `dist/content.js`. `src/extension/contentChrome.test.ts` now fails the
 * build if the entry point is imported back into the content script.
 *
 * The general shape is already recorded: `theme.ts`'s own header calls `background.ts` the
 * cautionary tale for module-scope side effects. It was true of `theme.ts` too, and the
 * file naming the lesson was the file that had not applied it.
 */

export type Theme = 'light' | 'dark';

/** Shared with the landing's own key by name, but a different origin and a different store. */
export const THEME_KEY = 'buki-theme';

/**
 * Pure, so the decision can be tested without a browser.
 *
 * `stored` is whatever the store handed back, which is a string store shared with anything
 * else on that origin: the value is not guaranteed to be one this module wrote. Anything
 * that is not exactly a mood is treated as no choice, never as a default.
 */
export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

/** The two places a choice has to land, injected so both failure paths are reachable. */
export interface ThemeStores {
  setLocal: (key: string, value: string) => void;
  /** Absent wherever `chrome.storage` is not: a harness, a test, a torn-down page. */
  area: { set: (items: Record<string, string>) => Promise<void> } | undefined;
}

/**
 * Write the choice to both stores, independently.
 *
 * TWO STORES BECAUSE THE TRAY CANNOT READ THE FIRST ONE. `popup.html` and `options.html`
 * are extension-origin pages and share one `localStorage`; a content script's belongs to
 * the page it landed on. `chrome.storage.local` is the one every extension context sees.
 * localStorage stays authoritative for the pages, because it is synchronous and the mood
 * has to be settled before first paint - `chrome.storage` is async and would put the flash
 * back.
 *
 * THE TWO WRITES MUST NOT SHARE A try. The page store throws outright when the origin has
 * storage disabled, and if that took the mirror down with it, the tray would keep the old
 * mood for a user whose browser is merely strict about localStorage. They fail for
 * unrelated reasons, so they get unrelated guards.
 */
export function rememberTheme(theme: Theme, stores: ThemeStores): void {
  try {
    stores.setLocal(THEME_KEY, theme);
  } catch {
    // Storage refused. The choice still applies to this window; the OS decides next time.
  }
  try {
    // Fire and forget: nothing on this page waits for the tray to learn the mood.
    void stores.area?.set({ [THEME_KEY]: theme });
  } catch {
    // No extension APIs in this context. The pages still have their answer.
  }
}
