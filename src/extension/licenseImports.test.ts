import { describe, it, expect } from 'vitest';
import LICENSE_SRC from './license.ts?raw';
import PROSTATE_SRC from './proState.ts?raw';
import VISIONROUTE_SRC from './visionRoute.ts?raw';

/**
 * AC-5, as an ABSENCE PROOF. `OPENWORK.md` item 51.
 *
 * **The finding was not that a number was wrong. It was that the number was in the wrong
 * BUILD.** `license.ts` imported `TOKEN_TTL_MS` and `GRACE_MS` from `src/server/token`, so
 * the proxy's lifetime constants were compiled into every shipped install — and a published
 * extension updates on Chrome's schedule, not ours. Change either server-side and every
 * client already out there disagrees with the proxy about when a token dies, silently, in
 * the direction that shows a paywall to somebody who paid.
 *
 * The lifetime crosses the wire now (`expiresIn`, `graceMs`). **This test is what stops it
 * quietly going back**, because nothing else would: re-adding the import typechecks, passes
 * every behavioural test, and produces a client that is correct on the day it ships and
 * wrong on the day the server changes.
 *
 * ⚠ **WRITTEN AS AN ABSENCE PROOF, per `CLAUDE.md`.** *"The right constant is used
 * somewhere"* is a claim a comment satisfies. *"There is no second way for a server
 * constant to enter this bundle"* is the thing that has to be true, so comments are stripped
 * and every extension module on the licence path is checked, not just the one that had the
 * bug.
 */

const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('what the client is allowed to compile in', () => {
  it('never compiles the server’s TOKEN LIFETIME into the bundle', () => {
    // The one that is now entirely gone. It was imported to be re-exported, and nothing
    // imported the re-export.
    for (const [name, src] of [
      ['license.ts', LICENSE_SRC],
      ['proState.ts', PROSTATE_SRC],
      ['visionRoute.ts', VISIONROUTE_SRC],
    ] as const) {
      expect(strip(src), `${name} compiles in the server's token lifetime`).not.toContain(
        'TOKEN_TTL_MS',
      );
    }
  });

  it('imports GRACE_MS in exactly ONE place, and only as the last-known fallback', () => {
    const code = strip(LICENSE_SRC);

    // It survives deliberately: a session stored before `graceMs` existed has none, and
    // treating that as zero would sign every existing subscriber out on the update.
    const imports = code.match(/^import .*GRACE_MS.* from '\.\.\/server\/token';$/gm) ?? [];
    expect(imports).toHaveLength(1);

    // THE HALVES THAT DISCRIMINATE. It may only ever appear as the right-hand side of a
    // fallback, and it may not be handed back out for anybody else to compile in.
    expect(code).toContain('session.graceMs ?? GRACE_MS');
    expect(code).not.toMatch(/export\s*\{[^}]*GRACE_MS/);
  });

  it('reads the lifetime off the response, which is the thing that replaced the constants', () => {
    // Not a style check. If these stop being read, the constants are back in charge and the
    // test above still passes.
    const code = strip(LICENSE_SRC);
    expect(code).toContain('expiresIn');
    expect(code).toContain('graceMs');
  });

  it('never lets another extension module reach into src/server/ for a lifetime number', () => {
    // `license.ts` owns this seam. A second module importing the same constants would be a
    // second copy of the rule, which is the drift `shared/retry.ts` exists to record.
    for (const [name, src] of [
      ['proState.ts', PROSTATE_SRC],
      ['visionRoute.ts', VISIONROUTE_SRC],
    ] as const) {
      expect(strip(src), `${name} reaches into src/server/`).not.toMatch(
        /from '\.\.\/server\/token'/,
      );
    }
  });
});
