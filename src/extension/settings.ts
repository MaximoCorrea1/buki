import { GEMINI } from '../recognizer/llmVision';
import type { Store } from './buyLink';

/** Stored under `visionSettings`. The key predates the store preference and must not move. */
const KEY = 'visionSettings';

export interface Settings {
  /** Empty until the user adds one. A proxy build can ship a blank key and its own endpoint. */
  apiKey: string;
  endpoint: string;
  model: string;
  /** Which shop the buy link points at. Amazon by default: it ships nearly everywhere. */
  store: Store;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  endpoint: GEMINI.endpoint,
  model: GEMINI.model,
  store: 'amazon',
};

const STORES: readonly string[] = ['amazon', 'bookshop'];

/**
 * Settings, read defensively out of whatever storage holds.
 *
 * TS-1. `OPENWORK.md` item 53. This used to be a SPREAD OVER THE DEFAULTS:
 *
 *     { ...DEFAULT_SETTINGS, ...(raw as Partial<Settings>) }
 *
 * **A spread fills in MISSING keys and accepts any value for a PRESENT one.** So
 * `{ apiKey: 42 }` in a user-editable store produced settings whose `apiKey` is a number,
 * and the review named exactly where that lands: **`settings.apiKey.trim()` is called on the
 * money path**, and `.trim` is not a function on 42. This was the only one of three storage
 * readers that did not check field by field.
 *
 * **PER FIELD, not per record.** A junk `store` should not also cost you your endpoint, and
 * taking everything back to default over one bad key hides which key was bad.
 *
 * Exported as a pure function of the raw value so it can be tested: the `chrome.storage`
 * call is the part that needs a browser, and the decision is the part that does not.
 */
export function readSettingsFrom(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return DEFAULT_SETTINGS;
  const got = raw as Record<string, unknown>;

  const str = (key: keyof Settings, allowEmpty = false): string => {
    const v = got[key];
    if (typeof v !== 'string') return DEFAULT_SETTINGS[key] as string;
    return allowEmpty || v !== '' ? v : (DEFAULT_SETTINGS[key] as string);
  };

  // BLANK IS A REAL VALUE for the key and only for the key: it is what a hosted proxy build
  // ships, and treating it as missing would put our own default endpoint's key back.
  const apiKey = str('apiKey', true);
  const endpoint = str('endpoint');
  const model = str('model');
  const store = got['store'];

  return {
    apiKey,
    // HTTPS ONLY. This is where the key gets SENT, and a `javascript:` or plain-http
    // endpoint sitting in a user-editable store is a credential pointed somewhere it was
    // never meant to go.
    endpoint: /^https:\/\//i.test(endpoint) ? endpoint : DEFAULT_SETTINGS.endpoint,
    model,
    store: (typeof store === 'string' && STORES.includes(store)
      ? store
      : DEFAULT_SETTINGS.store) as Store,
  };
}

export async function readSettings(): Promise<Settings> {
  const got = await chrome.storage.local.get(KEY);
  return readSettingsFrom(got[KEY]);
}

export async function writeSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}

/**
 * ⚠ `toVisionConfig` USED TO LIVE HERE and was deleted on 2026-08-28. `OPENWORK.md` item 54,
 * X-3: `background.ts` imported it and **called it zero times.** Two module headers vouched
 * for a function nothing used.
 *
 * It also happened to be one of the eleven sites `exactOptionalPropertyTypes` rejected -
 * `apiKey: settings.apiKey || undefined` writes the key as PRESENT-AND-UNDEFINED - so the
 * choice was to fix dead code or remove it. The best fix is a removal.
 */
