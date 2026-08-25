import { describe, it, expect } from 'vitest';
import {
  PRO_MONTHLY_USD,
  PRO_YEARLY_USD,
  FREE_USD,
  priceLine,
  PRICING_URL,
  CHECKOUT_MONTHLY_URL,
  CHECKOUT_YEARLY_URL,
} from './pricing';
import { BUKI_HOST } from './host';
import { TRIAL_CATCHES } from '../extension/entitlement';
import indexHtml from '../../docs/index.html?raw';
import pricingMd from '../../docs/pricing.md?raw';
import storeShots from '../../tools/store-shots.mjs?raw';

/**
 * The price, defined once, and the copies refused permission to disagree.
 *
 * This is `host.test.ts` for money. That file exists because the production host was
 * "defined once" and spelled out in seven places, and the plan that renamed it named
 * three. The price is worse: it appears in the landing's JSON-LD twice, in the pricing
 * card, in an aside near the fold, in `docs/pricing.md` — and now inside the extension
 * itself, on the wall, where a stale number is not a typo but a false statement made to
 * somebody about to pay.
 *
 * It cannot inline the value into a static page, so it does what `host.test.ts` does:
 * finds every price by LOOKING rather than by list, and refuses any that is not declared.
 */

/** Every `$N` on a surface, as numbers. */
const dollars = (body: string): number[] =>
  [...body.matchAll(/\$([0-9]+(?:\.[0-9]+)?)/g)].map((m) => Number(m[1]));

const SURFACES: Record<string, string> = {
  'docs/index.html': indexHtml,
  'docs/pricing.md': pricingMd,
};

describe('the price is one number', () => {
  it('states a free tier, a monthly and a yearly, and nothing else', () => {
    expect(FREE_USD).toBe(0);
    expect(PRO_MONTHLY_USD).toBeGreaterThan(0);
    // A year has to beat twelve months or the yearly plan is a worse deal stated proudly.
    expect(PRO_YEARLY_USD).toBeLessThan(PRO_MONTHLY_USD * 12);
  });

  for (const [name, body] of Object.entries(SURFACES)) {
    it(`${name} names no price this repo has not declared`, () => {
      const allowed = new Set([FREE_USD, PRO_MONTHLY_USD, PRO_YEARLY_USD]);
      const found = dollars(body);
      // Guard the vacuous pass: a surface that stopped mentioning money would otherwise
      // report clean, and the landing losing its pricing card is exactly the sort of
      // thing that should fail loudly.
      expect(found.length, `${name} states no price at all`).toBeGreaterThan(0);
      expect(
        [...new Set(found.filter((n) => !allowed.has(n)))],
        `${name} states a price that is not in src/shared/pricing.ts`,
      ).toEqual([]);
    });
  }

  it("the landing's structured data offers the same numbers it prints", () => {
    // Google reads the JSON-LD and a human reads the card. They have drifted apart on
    // other sites; here they are the same two numbers or the build fails.
    const offers = [...indexHtml.matchAll(/"price":\s*"([0-9.]+)"/g)].map((m) => Number(m[1]));
    expect(offers.length, 'no Offer objects found: has the JSON-LD moved?').toBeGreaterThan(0);
    expect([...new Set(offers)].sort((a, b) => a - b)).toEqual(
      [FREE_USD, PRO_MONTHLY_USD, PRO_YEARLY_USD].sort((a, b) => a - b),
    );
  });

  it('the trial the landing advertises is the trial the code enforces', () => {
    // "Ten catches free" in the hero, ten in `entitlement.ts`. A landing that promises
    // more than the gate allows is the one claim a stranger can check in five minutes.
    expect(TRIAL_CATCHES).toBe(10);
    expect(indexHtml.toLowerCase()).toContain('ten catches free');
  });

  it('the STORE FRAMES promise the same trial as the landing and the code', () => {
    // Added 2026-08-25 with shot 5's sub, which now carries the locked motto line
    // *"Ten catches free. No account, no sync."* That makes the store screenshots a THIRD
    // surface spelling a promise `entitlement.ts` enforces, and OPENWORK item 45 is open
    // precisely because the price guard could not see two of the five surfaces it should.
    //
    // A screenshot is the worst place for this to drift: the frame is a PNG by the time a
    // reader sees it, so a stale number cannot be hot-fixed the way a page can. It has to
    // be caught here or not at all.
    expect(TRIAL_CATCHES).toBe(10);
    expect(storeShots.toLowerCase()).toContain('ten catches free');
  });

  it('the landing has the anchor the EXTENSION links to', () => {
    // The wall and the plan badge both open `${BUKI_HOST}/#pricing`. Without this id they
    // land at the top of a long page and the reader has to go looking for the thing they
    // just pressed a button to see. A cross-surface link nobody asserts is a link that
    // breaks the next time a section is renamed — and this one was broken the moment it
    // was written, which is why the test exists.
    expect(indexHtml).toMatch(/id="pricing"/);
  });

  it('the extension points at that anchor and nowhere else for the price', () => {
    expect(PRICING_URL).toBe(`${BUKI_HOST}/#pricing`);
  });

  it('renders one price line every surface can quote', () => {
    expect(priceLine()).toBe('$4 a month, or $29 a year');
  });
});

/**
 * THE TILL, and until 2026-08-18 there was not one.
 *
 * Every purchase CTA in the extension - the wall's *Get Buki Pro*, the popup's plan badge,
 * the setup page's *See what Pro costs* - opens the landing's `#pricing`. That section's
 * only button linked to GitHub, to install the extension the visitor already has, so
 * somebody who hit the wall was sent in a circle. `OPENWORK.md` item 34.
 *
 * The two URLs now live in `pricing.ts` for the same reason the price and the host do: a
 * value spelled out in a static page and a module drifts, and this one drifts into
 * "nobody can pay" rather than into a typo.
 *
 * These are PUBLIC checkout links, not credentials. Polar issues them to be clicked by
 * customers, which is why they can sit in the repo at all - unlike `POLAR_ACCESS_TOKEN`,
 * which lives in Vercel and must never appear in a file under `src/`.
 */
describe('the checkout', () => {
  it('names Polar, over TLS, for both intervals', () => {
    for (const url of [CHECKOUT_MONTHLY_URL, CHECKOUT_YEARLY_URL]) {
      expect(url).toMatch(/^https:\/\/buy\.polar\.sh\//);
    }
  });

  it('is two DIFFERENT links, because they are two products', () => {
    // Polar locks the billing cycle to the product, so one link cannot sell both. Pasting
    // the same URL twice would silently sell monthly to somebody who chose yearly.
    expect(CHECKOUT_MONTHLY_URL).not.toBe(CHECKOUT_YEARLY_URL);
  });

  it('is reachable from the landing, or the extension leads to a page with no till', () => {
    // The extension sends every purchase CTA to `#pricing`. If that section stops carrying
    // the checkout, the circle comes back and nothing else in this repo would notice.
    expect(indexHtml).toContain(CHECKOUT_MONTHLY_URL);
    expect(indexHtml).toContain(CHECKOUT_YEARLY_URL);
  });

  it('is reached from the PRICING section, not from somewhere further down the page', () => {
    // `PRICING_URL` is an anchor, so a reader arriving from the wall lands at #pricing and
    // sees whatever is inside that section. A checkout link in the footer would satisfy the
    // check above and still leave them looking at a card with no way to pay.
    const start = indexHtml.indexOf('id="pricing"');
    expect(start, 'the landing lost its #pricing section').toBeGreaterThan(-1);
    const section = indexHtml.slice(start, indexHtml.indexOf('</section>', start));
    expect(section).toContain(CHECKOUT_MONTHLY_URL);
    expect(section).toContain(CHECKOUT_YEARLY_URL);
  });

  it('is where the extension actually points', () => {
    // PRICING_URL is what the wall, the plan badge and the setup page open. It has to be an
    // anchor on the landing rather than a checkout, because the choice between monthly and
    // yearly belongs to the customer and only the landing shows both.
    expect(PRICING_URL).toBe(`${BUKI_HOST}/#pricing`);
    expect(indexHtml).toContain('id="pricing"');
  });
});
