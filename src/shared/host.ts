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
 * NOTE FOR WHOEVER WIRES THE PROXY: nothing imports VISION_ENDPOINT yet.
 * `DEFAULT_SETTINGS.endpoint` still points straight at Google, which is the
 * bring-your-own-key build. Task 6 stands up /api/vision and Task 8 repoints the default.
 * Until both land, this file is a declaration of intent rather than a live route.
 */
export const BUKI_HOST = 'https://get-buki.vercel.app';

/** The proxy that holds the Gemini key, so a user never has to. Task 6. */
export const VISION_ENDPOINT = `${BUKI_HOST}/api/vision`;

/** Where a Polar licence key is exchanged for a session token. Task 7. */
export const LICENSE_ENDPOINT = `${BUKI_HOST}/api/license`;
