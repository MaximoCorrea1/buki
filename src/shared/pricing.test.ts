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

    // LOOK AT THE DISPLAYED COPY, NOT THE FILE. The first version of this asserted the
    // phrase appeared anywhere in store-shots.mjs, and a mutation that DELETED it from the
    // frame left the suite green: the comment above the frame explaining the guard was
    // enough to satisfy the guard. That is the ?raw failure OPENWORK section 5 records, in
    // its purest form. Only head: and sub: literals are copy a reader can ever see.
    const shown = [...storeShots.matchAll(/\b(?:head|sub):\s*'([^']*)'/g)].map((m) => m[1]);
    expect(shown.length, 'no frame copy found: has the SHOTS shape changed?').toBeGreaterThan(4);
    expect(shown.join(' | ').toLowerCase()).toContain('ten catches free');
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
 * THE PRICE ON THE SURFACES THE GUARD ABOVE CANNOT SEE. `OPENWORK.md` item 45.
 *
 * `SURFACES` covers the landing and `docs/pricing.md` with a blunt rule: every `$N` must be
 * one this repo declared. That works there because those two files talk about nothing but
 * what Buki costs. It does not generalise, and the item's own prescription — *"widen the
 * glob to the three files `host.test.ts` already covers, same shape, one line"* — was
 * MEASURED on 2026-08-27 and is wrong twice over:
 *
 * 1. **It is red on arrival.** Across the shipped docs the blunt rule finds ~40 undeclared
 *    figures in 12 files, and every single one is a COST rather than a price: `$0.00011` a
 *    catch, the `$5` Gemini cap, `$3.46` for the attacker request, `$2.50/M` in and `$15/M`
 *    out, `$1.20 per 1 million events`. The reflex answer is to allowlist those numbers,
 *    and an allowlist containing `4.99` is a guard that waves through a listing reading
 *    *"Buki Pro is $4.99 a month"*. The fix that looks like one line destroys the guard.
 * 2. **It names three files and there are two.** `docs/store/launch.md` does not state the
 *    price. Its only `$29` sits in *"subscriber pays $29, gets nothing to paste"* — prose
 *    about a failure mode, with no period beside it.
 *
 * So the unit is not a dollar figure, it is a PRICE CLAIM: a figure whose next words say
 * how long it buys. `$4 a month` is a claim; `$0.00011` a catch is arithmetic; `$15 per
 * dispute` is Polar's fee. Only the first can be a false statement made to somebody at the
 * moment they decide to pay, and `docs/store/listing.md` is the copy pasted into the store
 * form, which CANNOT BE EDITED AFTER SUBMISSION without another review cycle.
 */

/**
 * A per-period price claim, tolerating markup between the number and the period because
 * the landing splits them: `<b>$4</b><span>a month`.
 */
const CLAIM =
  /\$([0-9]+(?:\.[0-9]{1,2})?)\s*(?:<[^>]*>\s*)*(?:a|an|per|each|\/)\s*(?:<[^>]*>\s*)*(?:month|year|mo|yr|mth)\b/gi;

const claims = (body: string): number[] => [...body.matchAll(CLAIM)].map((m) => Number(m[1]));

/**
 * Every shipped document, found by LOOKING rather than by list — the same argument
 * `host.test.ts` makes, and for the same reason: the last rename broke on files the list
 * did not know about.
 *
 * `docs/superpowers/**` is the one exclusion and it is measured, not assumed:
 * `specs/2026-08-09-buki-pro-design.md` carries **Polar's** fee table — `$15 per dispute,
 * $2/month payout fee` — so it states a third party's price the same way
 * `competitor-profiles/` states a rival's, and `host.test.ts` excludes that folder on
 * exactly this reasoning. Those files are also dated design records; forcing a price change
 * to edit them would rewrite history to satisfy a guard.
 */
const PRICED = import.meta.glob(
  [
    '../../docs/**/*.html',
    '../../docs/**/*.md',
    '../../docs/**/*.txt',
    '../../README.md',
    '!../../docs/superpowers/**',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const shortPath = (p: string): string => p.replace(/^(\.\.\/)+/, '');

/** One globbed file by its repo-relative name, loud when the glob stops reaching it. */
function surface(name: string): string {
  const hit = Object.entries(PRICED).find(([p]) => shortPath(p) === name);
  if (!hit) throw new Error(`the glob no longer reaches ${name}`);
  return hit[1];
}

/** One markdown section, so a guard can read the copy rather than the commentary on it. */
function section(body: string, heading: string): string {
  const start = body.indexOf(heading);
  if (start < 0) throw new Error(`lost the heading ${heading}`);
  const next = body.indexOf('\n## ', start + heading.length);
  return body.slice(start, next < 0 ? undefined : next);
}

describe('a price claim, as distinct from a dollar figure', () => {
  it('reads the claim however a surface spells it', () => {
    expect(claims('Buki Pro is $4 a month or $29 a year')).toEqual([4, 29]);
    expect(claims('- Price: $4/month, or $29/year')).toEqual([4, 29]);
    expect(claims('Buki Pro is $4 per month or $29 per year')).toEqual([4, 29]);
    expect(claims('<b>$4</b><span>a month, or $29 a year</span>')).toEqual([4, 29]);
    expect(claims('StoryGraph Plus is $4.99/mo or $49.99/yr')).toEqual([4.99, 49.99]);
  });

  it('does NOT read a cost, a cap or a fee as a price', () => {
    // These six strings are verbatim from this repo, and they are the reason the item's
    // own one-line prescription cannot be taken. A guard that trips on them gets an
    // allowlist, and an allowlist is how `$4.99 a month` gets onto a store listing.
    expect(claims('a catch costs about $0.00011')).toEqual([]);
    expect(claims('the Gemini cap is $5')).toEqual([]);
    expect(claims('$2.50/M in, $15/M out')).toEqual([]);
    expect(claims('$1.20 per 1 million events')).toEqual([]);
    expect(claims('$15 per dispute')).toEqual([]);
    expect(claims('subscriber pays $29, gets nothing to paste')).toEqual([]);
  });

  it('does not mistake a word that merely starts like a period', () => {
    // `mo` and `yr` are real abbreviations on rival pricing pages, so the alternation has
    // to end on a word boundary or `$5 a moment` becomes a monthly plan.
    expect(claims('$5 a moment later')).toEqual([]);
    expect(claims('$5 a year')).toEqual([5]);
  });
});

describe('every shipped surface that names a price names the declared one', () => {
  it('reads real files rather than passing on a glob that matched nothing', () => {
    // Without this the whole block is satisfied by a broken pattern, which is the same
    // silent pass as `str.replace` matching nothing.
    expect(Object.keys(PRICED).length).toBeGreaterThan(10);
  });

  it('leaves the internal plans out, because they carry a third party\'s fees', () => {
    // Stated as an ABSENCE proof rather than a presence one: the risk is the exclusion
    // silently stopping working, not the exclusion being absent.
    const swept = Object.keys(PRICED).map(shortPath);
    expect(swept.filter((p) => p.includes('docs/superpowers/'))).toEqual([]);
  });

  it('states no price this repo has not declared', () => {
    const allowed = new Set([FREE_USD, PRO_MONTHLY_USD, PRO_YEARLY_USD]);
    // Named rather than counted. "Two files are stale" sends you hunting; this says which
    // file and what it claims, which is the whole value of catching it here.
    const stale = Object.entries(PRICED).flatMap(([path, body]) =>
      [...new Set(claims(body).filter((n) => !allowed.has(n)))].map(
        (n) => `${shortPath(path)} claims $${n}`,
      ),
    );
    expect(stale).toEqual([]);
  });

  it('still finds the price in the copy that is PASTED INTO THE FORM, not merely in the file', () => {
    // THE FIRST VERSION OF THIS TEST ASKED WHETHER `listing.md` MENTIONS A PRICE ANYWHERE,
    // AND A MUTATION DELETING THE PRICE SENTENCE FROM THE SHIPPED COPY LEFT IT GREEN.
    // The file states the price twice: once in the Detailed description, which is what a
    // customer reads, and once at line 23 inside an editorial note QUOTING that copy while
    // explaining why the till had to exist. The note satisfied the guard. That is the
    // `?raw` failure OPENWORK section 5 records, one level up — commentary about the copy
    // standing in for the copy — and it is why this reads the SECTION.
    const detailed = section(surface('docs/store/listing.md'), '## Detailed description');
    expect(claims(detailed)).toContain(PRO_MONTHLY_USD);
    expect(claims(detailed)).toContain(PRO_YEARLY_USD);

    // `llms.txt` is what an assistant answers when somebody asks what Buki costs, and it is
    // shipped prose end to end, so the file IS the copy.
    const llms = claims(surface('docs/llms.txt'));
    expect(llms).toContain(PRO_MONTHLY_USD);
    expect(llms).toContain(PRO_YEARLY_USD);
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
