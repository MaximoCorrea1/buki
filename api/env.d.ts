/**
 * The one Node global these two shells need, declared rather than pulled in.
 *
 * This package ships no `@types/node` on purpose: everything under `src/` runs in a
 * browser or a service worker, and adding the whole Node surface to a browser extension's
 * typecheck is how DOM code starts compiling against `Buffer`. Four lines is cheaper and
 * narrower than the dependency.
 */
declare const process: { env: Record<string, string | undefined> };
