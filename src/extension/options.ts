import { readSettings, writeSettings, DEFAULT_SETTINGS } from './settings';

const $ = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

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
      console.error('[BookCatcher] could not save settings', err);
      say("Couldn't save. Try again.");
    }
  });

  reset.addEventListener('click', () => {
    endpoint.value = DEFAULT_SETTINGS.endpoint;
    model.value = DEFAULT_SETTINGS.model;
    say('Provider reset to Gemini.');
  });
}

void main();
