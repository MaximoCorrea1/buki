import { readSettings, writeSettings, DEFAULT_SETTINGS } from './settings';
import { createRecognitionLog } from './recognitionLog';
import { createLibrary, type StorageArea } from './storage';
import { toGoodreadsCsv, shelfFilename } from './goodreadsCsv';
import type { BackgroundRequest } from './messages';
import { createLicense } from './license';
import { readPro, writePro, standingOf } from './proState';
import { createTrial } from './trial';
import { planLabel } from './entitlement';
import { BUKI_HOST } from '../shared/host';
import { PRICING_URL } from '../shared/pricing';
import { priceLine } from '../shared/pricing';

const $ = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

const storage: StorageArea = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
};
/** Reads only - the background worker is the log's single writer. */
const log = createRecognitionLog({ storage, now: () => Date.now() });
/** Reads only, for the same reason. The worker is the shelf's single writer. */
const library = createLibrary({ storage, now: () => Date.now(), newId: () => crypto.randomUUID() });


/**
 * Buki Pro: say what plan this is, and let a licence key be exchanged for a session.
 *
 * Wired separately from the provider form and guarded on its own elements, because
 * `main()` returns early when any provider field is missing and anything sharing that
 * guard disappears with it. `docs/brand.md` records the two days the theme switch spent
 * dead behind exactly that.
 */
async function wirePro(): Promise<void> {
  const field = $<HTMLInputElement>('licence');
  const activate = $<HTMLButtonElement>('activate');
  const now = $<HTMLElement>('planNow');
  const status = $<HTMLElement>('licenceStatus');
  const buy = $<HTMLAnchorElement>('getPro');
  if (!field || !activate || !now || !status || !buy) return;
  // Re-bound after the guard: TypeScript cannot carry a narrowing across the closure
  // boundary of the handlers below, and `!` at every use is a worse answer than binding.
  const el = { field, activate, now, status, buy };

  buy.href = PRICING_URL;
  buy.textContent = `Buki Pro, ${priceLine()}`;

  const trial = createTrial({ storage });

  /** What plan is this, in the words `entitlement.ts` owns. */
  async function showPlan(): Promise<void> {
    const [pro, settings, spent] = await Promise.all([
      readPro(storage),
      readSettings(),
      trial.spent(),
    ]);
    const standing = standingOf(pro, spent, settings.apiKey, Date.now());
    el.now.textContent = planLabel(standing);
    el.now.toggleAttribute('data-pro', standing.pro);
    // Nothing to sell to somebody already on Pro or paying nothing because they brought
    // their own key. Hiding the price is the difference between an offer and a nag.
    el.buy.hidden = standing.pro || standing.ownKey;
    el.field.value = pro.key;
  }

  const say = (msg: string): void => {
    el.status.textContent = msg;
    el.status.classList.add('shown');
  };

  activate.addEventListener('click', async () => {
    el.activate.disabled = true;
    say('Checking…');
    try {
      const license = createLicense({
        fetch: (url, init) => fetch(url, init),
        endpoint: `${BUKI_HOST}/api/license`,
        now: () => Date.now(),
      });
      // Re-pressing Activate on the SAME key must not spend a second activation slot, so
      // the stored id is offered back and the server validates instead. A DIFFERENT key
      // gets no id: that is a genuinely new pairing and has to activate.
      const pasted = el.field.value.trim();
      const held = await readPro(storage);
      const reuse = held.key === pasted ? held.activationId : undefined;

      const result = await license.exchange(pasted, reuse);
      if (result.ok) {
        const id = result.activationId || reuse;
        await writePro(storage, {
          key: pasted,
          session: result.session,
          ...(id ? { activationId: id } : {}),
        });
        say('Pro is on. Cover reading is unlimited.');
      } else {
        // A retryable failure keeps whatever session is already stored: an outage on our
        // side must not sign a paying customer out.
        if (!result.retryable) {
          // The session goes; the activation stays. This install is still paired, and
          // forgetting the id would make the next success activate a second time.
          await writePro(storage, {
            key: pasted,
            session: null,
            ...(reuse ? { activationId: reuse } : {}),
          });
        }
        say(result.message ?? 'That key could not be activated.');
      }
    } catch (err) {
      console.error('[Buki] licence activation failed', err);
      say('Something went wrong. Try again in a moment.');
    } finally {
      el.activate.disabled = false;
      await showPlan();
    }
  });

  await showPlan();
}

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

/**
 * THE PRO SECTION, at module scope, which is the entire point.
 *
 * This used to be `void wirePro();` INSIDE `main()`, below a guard that returns early when
 * any of seven PROVIDER ids is missing — `key`, `endpoint`, `model`, `status`, `form`,
 * `reset`, `store`. None of them has anything to do with a licence. Rename one and the
 * whole paid path went dark without a sound: `#planNow` stuck on "Reading your plan…",
 * `#activate` with no listener, `#getPro`'s href left as the literal "#".
 *
 * The comment that used to sit at that call site said the opposite — that the section was
 * "guarded on its own fields" and safe from main()'s return — and cited the two days the
 * theme switch spent inside a `prefers-reduced-motion` guard as the reason. It named the
 * right lesson from the wrong side of the guard. `optionsPage.test.ts` asserts column 0
 * now, because a module-scope call is the only version of this that cannot inherit one.
 */
void wirePro();
