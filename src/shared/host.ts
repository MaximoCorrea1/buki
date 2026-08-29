/**
 * Where Buki's own server lives. ONE definition, imported by the extension and echoed by
 * the landing, because a host that appears in nine files is a host that gets renamed in
 * eight.
 *
 * It was renamed once already. The Vercel project was `shelfy`, from the product's first
 * name, and it answered on `shelfy-pearl.vercel.app`; renaming a Vercel project retires
 * the old domain immediately, so this had to be settled before any build shipped pointing
 * at it. The current production domain is below and it is the only place to change it.
 *
 * BOTH ROUTES ARE LIVE AND BOTH CONSTANTS ARE IMPORTED. `api/vision.ts` and
 * `api/license.ts` are stood up; `visionRoute.ts` routes to `VISION_ENDPOINT`, and
 * `background.ts` and `options.ts` exchange keys at `LICENSE_ENDPOINT`.
 *
 * *(This read "nothing imports VISION_ENDPOINT yet ... a declaration of intent rather than
 * a live route" until 2026-08-29. Task 6 had landed; the note had not. All three callers
 * were meanwhile rebuilding the paths by hand out of `BUKI_HOST` — item 54's M-1, and the
 * same nine-files problem the paragraph above warns about, one level down: the HOST was
 * defined once and the PATHS were not.)*
 *
 * `DEFAULT_SETTINGS.endpoint` does still point straight at Google, which is the
 * bring-your-own-key build. That half of the old note was true. Task 8 repoints it.
 */
export const BUKI_HOST = 'https://get-buki.vercel.app';

/** The proxy that holds the Gemini key, so a user never has to. Task 6. */
export const VISION_ENDPOINT = `${BUKI_HOST}/api/vision`;

/** Where a Polar licence key is exchanged for a session token. Task 7. */
export const LICENSE_ENDPOINT = `${BUKI_HOST}/api/license`;
