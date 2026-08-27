/**
 * Licence key in, session token out. THE SHELL ONLY.
 *
 * Every decision lives in `src/server/licenseHandler.ts`, where it is typechecked and
 * tested without a deploy.
 *
 * NONE OF THESE VARIABLES MAY EVER APPEAR IN A FILE UNDER `src/extension/`.
 */
import { handleLicense } from '../src/server/licenseHandler';
import { createKeyCap } from '../src/server/keyCap';
import { createIpCap, LICENSE_PER_IP_PER_DAY } from '../src/server/ipCap';

export const config = { runtime: 'edge' };

/**
 * ACTIVATE ONCE, VALIDATE FOREVER.
 *
 * `activate` CREATES an activation and spends one of the key's five slots. `validate` takes
 * the activation_id it returned and creates nothing, and is what Polar calls the "for each
 * session" endpoint. The handler picks between them on whether the caller sent an id.
 *
 * The server family (`/v1/license-keys/*`), not `/v1/customer-portal/*`: the portal pair
 * needs no auth and is meant for a client calling Polar directly, and we hold an
 * organisation token because the proxy has to verify the licence anyway.
 */
const POLAR_ACTIVATE = 'https://api.polar.sh/v1/license-keys/activate';
const POLAR_VALIDATE = 'https://api.polar.sh/v1/license-keys/validate';

/**
 * ONE counter for this isolate. The rule, the two ceilings and the eviction are all in
 * `src/server/keyCap.ts`, where they are tested — this file stays a shell.
 */
const keyCap = createKeyCap();

/**
 * The second counter, and it counts what `keyCap` cannot.
 *
 * `keyCap` is keyed on the licence key, which the caller chooses, so guessing N keys costs
 * N real calls on `POLAR_ACCESS_TOKEN`. This one is keyed on the caller. Its ceiling is
 * higher than `/api/vision`'s because the traffic is different — five activation slots
 * renewing daily, times a household behind one address, times retries — and locking out a
 * paying subscriber is the worst outcome this endpoint has. `OPENWORK.md` item 51, SEC-3.
 */
const ipCap = createIpCap({ perDay: LICENSE_PER_IP_PER_DAY });

export default async function handler(request: Request): Promise<Response> {
  return handleLicense(request, {
    secret: process.env['BUKI_TOKEN_SECRET'] ?? '',
    polarToken: process.env['POLAR_ACCESS_TOKEN'] ?? '',
    organizationId: process.env['POLAR_ORGANIZATION_ID'] ?? '',
    // Same variable `/api/vision` uses. Without it this endpoint answers anybody, which
    // made it an open licence-key oracle standing on POLAR_ACCESS_TOKEN.
    extensionId: process.env['BUKI_EXTENSION_ID'] ?? '',
    activateUrl: POLAR_ACTIVATE,
    validateUrl: POLAR_VALIDATE,
    fetch: (url, init) => fetch(url, init),
    now: () => Date.now(),
    keyCap,
    ipCap,
  });
}
