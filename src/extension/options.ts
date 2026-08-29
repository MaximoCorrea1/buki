import { readSettings, writeSettings, DEFAULT_SETTINGS } from './settings';
import { createRecognitionLog } from './recognitionLog';
import { createLibrary, type StorageArea } from './storage';
import { toGoodreadsCsv, shelfFilename } from './goodreadsCsv';
import type { BackgroundRequest } from './messages';
import { createLicense } from './license';
import { readPro, writePro, standingOf } from './proState';
// Aliased: `activate` is already the button element in `wirePro`, and one of the two
// would have shadowed the other in exactly the handler where both are used.
import { activate as activateLicence } from './activateKey';
import { createTrial } from './trial';
import { planLabel } from './entitlement';
import {
  revocableHosts,
  forgotten,
  stillAllowed,
  NO_HOSTS_YET,
  type GrantedHost,
} from './grantedHosts';
import { LICENSE_ENDPOINT } from '../shared/host';
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
    const [pro, settings, spent, attempts] = await Promise.all([
      readPro(storage),
      readSettings(),
      trial.spent(),
      trial.attempts(),
    ]);
    const standing = standingOf(pro, { spent, attempts }, settings.apiKey, Date.now());
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
        endpoint: LICENSE_ENDPOINT,
        now: () => Date.now(),
      });
      // THE WHOLE PRESS LIVES IN `activateKey.ts`, and this handler has no decision left.
      //
      // It used to be four lines of branching here, inside a click listener in a module no
      // test can import — and the 2026-08-24 review MUTATION-PROVED the result: replacing
      // the activation reuse with `undefined` made every press spend one of the licence's
      // five permanent slots, and the suite stayed 620/620 green. The only guard was
      // `toContain('activationId')`, which passed on the identifier surviving in a spread.
      //
      // Extracting only the ARITHMETIC was not enough, and a mutation proved that too: this
      // handler could still build its own state and call `writePro` itself. So the order
      // came out as well. Read a field, call this, say the sentence — there is no branch
      // here to get wrong, and "wrote nothing" versus "wrote a dead session" is now a
      // behaviour a test can see. Same move `saveBook.ts` made out of `background.ts`.
      say(
        await activateLicence({
          pasted: el.field.value,
          read: () => readPro(storage),
          exchange: (key, activationId) => license.exchange(key, activationId),
          write: (state) => writePro(storage, state),
        }),
      );
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

/**
 * SITES BUKI CAN REACH, and the way to take one back. `OPENWORK.md` item 46, TM-11.
 *
 * `mayFetch` asks for one host at a time and the endpoint field asks for one more. Both
 * are per-use asks, which is what `docs/store/permissions.md` tells a reviewer and it is
 * true. What was not true by implication is that the grant is temporary: nothing in this
 * extension had ever called `chrome.permissions.remove`, so a permission given once for
 * one cover was held for the life of the install and the reader could not even see it.
 *
 * AT MODULE SCOPE, for the same reason `wirePro` is, and the comment above it is the
 * record of why: `main()` returns early when any of seven PROVIDER ids is missing, and
 * none of them has anything to do with a permission. Inside `main()` this section would go
 * dark the day somebody renamed `#store`.
 *
 * The decisions are in `grantedHosts.ts` because no test can import THIS file. What is
 * left here is DOM.
 */
function wireGrants(): void {
  const list = $<HTMLUListElement>('grants');
  const status = $<HTMLElement>('grantStatus');
  if (!list) return;

  const say = (text: string): void => {
    if (status) status.textContent = text;
  };

  /** The manifest itself, rather than a second copy of its host list in this file. */
  const required = chrome.runtime.getManifest().host_permissions ?? [];

  function emptyRow(text: string): HTMLLIElement {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.className = 'empty';
    span.textContent = text;
    li.appendChild(span);
    return li;
  }

  async function forget(row: GrantedHost, button: HTMLButtonElement): Promise<void> {
    button.disabled = true;
    try {
      const gone = await chrome.permissions.remove({ origins: [row.origin] });
      say(gone ? forgotten(row.host) : stillAllowed(row.host));
      if (gone) {
        await paint();
        return;
      }
    } catch (err) {
      console.error('[Buki] could not remove', row.origin, err);
      say(stillAllowed(row.host));
    }
    button.disabled = false;
  }

  async function paint(): Promise<void> {
    let rows: GrantedHost[] = [];
    try {
      const held = await chrome.permissions.getAll();
      rows = revocableHosts(held.origins, required);
    } catch (err) {
      // A section that throws here would take every section below it with it, and this one
      // is last on the page precisely so it cannot. Say what failed rather than nothing.
      console.error('[Buki] could not read the granted origins', err);
      list?.replaceChildren(emptyRow("Chrome would not say which sites are allowed."));
      return;
    }

    if (!rows.length) {
      list?.replaceChildren(emptyRow(NO_HOSTS_YET));
      return;
    }

    list?.replaceChildren(
      ...rows.map((row) => {
        const li = document.createElement('li');

        const site = document.createElement('span');
        site.className = 'site';
        site.textContent = row.host;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ghost';
        button.textContent = 'Forget';
        // The visible word is "Forget" on every row, so a screen reader announcing four of
        // them announces the same button four times. The label names WHICH, and it starts
        // with the visible text, which is what WCAG's Label in Name asks for.
        button.setAttribute('aria-label', `Forget ${row.host}`);
        button.addEventListener('click', () => void forget(row, button));

        li.append(site, button);
        return li;
      }),
    );
  }

  void paint();
}

void wireGrants();
