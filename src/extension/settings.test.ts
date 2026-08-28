import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, readSettingsFrom } from './settings';
import SETTINGS_SRC from './settings.ts?raw';

/**
 * TS-1. `OPENWORK.md` item 53.
 *
 *     return typeof raw === 'object' && raw !== null
 *       ? { ...DEFAULT_SETTINGS, ...(raw as Partial<Settings>) }
 *       : DEFAULT_SETTINGS;
 *
 * **A spread over the defaults is not validation.** It fills in MISSING keys and accepts any
 * value for a PRESENT one, so `{ apiKey: 42 }` in storage produces settings whose `apiKey`
 * is a number — and the review's point is where that lands: **`settings.apiKey.trim()` is
 * called on the money path.** `.trim` is not a function on 42.
 *
 * `readSettings` was the only one of three storage readers that did not check field by
 * field. `proState.sessionFrom` and (since TS-2) `storedShelf`/`storedLog` all do.
 *
 * **FALL BACK PER FIELD, not per record.** A junk `store` should not also cost you your
 * endpoint — the reader is one edit away from a working extension either way, and taking
 * everything back to default over one bad key hides which key was bad.
 */
describe('reading settings out of storage', () => {
  it('returns the defaults when storage holds nothing', () => {
    for (const raw of [undefined, null, 'settings', 42, []]) {
      expect(readSettingsFrom(raw), String(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('takes a well-formed record', () => {
    const stored = {
      apiKey: 'k-123',
      endpoint: 'https://provider.test/v1/chat/completions',
      model: 'gemini-flash-lite-latest',
      store: 'bookshop',
    };
    expect(readSettingsFrom(stored)).toEqual(stored);
  });

  it('keeps a BLANK api key, because blank is what a proxy build ships', () => {
    // The one field where the empty string is a real value rather than a missing one.
    expect(readSettingsFrom({ ...DEFAULT_SETTINGS, apiKey: '' }).apiKey).toBe('');
  });

  it('pins the invariant that makes the blank-key rule currently unobservable', () => {
    /**
     * ⚠ A MUTATION PROVED THIS PAIR EQUIVALENT, and pinning the reason is the honest answer
     * rather than deleting the flag or explaining the survivor away (§5 T15).
     *
     * `readSettingsFrom` reads the key with `allowEmpty: true` and everything else with
     * `false`. Those two spellings can only DIFFER when the field's default is non-empty —
     * and `DEFAULT_SETTINGS.apiKey` is `''`, so today they agree for every input and no test
     * can tell them apart.
     *
     * The flag stays because it states a real product rule: **blank means keyless, which is
     * what a hosted proxy build ships.** This assertion is what turns "currently equivalent"
     * into "equivalent for a reason that is checked" — the day a default key appears, this
     * goes red and the distinction starts mattering.
     */
    expect(DEFAULT_SETTINGS.apiKey).toBe('');
  });

  /** THE FINDING. Each of these used to reach `.trim()` on the money path. */
  it('falls back when a field is not a string', () => {
    for (const apiKey of [42, null, {}, [], true]) {
      const got = readSettingsFrom({ ...DEFAULT_SETTINGS, apiKey });
      expect(typeof got.apiKey, String(apiKey)).toBe('string');
      expect(got.apiKey).toBe(DEFAULT_SETTINGS.apiKey);
    }
  });

  it('falls back PER FIELD, so one bad key does not cost you the others', () => {
    const got = readSettingsFrom({
      apiKey: 'k-123',
      endpoint: 42,
      model: 'a-real-model',
      store: 'nonsense',
    });

    expect(got.apiKey).toBe('k-123');
    expect(got.model).toBe('a-real-model');
    expect(got.endpoint).toBe(DEFAULT_SETTINGS.endpoint);
    expect(got.store).toBe(DEFAULT_SETTINGS.store);
  });

  it('refuses an endpoint that is not an https url', () => {
    // This is where the key gets SENT. A `javascript:` or `http:` endpoint in a
    // user-editable store is a credential pointed somewhere it was never meant to go.
    for (const endpoint of ['javascript:alert(1)', 'http://provider.test/v1', 'not a url', '']) {
      expect(readSettingsFrom({ ...DEFAULT_SETTINGS, endpoint }).endpoint, endpoint).toBe(
        DEFAULT_SETTINGS.endpoint,
      );
    }
  });

  it('refuses a store that is not one we can build a link for', () => {
    for (const store of ['ebay', '', 42, null]) {
      expect(readSettingsFrom({ ...DEFAULT_SETTINGS, store }).store, String(store)).toBe(
        DEFAULT_SETTINGS.store,
      );
    }
  });

  it('ignores extra keys rather than carrying them onto the object', () => {
    const got = readSettingsFrom({ ...DEFAULT_SETTINGS, evil: 'payload' });
    expect(got).toEqual(DEFAULT_SETTINGS);
    expect(got).not.toHaveProperty('evil');
  });

  it('never hands back a value that would throw on .trim()', () => {
    // The review's exact sentence, as an assertion: "its values are called as methods on
    // the money path". This is that, checked rather than reasoned about.
    const got = readSettingsFrom({ apiKey: 42, endpoint: {}, model: [], store: null });
    expect(() => got.apiKey.trim()).not.toThrow();
    expect(() => got.endpoint.trim()).not.toThrow();
    expect(() => got.model.trim()).not.toThrow();
  });
});

/**
 * The wiring, as an ABSENCE PROOF.
 *
 * ⚠ A MUTATION REPLACING `readSettings`'s BODY WITH THE OLD SPREAD SURVIVED THE SUITE.
 * Every test above drives `readSettingsFrom`, and `readSettings` itself reaches for the
 * `chrome.storage.local` global — which no test in this repo has, by design: storage is
 * injected everywhere else.
 *
 * So the validator is tested and the CALL to it is not, and the call is the part that can be
 * deleted for free. Same gap the shelf and the log had, closed there by driving the real
 * `createLibrary`; here there is nothing to drive, so the guard reads the source.
 */
describe('readSettings actually uses the validator', () => {
  const code = SETTINGS_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('passes storage through readSettingsFrom', () => {
    expect(code).toMatch(/readSettings\(\)[\s\S]{0,200}?readSettingsFrom\(/);
  });

  it('never spreads raw storage over the defaults again', () => {
    // THE HALF THAT DISCRIMINATES. This is the finding's exact shape, and it is what the
    // surviving mutation restored.
    expect(code).not.toMatch(/\{\s*\.\.\.DEFAULT_SETTINGS,\s*\.\.\./);
  });
});
