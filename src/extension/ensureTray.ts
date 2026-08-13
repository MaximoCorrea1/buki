import type { ContentRequest } from './messages';

/**
 * The two things putting a tray on a tab needs from Chrome, injected rather than reached
 * for, so this can be tested without one. Same reason `storage.ts` takes a `StorageArea`
 * and `trial.ts` takes `deps.storage`: the riskiest behaviour in catch-anywhere is the
 * part a unit test could not see, and that is precisely the part worth covering.
 */
export interface TrayDeps {
  /**
   * Ask this tab something. Resolves undefined when nothing answered, which is the normal
   * negative here: `tellTab` swallows the "no receiving end" error rather than throwing.
   */
  tell(tabId: number, msg: ContentRequest): Promise<unknown>;
  /** Put the content script on the tab. Throws where no extension may inject. */
  inject(tabId: number): Promise<unknown>;
}

/**
 * Put a tray on this tab, wherever it is.
 *
 * A context-menu click is a user gesture, and a user gesture grants `activeTab`, which is
 * exactly enough to inject here without asking for host access at install. Returns false
 * when there is nowhere to inject, which is the normal answer on a chrome:// page or the
 * Web Store: those tabs are closed to every extension and the catch simply does not start.
 */
export async function ensureTray(tabId: number | undefined, deps: TrayDeps): Promise<boolean> {
  if (tabId == null) return false;
  // Cheapest possible probe. X already has a tray from the manifest, and injecting a
  // second one would leave that tab with two listeners answering the same messages.
  const alive = await deps.tell(tabId, { type: 'ping' });
  if (alive) return true;
  try {
    await deps.inject(tabId);
    return true;
  } catch (err) {
    console.error('[Buki] could not put a tray on this page', err);
    return false;
  }
}
