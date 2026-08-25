import { describe, it, expect, vi } from 'vitest';
import { handleVision, type VisionEnv } from './visionHandler';
import { sign } from './token';
import { PINNED_MODEL, MAX_OUTPUT_TOKENS, MAX_BODY_BYTES } from './visionBody';

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

/**
 * A REAL catch, because the body is now load-bearing.
 *
 * This fixture used to be `{ model: 'x', messages: [] }` — a shape no client has ever
 * sent, which was harmless while the handler forwarded whatever it was given and is not
 * harmless now that it rebuilds. A fixture that cannot reach the provider proves nothing
 * about a handler whose job is deciding what reaches the provider.
 */
const post = (init: RequestInit = {}): Request =>
  new Request('https://get-buki.vercel.app/api/vision', {
    method: 'POST',
    headers: { origin: `chrome-extension://${EXT}`, ...(init.headers as Record<string, string>) },
    body: JSON.stringify({
      model: 'gemini-flash-lite-latest',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'You identify books from photographs.' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } },
          ],
        },
      ],
    }),
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

/**
 * WHAT GOES ON THE WIRE, asserted at the wire.
 *
 * The tests above prove who may ask. These prove what we then buy on their behalf, and
 * they exist because the previous answer to that question was `body: await request.text()`
 * — the caller's request, forwarded verbatim to a metered credential.
 *
 * Every assertion here reads the body `fetch` was actually called with. The review found
 * `visionRoute.test.ts:81` asserting `model === ''` one layer BELOW where the body is
 * assembled: a property three artefacts claimed, checked at the wrong layer, and false at
 * the right one. This is the right layer.
 */
describe('what the proxy actually buys', () => {
  /** The body handed to the provider, parsed. */
  const sent = (fetch: ReturnType<typeof vi.fn>): Record<string, unknown> => {
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    return JSON.parse(String(init.body)) as Record<string, unknown>;
  };

  const withBody = (body: unknown, headers: Record<string, string> = {}): Request =>
    new Request('https://get-buki.vercel.app/api/vision', {
      method: 'POST',
      headers: { origin: `chrome-extension://${EXT}`, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  const catchBody = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    model: 'gemini-flash-lite-latest',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'You identify books from photographs.' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } },
        ],
      },
    ],
    ...over,
  });

  it('pins OUR model even when the caller names a dearer one', async () => {
    // Reachable through our own UI: `options.html` is a free-text model field, and
    // `background.ts` puts it back on the proxy path. No forgery required.
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    await handleVision(withBody(catchBody({ model: 'gemini-2.5-pro' })), env({ fetch }));
    expect(sent(fetch)['model']).toBe(PINNED_MODEL);
  });

  it('sets an output budget the caller cannot raise', async () => {
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    await handleVision(withBody(catchBody({ max_tokens: 64_000 })), env({ fetch }));
    expect(sent(fetch)['max_tokens']).toBe(MAX_OUTPUT_TOKENS);
  });

  it('will not let a caller multiply the bill with `n` or buy a premium tier', async () => {
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    await handleVision(
      withBody(catchBody({ n: 100, service_tier: 'priority', stream: true })),
      env({ fetch }),
    );
    const body = sent(fetch);
    expect(body['n']).toBeUndefined();
    expect(body['service_tier']).toBeUndefined();
    expect(body['stream']).toBeUndefined();
  });

  it('spends nothing on a body it cannot read', async () => {
    // The refusal has to land BEFORE the outbound call, for the same reason every other
    // refusal in this file does: a 400 answered after calling the provider has already
    // paid for the request it is refusing.
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    const res = await handleVision(withBody('<html>not json</html>'), env({ fetch }));
    expect(res.status).toBe(400);
    expect(fetch, 'the provider was called for a body we refused').not.toHaveBeenCalled();
  });

  it('spends nothing on a body that is too large', async () => {
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    const res = await handleVision(
      withBody('x'.repeat(MAX_BODY_BYTES + 1)),
      env({ fetch }),
    );
    expect(res.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('drops an oversized request on its declared length, without buffering it', async () => {
    // An EARLY-OUT, never the control: `content-length` is caller-supplied and a platform
    // may or may not surface it. The byte cap inside `rebuildVisionBody` is what actually
    // bounds this, and the test above proves it holds when this header lies or is absent.
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    const res = await handleVision(
      withBody(catchBody(), { 'content-length': String(MAX_BODY_BYTES + 1) }),
      env({ fetch }),
    );
    expect(res.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('still refuses an oversized body when the declared length LIES about it', async () => {
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    const res = await handleVision(
      withBody('x'.repeat(MAX_BODY_BYTES + 1), { 'content-length': '12' }),
      env({ fetch }),
    );
    expect(res.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers a refusal in the shape the extension already parses', async () => {
    // `llmVision.explain()` reads `{ error: { message } }` and puts it in front of the
    // user. A bare string here is a status code with no explanation attached.
    const res = await handleVision(withBody('not json'), env());
    const body = (await res.json()) as { error?: { message?: unknown } };
    expect(typeof body.error?.message).toBe('string');
  });

  it('keeps a real catch intact: the prompt and every picture reach the model', async () => {
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    const images = Array.from({ length: 4 }, (_, i) => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,PICTURE${i}` },
    }));
    await handleVision(
      withBody({
        model: '',
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'read these' }, ...images] },
        ],
      }),
      env({ fetch }),
    );
    const content = (sent(fetch)['messages'] as { content: { type: string }[] }[])[0]?.content;
    expect(content?.filter((p) => p.type === 'image_url').length).toBe(4);
    expect(JSON.stringify(content)).toContain('read these');
    expect(JSON.stringify(content)).toContain('PICTURE3');
  });
});
