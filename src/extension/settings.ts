import { GEMINI, type VisionConfig } from '../recognizer/llmVision';

const KEY = 'visionSettings';

export interface VisionSettings {
  /** Empty until the user adds one. A proxy build can ship a blank key and its own endpoint. */
  apiKey: string;
  endpoint: string;
  model: string;
}

export const DEFAULT_SETTINGS: VisionSettings = {
  apiKey: '',
  endpoint: GEMINI.endpoint,
  model: GEMINI.model,
};

export async function readSettings(): Promise<VisionSettings> {
  const got = await chrome.storage.local.get(KEY);
  const raw = got[KEY];
  return typeof raw === 'object' && raw !== null
    ? { ...DEFAULT_SETTINGS, ...(raw as Partial<VisionSettings>) }
    : DEFAULT_SETTINGS;
}

export async function writeSettings(settings: VisionSettings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}

export function toVisionConfig(settings: VisionSettings): VisionConfig {
  return {
    endpoint: settings.endpoint,
    model: settings.model,
    // Blank means keyless, which is what a hosted proxy build looks like.
    apiKey: settings.apiKey || undefined,
  };
}
