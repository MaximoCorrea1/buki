import { describe, it, expect, vi } from 'vitest';
import { SAFE_HEADERS } from './responseHeaders';
import { handleLicense, type LicenseEnv } from './licenseHandler';
import { handleVision, type VisionEnv } from './visionHandler';
import LICENSE_SRC from './licenseHandler.ts?raw';
import VISION_SRC from './visionHandler.ts?raw';
import VERCEL_JSON from '../../vercel.json?raw';

/**
 * TM-12. `OPENWORK.md` item 51.
 *
 * `vercel.json`'s headers block is sourced `/((?!api/).*)` — **every path EXCEPT the API.**
 * So the two endpoints answered with `content-type` and nothing else: no `nosniff`, and no
 * `Cache-Control: no-store`.
 *
 * The second one is the one that matters. **`/api/license` returns a bearer token in its
 * body** — an eight-day credential, `TOKEN_TTL_MS` plus `GRACE_MS` — and a response with no
 * cache directive is a response any intermediary is entitled to store. The endpoint holding
 * the money-spending credential was the one with no cache instruction.
 *
 * FIXED IN THE HANDLERS RATHER THAN IN `vercel.json`, and the platform config is kept as a
 * second layer rather than the only one. A header set by hosting configuration is a header
 * that disappears silently when the hosting changes, and this repo has already been bitten
 * by exactly that shape — `ipCap`'s `x-forwarded-for` safety comes from Vercel overwriting
 * it at the edge, which the threat model had to say out loud because the CODE could not.
 * Headers set where the response is built travel with the code and can be tested here.
 */

const SECRET = 'test-secret-at-least-32-characters-long!!';
const EXT = 'abcdefghijklmnopabcdefghijklmnop';
const NOW = Date.UTC(2026, 7, 17, 12, 0, 0);

const granted = { id: 'act_1', license_key: { id: 'lk_1', status: 'granted', expires_at: null } };

const licenseEnv = (over: Partial<LicenseEnv> = {}): LicenseEnv => ({
  secret: SECRET,
  polarToken: 'POLAR-TOKEN-SECRET',
  organizationId: 'org_1',
  extensionId: EXT,
  activateUrl: 'https://api.polar.test/v1/license-keys/activate',
  validateUrl: 'https://api.polar.test/v1/license-keys/validate',
  fetch: vi.fn(async () => new Response(JSON.stringify(granted), { status: 200 })),
  now: () => NOW,
  keyCap: () => false,
  ipCap: () => false,
  ...over,
});

const visionEnv = (over: Partial<VisionEnv> = {}): VisionEnv => ({
  secret: SECRET,
  providerKey: 'PROVIDER-KEY-SECRET',
  extensionId: EXT,
  trialClosed: false,
  providerUrl: 'https://provider.test/v1/chat/completions',
  fetch: vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })),
  now: () => NOW,
  ipCap: () => false,
  proCap: () => false,
  revoked: () => false,
  ...over,
});

const licensePost = (body: unknown): Request =>
  new Request('https://get-buki.vercel.app/api/license', {
    method: 'POST',
    headers: { origin: `chrome-extension://${EXT}` },
    body: JSON.stringify(body),
  });

describe('the headers every API response carries', () => {
  it('names no-store and nosniff, and says so once', () => {
    expect(SAFE_HEADERS['cache-control']).toBe('no-store');
    expect(SAFE_HEADERS['x-content-type-options']).toBe('nosniff');
  });

  it('puts them on a licence response, which carries a bearer token in its body', async () => {
    const res = await handleLicense(licensePost({ key: 'KEY-1' }), licenseEnv());

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-type')).toBe('application/json');
  });

  it('puts them on a licence REFUSAL too, because a 403 is cacheable as well', async () => {
    const res = await handleLicense(licensePost({ key: '' }), licenseEnv());

    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('puts them on the vision relay, whose body is a paid answer', async () => {
    const res = await handleVision(
      new Request('https://get-buki.vercel.app/api/vision', {
        method: 'POST',
        headers: { origin: `chrome-extension://${EXT}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'x',
          messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        }),
      }),
      visionEnv(),
    );

    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

/**
 * The absence proof, and it is the half that discriminates.
 *
 * Asserting "the headers are set somewhere" is satisfied by ONE call site out of three.
 * What has to be true is that there is **no response constructed in either handler that
 * skips them** — the same shape as `contentSafety.test.ts`, which proves there is no second
 * way in rather than that the safe way exists.
 */
describe('there is no second way to build a response', () => {
  const strip = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  for (const [name, src] of [
    ['licenseHandler.ts', LICENSE_SRC],
    ['visionHandler.ts', VISION_SRC],
  ] as const) {
    it(`${name} spreads SAFE_HEADERS into every response it builds`, () => {
      const code = strip(src);
      const built = code.match(/new Response\(/g)?.length ?? 0;
      const safe = code.match(/\.\.\.SAFE_HEADERS/g)?.length ?? 0;

      // Every construction site, not "at least one".
      expect(built).toBeGreaterThan(0);
      expect(safe).toBe(built);
    });
  }
});

/**
 * `vercel.json` is the second layer, kept because a header set in two places survives one
 * of them being wrong. It is NOT the primary: the handlers are, and the tests above are why.
 */
describe('the platform config, as defence in depth', () => {
  it('stops excluding /api/ from the headers block', () => {
    const config = JSON.parse(VERCEL_JSON) as {
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };

    // ⚠ NOT `source.includes('api')`. The block that was already there is sourced
    // `/((?!api/).*)` — it MENTIONS api in order to EXCLUDE it, so a substring test finds
    // the exclusion and calls it coverage. Ask instead whether the pattern actually matches
    // a real API path, which is the only question that decides anything.
    const applies = (source: string): boolean => {
      try {
        return new RegExp(`^${source}$`).test('/api/license');
      } catch {
        return false;
      }
    };

    const api = config.headers.find((h) => applies(h.source));
    expect(api, 'no headers block in vercel.json matches /api/license').toBeDefined();

    const keys = new Map(api!.headers.map((h) => [h.key.toLowerCase(), h.value]));
    expect(keys.get('cache-control')).toBe('no-store');
    expect(keys.get('x-content-type-options')).toBe('nosniff');
  });
});
