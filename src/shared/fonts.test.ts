import { describe, it, expect } from 'vitest';
import popupHtml from '../../popup.html?raw';
import optionsHtml from '../../options.html?raw';
import contentTs from '../extension/content.ts?raw';

/**
 * A dangling `@font-face` is the quietest failure this repo can ship.
 *
 * Delete a `.woff2` and leave the `src: url(...)` behind and nothing anywhere complains:
 * the browser fetches, gets a 404, silently falls through the stack in `--ui`, and every
 * surface renders in `system-ui`. It looks *fine*. It looks like a slightly different
 * design decision. There is no console error a screenshot can show you and no test in this
 * repo that could have caught it, which is why this file exists.
 *
 * The reverse costs bytes rather than looks: a font left in `fonts/` that nothing loads is
 * dead weight in every copy of the extension a user installs. `docs/` had exactly that for
 * two days after the landing moved to Manrope, and it was only found by reading the
 * directory. An extension pays for it worse than a website does, because a website serves
 * what is asked for and an extension ships the whole folder.
 *
 * Same technique as `host.test.ts`: find the files by looking, not by list.
 */

/** The font files actually present, as `fonts/<name>.woff2`. */
const PRESENT = new Set(
  Object.keys(import.meta.glob('../../fonts/*.woff2')).map(
    (path) => `fonts/${path.split('/').pop()}`,
  ),
);

/** Every `url("fonts/…")` a shipped surface asks for. */
const SURFACES: Record<string, string> = {
  'popup.html': popupHtml,
  'options.html': optionsHtml,
};
const REQUESTED = new Map<string, string[]>();
for (const [name, body] of Object.entries(SURFACES)) {
  for (const m of body.matchAll(/url\(["']?(fonts\/[^"')]+)["']?\)/g)) {
    const file = m[1] as string;
    REQUESTED.set(file, [...(REQUESTED.get(file) ?? []), name]);
  }
}

describe('the fonts the extension ships', () => {
  it('reads a real directory rather than passing on a glob that matched nothing', () => {
    // Without this, deleting every font satisfies both checks below and reports clean.
    expect(PRESENT.size).toBeGreaterThan(0);
    expect(REQUESTED.size).toBeGreaterThan(0);
  });

  it('are all present on disk, so no surface falls back to a system face', () => {
    const missing = [...REQUESTED.entries()]
      .filter(([file]) => !PRESENT.has(file))
      .map(([file, askers]) => `${askers.join(' and ')} loads ${file}, which does not exist`);
    expect(missing).toEqual([]);
  });

  it('are all actually loaded, so none is dead weight in the installed extension', () => {
    const unused = [...PRESENT]
      .filter((file) => !REQUESTED.has(file))
      .map((file) => `${file} ships but no surface loads it`);
    expect(unused).toEqual([]);
  });
});

/**
 * MANROPE SHIPS NO ITALIC, on every surface that uses it.
 *
 * `font-synthesis: none` makes the browser refuse to shear the roman rather than quietly
 * producing the counterfeit `docs/brand.md` records reaching production once. Three
 * surfaces declared it and the CATCH TRAY did not - found by the long-carried "grep for
 * other dead declarations" on 2026-08-17, which had been deferred for three sessions.
 *
 * Nothing in the tray is italic today, so this was latent rather than live. That is
 * exactly when it is cheapest to close: one declaration, and the class of bug cannot come
 * back through a future `<em>` in a book title.
 */
describe('no surface may synthesise an italic', () => {
  const SURFACES: Record<string, string> = {
    'popup.html': popupHtml,
    'options.html': optionsHtml,
    'the catch tray (content.ts)': contentTs,
  };
  for (const [name, body] of Object.entries(SURFACES)) {
    it(`${name} declares font-synthesis: none`, () => {
      expect(body.replace(/\s+/g, ' ')).toMatch(/font-synthesis:\s*none/);
    });
  }
});
