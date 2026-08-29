import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * EVERY COMMAND README TELLS A STRANGER TO RUN, ACTUALLY RUNS.
 *
 * `entryPoints.test.ts` beside this file asks whether a tool PARSES, and says in its own
 * comment that "the only thing that catches a broken one is running it". That comment sat
 * there while `tools/mark-sizes.mjs` was dead for eleven days. The mark was replaced on
 * 2026-08-17 and the tool still drew the retired one — `MARK.cords`, `MARK.shelved`,
 * `MARK.caught`, and a per-ground `spine`/`caught` that no longer exist. It parsed
 * perfectly. It threw `TypeError` on the first line of output, and `README.md:103` went on
 * listing it as working the whole time. **A comment naming a hole is not a guard.**
 *
 * WHY THIS FILE IS `.mjs` AND ITS SIBLING IS `.ts`. Running a subprocess needs
 * `node:child_process`, and this repo deliberately ships no `@types/node` — `raw.d.ts` says
 * why: taking it on for one file widens `process` across an extension that must not assume
 * node globals. `tsconfig` includes `src` with no `allowJs`, so a `.mjs` here is invisible
 * to `tsc` and still collected by vitest's default pattern. Same trade `raw.d.ts` already
 * makes, one step further.
 *
 * The list is DERIVED FROM README rather than written here. README is the file that lied,
 * and a hand-kept copy would be the second place to forget.
 */
describe('the commands README advertises', () => {
  const ROOT = fileURLToPath(new URL('../../', import.meta.url));
  const README = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const advertised = [...README.matchAll(/`node (tools\/[\w-]+\.mjs)`/g)].map((m) => m[1]);
  const unique = [...new Set(advertised)].sort();

  /** Reviewed as safe to execute: each writes only gitignored `zzz-*` output. */
  const SAFE_TO_RUN = [
    'tools/mark-sizes.mjs',
    'tools/popup-harness.mjs',
    'tools/tray-harness.mjs',
    'tools/x-button-harness.mjs',
  ];

  /**
   * Advertised, and deliberately NOT run here. `make-icons.mjs` rasterises the mark into
   * `icons/icon*.png` and `docs/icon32.png` / `docs/icon180.png`, all of which are TRACKED —
   * `zzz-*` is gitignored, these are not. A guard that ran it would rewrite shipped art on
   * every green run, and CLAUDE.md's own warning is to check `git status` before `git add
   * -A`. It is alive: it reads `MARK.ball`, `MARK.eyes` and `MARK.catchlights`, so it was
   * carried to the new mark on 2026-08-17 when `mark-sizes.mjs` was not.
   */
  const WRITES_TRACKED_ASSETS = ['tools/make-icons.mjs'];

  it('advertises exactly the commands reviewed here, and nothing else', () => {
    // The vacuous pass: a table reformat that breaks the regex would otherwise report clean
    // on an empty set, which is the same hole the sibling file guards against.
    expect(unique.length, 'README advertises no tool commands; the regex has drifted').toBeGreaterThan(0);
    expect(unique).toEqual([...SAFE_TO_RUN, ...WRITES_TRACKED_ASSETS].sort());
  });

  it.each(SAFE_TO_RUN)('%s runs', (tool) => {
    // process.execPath, and NO shell. A shell here means cmd.exe on Windows, whose PATH
    // search dies at the first unbalanced quote in the string — on this machine that is
    // entry 13, ahead of the nodejs directory at 39, so a bare `node` is unresolvable.
    // See CLAUDE.md, THE SHELL.
    //
    // fileURLToPath for the cwd, not `.pathname`: this repo lives under "Projects VS", and
    // a raw pathname hands back a percent-encoded space that spawnSync reports as ENOENT on
    // the CWD — an error that names node.exe and looks nothing like the cause.
    const run = spawnSync(process.execPath, [tool], { cwd: ROOT, encoding: 'utf8', timeout: 60_000 });

    expect(run.error ?? null, `${tool} could not be spawned`).toBeNull();
    // The stderr is most of the value: "one tool is broken" sends you hunting, a stack trace
    // names the line and the property that no longer exists.
    expect(run.status, `${tool} exited ${run.status}\n${run.stderr}`).toBe(0);
  }, 60_000);
});
