import { describe, it, expect } from 'vitest';
import { createIpCap, TRIAL_PER_IP_PER_DAY, LICENSE_PER_IP_PER_DAY } from './ipCap';
import LICENSE_SHELL from '../../api/license.ts?raw';

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

  /**
   * PERF-6 / SEC-4. `OPENWORK.md` item 51.
   *
   * The module used to carry an explicit argument for having no eviction: *"an attacker
   * cannot mint new source IPs the way they can mint candidate licence keys."* **That is
   * IPv4 reasoning.** A residential IPv6 customer is delegated a /64 at minimum — often a
   * /56 or /48 — and every address inside it routes back to them. So they can mint 2^64
   * source addresses at no cost, which is both a free bypass of the cap and an unbounded
   * map. A comment vouching for a hole is worse than no comment.
   */
  it('counts a whole IPv6 /64 as ONE caller, because its owner can mint every address in it', () => {
    const cap = createIpCap();
    for (let i = 0; i <= TRIAL_PER_IP_PER_DAY; i++) cap(from('2001:db8:1234:5678::1'), NOW);
    expect(cap(from('2001:db8:1234:5678::1'), NOW)).toBe(true);

    // A different address in the SAME delegation. Free to choose, so it must not be free
    // to use: this is the request that used to reset the allowance.
    expect(cap(from('2001:db8:1234:5678:dead:beef:cafe:1'), NOW)).toBe(true);
    expect(cap(from('2001:db8:1234:5678:ffff::9'), NOW)).toBe(true);
  });

  it('still gives a DIFFERENT /64 its own allowance', () => {
    // The prefix is the caller. Collapsing more than the /64 would put unrelated customers
    // of one ISP into a single bucket, which is the opposite failure.
    const cap = createIpCap();
    for (let i = 0; i <= TRIAL_PER_IP_PER_DAY; i++) cap(from('2001:db8:1234:5678::1'), NOW);

    expect(cap(from('2001:db8:1234:5678::1'), NOW)).toBe(true);
    expect(cap(from('2001:db8:1234:9999::1'), NOW)).toBe(false);
  });

  it('reads an IPv6 address a proxy wrote with brackets and a port', () => {
    // `[2001:db8::1]:443` is a legal way for a proxy to write it. Treating that as a
    // different caller from the bare form would hand out a second allowance for a
    // formatting difference, exactly as the spaces test says about the chain.
    const cap = createIpCap();
    for (let i = 0; i <= TRIAL_PER_IP_PER_DAY; i++) cap(from('2001:db8:1234:5678::1'), NOW);

    expect(cap(from('[2001:db8:1234:5678::1]:443'), NOW)).toBe(true);
  });

  it('leaves IPv4 alone: a whole address, not a prefix', () => {
    // IPv4 has no per-customer delegation to collapse. Two addresses that share three
    // octets are two different customers, and folding them would throttle strangers.
    const cap = createIpCap();
    for (let i = 0; i <= TRIAL_PER_IP_PER_DAY; i++) cap(from('203.0.113.7'), NOW);

    expect(cap(from('203.0.113.7'), NOW)).toBe(true);
    expect(cap(from('203.0.113.8'), NOW)).toBe(false);
  });

  it('keeps an IPv4-mapped address whole, because its /64 is the same for everyone', () => {
    // FOUND BY A SURVIVING MUTATION, not by writing the test first. `::ffff:203.0.113.7`
    // folded to a /64 is `0:0:0:0` — every mapped caller in the world in one bucket, which
    // is an outage for strangers rather than a brake on a prober.
    const cap = createIpCap();
    for (let i = 0; i <= TRIAL_PER_IP_PER_DAY; i++) cap(from('::ffff:203.0.113.7'), NOW);

    expect(cap(from('::ffff:203.0.113.7'), NOW)).toBe(true);
    expect(cap(from('::ffff:198.51.100.4'), NOW)).toBe(false);
  });

  it('reads 0db8 and db8 as the same hextet', () => {
    // ALSO FOUND BY A SURVIVING MUTATION. Leading zeros are optional in IPv6, so a caller
    // that writes them out would otherwise get a second allowance for a spelling — the
    // same failure the spaces-in-the-chain test exists to prevent.
    const cap = createIpCap();
    for (let i = 0; i <= TRIAL_PER_IP_PER_DAY; i++) cap(from('2001:db8:1234:5678::1'), NOW);

    expect(cap(from('2001:0db8:1234:5678::1'), NOW)).toBe(true);
    expect(cap(from('2001:0DB8:1234:5678::9'), NOW)).toBe(true);
  });

  it('bounds the map, so no caller can grow an isolate without limit', () => {
    // The /64 rule removes the cheap way to mint keys; it does not remove the map's
    // ability to grow forever across a long-lived isolate. `keyCap` already carries this
    // exact shape, and the sibling rule in §5 is that when one handler has a guard you ask
    // what the other one has.
    const cap = createIpCap({ maxTracked: 50 });
    for (let i = 0; i < 200; i++) cap(from(`2001:db8:0:${i.toString(16)}::1`), NOW);

    expect(cap.size()).toBeLessThanOrEqual(51);
  });

  it('forgetting OPENS the brake rather than closing it', () => {
    // Same deliberate direction as keyCap: refusing everybody once the bookkeeping
    // overflows would turn a probing attack into an outage for people who are not probing.
    const cap = createIpCap({ maxTracked: 10 });
    for (let i = 0; i <= TRIAL_PER_IP_PER_DAY; i++) cap(from('2001:db8:1111:2222::1'), NOW);
    expect(cap(from('2001:db8:1111:2222::1'), NOW)).toBe(true);

    for (let i = 0; i < 100; i++) cap(from(`2001:db8:9:${i.toString(16)}::1`), NOW);

    expect(cap(from('2001:db8:1111:2222::1'), NOW)).toBe(false);
  });

  it('honours a caller-supplied ceiling, and defaults to the trial one', () => {
    // `/api/license` needs a looser ceiling than `/api/vision`: five activation slots
    // renewing daily, times a household, times retries. See LICENSE_PER_IP_PER_DAY.
    const tight = createIpCap({ perDay: 2 });
    expect(tight(from('203.0.113.7'), NOW)).toBe(false);
    expect(tight(from('203.0.113.7'), NOW)).toBe(false);
    expect(tight(from('203.0.113.7'), NOW)).toBe(true);

    const dflt = createIpCap();
    for (let i = 0; i < TRIAL_PER_IP_PER_DAY; i++) {
      expect(dflt(from('198.51.100.4'), NOW)).toBe(false);
    }
    expect(dflt(from('198.51.100.4'), NOW)).toBe(true);
  });

  it('gives the licence endpoint room a real household needs', () => {
    // The number itself, asserted rather than assumed: a value that drifted below a
    // plausible household would lock out somebody who is paying, which is the worst
    // outcome that endpoint has.
    expect(LICENSE_PER_IP_PER_DAY).toBeGreaterThan(TRIAL_PER_IP_PER_DAY);
    expect(LICENSE_PER_IP_PER_DAY).toBeGreaterThanOrEqual(120);
  });

  /**
   * The shells are the one place a ceiling can be wired to the wrong constant invisibly.
   *
   * `api/license.ts` says of itself that it is "the shell only" and needs no test, which is
   * true of its logic and false of its WIRING: passing `/api/vision`'s trial ceiling here
   * would throttle paying subscribers, typecheck cleanly, and pass every test above.
   *
   * Written as an ABSENCE proof, per `CLAUDE.md`: the load-bearing half is that the trial
   * ceiling does not appear, because "the right constant is mentioned somewhere" is a claim
   * a comment satisfies. Comments are stripped first for exactly that reason.
   */
  it('wires the licence shell to the licence ceiling, and to no other', () => {
    const code = LICENSE_SHELL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    // ⚠ THE FIRST VERSION OF THIS TEST ASSERTED `code.toContain('LICENSE_PER_IP_PER_DAY')`
    // AND A MUTATION WALKED STRAIGHT THROUGH IT. Stripping comments was not enough,
    // because the IMPORT LINE still names the constant — so a shell that imported it and
    // then called `createIpCap()` with no arguments, silently taking the trial ceiling,
    // satisfied every assertion. A mention is not a use. §5 T11's shape, one level up.
    //
    // So the guard reads the CALL, not the file.
    expect(code).toMatch(/createIpCap\(\s*\{[^}]*perDay:\s*LICENSE_PER_IP_PER_DAY[^}]*\}\s*\)/);
    expect(code).toContain('ipCap,');

    // THE TWO HALVES THAT DISCRIMINATE. No other ceiling is reachable from this file, and
    // there is no un-ceilinged construction of the cap anywhere in it.
    expect(code).not.toContain('TRIAL_PER_IP_PER_DAY');
    expect(code).not.toMatch(/createIpCap\(\s*\)/);
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
