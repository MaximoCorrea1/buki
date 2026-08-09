import { verify } from './token';

/**
 * Who is asking, and may they. Pure, so the Edge function underneath is short enough to
 * read in one screen and every branch is tested without a network.
 */

export type Access =
  | { kind: 'trial' }
  | { kind: 'pro'; licenseKeyId: string; grace: boolean }
  | { kind: 'refused'; status: 401 | 403 };

/**
 * An MV3 service worker sends `Origin: chrome-extension://<id>` on a cross-origin fetch,
 * so this is a real signal. It is also forgeable by anything that is not a browser, which
 * is why it is one of three defences rather than the defence: the per-IP cap and the
 * global kill switch are the others, and a catch costs about $0.00011.
 */
export function fromExtension(origin: string | null, extensionId: string): boolean {
  return origin === `chrome-extension://${extensionId}`;
}

export async function decideAccess(
  token: string | null,
  origin: string | null,
  opts: { secret: string; extensionId: string; now: number },
): Promise<Access> {
  if (!token) {
    return fromExtension(origin, opts.extensionId)
      ? { kind: 'trial' }
      : { kind: 'refused', status: 403 };
  }

  const verdict = await verify(token, opts.secret, opts.now);
  switch (verdict.state) {
    case 'valid':
      return { kind: 'pro', licenseKeyId: verdict.claim.licenseKeyId, grace: false };
    case 'expired':
      // Correctly signed and recently ours, so we know this licence was real yesterday.
      // Serving it is how a Polar outage stays our problem rather than the customer's.
      return { kind: 'pro', licenseKeyId: verdict.claim.licenseKeyId, grace: true };
    default:
      // 401, never 403: it tells the extension to exchange its licence key again, which
      // is the one action that can actually fix this.
      return { kind: 'refused', status: 401 };
  }
}
