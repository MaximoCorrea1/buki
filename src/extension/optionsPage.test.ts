import { describe, it, expect } from 'vitest';
import options from '../../options.html?raw';

/**
 * The setup page's SHAPE, which is a product decision rather than a style one.
 *
 * The page was built when a key was mandatory: it opened with a paragraph explaining why
 * you needed one, then asked for it, and the lede said "Setup: one field, once." None of
 * that survives the paid tier. A fresh install now catches books with no key, no card and
 * no account, so a page that leads with a field almost nobody needs is a page that tells
 * every reader they have work to do.
 *
 * Task 13 Step 1 of `docs/superpowers/plans/2026-08-09-buki-pro.md` asks for the licence
 * first and the own key demoted into a collapsed `<details>`. That step was ticked once
 * without being done, then untick'd and left honest; this file is what makes the third
 * state provable instead of claimed.
 *
 * WHY A TEST AND NOT A LOOK. Order is invisible to every other guard in this repo.
 * `extensionTokens` reads colours, `fonts` reads @font-face, `mark` reads geometry, and
 * all four pass on a page whose first field is the wrong one.
 */

const at = (needle: string): number => options.indexOf(needle);

describe('the setup page leads with what most people need', () => {
  it('puts the licence field above the API key field', () => {
    // The whole restructure in one assertion. Almost nobody needs a key after the paid
    // tier ships; everybody who paid needs somewhere to paste a licence.
    const licence = at('id="licence"');
    const key = at('id="key"');
    expect(licence, 'the licence field is missing').toBeGreaterThan(-1);
    expect(key, 'the key field is missing').toBeGreaterThan(-1);
    expect(licence).toBeLessThan(key);
  });

  it('keeps the own-key path collapsed, and says whose key it means', () => {
    const summary = options.match(/<summary>([^<]*)<\/summary>/)?.[1] ?? '';
    expect(summary.toLowerCase()).toContain('your own');

    // A `<details open>` is not a demotion, it is the same page with a line drawn on it.
    const details = options.match(/<details([^>]*)>/)?.[1] ?? '';
    expect(details, 'the own-key block must start closed').not.toContain('open');
  });

  it('puts the API key inside that block rather than beside it', () => {
    const open = at('<details');
    const close = at('</details>');
    expect(open).toBeGreaterThan(-1);
    expect(at('id="key"')).toBeGreaterThan(open);
    expect(at('id="key"')).toBeLessThan(close);
    // The endpoint and model belong with the key: choosing a provider is what having your
    // own key is FOR, and a nested <details> inside a <details> is a worse page than one.
    expect(at('id="endpoint"')).toBeLessThan(close);
    expect(at('id="model"')).toBeLessThan(close);
  });

  it('still hands options.ts every element it refuses to run without', () => {
    // `main()` returns early if ANY of these is missing, taking the whole provider form
    // with it, and a restructure is exactly when an id gets dropped. `wirePro` is guarded
    // separately on its own four, which is why they are listed apart.
    for (const id of ['key', 'endpoint', 'model', 'status', 'form', 'reset', 'store']) {
      expect(options, `main() needs #${id}`).toContain(`id="${id}"`);
    }
    for (const id of ['licence', 'activate', 'planNow', 'licenceStatus', 'getPro']) {
      expect(options, `wirePro() needs #${id}`).toContain(`id="${id}"`);
    }
  });

  it('does not tell anyone that setup is required', () => {
    // The lede said "Setup: one field, once." for as long as a key was mandatory. It is
    // the first sentence on the page and it was describing the previous product.
    expect(options).not.toContain('Setup: one field');
  });

  it('shapes the buy link with the same rule as the buttons beside it', () => {
    // `#getPro` is an <a> sitting in the same .actions row as the <button> "Activate", and
    // the pill shape came from a rule selecting `button`, which never matches an anchor.
    // MEASURED in Chrome against the real page, not inferred from the selector:
    //   activate <button>  radius 999px  padding 11px/20px  height 35.5
    //   getPro   <a>       radius 0px    padding 0px        height 23.3
    // A square, unpadded box in a row of pills, on the one control that leads to paying.
    // Anchored on `padding: 11px 20px`, which appears exactly once. Three rules carry
    // `border-radius: 999px` and the first of them is the plan badge, so matching on the
    // radius found the wrong rule and failed for the wrong reason.
    const shape = options.match(/([^{}]*)\{[^{}]*padding:\s*11px 20px/)?.[1] ?? '';
    expect(shape, 'the pill-shape rule must name the anchor as well as button').toContain(
      'a.ghost.buy',
    );
  });

  it('does not offer a keyless custom endpoint, because the router ignores one', () => {
    // `visionRoute` branches on the KEY, not the endpoint: a blank key goes to Buki's own
    // proxy and `settings.endpoint` is not consulted at all. The page used to advertise
    // "a proxy that holds its own credential lets you leave the key field blank", which
    // that branch silently made false — it would spend the reader's free catches on our
    // proxy while they believed they were talking to their own.
    expect(options).not.toContain('leave the key field blank');
  });
});
