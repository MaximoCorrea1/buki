import { describe, it, expect, vi } from 'vitest';
import { handleVision, type VisionEnv } from './visionHandler';
import { sign } from './token';

const SECRET = 'test-secret-at-least-32-characters-long!!';
const EXT = 'abcdefghijklmnopabcdefghijklmnop';
const NOW = Date.UTC(2026, 7, 17, 12, 0, 0);

/**
 * The recognition proxy, as a function of a Request rather than of Vercel.
 *
 * `api/vision.ts` is a four-line shell that reads `process.env` and calls this. Everything
 * that can be wrong lives here, where it can be tested without a deploy — which matters
 * more than usual, because this is the only code path in the product that spends money and
 * the only one holding a credential that is not the user's.
 */

const env = (over: Partial<VisionEnv> = {}): VisionEnv => ({
  secret: SECRET,
  providerKey: 'PROVIDER-KEY-SECRET',
  extensionId: EXT,
  trialClosed: false,
  providerUrl: 'https://provider.test/v1/chat/completions',
  fetch: vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })),
  now: () => NOW,
  ipCap: () => false,
  ...over,
});

const post = (init: RequestInit = {}): Request =>
  new Request('https://get-buki.vercel.app/api/vision', {
    method: 'POST',
    headers: { origin: `chrome-extension://${EXT}`, ...(init.headers as Record<string, string>) },
    body: JSON.stringify({ model: 'x', messages: [] }),
    ...init,
  });

describe('the recognition proxy', () => {
  it('refuses anything that is not a POST', async () => {
    const res = await handleVision(new Request('https://x/api/vision'), env());
    expect(res.status).toBe(405);
  });

  it('refuses to run misconfigured rather than half-working', async () => {
    // A missing secret means every token verifies as garbage and every subscriber is
    // demoted to the trial. Failing loudly is the only safe answer.
    for (const missing of ['secret', 'providerKey', 'extensionId'] as const) {
      const res = await handleVision(post(), env({ [missing]: '' }));
      expect(res.status, `${missing} missing`).toBe(500);
    }
  });

  it('closes the trial on one environment variable, with no deploy', async () => {
    const res = await handleVision(post(), env({ trialClosed: true }));
    expect(res.status).toBe(402);
  });

  it('keeps serving a PAYING subscriber while the trial is closed', async () => {
    // The switch is named for the trial and has to mean only the trial. It used to sit
    // above `decideAccess`, so flipping it refused EVERY request — a subscriber holding a
    // valid session was told "The free trial is closed just now", which is both a lockout
    // and a false statement to the one person who paid not to see it.
    //
    // Eight lines below, the IP cap already had this exactly right, gated on
    // `access.kind === 'trial'` under a comment saying that rate-limiting somebody who is
    // paying is the worst possible place to save a hundredth of a cent. Two brakes, one
    // intent, and only one of them read it.
    const token = await sign({ licenseKeyId: 'lk_1', activationId: 'act_1' }, SECRET, NOW);
    const res = await handleVision(
      post({ headers: { authorization: `Bearer ${token}` } }),
      env({ trialClosed: true }),
    );

    expect(res.status).toBe(200);
  });

  it('serves an unlicensed request that came from our own extension', async () => {
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    const res = await handleVision(post(), env({ fetch }));
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refuses an unlicensed request from anywhere else', async () => {
    const res = await handleVision(post({ headers: { origin: 'https://evil.test' } }), env());
    expect(res.status).toBe(403);
  });

  it('serves a licensed request whatever the origin says', async () => {
    // A real token is the strong signal; Origin is one of three weak ones.
    const token = await sign({ licenseKeyId: 'lk_1', activationId: 'act_1' }, SECRET, NOW);
    const res = await handleVision(
      post({ headers: { origin: 'https://elsewhere.test', authorization: `Bearer ${token}` } }),
      env(),
    );
    expect(res.status).toBe(200);
  });

  it('answers 401 for a broken token, so the extension re-exchanges its licence', async () => {
    // NOT 403. 401 is the one status that tells the client an action can fix this.
    const res = await handleVision(post({ headers: { authorization: 'Bearer rubbish' } }), env());
    expect(res.status).toBe(401);
  });

  it('caps unlicensed requests per IP, but never a subscriber', async () => {
    const overCap = env({ ipCap: () => true });
    expect((await handleVision(post(), overCap)).status).toBe(429);

    const token = await sign({ licenseKeyId: 'lk_1', activationId: 'act_1' }, SECRET, NOW);
    const res = await handleVision(
      post({ headers: { authorization: `Bearer ${token}` } }),
      overCap,
    );
    expect(res.status, 'a paying customer was rate-limited').toBe(200);
  });

  it('NEVER lets the provider key reach the client', async () => {
    // The whole reason this hop exists. If the key can appear in a response body or a
    // header, the proxy is a slower way of publishing it.
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    const res = await handleVision(post(), env({ fetch }));
    const body = await res.text();
    expect(body).not.toContain('PROVIDER-KEY-SECRET');
    for (const [, value] of res.headers) expect(value).not.toContain('PROVIDER-KEY-SECRET');
  });

  it('sends the provider key to the provider, and nothing of the caller\'s', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    const token = await sign({ licenseKeyId: 'lk_1', activationId: 'act_1' }, SECRET, NOW);
    await handleVision(post({ headers: { authorization: `Bearer ${token}` } }), env({ fetch }));
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const auth = String((init.headers as Record<string, string>)['authorization']);
    expect(auth).toContain('PROVIDER-KEY-SECRET');
    // The caller's session token must not be forwarded: the provider has no use for it
    // and every credential that travels further than it must is a wider blast radius.
    expect(auth).not.toContain(token);
  });

  it("returns the provider's answer verbatim, because llmVision parses that shape", async () => {
    const payload = { choices: [{ message: { content: '{"books":[]}' } }] };
    const fetch = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    const res = await handleVision(post(), env({ fetch }));
    expect(await res.json()).toEqual(payload);
  });

  it("passes the provider's failure status through rather than flattening it", async () => {
    // 429 from the provider means "slow down" and the extension already knows how to
    // retry that. Turning it into a 500 would lose the one instruction it carries.
    const fetch = vi.fn(async () => new Response('{"error":{}}', { status: 429 }));
    const res = await handleVision(post(), env({ fetch }));
    expect(res.status).toBe(429);
  });

  it('survives the provider being unreachable', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const res = await handleVision(post(), env({ fetch }));
    expect(res.status).toBe(502);
  });
});
