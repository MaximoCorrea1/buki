import { describe, it, expect } from 'vitest';
import { worthRetrying } from './retry';

/**
 * WILL WAITING HELP? One answer, in one place, because there were two and they disagreed.
 *
 * `llmVision.ts:78` had it right and had had it right for months:
 *
 *     this.permanent = status < 500 && status !== 429 && status !== TIMEOUT_STATUS;
 *
 * `license.ts:118` had `retryable: res.status >= 500` — and that missing clause is the
 * whole of P0-2's client half. Our OWN `keyCap` answers 429 with "Try again tomorrow", a
 * customer can meet it with five installs on a bad network day, and the extension read that
 * as definitive: `proState.ts` wrote `session: null`, the bearer token was erased from
 * disk, the next catch travelled with no Authorization header, the server classified it
 * `trial`, and a paying subscriber met the wall they had already paid to pass.
 *
 * The token was NOT expired. `verify` would have returned `expired` and `decideAccess`
 * would have served `{kind:'pro', grace:true}` for another seven days. **The grace window
 * was defeated by destroying the evidence it runs on.**
 *
 * So the rule lives here, in `src/shared/`, which both `src/recognizer/` and
 * `src/extension/` may import without adding an edge against the dependency graph. Two
 * copies of a rule is two rules.
 */

describe('worthRetrying', () => {
  it('says yes to every server-side failure', () => {
    // Ours or Polar's, it is a bad minute rather than an answer about this licence.
    for (const status of [500, 502, 503, 504, 599]) {
      expect(worthRetrying(status), `${status} was treated as final`).toBe(true);
    }
  });

  it('says yes to 429, which is the one our OWN cap answers with', () => {
    // `CHECKS_PER_KEY_PER_DAY = 40`. A customer with five installs on a bad network day
    // reaches it, and the message even says "Try again tomorrow" — advice that only makes
    // sense if the caller keeps what it has.
    expect(worthRetrying(429)).toBe(true);
  });

  it('says yes to 408, because a timeout is the definition of "try again"', () => {
    expect(worthRetrying(408)).toBe(true);
  });

  it('says no to an answer about this key', () => {
    // Revoked, refunded, wrong key, activation limit reached. Waiting changes none of them,
    // and telling somebody to try again in a moment is advice that can never work.
    for (const status of [400, 401, 402, 403, 404, 409, 410, 422]) {
      expect(worthRetrying(status), `${status} was treated as transient`).toBe(false);
    }
  });

  it('says no to a success, so nothing loops on one', () => {
    expect(worthRetrying(200)).toBe(false);
    expect(worthRetrying(204)).toBe(false);
  });
});
