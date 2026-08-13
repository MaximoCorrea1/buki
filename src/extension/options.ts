import { readSettings, writeSettings, DEFAULT_SETTINGS } from './settings';
import { createRecognitionLog } from './recognitionLog';
import { createLibrary, type StorageArea } from './storage';
import { toGoodreadsCsv, shelfFilename } from './goodreadsCsv';
import type { BackgroundRequest } from './messages';

const $ = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

const storage: StorageArea = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
};
/** Reads only - the background worker is the log's single writer. */
const log = createRecognitionLog({ storage, now: () => Date.now() });
/** Reads only, for the same reason. The worker is the shelf's single writer. */
const library = createLibrary({ storage, now: () => Date.now(), newId: () => crypto.randomUUID() });

async function main(): Promise<void> {
  const key = $<HTMLInputElement>('key');
  const endpoint = $<HTMLInputElement>('endpoint');
  const model = $<HTMLInputElement>('model');
  const status = $<HTMLElement>('status');
  const form = $<HTMLFormElement>('form');
  const reset = $<HTMLButtonElement>('reset');
  const store = $<HTMLSelectElement>('store');
  if (!key || !endpoint || !model || !status || !form || !reset || !store) return;

  const current = await readSettings();
  key.value = current.apiKey;
  endpoint.value = current.endpoint;
  model.value = current.model;
  store.value = current.store;

  const say = (msg: string): void => {
    status.textContent = msg;
    status.classList.add('shown');
    setTimeout(() => status.classList.remove('shown'), 2400);
  };

  /**
   * A cross-origin fetch needs a matching host permission. Without this, choosing any
   * provider other than the default failed with an opaque network error - while the
   * field's own help text advertised OpenRouter, Cloudflare and self-hosted proxies.
   */
  async function allowEndpoint(url: string): Promise<boolean> {
    let origin: string;
    try {
      origin = `${new URL(url).origin}/*`;
    } catch {
      return true; // not a URL we can ask about; writeSettings will fall back to default
    }
    if (await chrome.permissions.contains({ origins: [origin] })) return true;
    return chrome.permissions.request({ origins: [origin] });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const wanted = endpoint.value.trim() || DEFAULT_SETTINGS.endpoint;
      if (!(await allowEndpoint(wanted))) {
        say('Not saved. Buki needs permission to reach that endpoint.');
        return;
      }
      await writeSettings({
        apiKey: key.value.trim(),
        endpoint: wanted,
        model: model.value.trim() || DEFAULT_SETTINGS.model,
        // Narrowed rather than cast: a hand-edited DOM cannot smuggle a third value
        // into storage and break every buy link.
        store: store.value === 'bookshop' ? 'bookshop' : 'amazon',
      });
      say(key.value.trim() ? 'Saved. Recognition is on.' : 'Saved. Add a key to read covers.');
    } catch (err) {
      console.error('[Buki] could not save settings', err);
      say("Couldn't save. Try again.");
    }
  });

  reset.addEventListener('click', () => {
    endpoint.value = DEFAULT_SETTINGS.endpoint;
    model.value = DEFAULT_SETTINGS.model;
    // The button only fills the fields, so claiming it reset the provider would be a
    // lie you discover later, when recognition still fails.
    say('Fields filled. Press Save to apply.');
  });

  const exportCsv = $<HTMLButtonElement>('exportCsv');
  const exportStatus = $<HTMLElement>('exportStatus');
  if (exportCsv && exportStatus) {
    const books = (n: number): string => `${n} book${n === 1 ? '' : 's'}`;

    const showShelf = async (): Promise<void> => {
      try {
        const shelf = await library.list();
        exportCsv.disabled = shelf.length === 0;
        // An empty state is an invitation, not a wall.
        exportStatus.textContent = shelf.length
          ? `${books(shelf.length)} ready`
          : 'Nothing on the shelf yet. Catch a book and it lands here.';
      } catch (err) {
        console.error('[Buki] could not read the shelf', err);
      }
    };
    void showShelf();

    exportCsv.addEventListener('click', async () => {
      exportCsv.disabled = true;
      try {
        const shelf = await library.list();
        const blob = new Blob([toGoodreadsCsv(shelf)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = shelfFilename(Date.now());
        a.click();
        // Next tick, not this one: Chrome starts the download from the click, and
        // revoking inside the same task can cancel it before it begins. No `downloads`
        // permission is involved, which is deliberate - asking for one right before store
        // review, for something a blob can already do, is a bad trade.
        setTimeout(() => URL.revokeObjectURL(url), 0);
        exportStatus.textContent = `${books(shelf.length)} exported`;
      } catch (err) {
        console.error('[Buki] could not export the shelf', err);
        exportStatus.textContent = "Couldn't build the file";
      } finally {
        exportCsv.disabled = false;
      }
    });
  }

  const clearLog = $<HTMLButtonElement>('clearLog');
  const logStatus = $<HTMLElement>('logStatus');
  if (!clearLog || !logStatus) return;

  const showCount = async (): Promise<void> => {
    try {
      const events = await log.list();
      logStatus.textContent = events.length ? `${events.length} recorded` : 'Nothing recorded yet';
    } catch (err) {
      console.error('[Buki] could not read the log', err);
    }
  };
  void showCount();

  clearLog.addEventListener('click', async () => {
    clearLog.disabled = true;
    try {
      // The worker answers {ok}; without checking it, a failed clear read as success.
      const resp = (await chrome.runtime.sendMessage({
        type: 'clearLog',
      } satisfies BackgroundRequest)) as { ok?: boolean } | undefined;
      logStatus.textContent = resp?.ok ? 'Cleared' : "Couldn't clear it";
    } catch (err) {
      console.error('[Buki] could not clear the log', err);
      logStatus.textContent = "Couldn't clear it";
    } finally {
      clearLog.disabled = false;
    }
  });
}

void main();
