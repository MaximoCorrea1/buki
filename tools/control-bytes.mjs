/**
 * Sweep the tree for control bytes. NUL and 0x08, the two this repo has actually shipped.
 *
 * ⚠ **THIS FILE WAS A GUARD THAT COULD NOT FIRE, AND IT SAID SO IN A DOC.** Until
 * 2026-08-27 it was a one-shot REPAIR script for a specific NUL byte in
 * `generatedCover.ts`, with the sweep bolted on the end - after an `process.exit(1)`
 * that ran whenever the repair found nothing to repair. So from the moment the NUL was
 * fixed, **every invocation exited 1 without sweeping a single file**, while
 * `OPENWORK.md` and the 08-27 handoff both told the next reader:
 *
 *     "Sweep with `node tools/control-bytes.mjs`; only binaries should match."
 *
 * It never swept. And the failure was invisible twice over, because the natural way to
 * run it - `node tools/control-bytes.mjs | tail` - reports the exit status of `tail`.
 * **Same mechanism as `tsc --noEmit | head` printing TSC=0 under ten real errors**,
 * which is already §5. A pipe launders an exit code.
 *
 * The repair half is deleted rather than kept: it did its job once, its premise
 * ("there is a NUL in generatedCover.ts") is permanently false, and a repair that
 * rewrites a source file is the wrong thing to leave lying in a sweep tool. What
 * survives is the rule it was protecting, which is the sweep.
 *
 *     node tools/control-bytes.mjs           sweep; exit 1 if anything is carrying one
 *     node tools/control-bytes.mjs --verify  prove the sweep can FAIL, then sweep
 *
 * **Run it WITHOUT a pipe**, or read `${PIPESTATUS[0]}` rather than `$?`.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';

const NUL = String.fromCharCode(0);
const BACKSPACE = String.fromCharCode(8);

/** Directories with no text to check, and `zzz-*` which is scratch by definition. */
const SKIP = new Set(['node_modules', '.git', 'dist', 'icons', 'fonts', 'images', 'covers']);
const TEXT = /\.(ts|mjs|js|md|html|json|txt|xml)$/;

function sweep(root) {
  const found = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name) || name.startsWith('zzz-')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (TEXT.test(name)) {
        const body = readFileSync(p, 'utf8');
        if (body.includes(NUL) || body.includes(BACKSPACE)) found.push(relative(root, p));
      }
    }
  })(root);
  return found;
}

const root = process.cwd();

// --verify plants one and watches the sweep FIND it. A guard never watched to fail is
// not evidence - and this guard spent eleven days as proof of exactly that.
if (process.argv.includes('--verify')) {
  const canary = join(root, 'src', '__control-byte-canary.ts');
  writeFileSync(canary, `export const x = 'a${NUL}b';\n`, 'utf8');
  try {
    const hits = sweep(root);
    const caught = hits.some((h) => h.includes('__control-byte-canary'));
    console.log(caught ? 'VERIFY: sweep caught the planted NUL' : 'VERIFY FAILED: sweep MISSED a planted NUL');
    if (!caught) process.exit(1);
  } finally {
    unlinkSync(canary);
  }
}

const found = sweep(root);
if (found.length) {
  console.log('STILL CARRYING CONTROL BYTES:\n' + found.map((f) => '  ' + f).join('\n'));
  process.exit(1);
}
console.log('tree clean of NUL and 0x08');
