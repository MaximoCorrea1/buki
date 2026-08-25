import { describe, it, expect } from 'vitest';
import { activate, activationFor, nextProState } from './activateKey';
import type { ProState } from './proState';
import type { Exchange, Session } from './license';

/**
 * PRESSING ACTIVATE MUST NOT SPEND A SLOT THE PERSON ALREADY OWNS.
 *
 * A licence has FIVE activation slots and they are permanent — Polar creates one on every
 * `activate` call and nothing but the customer's own deactivation gives one back. So
 * pressing Activate on a key you already hold has to VALIDATE the activation you have, not
 * create a sixth.
 *
 * **The 2026-08-24 review proved this deletable with the suite fully green.** Replacing
 *
 *     const reuse = held.key === pasted ? held.activationId : undefined;
 *
 * with `const reuse = undefined;` gave `Test Files 58 passed / Tests 620 passed`. The only
 * guard was `expect(optionsSrc).toContain('activationId')`, which still passed because the
 * identifier survived in the `writePro` spread and in four comments.
 *
 * **Five presses lock the person who paid out of their own licence, permanently, with no
 * self-service fix** — and the Activate button is exactly what a human presses repeatedly
 * when a key does not seem to take.
 *
 * This file exists because `options.ts` cannot be imported by a test: it calls `main()` and
 * `wirePro()` at module scope. The decision is extracted, the way `saveBook.ts` was
 * extracted out of `background.ts` for the same reason, and asserted with REAL VALUES.
 */

const session: Session = { token: 'tok', expiresAt: 1_800_000_000_000 };
const ok = (over: Partial<Extract<Exchange, { ok: true }>> = {}): Exchange => ({
  ok: true,
  session,
  activationId: 'act_fresh',
  ...over,
});

describe('activationFor', () => {
  it('offers the stored id back when the key is the same one', () => {
    // The whole defect. Without this the server takes the ACTIVATE branch and burns a slot.
    const held: ProState = { key: 'BUKI-AAAA', session: null, activationId: 'act_1' };
    expect(activationFor('BUKI-AAAA', held)).toBe('act_1');
  });

  it('offers NOTHING for a different key, because that is a new pairing', () => {
    // Handing key B the activation id belonging to key A asks Polar to validate an
    // activation that does not exist on it, which fails and looks like a dead licence.
    const held: ProState = { key: 'BUKI-AAAA', session: null, activationId: 'act_1' };
    expect(activationFor('BUKI-BBBB', held)).toBeUndefined();
  });

  it('offers nothing when there is nothing stored', () => {
    expect(activationFor('BUKI-AAAA', { key: 'BUKI-AAAA', session: null })).toBeUndefined();
  });

  it('matches on the trimmed key the caller actually sends', () => {
    // Keys arrive pasted out of an email. `license.exchange` trims before sending, so a
    // comparison against the untrimmed field would offer no id for a key that is in fact
    // the same one — and quietly activate again.
    const held: ProState = { key: 'BUKI-AAAA', session: null, activationId: 'act_1' };
    expect(activationFor('  BUKI-AAAA \n', held)).toBe('act_1');
  });
});

describe('nextProState', () => {
  const held: ProState = { key: 'BUKI-AAAA', session: null, activationId: 'act_1' };

  it('keeps the fresh activation Polar just issued', () => {
    expect(nextProState('BUKI-AAAA', held, ok())).toEqual({
      key: 'BUKI-AAAA',
      session,
      activationId: 'act_fresh',
    });
  });

  it('FALLS BACK to the stored id when the answer carries none', () => {
    // A validate response echoes the activation, but if it ever does not, forgetting the id
    // would silently activate again next time and spend another slot.
    expect(nextProState('BUKI-AAAA', held, ok({ activationId: '' }))).toEqual({
      key: 'BUKI-AAAA',
      session,
      activationId: 'act_1',
    });
  });

  it('omits the field entirely when there is no id from either side', () => {
    // Omitted rather than empty-stringed, matching every other writer, so a record that
    // never had one round-trips unchanged instead of gaining a field meaning "no id".
    const first: ProState = { key: 'BUKI-BBBB', session: null };
    const next = nextProState('BUKI-BBBB', first, ok({ activationId: '' }));
    expect(next).toEqual({ key: 'BUKI-BBBB', session });
    expect(next && 'activationId' in next).toBe(false);
  });

  it('keeps the activation when the licence is refused outright', () => {
    // The session goes; the activation stays. This install is still paired with Polar, so
    // dropping the id would make the next success activate a SECOND time for one machine.
    const refused: Exchange = { ok: false, retryable: false, message: 'revoked' };
    expect(nextProState('BUKI-AAAA', held, refused)).toEqual({
      key: 'BUKI-AAAA',
      session: null,
      activationId: 'act_1',
    });
  });

  it('WRITES NOTHING when the failure might pass', () => {
    // An outage on our side must not sign a paying customer out. `null` means "do not
    // write", which is different from "write a state with no session".
    const wobble: Exchange = { ok: false, retryable: true, message: 'offline' };
    expect(nextProState('BUKI-AAAA', held, wobble)).toBeNull();
  });

  it('does not hand a NEW key the old key\'s activation, on success or refusal', () => {
    // Both branches, because the reuse decision is made once and both read it.
    expect(nextProState('BUKI-BBBB', held, ok({ activationId: '' }))).toEqual({
      key: 'BUKI-BBBB',
      session,
    });
    expect(
      nextProState('BUKI-BBBB', held, { ok: false, retryable: false }),
    ).toEqual({ key: 'BUKI-BBBB', session: null });
  });

  it('stores the trimmed key, so the next press recognises it', () => {
    // If the pasted value were stored untrimmed, `activationFor` would compare a trimmed
    // paste against an untrimmed store on the very next press and offer no id — activating
    // again. The trim has to happen once, here, and be what is written.
    expect(nextProState(' BUKI-AAAA \n', held, ok())).toEqual({
      key: 'BUKI-AAAA',
      session,
      activationId: 'act_fresh',
    });
  });
});

describe('activate, the whole press', () => {
  /**
   * THE ORCHESTRATION, not just the arithmetic.
   *
   * A mutation exposed why this had to exist. With only `activationFor` and `nextProState`
   * extracted, `options.ts` could still be rewritten to build its own state and call
   * `writePro` directly — and the whole suite stayed green, because the source guard in
   * `proState.test.ts` only forbids the two OLD spellings, and §5 records that a `?raw`
   * guard cannot see control flow at all.
   *
   * So the press itself is a function. `options.ts` now has no branch, no literal and no
   * decision left in it: it reads a field, calls this, and says the sentence that comes
   * back. **The review's fifth assertion — "retryable refusal → `writePro` not called" — is
   * a behaviour, and this is what makes it assertable.**
   */
  const held: ProState = { key: 'BUKI-AAAA', session: null, activationId: 'act_1' };

  const press = (result: Exchange, pasted = 'BUKI-AAAA') => {
    const written: ProState[] = [];
    const asked: (string | undefined)[] = [];
    return {
      written,
      asked,
      run: () =>
        activate({
          pasted,
          read: async () => held,
          exchange: async (key, activationId) => {
            asked.push(activationId);
            void key;
            return result;
          },
          write: async (state) => void written.push(state),
        }),
    };
  };

  it('offers the stored activation to the server', async () => {
    const p = press(ok());
    await p.run();
    expect(p.asked).toEqual(['act_1']);
  });

  it('offers nothing for a key it has not seen', async () => {
    const p = press(ok(), 'BUKI-BBBB');
    await p.run();
    expect(p.asked).toEqual([undefined]);
  });

  it('stores the new state and says Pro is on', async () => {
    const p = press(ok());
    expect(await p.run()).toBe('Pro is on. Cover reading is unlimited.');
    expect(p.written).toEqual([{ key: 'BUKI-AAAA', session, activationId: 'act_fresh' }]);
  });

  it('WRITES NOTHING when the failure might pass', async () => {
    // The assertion a source guard could never make. An outage on our side must not sign a
    // paying customer out, and "wrote a state with no session" is a different bug from
    // "wrote nothing" that no amount of reading options.ts as text can tell apart.
    const p = press({ ok: false, retryable: true, message: 'Could not reach Buki.' });
    expect(await p.run()).toBe('Could not reach Buki.');
    expect(p.written, 'an outage signed a paying customer out').toEqual([]);
  });

  it('clears the session but keeps the activation when the licence is refused', async () => {
    const p = press({ ok: false, retryable: false, message: 'That licence is not active.' });
    expect(await p.run()).toBe('That licence is not active.');
    expect(p.written).toEqual([{ key: 'BUKI-AAAA', session: null, activationId: 'act_1' }]);
  });

  it('has something to say when the server does not', async () => {
    const p = press({ ok: false, retryable: false });
    expect(await p.run()).toBe('That key could not be activated.');
  });
});
