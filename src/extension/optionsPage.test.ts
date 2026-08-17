import { describe, it, expect } from 'vitest';
import options from '../../options.html?raw';
import optionsTs from './options.ts?raw';

/**
 * The page markup, with comments and CSS stripped.
 *
 * `indexOf` over the raw file counted prose. A review proved it: inserting one benign
 * comment mentioning `id="key"` above the masthead flipped two order assertions with no
 * element moved at all, and the failure read as a layout regression. This repo's house
 * style is unusually comment-dense, so that collision is likelier here than elsewhere.
 */
const DOM = options.replace(/<!--[\s\S]*?-->/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');

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

/** Anchored on the opening TAG, not a bare attribute, for the same reason. */
const at = (needle: string): number => DOM.indexOf(needle);

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

  it('wires the licence section OUTSIDE main()’s provider guard', () => {
    // THE CLAIM THIS FILE'S OWN COMMENT MADE, now actually enforced.
    //
    // `main()` returns early if any of seven PROVIDER ids is missing — none of which has
    // anything to do with Pro. `void wirePro();` sat INSIDE main(), after that guard, so
    // renaming a provider field would have taken the whole licence path down silently:
    // #planNow stuck on "Reading your plan…", #activate with no listener, #getPro's href
    // left as the literal "#". Nothing thrown, nothing logged.
    //
    // `docs/brand.md` and OPENWORK §5 both record this exact shape — "a guard at the top
    // of a script owns everything below it", learned when the theme switch spent two days
    // inside a prefers-reduced-motion guard. The comment claiming independence was written
    // while the call site still had none.
    //
    // Column 0 IS the assertion: a module-scope call cannot inherit a function's guard.
    expect(optionsTs, 'wirePro() must be called at module scope, not inside main()').toMatch(
      /^void wirePro\(\);$/m,
    );
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
    // Identified STRUCTURALLY, by selector, not by anchoring on a magic padding value. A
    // review proved the value anchor brittle: changing only `11px 20px` on the correctly
    // shaped rule failed this test with a message about the anchor, which is a false
    // report about a feature that had not moved.
    // Comments stripped FIRST: this file's comments are long and sit directly above the
    // rules they explain, so without this they land inside the selector capture and no
    // selector ever compares equal to `button`.
    const style = (options.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    const rules = [...style.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({
      selectors: (sel ?? '').split(',').map((s) => s.trim()),
      body: body ?? '',
    }));

    const shape = rules.find(
      (r) => r.selectors.includes('button') && r.body.includes('border-radius'),
    );
    expect(shape, 'no rule gives `button` its shape').toBeDefined();
    expect(
      shape?.selectors,
      'the anchor must share the buttons’ shape rule; it is an <a> and a rule selecting `button` never matches it',
    ).toContain('a.ghost.buy');
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
