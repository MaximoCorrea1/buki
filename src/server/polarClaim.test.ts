import { describe, it, expect } from 'vitest';
import { readClaim } from './polarClaim';

/**
 * AC-10. `OPENWORK.md` item 51.
 *
 * Polar's answer was CAST, never validated:
 *
 *     licenseKeyId: (parsed as PolarActivation).license_key?.id,
 *     status:       (parsed as PolarActivation).license_key?.status,
 *
 * A cast checks nothing at runtime. **A well-formed JSON body with different keys gives
 * `status === undefined`, which is not `'granted'`, which is a 403 — *"That licence is not
 * active"* — to a subscriber whose licence is perfectly fine.** The honest 502 was reachable
 * only on MALFORMED JSON, which is the one failure mode a large API almost never has.
 *
 * ⚠ **AND THE FILE ALREADY KNEW.** `PolarValidation`'s own docblock says it out loud:
 * *"Read one as the other and `status` is `undefined`, so every renewal 403s with 'That
 * licence is not active' and looks exactly like a revoked subscription."* It described the
 * bug as a reason to be careful with the two shapes, rather than as a reason to check.
 *
 * **Why the status code is the whole finding:** 403 is not in `worthRetrying`, so the
 * extension DESTROYS its session and the customer meets the wall they paid to pass. 502 is,
 * so they keep the session and ride the grace window. One number, and it decides whether an
 * upstream hiccup is invisible or a lockout.
 */

const ACTIVATE = {
  id: 'act_1',
  license_key: { id: 'lk_1', status: 'granted', expires_at: null },
};

const VALIDATE = { id: 'lk_1', status: 'granted', activation: { id: 'act_1' } };

describe('reading a claim out of Polar’s answer', () => {
  it('reads the activate shape, where the top-level id is the ACTIVATION', () => {
    expect(readClaim(ACTIVATE, false, '')).toEqual({
      licenseKeyId: 'lk_1',
      activationId: 'act_1',
      status: 'granted',
    });
  });

  it('reads the validate shape, which is INVERTED from activate’s', () => {
    expect(readClaim(VALIDATE, true, 'act_1')).toEqual({
      licenseKeyId: 'lk_1',
      activationId: 'act_1',
      status: 'granted',
    });
  });

  it('falls back to the activation id we sent, which is what makes renewal safe', () => {
    const { activation, ...withoutActivation } = VALIDATE;
    void activation;
    expect(readClaim(withoutActivation, true, 'act_sent')?.activationId).toBe('act_sent');
  });

  /** THE FINDING. Every one of these used to become "That licence is not active". */
  it('refuses a well-formed body with the wrong keys, rather than calling it revoked', () => {
    for (const body of [
      {},
      { id: 'lk_1' },
      { license_key: {} },
      { license_key: { id: 'lk_1' } },
      { data: { id: 'lk_1', status: 'granted' } },
      { error: 'not found' },
    ]) {
      expect(readClaim(body, false, ''), JSON.stringify(body)).toBeNull();
    }
  });

  it('refuses ACTIVATE’s shape arriving on the VALIDATE path, which is the documented trap', () => {
    // The two shapes are inverted, and reading one as the other is what the PolarValidation
    // docblock warns about. It was a warning; now it is a check.
    expect(readClaim(ACTIVATE, true, 'act_1')).toBeNull();
  });

  it('refuses a status that is not a string, because a cast would have accepted it', () => {
    expect(readClaim({ ...ACTIVATE, license_key: { id: 'lk_1', status: 42 } }, false, '')).toBeNull();
    expect(readClaim({ ...ACTIVATE, license_key: { id: 'lk_1', status: null } }, false, '')).toBeNull();
    expect(readClaim({ ...ACTIVATE, license_key: { id: 'lk_1', status: '' } }, false, '')).toBeNull();
  });

  it('refuses a missing or empty licence id', () => {
    expect(readClaim({ ...ACTIVATE, license_key: { status: 'granted' } }, false, '')).toBeNull();
    expect(readClaim({ ...ACTIVATE, license_key: { id: '', status: 'granted' } }, false, '')).toBeNull();
  });

  it('refuses a body that is not an object at all', () => {
    for (const body of [null, undefined, 'granted', 42, true, []]) {
      expect(readClaim(body, false, ''), String(body)).toBeNull();
    }
  });

  /**
   * A VALID SHAPE CARRYING A BAD STATUS STILL READS, and that separation is the point.
   *
   * *"Polar says this licence is revoked"* is an ANSWER ABOUT THE CUSTOMER and belongs at
   * 403. *"Polar sent something Buki cannot read"* is our upstream failing its contract and
   * belongs at 502. Collapsing them is what made an outage look like a cancellation.
   */
  it('reads a revoked licence fine, and leaves the verdict to the caller', () => {
    const revoked = { ...ACTIVATE, license_key: { id: 'lk_1', status: 'revoked' } };
    expect(readClaim(revoked, false, '')).toEqual({
      licenseKeyId: 'lk_1',
      activationId: 'act_1',
      status: 'revoked',
    });
  });

  it('refuses an activate answer with no activation id, which would burn a slot a week later', () => {
    // Item 48, ADV-3: `undefined` does not survive JSON.stringify, so it vanishes from the
    // signed claim and the next renewal ACTIVATES AGAIN. Five permanent slots, renewal
    // daily, locked out inside a week.
    const { id, ...noId } = ACTIVATE;
    void id;
    expect(readClaim(noId, false, '')).toBeNull();
  });
});
