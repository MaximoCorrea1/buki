import { describe, it, expect } from 'vitest';
import claudeMd from '../../CLAUDE.md?raw';
import openWork from '../../OPENWORK.md?raw';

/**
 * `CLAUDE.md` IS LOADED ON TURN ONE OF EVERY SESSION, WHICH IS THE WHOLE POINT OF IT AND
 * ALSO THE ONLY THING THAT CAN BREAK IT.
 *
 * It exists because of a measurement, not a preference. `OPENWORK.md` §5 - the trap ledger -
 * spans lines 1900 to 2511, and the Read tool takes **2000 lines by default**. So roughly
 * five sixths of §5 is unreachable in a normal read, and on 2026-08-27 the entries below
 * that cut were `heredoc`, `backtick`, `npx` and `0x08`: **the exact four traps that were
 * hit five times in a single session.**
 *
 * A rule nobody can read is not a rule. So the shell traps are SPELLED OUT in CLAUDE.md
 * rather than pointed at, and these tests stop the two edits that would quietly undo that:
 * tidying them back into a pointer, and letting the file grow until it is subject to the
 * same truncation it was written to escape.
 */

/** Comfortably inside any host cut, and small enough to stay read rather than skimmed. */
const BUDGET = 15_000;

describe('the turn-one rules survive being loaded', () => {
  it('stays inside its size budget', () => {
    // Flowy's equivalent file reached 181,617 chars against a 150,000 host limit, and 88.7%
    // of it was case studies - so on any client enforcing the cut, the anecdotes survived
    // and the behaviour rules were the part that disappeared. Nothing broke. Nothing could.
    expect(claudeMd.length).toBeLessThanOrEqual(BUDGET);
    // And it has to still be doing its job: an empty file is trivially within budget.
    expect(claudeMd.length).toBeGreaterThan(4_000);
  });

  it('SPELLS OUT the traps that sit below OPENWORK’s read cut', () => {
    // Each of these is unreachable in a default Read of OPENWORK.md, which is why it is
    // duplicated here on purpose. This is the one place the point-do-not-copy rule is
    // deliberately broken, and the reason is measured rather than assumed.
    //
    // ASSERTED ON THE REMEDY, NOT THE TRAP'S NAME, and scoped to the shell section. The
    // first version looked for the words "npx" and "backtick" anywhere in the file and
    // stayed GREEN when the actual rules were deleted, because both words also appear in
    // the size-budget note at the top that lists which traps fall below the cut. A
    // mention is not an instruction. Same hole as a `?raw` guard satisfied by a comment.
    const shell = /## ⛔ THE SHELL[\s\S]*?\n---/.exec(claudeMd)?.[0] ?? '';
    expect(shell, 'the shell section is gone or renamed').not.toBe('');

    for (const remedy of [
      'npx', // named INSIDE this section, so an agent whose npx fails knows it is expected
      // rather than a broken install. The word also appears in the size-budget note at the
      // top of the file, which is exactly why this loop is scoped to the section.
      './node_modules/.bin/vitest', // what to use instead
      'node <file>.mjs', // what to do instead of a heredoc
      'template literal terminates', // the backtick, and why
      'String.raw', // and that the obvious escape hatch does not work
      'backspace byte', // the 0x08 that markdown renders as nothing
      'process.execPath', // execSync runs under cmd.exe
      'x1b', // strip the ESC byte or every mutation reads as SURVIVED
    ]) {
      expect(shell, `the shell section no longer carries: ${remedy}`).toContain(remedy);
    }
  });

  it('still points at OPENWORK for status rather than answering it', () => {
    // The failure mode in the other direction: CLAUDE.md growing a copy of THE LANE, which
    // would then disagree with it. It carries rules and ground truth, never status.
    //
    // Scoped to a LANE ROW's shape - a number followed by an OWNER - because the first
    // version banned any `| **N** |` and turned red on this file's own numbered
    // session-start steps. An absence proof has to name the thing it forbids, not a
    // family it happens to belong to.
    expect(claudeMd).toMatch(/OPENWORK\.md/);
    expect(claudeMd).not.toMatch(/^\| \*\*\d+\*\* \| *(agent|\*\*Maximo\*\*)/m);
  });

  it('the premise it is built on is still true', () => {
    // If §5 ever moves above the 2000-line cut, the duplication above stops being justified
    // and this file should say so instead of carrying it forever. A record inherits the
    // lifetime of its PREMISE.
    const lines = openWork.split('\n');
    const fifth = lines.findIndex((l) => l.startsWith('## 5. Traps'));
    expect(fifth, 'OPENWORK section 5 has been renamed or removed').toBeGreaterThan(-1);
    expect(
      lines.length,
      'OPENWORK.md now fits in one default Read - re-check whether CLAUDE.md still needs to duplicate the traps',
    ).toBeGreaterThan(2000);
  });
});
