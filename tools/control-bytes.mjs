// Replace the literal NUL separators in the weaveOf memo key with a visible escape.
// Guarded: a miss is loud, per CLAUDE.md's shell rules.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const F = 'src/extension/generatedCover.ts';
const before = readFileSync(F, 'utf8');
const NUL = String.fromCharCode(0);
if (!before.includes(NUL)) {
  console.error('MISS: no NUL byte found in', F);
  process.exit(1);
}
const after = before.split(NUL).join('\\u0000');
writeFileSync(F, after, 'utf8');
console.log('replaced', before.split(NUL).length - 1, 'NUL bytes in', F);

// And sweep the whole tree, because a control byte written once is a control byte that
// could have been written twice.
const SKIP = new Set(['node_modules', '.git', 'dist', 'icons', 'fonts', 'images', 'covers']);
const found = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('zzz-')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|mjs|js|md|html|json|txt|xml)$/.test(name)) {
      const body = readFileSync(p, 'utf8');
      // NUL and BACKSPACE, the two this repo has now seen.
      if (body.includes(NUL) || body.includes(String.fromCharCode(8))) found.push(p);
    }
  }
}
walk(process.cwd());
console.log(found.length ? 'STILL CARRYING CONTROL BYTES:\n' + found.join('\n') : 'tree clean of NUL and 0x08');
