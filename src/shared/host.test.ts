import { describe, it, expect } from 'vitest';
import { BUKI_HOST } from './host';
import indexHtml from '../../docs/index.html?raw';
import sitemapXml from '../../docs/sitemap.xml?raw';
import robotsTxt from '../../docs/robots.txt?raw';
import manifestJson from '../../manifest.json?raw';

/**
 * `host.ts` says it is the one definition of the production host. Nothing imports it, and
 * the landing cannot: a static page has no build step to inline a constant through. So
 * the claim was decoration, and the next rename would repeat exactly the failure that
 * file was created to prevent. It happened once already, when the Vercel project was
 * renamed off `shelfy`: the plan named three files carrying the retired domain and the
 * real number was seven, because `robots.txt`, `sitemap.xml` and `llms.txt` postdated it.
 *
 * This is the enforcement. It cannot inline the value, but it can refuse to let the
 * copies disagree with it, and it finds the copies by looking rather than by list.
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

  it('is actually named by the files whose whole job is an absolute URL', () => {
    // The first check is satisfied by a docs/ that mentions no host at all. These three
    // cannot work without one: a sitemap or a robots directive pointing at a dead host is
    // worse than none, and it is the near-miss the last rename produced.
    for (const file of [indexHtml, sitemapXml, robotsTxt]) {
      expect(file).toContain(BUKI_HOST);
    }
  });
});
