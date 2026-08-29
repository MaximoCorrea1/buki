/**
 * Which service reads the cover, and with whose credential.
 *
 * Three answers, and each wrong one is expensive in its own way:
 *
 *   own key sent to Buki's proxy    we now hold a credential we never wanted
 *   licence key sent with a catch   the long-lived secret is on the wire every time
 *   nothing sent while paying       a subscriber is quietly demoted to the trial
 *
 * Pure, and separate from `background.ts`, so all three can be tested without Chrome.
 */
import { VISION_ENDPOINT } from '../shared/host';
import { isLicensed, type Session } from './license';
import type { ProState } from './proState';

export interface Route {
  endpoint: string;
  model: string;
  /**
   * Undefined means NO Authorization header at all, which is not the same as an empty
   * one. `llmVision` omits the header when this is falsy and `policy.ts` reads an absent
   * header as "never paid" and an empty one as "a session that broke". Keep the
   * distinction: it is the difference between the trial path and a 401.
   */
  apiKey?: string;
}

export function visionRoute(
  settings: { apiKey: string; endpoint: string; model: string },
  pro: ProState,
  now: number = Date.now(),
): Route {
  // Their own provider, their own key, unchanged and unlimited. Nothing about Pro touches
  // this path, and their key never leaves for anywhere else.
  if (settings.apiKey.trim()) {
    return { endpoint: settings.endpoint, model: settings.model, apiKey: settings.apiKey };
  }

  // Otherwise Buki pays, so Buki's proxy answers. The MODEL IS LEFT EMPTY on purpose: the
  // server pins the alias, and an extension pinning its own would 404 for every user the
  // day that model retired, which has already happened twice.
  const session: Session | null = pro.session;
  return {
    endpoint: VISION_ENDPOINT,
    model: '',
    // The SESSION token, never the licence key. And still sent when it is expired but
    // inside the server's grace window: withholding it there demotes a paying customer
    // during our own outage, which is precisely what the grace window exists to prevent.
    ...(session && isLicensed(session, now) ? { apiKey: session.token } : {}),
  };
}
