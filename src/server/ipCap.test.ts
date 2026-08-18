import { describe, it, expect } from 'vitest';
import { createIpCap, TRIAL_PER_IP_PER_DAY } from './ipCap';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 18, 12, 0, 0);

const from = (forwarded?: string): Request =>
  new Request('https://get-buki.vercel.app/api/vision', {
    method: 'POST',
    headers: forwarded === undefined ? {} : { 'x-forwarded-for': forwarded },
  });

/**
 * The counter behind `/api/vision`'s trial cap.
 *
 * It lived inline in `api/vision.ts` until 2026-08-18, in a file whose own header says it
 * is "the shell only ... deliberately short enough that nothing here needs a test". A day
 * rollover and a header-parsing rule are not nothing, and the header parsing in particular
 * decides WHO gets counted, which is the part worth being sure about.
 *
 * `OPENWORK.md` §5 already carries the general form: when one handler has a guard, ask what
 * the sibling has. `keyCap.ts` was extracted first, for `/api/license`; this is the sibling
 * that entry was written about.
 */

describe('the per-IP daily trial cap', () => {
  it('lets a household behind one NAT through', () => {
    // Generous on purpose: the free allowance is ten catches and several people can sit
    // behind one address. This is a brake on a runaway, not the trial counter — that lives
    // in the extension, on the machine.
    const cap = createIpCap();
    for (let i = 0; i < 20; i++) expect(cap(from('203.0.113.7'), NOW)).toBe(false);
  });

  it('stops at the ceiling and not before', () => {
    const cap = createIpCap();
    for (let i = 0; i < TRIAL_PER_IP_PER_DAY; i++) {
      expect(cap(from('203.0.113.7'), NOW)).toBe(false);
    }
    expect(cap(from('203.0.113.7'), NOW)).toBe(true);
  });

  it('counts each address separately', () => {
    const cap = createIpCap();
    for (let i = 0; i <= TRIAL_PER_IP_PER_DAY; i++) cap(from('203.0.113.7'), NOW);

    expect(cap(from('203.0.113.7'), NOW)).toBe(true);
    expect(cap(from('198.51.100.4'), NOW)).toBe(false);
  });

  it('forgets yesterday', () => {
    const cap = createIpCap();
    for (let i = 0; i <= TRIAL_PER_IP_PER_DAY; i++) cap(from('203.0.113.7'), NOW);
    expect(cap(from('203.0.113.7'), NOW)).toBe(true);

    expect(cap(from('203.0.113.7'), NOW + DAY)).toBe(false);
  });

  /**
   * THE HEADER RULE, which is the half that decides who gets counted.
   *
   * `x-forwarded-for` is a CHAIN: the client first, then every proxy that added itself.
   * Taking the last entry would count Vercel's own edge and put every trial user in the
   * world into one bucket; taking the whole string would give one client a fresh allowance
   * per proxy hop, since the chain changes.
   */
  it('counts the client, not the proxy chain behind it', () => {
    const cap = createIpCap();
    for (let i = 0; i <= TRIAL_PER_IP_PER_DAY; i++) {
      cap(from('203.0.113.7, 70.41.3.18, 150.172.238.178'), NOW);
    }

    // Same client, a different chain behind it: still the same bucket.
    expect(cap(from('203.0.113.7, 10.0.0.1'), NOW)).toBe(true);
    // A different client that happens to share the chain: its own allowance.
    expect(cap(from('198.51.100.4, 70.41.3.18'), NOW)).toBe(false);
  });

  it('ignores the spaces the chain is written with', () => {
    // "a, b" and "a,b" are the same header. Counting them apart would hand out a second
    // allowance for a formatting difference nobody controls.
    const cap = createIpCap();
    for (let i = 0; i <= TRIAL_PER_IP_PER_DAY; i++) cap(from('203.0.113.7,70.41.3.18'), NOW);

    expect(cap(from('  203.0.113.7 , 70.41.3.18'), NOW)).toBe(true);
  });

  it('puts every unidentifiable caller in ONE bucket, which is the safe direction', () => {
    // No header at all should not mean a fresh allowance each time. Sharing one bucket
    // makes the anonymous case TIGHTER than a named one rather than a way around the cap.
    const cap = createIpCap();
    for (let i = 0; i <= TRIAL_PER_IP_PER_DAY; i++) cap(from(), NOW);

    expect(cap(from(), NOW)).toBe(true);
    expect(cap(from(''), NOW)).toBe(true);
  });
});
