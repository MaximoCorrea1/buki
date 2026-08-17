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

export const config = { runtime: 'edge' };

/** The alias, never a pinned version. Two pinned models were found retired inside one
 *  afternoon, and a pinned default 404s for every new user while working perfectly on the
 *  machine of the one person who could notice. */
const PROVIDER_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

/** Per IP per day, for unlicensed trial requests only. Generous on purpose: the trial is
 *  ten and a household behind one NAT is several people. */
const TRIAL_PER_IP_PER_DAY = 40;

/** In-memory and therefore per-instance, which is the point: it is a brake on a runaway,
 *  not an accounting system. The trial count that matters lives in the extension. */
const hits = new Map<string, { day: number; n: number }>();

function overIpCap(request: Request, now: number): boolean {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const day = Math.floor(now / 86_400_000);
  const seen = hits.get(ip);
  if (!seen || seen.day !== day) {
    hits.set(ip, { day, n: 1 });
    return false;
  }
  seen.n++;
  return seen.n > TRIAL_PER_IP_PER_DAY;
}

export default async function handler(request: Request): Promise<Response> {
  return handleVision(request, {
    secret: process.env['BUKI_TOKEN_SECRET'] ?? '',
    providerKey: process.env['GEMINI_API_KEY'] ?? '',
    extensionId: process.env['BUKI_EXTENSION_ID'] ?? '',
    trialClosed: process.env['BUKI_TRIAL_CLOSED'] === '1',
    providerUrl: PROVIDER_URL,
    fetch: (url, init) => fetch(url, init),
    now: () => Date.now(),
    ipCap: overIpCap,
  });
}
