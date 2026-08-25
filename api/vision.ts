/**
 * Buki's recognition proxy. THE SHELL ONLY.
 *
 * Every decision lives in `src/server/visionHandler.ts`, where it is typechecked and
 * tested without a deploy. This file exists to read the environment and to be a file
 * Vercel can find, and it is deliberately short enough that nothing here needs a test.
 *
 * NONE OF THESE VARIABLES MAY EVER APPEAR IN A FILE UNDER `src/extension/`. They are the
 * whole reason this hop exists; a key in the extension is a published key.
 */
import { handleVision } from '../src/server/visionHandler';
import { createIpCap } from '../src/server/ipCap';
import { createProCap, parseRevoked } from '../src/server/proCap';

export const config = { runtime: 'edge' };

/** The alias, never a pinned version. Two pinned models were found retired inside one
 *  afternoon, and a pinned default 404s for every new user while working perfectly on the
 *  machine of the one person who could notice. */
const PROVIDER_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

/**
 * ONE counter for this isolate. The ceiling, the day rollover and the header rule are all
 * in `src/server/ipCap.ts`, where they are tested - this file stays a shell.
 */
const ipCap = createIpCap();

/**
 * ONE counter for this isolate, per LICENCE. The ceiling, the day rollover and the
 * eviction rule are all in `src/server/proCap.ts`, where they are tested.
 */
const proCap = createProCap();

/**
 * Licences turned off out of band, read ONCE at module scope.
 *
 * Read here rather than per request because an isolate is short-lived: a change to the
 * variable takes effect as isolates recycle, which is minutes, and re-parsing a
 * comma-separated string on the money path to save those minutes is the wrong trade.
 *
 * **Unset is the normal state**, like `BUKI_TRIAL_CLOSED`, so this adds nothing to the six
 * variables that must be set at launch. An empty value revokes nothing.
 */
const revokedKeyIds = parseRevoked(process.env['BUKI_REVOKED_KEY_IDS']);

export default async function handler(request: Request): Promise<Response> {
  return handleVision(request, {
    secret: process.env['BUKI_TOKEN_SECRET'] ?? '',
    providerKey: process.env['GEMINI_API_KEY'] ?? '',
    extensionId: process.env['BUKI_EXTENSION_ID'] ?? '',
    trialClosed: process.env['BUKI_TRIAL_CLOSED'] === '1',
    providerUrl: PROVIDER_URL,
    fetch: (url, init) => fetch(url, init),
    now: () => Date.now(),
    ipCap,
    proCap,
    revoked: (licenseKeyId) => revokedKeyIds.has(licenseKeyId),
  });
}
