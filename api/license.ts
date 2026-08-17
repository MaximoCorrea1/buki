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

const POLAR_ACTIVATE = 'https://api.polar.sh/v1/license-keys/activate';

export default async function handler(request: Request): Promise<Response> {
  return handleLicense(request, {
    secret: process.env['BUKI_TOKEN_SECRET'] ?? '',
    polarToken: process.env['POLAR_ACCESS_TOKEN'] ?? '',
    organizationId: process.env['POLAR_ORGANIZATION_ID'] ?? '',
    // Same variable `/api/vision` uses. Without it this endpoint answers anybody, which
    // made it an open licence-key oracle standing on POLAR_ACCESS_TOKEN.
    extensionId: process.env['BUKI_EXTENSION_ID'] ?? '',
    activateUrl: POLAR_ACTIVATE,
    fetch: (url, init) => fetch(url, init),
    now: () => Date.now(),
  });
}
