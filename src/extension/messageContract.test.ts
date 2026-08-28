import { describe, it, expect, vi } from 'vitest';
import { MESSAGE_CONTRACT_COMPLETE, unhandled } from './messages';
import MESSAGES_SRC from './messages.ts?raw';
import BACKGROUND_SRC from './background.ts?raw';
import CONTENT_SRC from './content.ts?raw';

/**
 * TS-3 and TS-4. `OPENWORK.md` item 53.
 *
 * **TS-3.** The request unions and the response types both existed and **nothing connected
 * them.** `chrome.runtime.sendMessage` defaults its response to `any`, so most variants had
 * no declared answer — a renamed field compiled clean on BOTH sides and broke only at
 * runtime. `messages.ts`'s own header records that happening once, surfacing as a misleading
 * *"OCR failed"*.
 *
 * **TS-4.** Neither receiver had an exhaustiveness check, so a new variant was a **silent
 * no-op**: the message went, no branch matched, nothing answered, and the sender's `await`
 * resolved to `undefined`. The feature is simply missing and nothing says so.
 *
 * ⚠ **BOTH FIXES ARE COMPILE-TIME, and `background.ts`/`content.ts` cannot be imported by a
 * test — so most of the proof is not in this file.** It was done the way TS-7's was, by
 * watching it fail: a ninth variant with no reply and no branch was added on 2026-08-28 and
 * produced **exactly two errors** —
 *
 *     messages.ts    Type 'true' is not assignable to type 'never'   (TS-3)
 *     background.ts  Argument of type '{ type: "zzzProbe" }' is not
 *                    assignable to parameter of type 'never'          (TS-4)
 *
 * — then removed. What this file adds is the part a compiler cannot give: proof that the
 * guards are still PRESENT, since deleting either one compiles perfectly.
 */
describe('the message contract', () => {
  it('covers every variant in both directions', () => {
    // `MESSAGE_CONTRACT_COMPLETE` is typed `never` unless each reply map's keys are EXACTLY
    // its union's `type` values. A missing reply fails, and so does a reply for a variant
    // that no longer exists — which is what caught two mistakes in the map on its first run:
    // an invented `cancelRecognize` and a missing `catchResolve`.
    expect(MESSAGE_CONTRACT_COMPLETE).toBe(true);
  });

  it('says something when a message reaches nobody', () => {
    // `unhandled` takes `never`, so at runtime it should only ever be reached by a message
    // from a NEWER build talking to an older one. Silence there is the failure mode this
    // whole finding is about, so it logs.
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    unhandled({ type: 'fromTheFuture' } as never);

    expect(error).toHaveBeenCalled();
    expect(String(error.mock.calls[0]?.[0])).toContain('unhandled message');
    error.mockRestore();
  });
});

/**
 * The absence proof. Deleting an exhaustiveness check compiles perfectly, which is exactly
 * why one was missing for so long — nothing anywhere would have noticed.
 */
describe('both receivers still say every case was handled', () => {
  const strip = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  for (const [name, src] of [
    ['background.ts', BACKGROUND_SRC],
    ['content.ts', CONTENT_SRC],
  ] as const) {
    it(`${name} calls unhandled() at the end of its listener`, () => {
      const code = strip(src);
      expect(code, `${name} lost its exhaustiveness check`).toContain('unhandled(msg)');
    });
  }

  it('never lets a receiver fall through silently again', () => {
    // The shape the finding had: a bare terminator with nothing said. Asserted against the
    // two spellings that were actually there.
    const bg = strip(BACKGROUND_SRC);
    expect(bg).not.toMatch(/if \(msg\?\.type !== 'recognize'\) return false;/);
  });

  /**
   * ⚠ **A SOURCE GUARD STANDING IN FOR A COMPILE-TIME PROPERTY, and saying so is the point.**
   *
   * Two mutations SURVIVED before this was written: one that weakened the proof to a single
   * direction, and one that dropped its type annotation entirely. **Neither could fail**,
   * because the harness runs `vitest` and both are TYPE-level — `MESSAGE_CONTRACT_COMPLETE`
   * is `true` at runtime whatever its declared type says.
   *
   * The real verification is `tsc`, and it was done by watching it fail (see this file's
   * header: a probe variant produced exactly two errors, one of them here). **What a runtime
   * test can still do is stop the guard being DELETED**, which is the failure that actually
   * happens — nobody weakens a type check on purpose, they remove it while refactoring.
   *
   * So this asserts the SHAPE, both directions named explicitly, rather than just the name.
   */
  it('keeps the completeness proof, in both directions', () => {
    const code = strip(MESSAGES_SRC);

    expect(code).toContain('MESSAGE_CONTRACT_COMPLETE');
    // The annotation is what makes the const a proof rather than a boolean.
    expect(code).toMatch(
      /MESSAGE_CONTRACT_COMPLETE:\s*BackgroundRepliesAreComplete\s*&\s*ContentRepliesAreComplete/,
    );

    // BOTH DIRECTIONS, named. A one-way check passes a map that has every variant AND a
    // stale reply for one that was deleted - which is half a guard.
    expect(code).toContain("BackgroundRequest['type'] extends keyof BackgroundReplies");
    expect(code).toContain("keyof BackgroundReplies extends BackgroundRequest['type']");
    expect(code).toContain("ContentRequest['type'] extends keyof ContentReplies");
    expect(code).toContain("keyof ContentReplies extends ContentRequest['type']");
  });
});
