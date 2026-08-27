import { describe, it, expect } from 'vitest';
import manifestJson from '../../manifest.json?raw';
import { BUKI_HOST } from './host';

/**
 * THE PERMISSION SURFACE, which is the first thing a store reviewer reads and the first
 * thing a user is shown at install. `OPENWORK.md` item 46, TM-14.
 *
 * `host.test.ts` asks whether the manifest GRANTS the production host. This asks the
 * opposite question, which nothing asked before: does it grant anything it does not need?
 * A permission nobody uses is not free. It is a question in review, a line in the install
 * dialog, and — the part that actually costs — a standing grant that outlives whatever
 * reason it was added for.
 *
 * AN ALLOWLIST RATHER THAN A GLOB, DELIBERATELY, and this is the one place in this repo
 * where a hand-maintained list is the right answer. `host.test.ts` finds hosts by looking
 * because the failure there is a copy nobody remembered. The failure HERE is a permission
 * nobody justified, so requiring an edit to this file — with a sentence saying what breaks
 * without it — is the whole mechanism.
 */
const manifest = JSON.parse(manifestJson) as {
  permissions: string[];
  host_permissions: string[];
  optional_host_permissions: string[];
  content_scripts: { matches: string[] }[];
};

/** Every host permission, with the module that cannot work without it. */
const JUSTIFIED: Record<string, string> = {
  'https://pbs.twimg.com/*':
    'inlineImage.ts downloads the caught picture in the worker, because the tray cannot fetch it under the host page CSP',
  'https://openlibrary.org/*':
    'openLibrary.ts grounds every guess against the catalogue, and lookupByIsbn resolves the retailer-link path',
  'https://covers.openlibrary.org/*':
    'coverCache.ts and coverData.ts fetch the cover bytes; a redirect chain reaches archive.org from here',
  'https://generativelanguage.googleapis.com/*':
    'llmVision.ts posts directly to Google when the reader brought their own key, with no proxy in the path',
  [`${new URL(BUKI_HOST).origin}/*`]:
    'visionRoute.ts and license.ts reach both endpoints; neither sets Access-Control-Allow-Origin, so without this they fail on the wire',
};

describe('the permission surface a reviewer reads', () => {
  it('asks for exactly the hosts justified above, and nothing else', () => {
    // Sorted and compared whole, so an ADDITION fails as loudly as a removal. A subset
    // check would let a new grant in silently, which is the only direction that matters.
    expect([...manifest.host_permissions].sort()).toEqual(Object.keys(JUSTIFIED).sort());
  });

  it('never asks for a host it already reaches through a declared content script', () => {
    // AN ABSENCE PROOF: there is no host granted twice. In MV3 a statically declared
    // content script carries its own access to the sites in `matches`, so naming those
    // sites in `host_permissions` as well grants nothing and answers no question. It
    // shipped with `https://twitter.com/*` and `https://x.com/*` in both places.
    //
    // Written as an absence rather than "the manifest does not contain x.com", because
    // that form goes green the day somebody renames the site and re-adds it.
    const declared = new Set(manifest.content_scripts.flatMap((s) => s.matches));
    const doubled = manifest.host_permissions.filter((h) => declared.has(h));
    expect(doubled).toEqual([]);
  });

  it('reaches every other page through activeTab, not a broad grant at install', () => {
    // The framing `docs/store/permissions.md` gives a reviewer, held to the manifest:
    // catch-anywhere injects on a right-click, which is a user gesture, which grants
    // activeTab. If that ever became a broad host permission the store answer would be
    // false and nothing else in this repo would notice.
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.host_permissions).not.toContain('https://*/*');
    expect(manifest.host_permissions).not.toContain('<all_urls>');
  });

  it('keeps the per-image grant OPTIONAL, which is what makes it a per-use ask', () => {
    // `originPatternFor` narrows this to one hostname per right-clicked image and
    // `mayFetch` asks for it inside the click. As a required permission it would be the
    // entire web, granted at install, with no prompt.
    expect(manifest.optional_host_permissions).toEqual(['https://*/*']);
  });

  it('names every permission it takes, so a new one cannot arrive unreviewed', () => {
    expect([...manifest.permissions].sort()).toEqual(
      ['activeTab', 'contextMenus', 'scripting', 'storage'].sort(),
    );
  });
});
