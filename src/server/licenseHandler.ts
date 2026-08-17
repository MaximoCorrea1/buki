/**
 * Licence key in, session token out, as a function of a Request.
 *
 * `api/license.ts` is a shell that reads `process.env` and calls this.
 *
 * Called once a day by an extension that already holds a licence, and never during a
 * catch. Polar's customer-portal endpoints would let the extension do this itself without
 * a secret, but the proxy has to verify the licence anyway before spending our provider
 * key — so a check made in the extension would be decoration. One place decides.
 */
import { sign, TOKEN_TTL_MS } from './token';

export interface LicenseEnv {
  secret: string;
  /** Ours. It must never reach the client, not even inside an error we are quoting. */
  polarToken: string;
  organizationId: string;
  activateUrl: string;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
}

interface PolarActivation {
  id: string;
  license_key: { id: string; status: string; expires_at: string | null };
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function handleLicense(request: Request, env: LicenseEnv): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (!env.secret || !env.polarToken || !env.organizationId) {
    console.error('[buki] misconfigured: missing environment');
    return new Response('Server not configured', { status: 500 });
  }

  let key: string;
  try {
    key = ((await request.json()) as { key?: string }).key?.trim() ?? '';
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  if (!key) return json({ error: 'No licence key' }, 400);

  let res: Response;
  try {
    res = await env.fetch(env.activateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.polarToken}` },
      body: JSON.stringify({
        key,
        organization_id: env.organizationId,
        // Which install this is. Polar shows it in the dashboard and it is the only way
        // to tell one activation of a licence from another.
        label: 'Buki for Chrome',
      }),
    });
  } catch (err) {
    // Polar is unreachable. 503, NOT 403: a 4xx makes the extension throw its session
    // away during OUR outage, which is the exact moment the grace window exists to cover.
    console.error('[buki] polar unreachable', err);
    return json({ error: 'upstream' }, 503);
  }

  if (!res.ok) {
    // Polar's own words: revoked, wrong key, activation limit reached. Far more use than
    // "invalid licence", and the extension puts it straight in front of the customer.
    const detail = await res.text();
    console.info(`[buki] activate refused ${res.status}`);
    return json(
      {
        // Trimmed, and scrubbed of our own credential. Quoting an upstream body verbatim
        // is a common way for a server to publish the token it just used.
        error: detail.split(env.polarToken).join('[redacted]').slice(0, 300),
      },
      403,
    );
  }

  let activation: PolarActivation;
  try {
    activation = (await res.json()) as PolarActivation;
  } catch {
    return json({ error: 'Buki got an unexpected answer from the payment provider.' }, 502);
  }

  if (activation.license_key?.status !== 'granted') {
    return json({ error: 'That licence is not active.' }, 403);
  }

  const now = env.now();
  const token = await sign(
    { licenseKeyId: activation.license_key.id, activationId: activation.id },
    env.secret,
    now,
  );
  return json({ token, expiresAt: now + TOKEN_TTL_MS }, 200);
}
