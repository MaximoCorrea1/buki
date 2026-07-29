import { readSettings, writeSettings, DEFAULT_SETTINGS } from './settings';
import { createRecognitionLog } from './recognitionLog';
import type { StorageArea } from './storage';
import type { BackgroundRequest } from './messages';

const $ = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

const storage: StorageArea = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
};
/** Reads only - the background worker is the log's single writer. */
const log = createRecognitionLog({ storage, now: () => Date.now() });

async function main(): Promise<void> {
  const key = $<HTMLInputElement>('key');
  const endpoint = $<HTMLInputElement>('endpoint');
  const model = $<HTMLInputElement>('model');
  const status = $<HTMLElement>('status');
  const form = $<HTMLFormElement>('form');
  const reset = $<HTMLButtonElement>('reset');
  if (!key || !endpoint || !model || !status || !form || !reset) return;

  const current = await readSettings();
  key.value = current.apiKey;
  endpoint.value = current.endpoint;
  model.value = current.model;

  const say = (msg: string): void => {
    status.textContent = msg;
    status.classList.add('shown');
    setTimeout(() => status.classList.remove('shown'), 2400);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await writeSettings({
        apiKey: key.value.trim(),
        endpoint: endpoint.value.trim() || DEFAULT_SETTINGS.endpoint,
        model: model.value.trim() || DEFAULT_SETTINGS.model,
      });
      say(key.value.trim() ? 'Saved. Recognition is on.' : 'Saved. Add a key to read covers.');
    } catch (err) {
      console.error('[Shelfy] could not save settings', err);
      say("Couldn't save. Try again.");
    }
  });

  reset.addEventListener('click', () => {
    endpoint.value = DEFAULT_SETTINGS.endpoint;
    model.value = DEFAULT_SETTINGS.model;
    // The button only fills the fields, so claiming it reset the provider would be a
    // lie you discover later, when recognition still fails.
    say('Fields filled — hit Save to apply.');
  });

  const clearLog = $<HTMLButtonElement>('clearLog');
  const logStatus = $<HTMLElement>('logStatus');
  if (!clearLog || !logStatus) return;

  const showCount = async (): Promise<void> => {
    try {
      const events = await log.list();
      logStatus.textContent = events.length ? `${events.length} recorded` : 'Nothing recorded yet';
    } catch (err) {
      console.error('[Shelfy] could not read the log', err);
    }
  };
  void showCount();

  clearLog.addEventListener('click', async () => {
    clearLog.disabled = true;
    try {
      await chrome.runtime.sendMessage({ type: 'clearLog' } satisfies BackgroundRequest);
      logStatus.textContent = 'Cleared';
    } catch (err) {
      console.error('[Shelfy] could not clear the log', err);
      logStatus.textContent = "Couldn't clear it";
    } finally {
      clearLog.disabled = false;
    }
  });
}

void main();
