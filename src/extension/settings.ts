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

export async function readSettings(): Promise<Settings> {
  const got = await chrome.storage.local.get(KEY);
  const raw = got[KEY];
  return typeof raw === 'object' && raw !== null
    ? { ...DEFAULT_SETTINGS, ...(raw as Partial<Settings>) }
    : DEFAULT_SETTINGS;
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
