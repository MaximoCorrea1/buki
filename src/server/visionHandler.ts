/**
 * Buki's recognition proxy, as a function of a Request.
 *
 * `api/vision.ts` is a shell that reads `process.env` and calls this. Everything that can
 * be wrong lives here, where it is tested without a deploy — which matters more than
 * usual: this is the only code path in the product that spends money, and the only one
 * holding a credential that is not the user's.
 *
 * It speaks the OpenAI chat-completions shape in and out and returns the provider's
 * response VERBATIM, because `llmVision.ts` already parses that shape and must not learn
 * that this hop exists. The extension's only change is which URL it posts to.
 */
import { decideAccess } from './policy';

export interface VisionEnv {
  secret: string;
  /** Ours, never the user's, and it must never reach the client. */
  providerKey: string;
  extensionId: string;
  /** The kill switch: one variable drains the trial with no deploy. */
  trialClosed: boolean;
  providerUrl: string;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
  /** True when this caller has had too many unlicensed requests today. */
  ipCap: (request: Request, now: number) => boolean;
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** The provider's shape for an error, so the extension's existing parser reads it. */
const refuse = (message: string, status: number): Response => json({ error: { message } }, status);

export async function handleVision(request: Request, env: VisionEnv): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Refuse to run half-configured. A missing secret makes every token verify as garbage,
  // which silently demotes every subscriber to the trial path — the loudest possible
  // failure is the safest one here.
  if (!env.secret || !env.providerKey || !env.extensionId) {
    console.error('[buki] misconfigured: missing environment');
    return new Response('Server not configured', { status: 500 });
  }

  if (env.trialClosed) return refuse('The free trial is closed just now.', 402);

  const now = env.now();
  // `null` when the header is ABSENT, which is the correct state for somebody who has
  // never paid. An empty string is a session that BROKE, and `decideAccess` is careful
  // about the difference — do not collapse them here either.
  const header = request.headers.get('authorization');
  const bearer = header === null ? null : header.replace(/^Bearer\s+/i, '');

  const access = await decideAccess(bearer, request.headers.get('origin'), {
    secret: env.secret,
    extensionId: env.extensionId,
    now,
  });

  if (access.kind === 'refused') {
    // 401 tells the extension to exchange its licence key again, which is the one action
    // that can fix a broken session. 403 says "not you", and re-exchanging will not help.
    return refuse(
      access.status === 401 ? 'That session is no longer valid.' : 'Not authorised.',
      access.status,
    );
  }

  // The cap is for the TRIAL only. Rate-limiting somebody who is paying is the worst
  // possible place to save a hundredth of a cent.
  if (access.kind === 'trial' && env.ipCap(request, now)) {
    return refuse('Too many free catches from this network today.', 429);
  }

  let upstream: Response;
  try {
    upstream = await env.fetch(env.providerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // OURS, and only ours. The caller's session token is deliberately not forwarded:
        // the provider has no use for it, and a credential that travels further than it
        // must is a wider blast radius for no gain.
        authorization: `Bearer ${env.providerKey}`,
      },
      body: await request.text(),
    });
  } catch (err) {
    console.error('[buki] provider unreachable', err);
    return refuse('The reading service is unreachable.', 502);
  }

  // VERBATIM, including the status. A 429 from the provider means "slow down" and the
  // extension already knows how to retry that; flattening it to 500 loses the one
  // instruction it carries. Only the body and status cross back — never a header, because
  // an upstream header is the one place our own credential could ride home.
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  });
}
