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
import { MAX_BODY_BYTES, rebuildVisionBody } from './visionBody';
import { SAFE_HEADERS } from './responseHeaders';
import { VISION_UPSTREAM_MS, boundedSignal, timedOut } from './upstreamTimeout';
import { relayBody } from './upstreamRelay';

export interface VisionEnv {
  secret: string;
  /** Ours, never the user's, and it must never reach the client. */
  providerKey: string;
  extensionId: string;
  /** The kill switch: one variable drains the trial with no deploy. */
  trialClosed: boolean;
  providerUrl: string;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  /**
   * How long to wait on the provider. Injectable ONLY so a test can prove the bound fires
   * without waiting ten seconds; the shell never sets it. R-6 / TM-13, `OPENWORK.md` 51.
   */
  upstreamMs?: number;
  now: () => number;
  /** True when this caller has had too many unlicensed requests today. */
  ipCap: (request: Request, now: number) => boolean;
  /**
   * True when this LICENCE has had too many catches today.
   *
   * Keyed on `licenseKeyId`, which `decideAccess` has always returned and this handler
   * used to discard. Two installs of one subscription therefore share an allowance, which
   * is the correct shape: the thing being bounded is the subscription, not the machine.
   */
  proCap: (licenseKeyId: string, now: number) => boolean;
  /**
   * True when this licence has been turned off out of band.
   *
   * The only targeted lever in a design with no database. See `proCap.ts`.
   */
  revoked: (licenseKeyId: string) => boolean;
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...SAFE_HEADERS },
  });

/** The provider's shape for an error, so the extension's existing parser reads it. */
const refuse = (message: string, status: number): Response => json({ error: { message } }, status);

export async function handleVision(request: Request, env: VisionEnv): Promise<Response> {
  // THROUGH `refuse`, LIKE EVERY OTHER REFUSAL ON THIS ENDPOINT. This and the 500 below
  // returned bare text with no content-type, which the review filed as AC-8: the client
  // extracted no message on exactly the two statuses meaning the server itself is broken,
  // and showed the reader `HTTP 405` instead. `llmVision.explain()` reads
  // `{ error: { message } }`, so that is what it gets.
  if (request.method !== 'POST') return refuse('Buki reads covers by POST only.', 405);

  // Refuse to run half-configured. A missing secret makes every token verify as garbage,
  // which silently demotes every subscriber to the trial path — the loudest possible
  // failure is the safest one here.
  if (!env.secret || !env.providerKey || !env.extensionId) {
    console.error('[buki] misconfigured: missing environment');
    // LOUD TO US, IN THE LOGS; VAGUE TO WHOEVER IS ASKING. The log line above names
    // nothing either, and this must not: a 500 that says WHICH variable is missing is a
    // configuration map handed to a stranger. `visionHandler.test.ts` asserts the absence.
    return refuse('Buki is not set up to read covers just now.', 500);
  }

  // AN EARLY-OUT, NOT THE CONTROL. `content-length` is caller-supplied and a runtime may
  // or may not surface it, so nothing may depend on it — the authoritative check is the
  // byte cap inside `rebuildVisionBody`, and `visionHandler.test.ts` proves that cap holds
  // when this header lies. This only avoids buffering a body we already know we will
  // refuse, which is why it sits above `decideAccess` rather than below: reading headers
  // is all that happens before it.
  //
  // The same shape as `ipCap.ts`'s note about `x-forwarded-for`: the safety must come from
  // the code, and the platform is allowed to help.
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return refuse('That request is too large to read.', 413);
  }

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

  // BOTH BRAKES ARE FOR THE TRIAL ONLY, and they sit together so the next one added has
  // to walk past this sentence. Stopping somebody who is paying is the worst possible
  // place to save a hundredth of a cent.
  //
  // `trialClosed` used to be checked ABOVE `decideAccess`, which refused every request:
  // a subscriber holding a valid session was told "The free trial is closed just now",
  // which is a lockout AND a false statement made to the one person who paid not to see
  // it. The IP cap on the next line had the gate right from the start; the switch beside
  // it did not, eight lines apart.
  if (access.kind === 'trial') {
    if (env.trialClosed) return refuse('The free trial is closed just now.', 402);
    if (env.ipCap(request, now)) {
      return refuse('Too many free catches from this network today.', 429);
    }
  }

  // AND THE PAID PATH HAS TWO OF ITS OWN NOW, which the sentence above did not anticipate.
  //
  // It is still true that stopping somebody who is paying is a terrible place to save a
  // hundredth of a cent — and it stopped being the whole truth the moment the caller could
  // choose what a catch costs. The ceilings here are set where no human reaches them:
  // `TRIAL_PER_IP_PER_DAY` is 40 and is documented as "well above what one person could
  // legitimately do", and `CATCHES_PER_LICENCE_PER_DAY` is an order of magnitude above
  // that again. A brake a customer can feel would make "unlimited, no throttling" false.
  //
  // These are DIFFERENT brakes from the trial's, not the same ones widened. A per-IP cap
  // is a ceiling a subscriber would share with a café; a per-licence one is a ceiling they
  // share only with themselves.
  if (access.kind === 'pro') {
    // Revocation first: it is the cheaper refusal and it should not consume an allowance.
    //
    // 401, not 403, for the reason stated twice already in this file — it is the one
    // status that tells the extension an action can fix this. It re-exchanges, Polar
    // answers about the real state of the subscription, and the client lands in the right
    // place whichever answer that is.
    if (env.revoked(access.licenseKeyId)) {
      return refuse('That session is no longer valid.', 401);
    }
    if (env.proCap(access.licenseKeyId, now)) {
      return refuse('Too many catches on this licence today.', 429);
    }
  }

  // THE BODY IS REBUILT, NOT RELAYED, and this line used to be `body: await request.text()`.
  //
  // That made the caller the one choosing the model, the token budget and the number of
  // completions, all billed to `GEMINI_API_KEY` — measured at up to 25,000x an honest
  // catch. `visionBody.ts` owns the rebuild and every rule inside it; this call site owns
  // only the ordering, which is that the refusal lands BEFORE the outbound fetch, like
  // every other refusal in this handler. A 400 answered after calling the provider has
  // already paid for the request it is refusing.
  const rebuilt = rebuildVisionBody(await request.text());
  if (!rebuilt.ok) return refuse(rebuilt.message, rebuilt.status);

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
      body: rebuilt.body,
      // THE CALLER'S OWN SIGNAL, so that calling a catch off reaches Gemini.
      //
      // `grep -c signal` on this file returned ZERO. The extension aborts properly —
      // `dismiss` sends `cancelRecognize`, the worker's controller fires, the socket closes
      // — and none of it crossed this hop, so the provider went on generating and billing
      // against a connection nobody was listening to. That is what made the card's × a
      // free-read button: the money was committed and `gate.ts` skipped the spend because
      // the work had rejected.
      //
      // Both halves shipped together. This one stops the waste; `entitlement.TRIAL_ATTEMPTS`
      // bounds how many times somebody can do it deliberately.
      //
      // AND A CEILING BESIDE IT, because `request.signal` is abort PROPAGATION and not a
      // timeout: it covers "the caller gave up" and does nothing when nobody does. That is
      // not hypothetical here - the reason this signal exists at all is that a dismissed
      // card left the provider generating and billing, and the fix closed only the half
      // where somebody pressed the x. R-6 / TM-13, `OPENWORK.md` item 51.
      signal: boundedSignal(request.signal, env.upstreamMs ?? VISION_UPSTREAM_MS),
    });
  } catch (err) {
    // SAME STATUS, DIFFERENT SENTENCE. Down and slow are different incidents and need
    // different responses from whoever reads the alert; 502 is right for both, because from
    // here the provider did not answer either way and `worthRetrying` says retry to both.
    const slow = timedOut(err);
    console.error(slow ? '[buki] provider timed out' : '[buki] provider unreachable', err);
    return refuse(
      slow ? 'The reading service took too long.' : 'The reading service is unreachable.',
      502,
    );
  }

  // VERBATIM, including the status. A 429 from the provider means "slow down" and the
  // extension already knows how to retry that; flattening it to 500 loses the one
  // instruction it carries. Only the body and status cross back — never a header, because
  // an upstream header is the one place our own credential could ride home.
  // SCRUBBED AND BOUNDED. This was `await upstream.text()` verbatim - no redaction, no
  // length cap - while `/api/license` had scrubbed and truncated the same class of data
  // since it was written. The endpoint holding the money-spending credential was the one
  // without the scrub. `OPENWORK.md` item 51, AC-9 / TM-6.
  const relayed = relayBody(await upstream.text(), upstream.status, env.providerKey);
  if (!relayed.ok) {
    console.error('[buki] provider body over the relay ceiling');
    return refuse(relayed.message, 502);
  }

  return new Response(relayed.body, {
    status: upstream.status,
    // Ours, not the upstream's - no header crosses back, per the note above. The body is a
    // paid answer and must not be stored by anything between here and the extension.
    headers: { 'content-type': 'application/json', ...SAFE_HEADERS },
  });
}
