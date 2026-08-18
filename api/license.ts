/**
 * Licence key in, session token out. THE SHELL ONLY.
 *
 * Every decision lives in `src/server/licenseHandler.ts`, where it is typechecked and
 * tested without a deploy.
 *
 * NONE OF THESE VARIABLES MAY EVER APPEAR IN A FILE UNDER `src/extension/`.
 */
import { handleLicense } from '../src/server/licenseHandler';

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
  });
}
