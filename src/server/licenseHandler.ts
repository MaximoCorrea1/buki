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
import { fromExtension } from './policy';
import { sign, TOKEN_TTL_MS } from './token';
import { worthRetrying } from '../shared/retry';

export interface LicenseEnv {
  secret: string;
  /** Ours. It must never reach the client, not even inside an error we are quoting. */
  polarToken: string;
  organizationId: string;
  /** Who is allowed to ask. See the origin check below. */
  extensionId: string;
  activateUrl: string;
  /** Polar's per-session check. Takes an activation_id and creates NOTHING. */
  validateUrl: string;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
  /**
   * True when this key has had too many of THIS KIND of request today.
   *
   * Takes the branch because the two cost different things: `validate` creates nothing, so
   * its ceiling is about how much an oracle can be probed; `activate` spends one of the
   * key's five slots for ever, so one number generous enough for five installs renewing
   * daily would also be generous enough to burn every slot the customer has.
   */
  keyCap: (key: string, kind: 'activate' | 'validate', now: number) => boolean;
}

/** `activate`'s answer. The top-level `id` is the ACTIVATION. */
interface PolarActivation {
  id: string;
  license_key: { id: string; status: string; expires_at: string | null };
}

/**
 * `validate`'s answer, and it is INVERTED from activate's — this is the trap.
 *
 *   activate   { id: <activation>,  license_key: { id: <key>, status } }
 *   validate   { id: <key>, status, activation: { id: <activation> } }
 *
 * Read one as the other and `status` is `undefined`, so every renewal 403s with "That
 * licence is not active" and looks exactly like a revoked subscription.
 */
interface PolarValidation {
  id: string;
  status: string;
  activation?: { id: string };
}

/** What both shapes are normalised to, so one branch decides below. */
interface Claim {
  licenseKeyId: string;
  activationId: string;
  status: string;
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * WHY THIS WAS REFUSED, as a string a client can branch on.
 *
 * Two findings, one field.
 *
 * **AC-8** wanted one envelope. `405` and `500` returned bare text with no content-type, so
 * `license.ts` — which reads `body.error` as a string — extracted nothing on exactly the two
 * statuses meaning the server itself is broken.
 *
 * **The one the review did not file** is `origin`. A mismatched `BUKI_EXTENSION_ID` makes
 * this check refuse EVERY renewal with 403 while `/api/vision` keeps serving token-bearing
 * requests, so the failure is invisible until tokens age out eight days later — and by then
 * every subscriber has had their session erased by a 403 that was never about their licence.
 * A status alone cannot carry that difference: two 403s here mean opposite things.
 *
 *   origin    we do not recognise the caller. OURS to fix, never the customer’s
 *   request   the body was not a licence exchange
 *   cap       our own per-key brake. Passes on its own
 *   licence   Polar's answer about this key. Revoked, wrong, activation limit reached
 *   shape     Polar answered something we could not read
 *   upstream  Polar had a bad minute. Passes on its own
 *
 * **Adding this after publication is impossible**, which is item 44’s whole argument: a
 * client in the wild that has never heard of `code` cannot be taught to read one.
 */
type Refusal = 'origin' | 'request' | 'cap' | 'licence' | 'shape' | 'upstream';

const refuse = (error: string, code: Refusal, status: number): Response =>
  json({ error, code }, status);

export async function handleLicense(request: Request, env: LicenseEnv): Promise<Response> {
  if (request.method !== 'POST') {
    return refuse('Buki exchanges licences by POST only.', 'request', 405);
  }

  if (!env.secret || !env.polarToken || !env.organizationId || !env.extensionId) {
    console.error('[buki] misconfigured: missing environment');
    // Vague on purpose, and asserted to be. Naming the missing variable would hand a
    // stranger the configuration of the endpoint standing on our Polar credential.
    return refuse('Buki is not set up to check licences just now.', 'request', 500);
  }

  // WHO MAY ASK. Without this the endpoint is an open licence-key oracle standing on our
  // Polar credential: anybody could POST a candidate key and read from the status whether
  // it was real, on our token and our quota. Worse, a SUCCESSFUL activation consumes one
  // of that key's five slots, so a leaked key plus five requests locks the person who paid
  // out of their own licence.
  //
  // Checked BEFORE the body is read and long before Polar is called, because a refusal
  // that still made the outbound call would spend the quota and burn the slot anyway.
  //
  // Forgeable, like every Origin header, and worth having for the same reason it is worth
  // having on `/api/vision`: it closes the casual path entirely, and there was nothing
  // here at all before. It is not a substitute for a spend cap on the provider key.
  if (!fromExtension(request.headers.get('origin'), env.extensionId)) {
    // `origin`, NOT `licence`, and that distinction is the whole of the new field. This
    // 403 says we do not recognise the caller — which on launch day means
    // `BUKI_EXTENSION_ID` is not the shipped id. It is not a statement about anybody’s
    // subscription, and `license.ts` must not erase a paying session over it.
    return refuse('Not authorised', 'origin', 403);
  }

  let key: string;
  let activationId: string;
  try {
    const body = (await request.json()) as { key?: string; activationId?: string };
    key = body.key?.trim() ?? '';
    activationId = body.activationId?.trim() ?? '';
  } catch {
    return refuse('Bad request', 'request', 400);
  }
  if (!key) return refuse('No licence key', 'request', 400);

  const renewing = Boolean(activationId);

  // THE CAP, and it lands HERE for two reasons.
  //
  // BEFORE the outbound fetch, like every other refusal in this handler: a 429 answered
  // after calling Polar would have burned the activation it exists to protect.
  //
  // AFTER the key is parsed and trimmed, because the key is what it counts. Counting the
  // request instead would hand an attacker a fresh allowance per caller, and counting the
  // untrimmed string would hand them one per trailing space.
  //
  // `/api/vision` has always paired its Origin check with a per-IP cap. This endpoint had
  // the Origin check and nothing else, which two reviewers raised independently: `Origin`
  // is a header any script sets, and the extension id is public the moment the item is
  // listed. Five forged requests with a leaked key exhaust a customer's five slots.
  //
  // It is a brake, not an accounting system — the counter behind it is per-isolate, so a
  // caller spread across isolates gets more than one allowance. It bounds the casual and
  // the accidental. What bounds real money is the provider-side spend cap.
  if (env.keyCap(key, renewing ? 'validate' : 'activate', env.now())) {
    // States the fact and names the one thing that fixes it. A customer can meet this too
    // — five installs on a bad network day — so it never reads as an accusation.
    return refuse(
      'Too many licence checks for this key today. Try again tomorrow.',
      'cap',
      429,
    );
  }

  /**
   * ACTIVATE ONCE, VALIDATE FOREVER.
   *
   * `activate` CREATES an activation and spends one of the key's five slots. Calling it on
   * every renewal — which is what this handler used to do, once a day per subscriber —
   * exhausts a five-slot key in five days and then shows a paying customer the wall.
   *
   * So: no activation id means this is a first pairing, and we activate. An activation id
   * means the extension has been here before, and we validate, which creates nothing.
   * Polar's own words: activate is "optional if there is no activation limit", validate is
   * "for each session of your application".
   *
   * `increment_usage` is deliberately NOT sent. It meters consumption per key, and the
   * benefit's Usage limit is left empty on purpose because catches are counted in
   * `entitlement.ts`, on the machine. Two meters would disagree and nobody would know which
   * one had fired.
   */

  let res: Response;
  try {
    res = await env.fetch(renewing ? env.validateUrl : env.activateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.polarToken}` },
      body: JSON.stringify(
        renewing
          ? { key, organization_id: env.organizationId, activation_id: activationId }
          : {
              key,
              organization_id: env.organizationId,
              // Which install this is. Polar shows it in the dashboard and it is the only
              // way to tell one activation of a licence from another.
              label: 'Buki for Chrome',
            },
      ),
    });
  } catch (err) {
    // Polar is unreachable. 503, NOT 403: a 4xx makes the extension throw its session
    // away during OUR outage, which is the exact moment the grace window exists to cover.
    console.error('[buki] polar unreachable', err);
    return refuse('upstream', 'upstream', 503);
  }

  if (!res.ok) {
    // A BAD MINUTE AT POLAR IS NOT AN ANSWER ABOUT THIS LICENCE, and this branch used to
    // treat them as the same thing.
    //
    // Eight lines above, the `catch` returns 503 under a comment saying exactly why 403 is
    // wrong. That comment was right and guarded only the RARER outage shape — a socket or
    // DNS failure. The commoner one, a gateway answering 5xx, fell through to the 403
    // below: `license.ts` read it as definitive, `proState.ts` wrote `session: null`, the
    // token was erased, and the subscriber met the wall they had paid to pass. The token
    // was not expired; `verify` would have served it on grace for another seven days.
    //
    // `worthRetrying` is shared with `llmVision.ts` so the two clients cannot drift again.
    // 429 is in it because OUR OWN `keyCap` is one of the things that answers 429.
    //
    // Nothing of the upstream body is quoted here, unlike the 403 path. A gateway error
    // page is not something a customer can act on, and every relayed byte is a byte that
    // could carry our Polar credential home.
    if (worthRetrying(res.status)) {
      console.error(`[buki] polar upstream ${res.status}`);
      return refuse('upstream', 'upstream', 503);
    }

    // Polar's own words: revoked, wrong key, activation limit reached. Far more use than
    // "invalid licence", and the extension puts it straight in front of the customer.
    const detail = await res.text();
    console.info(`[buki] activate refused ${res.status}`);
    return refuse(
      // Trimmed, and scrubbed of our own credential. Quoting an upstream body verbatim
      // is a common way for a server to publish the token it just used.
      detail.split(env.polarToken).join('[redacted]').slice(0, 300),
      'licence',
      403,
    );
  }

  let claim: Claim;
  try {
    const parsed: unknown = await res.json();
    claim = renewing
      ? {
          licenseKeyId: (parsed as PolarValidation).id,
          activationId: (parsed as PolarValidation).activation?.id ?? activationId,
          status: (parsed as PolarValidation).status,
        }
      : {
          licenseKeyId: (parsed as PolarActivation).license_key?.id,
          activationId: (parsed as PolarActivation).id,
          status: (parsed as PolarActivation).license_key?.status,
        };
  } catch {
    return refuse('Buki got an unexpected answer from the payment provider.', 'shape', 502);
  }

  if (claim.status !== 'granted') {
    return refuse('That licence is not active.', 'licence', 403);
  }

  const now = env.now();
  const token = await sign(
    { licenseKeyId: claim.licenseKeyId, activationId: claim.activationId },
    env.secret,
    now,
  );
  // `activationId` travels back so the extension can persist it and stop activating. It
  // was always in the signed claim and never came out, which is why the client had no way
  // to renew without spending another slot.
  return json({ token, expiresAt: now + TOKEN_TTL_MS, activationId: claim.activationId }, 200);
}
