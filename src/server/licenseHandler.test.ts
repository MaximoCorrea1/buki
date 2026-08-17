import { describe, it, expect, vi } from 'vitest';
import { handleLicense, type LicenseEnv } from './licenseHandler';
import { verify, TOKEN_TTL_MS } from './token';

const SECRET = 'test-secret-at-least-32-characters-long!!';
const NOW = Date.UTC(2026, 7, 17, 12, 0, 0);

/**
 * Licence key in, session token out.
 *
 * Called once a day by an extension that already holds a licence, and never during a
 * catch. Polar's customer-portal endpoints would let the extension do this itself without
 * a secret, but the proxy has to verify the licence anyway before spending our provider
 * key, so a check made in the extension would be decoration. One place decides.
 */

const granted = {
  id: 'act_1',
  license_key: { id: 'lk_1', status: 'granted', expires_at: null },
};

const env = (over: Partial<LicenseEnv> = {}): LicenseEnv => ({
  secret: SECRET,
  polarToken: 'POLAR-TOKEN-SECRET',
  organizationId: 'org_1',
  activateUrl: 'https://api.polar.test/v1/license-keys/activate',
  fetch: vi.fn(async () => new Response(JSON.stringify(granted), { status: 200 })),
  now: () => NOW,
  ...over,
});

const post = (body: unknown): Request =>
  new Request('https://get-buki.vercel.app/api/license', {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('exchanging a licence for a session', () => {
  it('refuses anything that is not a POST', async () => {
    const res = await handleLicense(new Request('https://x/api/license'), env());
    expect(res.status).toBe(405);
  });

  it('refuses to run misconfigured', async () => {
    for (const missing of ['secret', 'polarToken', 'organizationId'] as const) {
      expect((await handleLicense(post({ key: 'K' }), env({ [missing]: '' }))).status).toBe(500);
    }
  });

  it('returns a token this repo can actually verify', async () => {
    const res = await handleLicense(post({ key: 'KEY-1' }), env());
    expect(res.status).toBe(200);
    const { token, expiresAt } = (await res.json()) as { token: string; expiresAt: number };
    expect(expiresAt).toBe(NOW + TOKEN_TTL_MS);
    const verdict = await verify(token, SECRET, NOW);
    expect(verdict.state).toBe('valid');
  });

  it('names the licence and the activation in the claim, so a key can be traced', async () => {
    const res = await handleLicense(post({ key: 'KEY-1' }), env());
    const { token } = (await res.json()) as { token: string };
    const verdict = await verify(token, SECRET, NOW);
    expect(verdict.state === 'valid' && verdict.claim).toMatchObject({
      licenseKeyId: 'lk_1',
      activationId: 'act_1',
    });
  });

  it('rejects an empty key without troubling Polar', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    expect((await handleLicense(post({ key: '   ' }), env({ fetch }))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON', async () => {
    const req = new Request('https://x/api/license', { method: 'POST', body: 'not json' });
    expect((await handleLicense(req, env())).status).toBe(400);
  });

  it("passes Polar's own words through, because they say what to do", async () => {
    // "Activation limit reached" tells the customer to deactivate another machine.
    // "Invalid licence" tells them to email us.
    const fetch = vi.fn(async () => new Response('Activation limit reached', { status: 403 }));
    const res = await handleLicense(post({ key: 'KEY-1' }), env({ fetch }));
    expect(res.status).toBe(403);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining('Activation limit'),
    });
  });

  it('refuses a licence Polar accepted but has not granted', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ...granted, license_key: { id: 'lk_1', status: 'revoked' } }), {
          status: 200,
        }),
    );
    expect((await handleLicense(post({ key: 'K' }), env({ fetch }))).status).toBe(403);
  });

  it('calls an unreachable Polar a 503, so the extension keeps riding its grace window', async () => {
    // NOT 403. A 4xx makes the extension throw its session away during OUR outage, which
    // is the exact moment the grace window exists to cover.
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect((await handleLicense(post({ key: 'K' }), env({ fetch }))).status).toBe(503);
  });

  it('NEVER lets the Polar token reach the client', async () => {
    const fetch = vi.fn(async () => new Response('POLAR-TOKEN-SECRET leaked', { status: 403 }));
    const res = await handleLicense(post({ key: 'K' }), env({ fetch }));
    expect(await res.text()).not.toContain('POLAR-TOKEN-SECRET');
  });

  it('sends the key to Polar in the body with our own credential in the header', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(granted), { status: 200 }));
    await handleLicense(post({ key: 'KEY-1' }), env({ fetch }));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('KEY-1');
    expect(String(init.body)).toContain('KEY-1');
    expect(String(init.body)).toContain('org_1');
    expect(String((init.headers as Record<string, string>)['Authorization'])).toContain(
      'POLAR-TOKEN-SECRET',
    );
  });
});
