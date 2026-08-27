/**
 * Mutation harness. A guard never watched to FAIL is not evidence.
 *
 * Reusable across the OPENWORK 45-55 lane. Every lesson in OPENWORK section 5 that made a
 * previous harness LIE is encoded here as a rule, not a comment:
 *
 *  T-ANSI  Strip the ESC BYTE, not just the `[32m` tail. `/\[[0-9;]*m/` leaves \x1b behind,
 *          `\s` does not match it, and every mutation reports SURVIVED against a harness
 *          that read nothing. Cost five round trips and two wrong hypotheses.
 *  T-TOTAL Compare the TOTAL, not the failure count. A mutation that does not compile makes
 *          the file fail to LOAD, so vitest reports a SMALLER all-green total, which reads
 *          as "survived" and is exactly backwards.
 *  T-ABORT When the total cannot be parsed, ABORT. Scoring it zero is how a harness that
 *          read nothing reports a clean sweep.
 *  T-EXEC  `execSync` from node runs under cmd.exe, which cannot resolve `node` because the
 *          inherited PATH is Unix-form. Build the command from `process.execPath`.
 *
 * Usage, from the REPO ROOT: node tools/mutate.mjs tools/mutations/<plan>.json
 *   plan.json = { "target": ["src/...test.ts", ...], "mutations": [ {label, file, from, to} ] }
 *   `target` takes one path or a list. `to` may be omitted to mean deletion.
 *   Every path inside a plan is relative to the repo root.
 *
 * PROMOTED OUT OF `zzz-` ON 2026-08-27. It lived as `zzz-mutate.mjs`, and `zzz-*` is
 * gitignored - so the instrument that found thirteen real holes in one session, and the
 * six section-5 lessons encoded in it, would have been deleted with the scratch. The
 * plans in `tools/mutations/` are the RECORD of what was actually mutated for items 45
 * to 50; re-run any of them to check a guard still discriminates.
 *
 * WRITE PLANS WITH THE Write TOOL, NEVER THROUGH A SHELL HEREDOC. A backslash in a regex
 * anchor is eaten and the plan then fails to find its own text - which the ABORT below
 * catches, loudly, but only after wasting the round trip. Section 5, T13 and T19.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const VITEST = 'node_modules/vitest/vitest.mjs';

/** T-ANSI: the ESC byte is part of the sequence. */
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

function run(target) {
  let out;
  try {
    // NOT `split(/s+/)`. Written through a shell once, the backslash was eaten and the
    // fragments ("rc/", "hared/manife") matched every path as substring filters, so the
    // harness silently ran the WHOLE suite while reporting it targeted two files. It gave
    // the right verdict for the wrong reason, which is the worst kind of green.
    const filters = Array.isArray(target) ? target : String(target).split(/\s+/).filter(Boolean);
    out = execFileSync(process.execPath, [VITEST, 'run', ...filters], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1', NO_COLOR: '1' },
    });
  } catch (e) {
    // Non-zero exit is the NORMAL case for a caught mutation; the output still has counts.
    out = `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
  }
  const clean = strip(out);
  const line = clean.match(/^\s*Tests\s+(.*)$/m);
  if (!line) {
    // T-ABORT. Never score an unreadable run as zero.
    console.error('ABORT: could not parse a "Tests" line. Raw tail:\n' + clean.slice(-1500));
    process.exit(2);
  }
  const passed = Number((line[1].match(/(\d+)\s+passed/) ?? [0, 0])[1]);
  const failed = Number((line[1].match(/(\d+)\s+failed/) ?? [0, 0])[1]);
  const total = passed + failed;
  if (!total) {
    console.error('ABORT: parsed a total of 0 from: ' + JSON.stringify(line[1]));
    process.exit(2);
  }
  return { passed, failed, total, names: [...clean.matchAll(/×\s+(.+)$/gm)].map((m) => m[1].trim()) };
}

const plan = JSON.parse(readFileSync(process.argv[2], 'utf8'));

const base = run(plan.target);
console.log(`BASELINE  total=${base.total} passed=${base.passed} failed=${base.failed}`);
if (base.failed) {
  console.error('ABORT: the baseline is not green. Fix that before mutating.');
  process.exit(2);
}

let caught = 0;
const verdicts = [];
for (const m of plan.mutations) {
  const original = readFileSync(m.file, 'utf8');
  if (!original.includes(m.from)) {
    // A miss must be LOUD. A silent no-op mutation reports SURVIVED against an unchanged
    // file, which is the single most expensive lie this harness can tell.
    console.error(`ABORT: [${m.label}] pattern not found in ${m.file}: ${JSON.stringify(m.from)}`);
    process.exit(2);
  }
  writeFileSync(m.file, original.replace(m.from, m.to ?? ''), 'utf8');
  try {
    const r = run(plan.target);
    // T-TOTAL: a shrunken total means the file stopped LOADING, not that the guard held.
    if (r.total !== base.total) {
      verdicts.push(`INVALID  ${m.label} — total moved ${base.total} to ${r.total} (did not compile?)`);
    } else if (r.failed > 0) {
      caught++;
      verdicts.push(`CAUGHT   ${m.label} — ${r.failed} failed: ${r.names.slice(0, 3).join(' | ')}`);
    } else {
      verdicts.push(`SURVIVED ${m.label} — total held at ${r.total} and nothing failed`);
    }
  } finally {
    writeFileSync(m.file, original, 'utf8');
  }
}

console.log('\n' + verdicts.join('\n'));
console.log(`\n${caught}/${plan.mutations.length} caught`);
process.exit(caught === plan.mutations.length ? 0 : 1);
