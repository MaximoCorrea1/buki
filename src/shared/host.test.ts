import { describe, it, expect } from 'vitest';
import { BUKI_HOST } from './host';
import indexHtml from '../../docs/index.html?raw';
import sitemapXml from '../../docs/sitemap.xml?raw';
import robotsTxt from '../../docs/robots.txt?raw';
import manifestJson from '../../manifest.json?raw';

/**
 * `host.ts` says it is the one definition of the production host. The extension imports it;
 * the landing cannot, because a static page has no build step to inline a constant through.
 * So for the files that cannot import, the claim would be decoration, and the next rename
 * would repeat exactly the failure that file was created to prevent. It happened once
 * already, when the Vercel project was renamed off `shelfy`: the plan named three files
 * carrying the retired domain and the real number was seven, because `robots.txt`,
 * `sitemap.xml` and `llms.txt` postdated it.
 *
 * This is the enforcement. It cannot inline the value, but it can refuse to let the copies
 * disagree with it, and it finds the copies by looking rather than by list.
 *
 * *(The first line read "Nothing imports it" until 2026-08-29, and that was true when it
 * was written. It stopped being true the moment M-1 was fixed and `visionRoute`,
 * `background` and `options` began importing the endpoint constants instead of rebuilding
 * the paths. The rule below outlived the sentence.)*
 */

/**
 * What ships, plus what an agent copies code out of. `docs/superpowers` is in on purpose:
 * the plan carries pasteable code with the host in it, and a stale host there becomes a
 * stale host in the build that follows.
 *
 * `src/shared/host.ts` is deliberately out. It is the definition, and its comment names
 * the retired domain on purpose, as the record of why this guard exists.
 * `competitor-profiles/` is out too: a rival's own Vercel host is not our drift.
 */
const SHIPPED = import.meta.glob(
  [
    '../../docs/**/*.html',
    '../../docs/**/*.txt',
    '../../docs/**/*.xml',
    '../../docs/**/*.md',
    '../../README.md',
    '../../manifest.json',
    '../../vercel.json',
    '../../popup.html',
    '../../options.html',
  ],
  { query: '?raw', import: 'default', eager: true },
);

/**
 * The TypeScript that can import the constants, for the absence proof below. Tests are in
 * on purpose: a test that hand-builds the URL is asserting against a path nothing ships.
 */
const SOURCE = import.meta.glob(
  ['../extension/*.ts', '../server/*.ts', '../recognizer/*.ts', '../shared/*.ts', '../../api/*.ts'],
  { query: '?raw', import: 'default', eager: true },
);

const ANY_VERCEL_HOST = /https:\/\/[a-z0-9-]+\.vercel\.app/gi;

describe('the production host', () => {
  it('is the only Vercel host any shipped file names', () => {
    const stale = Object.entries(SHIPPED).flatMap(([path, body]) =>
      (body.match(ANY_VERCEL_HOST) ?? [])
        .filter((found) => found.toLowerCase() !== BUKI_HOST.toLowerCase())
        .map((found) => `${path.replace(/^(\.\.\/)+/, '')} names ${found}`),
    );
    // Named rather than counted. "Three files are stale" sends you hunting; this says
    // which file and what it says, which is the whole value of catching it here.
    expect(stale).toEqual([]);
  });

  it('reads real files, rather than passing on a glob that matched nothing', () => {
    // Without this the check above is satisfied by a broken pattern, which is the same
    // silent pass as `str.replace` matching nothing. There are well over a dozen.
    expect(Object.keys(SHIPPED).length).toBeGreaterThan(8);
  });

  it("is the landing's canonical URL", () => {
    const canonical = /<link\s+rel="canonical"\s+href="([^"]+)"/.exec(indexHtml)?.[1];
    expect(canonical).toBe(`${BUKI_HOST}/`);
  });

  it('is GRANTED by the manifest, not merely spelled the same everywhere', () => {
    // THE AXIS THE CHECK ABOVE CANNOT CROSS. It fails a file that names the WRONG host, so
    // `manifest.json` satisfies it by naming no host at all — which is exactly the state
    // that shipped: `visionRoute` posts every keyless catch to `${BUKI_HOST}/api/vision`
    // and both the worker and the options page post every licence exchange to
    // `${BUKI_HOST}/api/license`, and the manifest granted permission for neither.
    //
    // Chrome, on cross-origin network requests: "A script executing in an extension service
    // worker or foreground tab can talk to remote servers outside of its origin, AS LONG AS
    // the extension requests host permissions", and a request to another origin "will be
    // treated as a cross-origin request unless the extension has host permissions".
    // https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
    //
    // Neither `/api/` handler sets `Access-Control-Allow-Origin` and `vercel.json`
    // deliberately excludes `/api/` from its headers block, so without this entry the
    // paid tier and the ten free catches fail on the wire rather than degrading.
    //
    // `optional_host_permissions: ["https://*/*"]` does NOT cover it: that one is requested
    // per image origin by `originPatternFor`, and nothing ever asks for this host.
    const manifest = JSON.parse(manifestJson) as {
      host_permissions?: string[];
      optional_host_permissions?: string[];
    };
    expect(manifest.host_permissions).toContain(`${new URL(BUKI_HOST).origin}/*`);
  });

  it('is never re-joined to an api path by hand', () => {
    // THE AXIS THE GLOB ABOVE CANNOT CROSS, and it is why item 54's M-1 survived a green
    // suite. That check fails a file naming the WRONG host — so a file naming the RIGHT
    // host and hand-joining the path satisfies it completely. Which is the state that
    // shipped: `host.ts` exported VISION_ENDPOINT and LICENSE_ENDPOINT, NOTHING imported
    // either, and three files rebuilt the path themselves. A rename of the PATH would have
    // missed all three, which is the seven-files failure one level down.
    //
    // Written as an ABSENCE proof — there is no second way to build the URL — rather than
    // "the constants are imported somewhere", which one caller satisfies while the other
    // two drift. `host.ts` itself is excluded: it is the definition.
    // COMMENTS ARE STRIPPED FIRST, and that is not a detail. This very file explains the
    // manifest grant by quoting both URLs in prose, so a scan of the raw text fails on its
    // own explanation — the mirror image of the trap this repo already knows, where a
    // `?raw` guard looking for a SAFE call is satisfied by a comment. Prose is not code in
    // either direction. Block comments before line comments, and `[^:]` so `https://`
    // survives.
    const code = (body: string) =>
      body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    const rebuilt = Object.entries(SOURCE)
      .filter(([path]) => !path.endsWith('host.ts'))
      .flatMap(([path, body]) =>
        [...code(body as string).matchAll(/\$\{BUKI_HOST\}\/api\/[a-z]+/g)].map(
          (m) => `${path.replace(/^(\.\.\/)+/, '')} builds ${m[0]} by hand`,
        ),
      );
    expect(rebuilt).toEqual([]);
  });

  it('reads real source, rather than passing on a glob that matched nothing', () => {
    // The same vacuous pass the shipped-files check guards against. If this collapses, the
    // absence proof above is satisfied by an empty set.
    expect(Object.keys(SOURCE).length).toBeGreaterThan(20);
  });

  it('is actually named by the files whose whole job is an absolute URL', () => {
    // The first check is satisfied by a docs/ that mentions no host at all. These three
    // cannot work without one: a sitemap or a robots directive pointing at a dead host is
    // worse than none, and it is the near-miss the last rename produced.
    for (const file of [indexHtml, sitemapXml, robotsTxt]) {
      expect(file).toContain(BUKI_HOST);
    }
  });
});

/**
 * WHERE "INSTALL" POINTS, and why this will be wrong on exactly one day.
 *
 * Every install CTA on the landing points at GitHub today, which is honest: there is no Web
 * Store listing yet, so the link goes to the source. **The moment the item is published,
 * all five have to become the store URL** - and that URL does not exist until publication,
 * because it contains the extension id.
 *
 * There are FIVE of them and there are also THREE GitHub links that must NOT move: two
 * "Source" links and "Report a problem". A find-and-replace on the day would send Source to
 * the Web Store, and nobody would notice because it still goes somewhere plausible.
 *
 * So this does not assert WHAT the destination is. It asserts that every install CTA shares
 * ONE, which is the failure that actually happens: five links, three updated, two left
 * behind. This repo has form - the plan that renamed the production host named three files
 * and the real number was seven.
 *
 * A `.btn` anchor whose href is a fragment is an in-page jump ("See it catch a book") and
 * is not an install CTA.
 */
describe('the install CTA', () => {
  const ctas = [...indexHtml.matchAll(/<a class="btn[^"]*" href="([^"]+)"/g)]
    .map((m) => m[1]!)
    .filter((href) => !href.startsWith('#'));

  it('is on the page more than once, so a single stale link cannot hide', () => {
    // The hero, the nav, both plan cards and the closing band. If this count collapses,
    // the check below starts passing vacuously.
    expect(ctas.length).toBeGreaterThanOrEqual(5);
  });

  it('sends everybody to the SAME place', () => {
    expect([...new Set(ctas)]).toHaveLength(1);
  });

  it('does not drag the Source and issue links along with it', () => {
    // THESE ASSERTED LINK TEXT UNTIL 2026-08-25, AND THE REVIEW MUTATION-PROVED WHY THAT
    // WAS NOT ENOUGH. A launch-day find-and-replace sends `Source` to the Web Store, and
    // `toContain('>Source<')` survives ANY href change — 620/620 green, shipping a "Source"
    // link that opens the store listing, and nobody would notice because it still goes
    // somewhere plausible. Worse, the sibling assertion above ("sends everybody to the SAME
    // place") passes MORE confidently after the bad replace, because now all eight agree.
    //
    // So this asserts the DESTINATION. Item 36 is the one agent edit that can only happen
    // on launch day; this is the guard it has to survive.
    const keep = [...indexHtml.matchAll(/<a(?![^>]*class="btn)[^>]*href="([^"]+)"[^>]*>/g)]
      .map((m) => m[1]!)
      .filter((href) => href.startsWith('http'));

    // GUARDS THE VACUOUS PASS, and it is the whole reason the count is written out. Three
    // GitHub links plus the two Polar checkout links: if this collapses — a class renamed,
    // the regex outgrown — every assertion below starts passing on an empty array.
    expect(keep.length, 'the non-btn link set collapsed; the check below proves nothing').toBe(5);

    const github = keep.filter((href) => href.includes('github.com'));
    expect(github.length, 'a GitHub link was moved by a find-and-replace').toBe(3);
    for (const href of github) {
      expect(href).toMatch(/^https:\/\/github\.com\/MaximoCorrea1\/buki/);
    }

    // The till. Same failure mode, higher stakes: a replace that caught these would send
    // every purchase to a 404 on launch day.
    const checkout = keep.filter((href) => href.includes('buy.polar.sh'));
    expect(checkout.length, 'a checkout link was moved by a find-and-replace').toBe(2);

    // The text still matters — it is what a reader sees — so it stays, beside the
    // destination rather than instead of it.
    expect(indexHtml).toContain('>Source<');
    expect(indexHtml).toContain('/issues">Report a problem<');
  });
});
