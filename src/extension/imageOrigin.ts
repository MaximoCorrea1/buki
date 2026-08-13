/**
 * Which origin permission, if any, a right-clicked image needs before it can be read.
 *
 * Reading a cover means fetching it, and a cover usually sits on a CDN that is not the
 * tab's own origin, which `activeTab` does not cover. So the worker has to ask. This
 * decides what to ask for, and the answer is frequently "nothing".
 *
 * `null` means DO NOT ASK, and it never means "give up". A data: image carries its own
 * bytes and needs no permission at all; an http: one cannot be requested because
 * `optional_host_permissions` is https only. In both cases the right move is to go ahead
 * and let the fetch succeed or fail on its own, because a catch that silently does
 * nothing is worse than one that fails with a card saying so.
 */
export function originPatternFor(srcUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(srcUrl);
  } catch {
    return null;
  }

  // optional_host_permissions is ["https://*/*"], so https is the only thing that can be
  // granted. Anything else is not a narrower ask, it is an impossible one.
  if (url.protocol !== 'https:') return null;

  // hostname, NOT host: a match pattern has no port component and Chrome rejects
  // "https://example.com:8443/*" outright. Dropping the port is also correct rather than
  // merely safe, because match patterns already apply to every port on the host.
  const host = url.hostname;

  // A hostname is attacker-influenced input: it arrives from whatever page the user
  // right-clicked on. "https://*/*" is a legal pattern that grants the entire web, so a
  // wildcard must never survive into the string we hand to permissions.request().
  if (!host || host.includes('*')) return null;

  // An IPv6 literal keeps its brackets in hostname, and "https://[::1]/*" is not a legal
  // match pattern either. Same failure as the port: Chrome throws rather than declining.
  if (host.includes('[') || host.includes(']')) return null;

  return `https://${host}/*`;
}

/**
 * The one thing asking needs from Chrome, injected so this can be tested without one.
 * `chrome.permissions.request({ origins })`, narrowed to the argument that varies.
 */
export interface PermissionDeps {
  request(origins: string[]): Promise<boolean>;
}

/**
 * Ask for the one origin this catch needs, if it needs one.
 *
 * MUST be the first await in the click handler. `permissions.request` requires the user
 * gesture from the click, and awaiting anything else first can consume it. It is also
 * called WITHOUT a `permissions.contains` check in front of it, for the same reason: an
 * already-granted origin resolves true with no prompt, so the check would buy nothing and
 * cost the gesture.
 *
 * A rejection is not a refusal. `false` means the user said no, so the catch stops. A
 * throw means the pattern was unusable, and then the honest move is to carry on and let
 * the fetch succeed or fail visibly rather than silently doing nothing.
 */
export async function mayFetch(srcUrl: string, deps: PermissionDeps): Promise<boolean> {
  const origin = originPatternFor(srcUrl);
  if (origin === null) return true; // nothing to ask for; see originPatternFor
  try {
    return await deps.request([origin]);
  } catch (err) {
    console.error('[Buki] could not ask for', origin, err);
    return true;
  }
}
