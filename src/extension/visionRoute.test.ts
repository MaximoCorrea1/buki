import { describe, it, expect } from 'vitest';
import { visionRoute, PROXY_URL } from './visionRoute';
import { BUKI_HOST } from '../shared/host';
import { GEMINI } from '../recognizer/llmVision';

const NOW = Date.UTC(2026, 7, 17, 12, 0, 0);
const live = { token: 'session-token', expiresAt: NOW + 3_600_000 };

/**
 * WHICH SERVICE READS THE COVER, and with whose credential.
 *
 * Three answers, and getting the wrong one is expensive in a different way each time:
 * send a user's own key to our proxy and we are holding a credential we never wanted;
 * send our proxy a licence KEY instead of a session token and the long-lived secret is on
 * the wire every catch; send nothing at all when somebody is paying and they are quietly
 * demoted to the trial.
 */

const settings = (apiKey: string) => ({ apiKey, endpoint: GEMINI.endpoint, model: GEMINI.model });

describe('where a cover read is sent', () => {
  it('goes to the user\'s own provider when they configured one', () => {
    const route = visionRoute(settings('AIza-mine'), { key: 'LIC', session: live });
    expect(route.endpoint).toBe(GEMINI.endpoint);
    expect(route.apiKey).toBe('AIza-mine');
  });

  it('never sends their own key anywhere but their own provider', () => {
    // Their key is theirs. It has no business reaching Buki's proxy, and a route that
    // sends it there is a credential we are now responsible for and never asked for.
    const route = visionRoute(settings('AIza-mine'), { key: '', session: null });
    expect(route.endpoint).not.toContain(BUKI_HOST);
  });

  it('goes to Buki when there is no key of their own', () => {
    const route = visionRoute(settings(''), { key: '', session: null });
    expect(route.endpoint).toBe(PROXY_URL);
    expect(PROXY_URL.startsWith(BUKI_HOST)).toBe(true);
  });

  it('carries NOTHING on a trial request, so the server sees an absent header', () => {
    // `policy.ts` distinguishes an ABSENT Authorization header from an empty one: absent
    // is somebody who has never paid, empty is a session that broke. `llmVision` omits
    // the header entirely when apiKey is falsy, so this must be undefined and not ''.
    const route = visionRoute(settings(''), { key: '', session: null });
    expect(route.apiKey).toBeUndefined();
  });

  it('carries the SESSION token for a subscriber, never the licence key', () => {
    // The licence key is long-lived and is what a thief actually wants. It is exchanged
    // once a day for a token that expires; only the token travels with a catch.
    const route = visionRoute(settings(''), { key: 'LICENCE-KEY-SECRET', session: live });
    expect(route.apiKey).toBe('session-token');
    expect(route.apiKey).not.toContain('LICENCE-KEY-SECRET');
  });

  it('still sends the token the server would honour on grace', () => {
    // Expired by our clock, still inside the server's grace window. Withholding it here
    // would demote a paying customer during our own outage — the exact failure the grace
    // window exists to prevent.
    const stale = { token: 'session-token', expiresAt: NOW - 3_600_000 };
    expect(visionRoute(settings(''), { key: 'K', session: stale }, NOW).apiKey).toBe(
      'session-token',
    );
  });

  it('drops a session the server would refuse too, rather than sending a dead token', () => {
    const dead = { token: 'session-token', expiresAt: NOW - 40 * 86_400_000 };
    expect(visionRoute(settings(''), { key: 'K', session: dead }, NOW).apiKey).toBeUndefined();
  });

  it('keeps the model out of the proxy request, because the proxy chooses it', () => {
    // The server pins the alias. An extension that pinned its own would 404 for everyone
    // the day the model was retired, which has already happened twice.
    expect(visionRoute(settings(''), { key: '', session: null }).model).toBe('');
  });
});
