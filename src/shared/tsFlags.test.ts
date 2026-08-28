import { describe, it, expect } from 'vitest';
import TSCONFIG from '../../tsconfig.json?raw';

/**
 * TS-7. `OPENWORK.md` item 53.
 *
 * `exactOptionalPropertyTypes` is **the one compiler flag that makes "omitted" and "present
 * but undefined" different types** — and this repo reasons about that distinction constantly,
 * IN PROSE. `storage.ts`, `shelfEdit.ts`, `mergeBook.ts`, `coverSource.ts` and `license.ts`
 * all carry a comment explaining why a conditional spread is not the same as an assignment.
 * **Prose is not checked.** This flag is what turns those five comments into a type.
 *
 * It is also the only thing that would have made the ORIGINAL `activationId` bug red:
 * `undefined` does not survive `JSON.stringify`, so the field vanished out of a signed claim
 * and the next renewal spent another of a licence key's five permanent slots.
 *
 * **VERIFIED THE WAY A GUARD SHOULD BE — by watching it fail.** A file containing
 * `{ title: 'x', author: 'y', isbn: undefined }` typed as `Book` was compiled twice on
 * 2026-08-28: **1 error with the flag on, 0 with it off.** The flag catches the bug class it
 * was turned on for, rather than being assumed to.
 *
 * ⚠ **THE REVIEW PREDICTED "a wave of errors, and that wave IS the finding".** The wave was
 * **ELEVEN** — five in production code, and one of those inside a function nothing called.
 * The conditional-spread discipline had already absorbed the rest, which is a better result
 * than the review expected and worth recording as such.
 *
 * This test exists because **nothing else would notice the flag being removed.** Every test
 * would still pass, the build would still succeed, and the repo would silently go back to
 * treating two different things as one.
 */
describe('the compiler flags this repo depends on', () => {
  const config = JSON.parse(
    TSCONFIG.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
  ) as { compilerOptions?: Record<string, unknown> };

  it('keeps exactOptionalPropertyTypes on', () => {
    expect(config.compilerOptions?.['exactOptionalPropertyTypes']).toBe(true);
  });

  it('keeps strict on, which the flag above builds upon', () => {
    expect(config.compilerOptions?.['strict']).toBe(true);
  });
});
