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
  });
}
