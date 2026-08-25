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
  proCap: () => false,
  revoked: () => false,
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

/**
 * THE BRAKES ON THE PAID PATH, WHICH HAD NONE.
 *
 * Both existing brakes live inside `if (access.kind === 'trial')`, under a comment saying
 * that stopping somebody who is paying is the worst possible place to save a hundredth of a
 * cent. That is sound for a $0.00011 catch and stops being sound once the caller picks what
 * a catch costs — which is what the block above fixes, and why these two ship together.
 *
 * `decideAccess` has always returned `licenseKeyId`. `handleVision` read only `.kind`, so
 * the field a per-licence cap would key on was computed and thrown away on every request.
 */
describe('a session token is no longer an unlimited one', () => {
  const proToken = (licenseKeyId = 'lk_1'): Promise<string> =>
    sign({ licenseKeyId, activationId: 'act_1' }, SECRET, NOW);

  const asPro = async (over: Partial<VisionEnv> = {}, id = 'lk_1'): Promise<Response> =>
    handleVision(
      post({ headers: { authorization: `Bearer ${await proToken(id)}` } }),
      env(over),
    );

  it('refuses a licence that has had too many catches today', async () => {
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    const res = await asPro({ proCap: () => true, fetch });
    expect(res.status).toBe(429);
    expect(fetch, 'a refused catch still cost us a request').not.toHaveBeenCalled();
  });

  it('serves the same subscriber when they are under it', async () => {
    expect((await asPro({ proCap: () => false })).status).toBe(200);
  });

  it('keys the cap on the LICENCE, not on the request', async () => {
    // The point of using `licenseKeyId`: two installs of one subscription share an
    // allowance, and one leaked token cannot spend somebody else's.
    const seen: string[] = [];
    await asPro({ proCap: (id) => { seen.push(id); return false; } }, 'lk_theirs');
    expect(seen).toEqual(['lk_theirs']);
  });

  it('never asks the pro cap about a trial request', async () => {
    // The trial has its own two brakes and its own counter. Asking both would count one
    // catch twice and give the trial a ceiling nobody chose.
    const proCap = vi.fn(() => true);
    const res = await handleVision(post(), env({ proCap }));
    expect(proCap).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('still never applies the IP cap to a subscriber', async () => {
    // The old rule has to survive the new one. A per-licence ceiling is a brake a
    // subscriber shares with themselves; a per-IP one is a brake they share with a café.
    expect((await asPro({ ipCap: () => true })).status).toBe(200);
  });
});

describe('a licence can be turned off without rotating the secret', () => {
  /**
   * THE ONLY TARGETED LEVER in a design with no database. The token is stateless on
   * purpose — that is what makes a Polar outage invisible and leaves nothing to migrate or
   * leak — and the price is that a leaked or refunded one keeps working for up to eight
   * days. Until now the only answer was rotating `BUKI_TOKEN_SECRET`, which signs out every
   * subscriber at once.
   */

  const proToken = (licenseKeyId: string): Promise<string> =>
    sign({ licenseKeyId, activationId: 'act_1' }, SECRET, NOW);

  it('refuses a revoked licence with 401, so the extension re-exchanges and finds out', async () => {
    // 401, not 403. 401 is the one status that tells the client an action can fix this:
    // it re-exchanges, Polar answers about the real state of the subscription, and the
    // extension ends up in the right place either way.
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    const res = await handleVision(
      post({ headers: { authorization: `Bearer ${await proToken('lk_leaked')}` } }),
      env({ revoked: (id) => id === 'lk_leaked', fetch }),
    );
    expect(res.status).toBe(401);
    expect(fetch, 'a revoked licence still spent a request').not.toHaveBeenCalled();
  });

  it('leaves every other subscriber alone', async () => {
    const res = await handleVision(
      post({ headers: { authorization: `Bearer ${await proToken('lk_paying')}` } }),
      env({ revoked: (id) => id === 'lk_leaked' }),
    );
    expect(res.status).toBe(200);
  });

  it('checks revocation BEFORE the cap, because it is the cheaper refusal', async () => {
    const proCap = vi.fn(() => false);
    await handleVision(
      post({ headers: { authorization: `Bearer ${await proToken('lk_leaked')}` } }),
      env({ revoked: () => true, proCap }),
    );
    expect(proCap).not.toHaveBeenCalled();
  });
});

/**
 * A CALLED-OFF CATCH HAS TO REACH THE PROVIDER, or it is not called off at all.
 *
 * `grep -c signal src/server/visionHandler.ts` returned **0**. The extension aborts
 * properly — `dismiss` sends `cancelRecognize`, the worker's `AbortController` fires, the
 * socket closes — and none of that reached Gemini, which went on generating and billing
 * against a connection nobody was listening to.
 *
 * That is the half of P0-5 that costs money. The other half is `gate.ts` and
 * `entitlement.TRIAL_ATTEMPTS`, which bound how many times somebody can do it on purpose.
 */
describe('calling a catch off reaches the provider', () => {
  it('hands the provider the caller\'s own abort signal', async () => {
    const fetch = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    const request = post();
    await handleVision(request, env({ fetch }));
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal, 'the upstream call was not cancellable').toBe(request.signal);
  });

  it('actually stops the upstream call when the caller goes away mid-read', async () => {
    // Behavioural, not a shape check: the fake provider is still generating, the client
    // disconnects, and what is asserted is that the provider's own promise rejected
    // because of it.
    //
    // THE FIRST VERSION OF THIS TEST HUNG, and the instrument was what was wrong. It only
    // listened for the `abort` EVENT, while `handleVision` does two awaits (the token
    // verify and reading the body) before it ever calls fetch — so the abort had already
    // happened and the listener was registered after the event it was waiting for. A real
    // `fetch` checks `signal.aborted` first. Now this one does too, and the abort is
    // delivered while the call is genuinely in flight, which is the case that matters.
    const control = new AbortController();
    let reached: () => void;
    const inFlight = new Promise<void>((resolve) => {
      reached = resolve;
    });

    const fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) return reject(new Error('AbortError'));
          signal?.addEventListener('abort', () => reject(new Error('AbortError')));
          reached();
        }),
    );

    const request = new Request('https://get-buki.vercel.app/api/vision', {
      method: 'POST',
      headers: { origin: `chrome-extension://${EXT}` },
      body: JSON.stringify({
        messages: [{ role: 'user', content: [{ type: 'text', text: 'read this' }] }],
      }),
      signal: control.signal,
    });

    const answered = handleVision(request, env({ fetch }));
    await inFlight; // the provider is now generating, and being billed for it
    control.abort();

    // 502 is right: from the server's point of view the provider did not answer, and the
    // caller who aborted is no longer listening to hear anything else.
    expect((await answered).status).toBe(502);
  });
});

/**
 * THE TWO MUTATIONS THE REVIEW RAN AGAINST THIS FILE, both of which survived 620/620 green.
 *
 * They are here rather than beside the tests they resemble because the resemblance is the
 * problem: there WERE tests for both of these, and both tests verified the mock.
 */
describe('the mutations that survived a green suite', () => {
  it('tells an EMPTY session apart from no session at all', async () => {
    // `visionHandler.ts` reads the header as `header === null ? null : header.replace(...)`,
    // with a comment saying not to collapse the two. Collapsing them with a falsy check —
    // `header?.replace(...) || null` — silently DEMOTES a subscriber whose session broke to
    // the trial path, spending free catches they already paid to pass, and never sends the
    // 401 that would make the extension re-exchange its licence and heal itself.
    //
    // THE HEADER HAS TO BE EXACTLY EMPTY, and the first version of this test got that
    // wrong. `Authorization: 'Bearer '` looks like the empty case and is not: `Headers`
    // strips trailing whitespace, so the value arrives as `'Bearer'`, the `\s+` in the
    // regex never matches, and BOTH implementations return `'Bearer'` and answer 401. The
    // test passed against the mutation, which is the only reason it was caught.
    //
    // Probed rather than assumed: only `authorization: ''` produces `''` on one side and
    // `null` on the other.
    const res = await handleVision(post({ headers: { authorization: '' } }), env());
    expect(res.status, 'a broken session was quietly demoted to the trial').toBe(401);
  });

  it('still treats an ABSENT header as somebody who never paid', async () => {
    // The other half, and the reason the distinction is not just pedantry: a missing header
    // is the correct, normal state for a trial user, and answering 401 to them would open
    // the options page on every catch.
    const res = await handleVision(post(), env());
    expect(res.status).toBe(200);
  });

  it('NEVER lets a hostile upstream send our key home in a header', async () => {
    // THE EXISTING TEST FOR THIS MOCKS AN UPSTREAM WITH NO HEADERS, so it verifies the
    // mock. The review's mutation — passing `upstream.headers` through — survived it, and
    // `GEMINI_API_KEY` could have ridden home in a `set-cookie` or a `www-authenticate`.
    //
    // `licenseHandler.test.ts` already mocks a HOSTILE upstream. This one now does too.
    const fetch = vi.fn(
      async () =>
        new Response('{"choices":[]}', {
          status: 200,
          headers: {
            'x-goog-quota-user': 'PROVIDER-KEY-SECRET',
            'www-authenticate': 'Bearer realm="PROVIDER-KEY-SECRET"',
            'set-cookie': 'session=PROVIDER-KEY-SECRET; Path=/',
          },
        }),
    );
    const res = await handleVision(post(), env({ fetch }));

    for (const [name, value] of res.headers) {
      expect(value, `${name} carried the provider key home`).not.toContain('PROVIDER-KEY-SECRET');
    }
    // And the whole header set is ours, not theirs: an allowlist of one, proven by its size.
    expect([...res.headers.keys()].sort()).toEqual(['content-type']);
  });

  it('does not relay an upstream header even when it is harmless', async () => {
    // The rule is "only body and status cross back", not "only dangerous headers are
    // stripped". A rule with an exception is a rule somebody will widen.
    const fetch = vi.fn(
      async () =>
        new Response('{"choices":[]}', {
          status: 200,
          headers: { 'x-request-id': 'abc123', 'retry-after': '30' },
        }),
    );
    const res = await handleVision(post(), env({ fetch }));
    expect(res.headers.get('x-request-id')).toBeNull();
    expect(res.headers.get('retry-after')).toBeNull();
  });
});

/**
 * ONE ENVELOPE, INCLUDING ON THE TWO STATUSES THAT MEAN "THE SERVER ITSELF IS BROKEN".
 *
 * The review's AC-8. `405` and `500` returned BARE TEXT with no content-type, while every
 * other refusal on this endpoint returns `{ error: { message } }` — the shape
 * `llmVision.explain()` reads. So the client extracted no message on exactly the two
 * statuses where a person most needs one, and showed them `HTTP 500` instead.
 *
 * Free to fix today; after publication it is a shape change against clients in the wild.
 */
describe('every refusal answers in one shape', () => {
  const message = async (res: Response): Promise<unknown> =>
    ((await res.json()) as { error?: { message?: unknown } }).error?.message;

  it('says something readable on a 405', async () => {
    const res = await handleVision(new Request('https://x/api/vision'), env());
    expect(res.status).toBe(405);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(typeof (await message(res))).toBe('string');
  });

  it('says something readable on a 500', async () => {
    const res = await handleVision(post(), env({ secret: '' }));
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(typeof (await message(res))).toBe('string');
  });

  it('NEVER names an environment variable in a 500', async () => {
    // The loud failure is deliberate — a missing `BUKI_TOKEN_SECRET` would verify every
    // session as garbage and silently demote every subscriber — but loud to US, in the
    // logs, not to whoever is asking. A 500 that names the variable it is missing is a
    // configuration map handed to the caller.
    for (const missing of ['secret', 'providerKey', 'extensionId'] as const) {
      const res = await handleVision(post(), env({ [missing]: '' }));
      const text = await res.text();
      expect(text, missing).not.toMatch(/BUKI_|GEMINI_|POLAR_|secret|providerKey|extensionId/);
    }
  });
});
