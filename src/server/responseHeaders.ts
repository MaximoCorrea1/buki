/**
 * The headers every response from this proxy carries, beside its content type.
 *
 * TM-12. `OPENWORK.md` item 51. `vercel.json`'s headers block is sourced
 * `/((?!api/).*)` — **every path EXCEPT the API** — so the two endpoints answered with a
 * content type and nothing else.
 *
 * **`no-store` is the one that matters, and the reason is the licence response body.** It
 * carries a bearer token good for `TOKEN_TTL_MS` plus `GRACE_MS`, about eight days, bound to
 * no device. A response with no cache directive is one an intermediary is entitled to store,
 * and the endpoint holding the money-spending credential was the endpoint with no cache
 * instruction. `nosniff` costs nothing and closes the content-type-guessing path on a body
 * that is always JSON.
 *
 * **SET HERE RATHER THAN IN `vercel.json`**, with the platform config kept as a second layer
 * instead of the only one. A header applied by hosting configuration disappears silently
 * when the hosting changes — and this repo has already been bitten by that exact shape:
 * `ipCap`'s `x-forwarded-for` safety comes from Vercel overwriting the header at the edge,
 * which the threat model had to state out loud precisely because the code could not. A
 * header set where the response is BUILT travels with the code and can be tested without a
 * deploy, which is the same argument that put every decision in `src/server/` and left the
 * `api/` files as shells.
 */
export const SAFE_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
} as const;
