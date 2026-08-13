/**
 * The one feedback channel that survives a page no extension may touch.
 *
 * Two paths through the context-menu click end the catch before anything is on screen:
 * the user declines the origin prompt, or the tab is a chrome:// page or the Web Store,
 * where nothing can be injected. Both used to return silently, so the menu item did
 * nothing and said nothing. There is no tray to put a card in and no content script to
 * ask, and the toolbar button is the only surface left that Chrome still owns for us.
 */

/**
 * Minimal shape of `chrome.action` we depend on, so this tests without Chrome. Same
 * convention as `StorageArea` in `storage.ts` and `TrayDeps` in `ensureTray.ts`.
 *
 * `setBadgeTextColor` is Chrome 110+; the manifest already requires 116.
 */
export interface ToolbarApi {
  setBadgeText(v: { text: string; tabId?: number }): Promise<void>;
  setBadgeBackgroundColor(v: { color: string; tabId?: number }): Promise<void>;
  setBadgeTextColor(v: { color: string; tabId?: number }): Promise<void>;
  setTitle(v: { title: string; tabId?: number }): Promise<void>;
}

export interface ToolbarDeps {
  toolbar: ToolbarApi;
  /** `setTimeout`, injected so a test does not have to sit out the delay. */
  after(ms: number, run: () => void): void;
}

/** The manifest's `default_title`. Resting means back to this, not blank. */
export const RESTING_TITLE = 'Buki, your shelf';

/**
 * A badge holds about four characters, so the mark cannot carry the reason and does not
 * try. It draws the eye; the tooltip says what happened.
 */
export const STOPPED_MARK = '!';

/**
 * The mark is a book board at toolbar size, and the pair is measured rather than chosen.
 *
 * Cream on the coral cloth is 3.09:1 and unreadable, which is the same failure `brand.md`
 * records for a bright cloth and answers with a binding. Cream on oxblood is 14.2:1 and
 * clears the 10.9:1 floor every binding holds. This is the one place a dye carries a
 * status, and it earns that the way jade does: it appears nowhere else in that role.
 */
const BOARD = '#4A1414'; // oxblood, the binding that pairs with coral
const STAMP = '#FAF7F2'; // the same cream every generated cover is titled in

/**
 * Long enough to find a toolbar you were not looking at. The eye goes to the page first,
 * because that is where the right-click happened.
 */
export const STOPPED_MS = 6000;

/**
 * Say that this catch stopped, and why.
 *
 * Deliberately NOT called before `mayFetch` to clear a stale mark: the permission prompt
 * needs the click's user gesture and must be the first await in the handler. A mark left
 * behind by a torn-down worker is bounded instead by being scoped to its tab, so it dies
 * when that tab navigates or closes.
 */
export async function sayStopped(
  tabId: number | undefined,
  why: string,
  deps: ToolbarDeps,
): Promise<void> {
  // Spread rather than pass undefined: `{ tabId: undefined }` is not the same request as
  // omitting it, and the tests assert on the exact shape that reaches Chrome.
  const scope = tabId == null ? {} : { tabId };
  const { toolbar } = deps;

  await Promise.all([
    toolbar.setBadgeText({ text: STOPPED_MARK, ...scope }),
    toolbar.setBadgeBackgroundColor({ color: BOARD, ...scope }),
    toolbar.setBadgeTextColor({ color: STAMP, ...scope }),
    toolbar.setTitle({ title: why, ...scope }),
  ]);

  deps.after(STOPPED_MS, () => {
    void toolbar.setBadgeText({ text: '', ...scope });
    void toolbar.setTitle({ title: RESTING_TITLE, ...scope });
  });
}
