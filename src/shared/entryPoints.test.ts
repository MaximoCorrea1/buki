import { describe, it, expect } from 'vitest';
import { transform } from 'esbuild';

/**
 * THE FOUR FILES NOTHING IMPORTS, AND WHY THAT IS A HOLE.
 *
 * `content.ts`, `background.ts`, `popup.ts` and `options.ts` all do work at module scope —
 * they register `chrome.runtime` listeners, observe the DOM, set intervals and call
 * `main()`. Importing any of them from a test throws before the first assertion runs, which
 * is why every guard on them reads the file as `?raw` TEXT instead.
 *
 * The consequence was found the hard way on 2026-08-18. A backtick inside a CSS comment
 * ended `content.ts`'s `STYLE` template literal, and **all 583 tests passed on a file that
 * does not parse** — because no test ever asked a parser to look at it. `tsc --noEmit` and
 * `node build.mjs` both caught it, and both are run, but "the suite is green" had already
 * been said out loud by then.
 *
 * So this asks the one question a `?raw` reader cannot: does it parse at all. It uses the
 * SAME transformer the build uses, so a file that passes here is a file `node build.mjs`
 * can bundle.
 *
 * It is not a substitute for `tsc`. esbuild strips types and never checks them, which is
 * exactly why `build.mjs` typechecks first and refuses to bundle on a type error. This
 * catches the narrower and louder failure: source that is not JavaScript.
 *
 * It is not a substitute for RUNNING them either, and the sentence below used to end there.
 * `toolsRun.test.mjs` beside this file runs every command README advertises, added after
 * `tools/mark-sizes.mjs` parsed cleanly here and threw on its first line of output for
 * eleven days while README listed it as working.
 */

const ENTRIES = import.meta.glob(
  [
    '../extension/content.ts',
    '../extension/background.ts',
    '../extension/popup.ts',
    '../extension/options.ts',
    // The tools too, as of the FOURTH occurrence of the backtick trap. tsconfig includes
    // only `src` and `api`, so nothing typechecks or parses a `tools/*.mjs` - the only
    // thing that catches a broken one is running it, and three of these are run by hand
    // once a month. `store-shots.mjs` was written hours after the trap was recorded in
    // OPENWORK.md §5 and fell into it anyway, because the warning lived inside the file
    // that already had the problem and a new file inherits nothing.
    '../../tools/*.mjs',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

describe('the files no test can import', () => {
  it('reads real files, rather than passing on a glob that matched nothing', () => {
    // The vacuous pass this repo has been bitten by twice: a renamed file matches nothing
    // and the check below reports clean on an empty set.
    expect(Object.keys(ENTRIES).length).toBeGreaterThanOrEqual(10);
    for (const [path, body] of Object.entries(ENTRIES)) {
      expect(body.length, `${path} is empty`).toBeGreaterThan(400);
    }
  });

  it('all parse', async () => {
    const broken: string[] = [];
    for (const [path, body] of Object.entries(ENTRIES)) {
      try {
        await transform(body, { loader: path.endsWith('.mjs') ? 'js' : 'ts' });
      } catch (err) {
        // Named, not counted. "One file is broken" sends you hunting; esbuild's own message
        // gives the line and the reason, and for the backtick case the reason lands a
        // hundred lines from the cause, so the message is most of the value.
        broken.push(`${path.replace(/^(\.\.\/)+/, 'src/')}: ${String(err).split('\n')[0]}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
