import { describe, it, expect, vi } from 'vitest';
import { handleLicense, type LicenseEnv } from './licenseHandler';
import { verify, TOKEN_TTL_MS } from './token';

const SECRET = 'test-secret-at-least-32-characters-long!!';
const EXT = 'abcdefghijklmnopabcdefghijklmnop';
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
  extensionId: EXT,
  activateUrl: 'https://api.polar.test/v1/license-keys/activate',
  validateUrl: 'https://api.polar.test/v1/license-keys/validate',
  fetch: vi.fn(async () => new Response(JSON.stringify(granted), { status: 200 })),
  now: () => NOW,
  // Open by default, so every test above measures what it is about. The caps have their
  // own describe blocks at the bottom.
  keyCap: () => false,
  ipCap: () => false,
  ...over,
});

const post = (body: unknown, headers: Record<string, string> = {}): Request =>
  new Request('https://get-buki.vercel.app/api/license', {
    method: 'POST',
    // The real caller is an MV3 worker or the options page, both of which send this on a
    // cross-origin fetch. `/api/vision` has relied on it since it was written.
    headers: { origin: `chrome-extension://${EXT}`, ...headers },
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
    // Carries the Origin, so this asserts the BODY check rather than the origin check that
    // now runs before it. Without the header it returned 403 and proved nothing about JSON.
    const req = new Request('https://x/api/license', {
      method: 'POST',
      headers: { origin: `chrome-extension://${EXT}` },
      body: 'not json',
    });
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

/**
 * WHO MAY ASK AT ALL.
 *
 * Until 2026-08-17 this endpoint had no origin check and no rate limit, which made it an
 * open licence-key oracle standing on our Polar credential. Anybody could POST a candidate
 * key and learn from the status whether it was real, on our token and our quota.
 *
 * The second consequence is the one that reaches a customer: a successful activation
 * CONSUMES ONE OF THE FIVE SLOTS on that key. A leaked key plus five requests locks the
 * person who paid out of their own licence until they go and deactivate.
 *
 * The check is the same `fromExtension` that `/api/vision` has always used, and it is
 * forgeable in exactly the same way — an Origin header is a header. It is worth having for
 * the same reason it is worth having there: it removes the casual path completely, and on
 * this endpoint there was previously nothing at all.
 */
/**
 * ACTIVATE ONCE, VALIDATE FOREVER.
 *
 * Polar's `activate` CREATES an activation and spends one of the key's five slots. It was
 * the only endpoint this handler ever called, and `ensureSession` calls the handler daily,
 * so every subscriber burned a slot a day and met the wall they had paid to pass on day
 * five. `validate` is the per-session call: it takes the `activation_id` that activate
 * returned and creates nothing.
 *
 * THE TWO RESPONSE SHAPES ARE INVERTED, which is the trap:
 *
 *   activate   { id: <activation>,  license_key: { id: <key>, status } }
 *   validate   { id: <key>, status, activation: { id: <activation> } }
 *
 * Read one as the other and `status` is `undefined`, so every renewal 403s with "That
 * licence is not active" — the failure would look exactly like a revoked subscription.
 */
describe('activating once and validating after', () => {
  const validated = {
    id: 'lk_1',
    status: 'granted',
    activation: { id: 'act_1', license_key_id: 'lk_1', label: 'Buki for Chrome' },
  };
  const called = (fetch: ReturnType<typeof vi.fn>): string[] =>
    fetch.mock.calls.map((c) => String(c[0]));

  it('activates when the caller has no activation id yet', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(granted), { status: 200 }));
    const res = await handleLicense(post({ key: 'KEY-1' }), env({ fetch }));

    expect(res.status).toBe(200);
    expect(called(fetch)).toEqual(['https://api.polar.test/v1/license-keys/activate']);
  });

  it('hands the activation id back so the extension can stop activating', async () => {
    // Without this the client has nothing to send next time and is condemned to activate
    // for ever. The id already existed inside the signed token; it just never came out.
    const fetch = vi.fn(async () => new Response(JSON.stringify(granted), { status: 200 }));
    const res = await handleLicense(post({ key: 'KEY-1' }), env({ fetch }));

    expect((await res.json()) as { activationId: string }).toMatchObject({ activationId: 'act_1' });
  });

  it('VALIDATES instead of activating once it is given an activation id', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(validated), { status: 200 }));
    const res = await handleLicense(
      post({ key: 'KEY-1', activationId: 'act_1' }),
      env({ fetch }),
    );

    expect(res.status).toBe(200);
    // The whole fix in one assertion: activate must not be touched on a renewal.
    expect(called(fetch)).toEqual(['https://api.polar.test/v1/license-keys/validate']);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).toContain('act_1');
  });

  it("reads validate's own shape, where status is top level", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(validated), { status: 200 }));
    const res = await handleLicense(post({ key: 'KEY-1', activationId: 'act_1' }), env({ fetch }));

    // Parsed as activate's shape this is `undefined` and the branch below 403s.
    expect(res.status).toBe(200);
    expect((await res.json()) as { activationId: string }).toMatchObject({ activationId: 'act_1' });
  });

  it('refuses a validate whose status is not granted', async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify({ ...validated, status: 'revoked' }), { status: 200 }),
    );
    const res = await handleLicense(post({ key: 'KEY-1', activationId: 'act_1' }), env({ fetch }));

    expect(res.status).toBe(403);
  });

  it('never sends increment_usage, which would be a second hidden limit', async () => {
    // `polar-setup.md` §2 leaves the benefit's Usage limit empty on purpose: catches are
    // metered in `entitlement.ts`, on the machine. Metering here as well would create a
    // second ceiling that disagrees with the first and nobody would know which one hit.
    const fetch = vi.fn(async () => new Response(JSON.stringify(validated), { status: 200 }));
    await handleLicense(post({ key: 'KEY-1', activationId: 'act_1' }), env({ fetch }));

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).not.toContain('increment_usage');
  });
});

describe('who may ask for a session', () => {
  it('refuses a request that did not come from our extension', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(granted), { status: 200 }));
    const res = await handleLicense(
      post({ key: 'KEY-1' }, { origin: 'https://elsewhere.test' }),
      env({ fetch }),
    );

    expect(res.status).toBe(403);
    // THE POINT. A refusal that still called Polar would spend the quota and burn an
    // activation slot anyway, which is most of the damage this check exists to prevent.
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a request carrying no Origin at all, which is what curl sends', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(granted), { status: 200 }));
    const bare = new Request('https://get-buki.vercel.app/api/license', {
      method: 'POST',
      body: JSON.stringify({ key: 'KEY-1' }),
    });

    const res = await handleLicense(bare, env({ fetch }));

    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses to run without an extension id rather than accepting everybody', async () => {
    // The same reasoning as the other three variables: a missing id must not silently
    // become "any origin is fine". Failing loudly is the only safe reading of an absent
    // credential, and `visionHandler` already treats it that way.
    const res = await handleLicense(post({ key: 'KEY-1' }), env({ extensionId: '' }));
    expect(res.status).toBe(500);
  });
});

/**
 * THE CAP, and what it is honestly for.
 *
 * `/api/vision` has always paired its Origin check with a per-IP cap. This endpoint had
 * the Origin check and nothing else, which two reviewers raised independently. `Origin` is
 * a header any script sets and the extension id is public the moment the item is listed,
 * so the check closes the casual path and nothing more.
 *
 * TWO NUMBERS, because the two branches cost different things and one number cannot bound
 * both. `validate` is cheap and creates nothing, so its ceiling is about how much a caller
 * can learn from an oracle. `activate` CREATES an activation and spends one of the key's
 * five slots for ever, so a single number generous enough for five installs renewing daily
 * would also be generous enough to burn every slot the customer has.
 *
 * A legitimate activation is genuinely rare: once per install, and only while no activation
 * id is held. A refused attempt creates nothing, and a re-paste of a key already held
 * validates. So the activate ceiling can be far below the renewal one without touching
 * anybody real.
 */
/**
 * SEC-3. `OPENWORK.md` item 51.
 *
 * `keyCap` counts the KEY, and the key is a string the attacker chooses. So N guessed keys
 * are N separate buckets and N real calls on `POLAR_ACCESS_TOKEN` — **a per-key cap
 * structurally cannot bound key ENUMERATION.**
 *
 * The impact is availability rather than disclosure, and it is worse than it sounds: the
 * org token is ONE token shared by every subscriber, so throttling it locks out everybody's
 * renewal at once. `/api/vision` has paired its Origin check with a per-IP cap since it was
 * written. This endpoint had the Origin check and a per-key cap, and neither counts the
 * thing an enumerator cannot change.
 */
describe('the per-IP cap, which is the one an enumerator cannot choose', () => {
  it('refuses before Polar is called', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(granted), { status: 200 }));
    const res = await handleLicense(post({ key: 'KEY-1' }), env({ fetch, ipCap: () => true }));

    expect(res.status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fires BEFORE keyCap, so enumeration cannot churn the key map', async () => {
    // ORDER IS THE POINT, not just presence. `keyCap` evicts to stay bounded, so letting a
    // capped caller reach it lets them push a real customer's counter out of the map -
    // which hands back the allowance the eviction was protecting.
    const keyCap = vi.fn(() => false);
    const res = await handleLicense(post({ key: 'KEY-1' }), env({ keyCap, ipCap: () => true }));

    expect(res.status).toBe(429);
    expect(keyCap).not.toHaveBeenCalled();
  });

  it('does not need a parseable body to count the request', async () => {
    // An enumerator sending garbage still costs us. Counting only well-formed requests
    // would leave the cheapest attack uncounted.
    const ipCap = vi.fn(() => false);
    const bad = new Request('https://get-buki.vercel.app/api/license', {
      method: 'POST',
      headers: { origin: `chrome-extension://${EXT}` },
      body: 'not json',
    });

    await handleLicense(bad, env({ ipCap }));
    expect(ipCap).toHaveBeenCalled();
  });

  it('says what happened without naming a key, because the caller may not own one', async () => {
    const res = await handleLicense(post({ key: 'KEY-1' }), env({ ipCap: () => true }));
    // The envelope is FLAT - `{ error, code }` - and this test asserted a nested one until
    // it was run. See the 'one envelope' block below, which is the authority on the shape.
    const body = (await res.json()) as { error?: string; code?: string };

    expect(body.code).toBe('cap');
    expect(body.error ?? '').not.toContain('KEY-1');
  });
});

describe('the cap', () => {
  it('refuses before Polar is called, so a refusal cannot spend a slot', async () => {
    // The rule this endpoint already follows everywhere else: every refusal lands BEFORE
    // the outbound fetch. A cap that answered 429 after calling Polar would have burned
    // the activation it was there to protect.
    const fetch = vi.fn(async () => new Response(JSON.stringify(granted), { status: 200 }));

    const res = await handleLicense(post({ key: 'KEY-1' }), env({ fetch, keyCap: () => true }));

    expect(res.status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('tells the two branches apart, because only one of them spends a slot', async () => {
    const seen: string[] = [];
    const keyCap = (_key: string, kind: string) => {
      seen.push(kind);
      return false;
    };

    await handleLicense(post({ key: 'KEY-1' }), env({ keyCap }));
    await handleLicense(post({ key: 'KEY-1', activationId: 'act_1' }), env({ keyCap }));

    expect(seen).toEqual(['activate', 'validate']);
  });

  it('counts the key, not the request, so one key cannot be probed through many callers', async () => {
    const keys: string[] = [];
    const keyCap = (key: string) => {
      keys.push(key);
      return false;
    };

    await handleLicense(post({ key: '  KEY-1  ' }), env({ keyCap }));

    // The TRIMMED key. Keys arrive pasted out of an email, and counting `KEY-1 ` and
    // `KEY-1` as two different keys would hand an attacker a fresh allowance per space.
    expect(keys).toEqual(['KEY-1']);
  });

  it('is not consulted for a request that never names a key', async () => {
    // Nothing to count against, and no slot at risk. A 400 is the honest answer and it
    // must not consume somebody else's allowance.
    const keyCap = vi.fn(() => false);
    const res = await handleLicense(post({}), env({ keyCap }));

    expect(res.status).toBe(400);
    expect(keyCap).not.toHaveBeenCalled();
  });

  it('says what to do, because a customer can meet this too', async () => {
    const res = await handleLicense(post({ key: 'KEY-1' }), env({ keyCap: () => true }));
    const { error } = (await res.json()) as { error: string };

    // Never vague, and never an apology. The one thing that fixes it is waiting.
    expect(error).toMatch(/try again/i);
    expect(error).not.toMatch(/sorry|something went wrong/i);
  });
});

/**
 * WHEN POLAR HAS A BAD MINUTE, and it is not the same as Polar saying no.
 *
 * `handleLicense` handled the RARER outage shape and not the commoner one. Eight lines
 * above the bug, the `catch` around the fetch returned 503 under a comment explaining
 * exactly why 403 is wrong: *"a 4xx makes the extension throw its session away during OUR
 * outage, which is the exact moment the grace window exists to cover."* Then
 * `if (!res.ok)` returned 403 for every non-2xx answer — 500, 502, 503, 429 included.
 *
 * A socket failure was covered. A gateway 5xx, which is what an outage usually looks like
 * from the outside, was not.
 *
 * `grep -c 'status: 5' licenseHandler.test.ts` returned **0** before this block existed:
 * every test drove a THROWN fetch, so the response-shaped outage had no coverage at all.
 */
describe('a bad minute at Polar is not an answer about this licence', () => {
  const upstream = (status: number, body = 'gateway error'): (() => Promise<Response>) => async () =>
    new Response(body, { status });

  it('calls every Polar 5xx a 503, not a 403', async () => {
    for (const status of [500, 502, 503, 504]) {
      const res = await handleLicense(post({ key: 'K' }), env({ fetch: vi.fn(upstream(status)) }));
      expect(res.status, `Polar ${status} became ${res.status}`).toBe(503);
    }
  });

  it('calls a Polar 429 a 503 too, because throttling passes', async () => {
    const res = await handleLicense(post({ key: 'K' }), env({ fetch: vi.fn(upstream(429)) }));
    expect(res.status).toBe(503);
  });

  it('STILL answers 403 when Polar has actually refused the key', async () => {
    // The distinction that makes the fix a fix rather than a blanket. Revoked, wrong key,
    // activation limit reached: these are answers, and the extension should act on them.
    for (const status of [400, 401, 403, 404, 422]) {
      const res = await handleLicense(
        post({ key: 'K' }),
        env({ fetch: vi.fn(upstream(status, 'Activation limit reached')) }),
      );
      expect(res.status, `Polar ${status} became ${res.status}`).toBe(403);
    }
  });

  it('says nothing about our credential on the outage path', async () => {
    // The 403 path scrubs the token out of the quoted body. The 503 path must not quote a
    // body at all: a gateway error page is not something a customer can act on, and every
    // relayed byte is a byte that could carry POLAR-TOKEN-SECRET.
    const res = await handleLicense(
      post({ key: 'K' }),
      env({ fetch: vi.fn(upstream(500, 'POLAR-TOKEN-SECRET in the stack trace')) }),
    );
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain('POLAR-TOKEN-SECRET');
    expect(text).not.toContain('stack trace');
  });
});

/**
 * ONE ENVELOPE, AND A CODE THE CLIENT CAN ACT ON.
 *
 * Two findings in one block, because they are the same edit.
 *
 * **AC-8:** `405` and `500` returned BARE TEXT with no content-type, so `license.ts` — which
 * reads `body.error` as a string — extracted nothing on exactly the two statuses meaning the
 * server itself is broken.
 *
 * **AND THE ONE THE REVIEW DID NOT FILE.** A mismatched `BUKI_EXTENSION_ID` makes the Origin
 * check refuse EVERY renewal with 403, while `/api/vision` keeps serving token-bearing
 * requests — so the failure is invisible until tokens age out, eight days later, and by then
 * every subscriber has had their session erased by a 403 that was never about their licence.
 * That is item 39's trigger (c), which item 39 could not close from either half.
 *
 * A `code` on the envelope is what lets the client tell "your licence is refused" apart from
 * "our server is misconfigured". One field today; impossible against clients in the wild.
 */
describe('one envelope, and a machine-readable code', () => {
  const read = async (res: Response): Promise<{ error?: unknown; code?: unknown }> =>
    (await res.json()) as { error?: unknown; code?: unknown };

  it('says something readable on a 405', async () => {
    const res = await handleLicense(new Request('https://x/api/license'), env());
    expect(res.status).toBe(405);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(typeof (await read(res)).error).toBe('string');
  });

  it('says something readable on a 500', async () => {
    const res = await handleLicense(post({ key: 'K' }), env({ secret: '' }));
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(typeof (await read(res)).error).toBe('string');
  });

  it('NEVER names an environment variable in a 500', async () => {
    const res = await handleLicense(post({ key: 'K' }), env({ polarToken: '' }));
    const text = await res.text();
    expect(text).not.toMatch(/BUKI_|GEMINI_|POLAR_|polarToken|organizationId/);
  });

  it('marks an ORIGIN refusal as ours, not as an answer about the licence', async () => {
    // The whole point. This 403 means our server does not recognise the caller, which on
    // launch day means `BUKI_EXTENSION_ID` is not the shipped id. It is not a statement
    // about the customer's subscription, and the client must not erase a session over it.
    const res = await handleLicense(
      new Request('https://get-buki.vercel.app/api/license', {
        method: 'POST',
        headers: { origin: 'chrome-extension://the-wrong-id', 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'K' }),
      }),
      env(),
    );
    expect(res.status).toBe(403);
    expect((await read(res)).code, 'the client cannot tell this from a revoked licence').toBe(
      'origin',
    );
  });

  it('marks a refusal that IS about the licence differently', async () => {
    // Revoked, wrong key, activation limit reached. Same status, different meaning, and the
    // difference is the whole reason the field exists.
    const fetch = vi.fn(async () => new Response('Activation limit reached', { status: 403 }));
    const res = await handleLicense(post({ key: 'K' }), env({ fetch }));
    expect(res.status).toBe(403);
    expect((await read(res)).code).toBe('licence');
  });

  it('marks our own rate limit, so it is never read as a licence problem', async () => {
    const res = await handleLicense(post({ key: 'K' }), env({ keyCap: () => true }));
    expect(res.status).toBe(429);
    expect((await read(res)).code).toBe('cap');
  });

  it('marks an outage', async () => {
    const fetch = vi.fn(async () => new Response('gateway', { status: 502 }));
    const res = await handleLicense(post({ key: 'K' }), env({ fetch }));
    expect(res.status).toBe(503);
    expect((await read(res)).code).toBe('upstream');
  });

  it('gives EVERY refusal a code, so a client can branch on any of them', async () => {
    // GUARDS THE VACUOUS PASS. Checking four codes proves nothing about the fifth; this
    // walks the rest of the refusals the handler can produce and insists each carries one.
    const unreachable = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const refusals: [string, Response][] = [
      ['no key', await handleLicense(post({ key: '  ' }), env())],
      ['unreachable', await handleLicense(post({ key: 'K' }), env({ fetch: unreachable }))],
      [
        'unexpected shape',
        await handleLicense(
          post({ key: 'K' }),
          env({ fetch: vi.fn(async () => new Response('not json', { status: 200 })) }),
        ),
      ],
      [
        'not granted',
        await handleLicense(
          post({ key: 'K' }),
          env({
            fetch: vi.fn(
              async () =>
                new Response(JSON.stringify({ id: 'a', license_key: { id: 'lk', status: 'revoked' } }), {
                  status: 200,
                }),
            ),
          }),
        ),
      ],
    ];
    for (const [label, res] of refusals) {
      expect(res.ok, label).toBe(false);
      expect(typeof (await read(res)).code, `${label} carries no code`).toBe('string');
    }
  });
});

/**
 * ADV-3. `OPENWORK.md` item 48, and it is item 27's P0 with a different door.
 *
 * On the ACTIVATE path `claim.activationId` is `(parsed as PolarActivation).id`, and there
 * is no fallback because there is no prior id to fall back TO. If Polar's answer lacks that
 * key the value is `undefined`, and undefined does not survive `JSON.stringify`: it is
 * dropped from the signed claim AND from the response body. The client's `?? ''` then
 * yields `''`, `writePro`'s `&& activationId` guard omits the field, and **the next renewal
 * ACTIVATES AGAIN.**
 *
 * That is not a slow leak. Renewal runs daily and a key has FIVE permanent slots, so a
 * subscriber is locked out inside a week, out of a resource only the Polar dashboard can
 * free. The comment eleven lines up in `license.ts` names this exact hazard.
 *
 * A session that cannot be renewed without spending a slot is not worth minting. 502
 * rather than 403: this is our upstream failing its own contract, not an answer about
 * this customer's licence, and 502 is in `worthRetrying` so the client keeps what it has.
 */
describe('a session is never minted without the id that renews it', () => {
  it('refuses when Polar activates but returns no activation id', async () => {
    const noId = { license_key: { id: 'lk_1', status: 'granted', expires_at: null } };
    const res = await handleLicense(
      post({ key: 'K' }),
      env({ fetch: vi.fn(async () => new Response(JSON.stringify(noId), { status: 200 })) }),
    );
    expect(res.status).toBe(502);
    // Not a token. The whole point is that no session escapes this branch.
    expect(await res.json()).not.toHaveProperty('token');
  });

  it('refuses when the id is present but empty, which stringify also drops on the way back', async () => {
    const emptyId = { id: '', license_key: { id: 'lk_1', status: 'granted', expires_at: null } };
    const res = await handleLicense(
      post({ key: 'K' }),
      env({ fetch: vi.fn(async () => new Response(JSON.stringify(emptyId), { status: 200 })) }),
    );
    expect(res.status).toBe(502);
  });

  it('STILL mints when Polar answers properly, or nobody can activate at all', async () => {
    const res = await handleLicense(post({ key: 'K' }), env());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token?: string; activationId?: string };
    expect(body.token).toBeTruthy();
    expect(body.activationId).toBe('act_1');
  });

  it('lets a RENEWAL through on the id the client sent, which is the whole point of renewing', async () => {
    // The validate path already has a fallback: Polar's validation response need not echo
    // the activation, because the client just sent it. Refusing here would break renewal
    // for every subscriber to fix a bug that only exists on activate.
    const validated = { id: 'lk_1', status: 'granted' };
    const res = await handleLicense(
      post({ key: 'K', activationId: 'act_1' }),
      env({ fetch: vi.fn(async () => new Response(JSON.stringify(validated), { status: 200 })) }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { activationId?: string }).toHaveProperty('activationId', 'act_1');
  });
});
