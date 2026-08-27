import { describe, it, expect } from 'vitest';
import manifestJson from '../../manifest.json?raw';
import listingMd from '../../docs/store/listing.md?raw';
import permissionsMd from '../../docs/store/permissions.md?raw';

/**
 * THE SUMMARY IS THE MOST HEAVILY INDEXED STRING BUKI SHIPS, AND IT WAS CHECKED BY EYE.
 *
 * `docs/store/listing.md` said so in as many words until 2026-08-26: *"`src/shared/host.test.ts`
 * does not guard this string; check it by eye when the manifest moves."* That is the exact
 * shape of `OPENWORK.md` item 45 - store copy spelled in more than one place, with nothing
 * watching, on a surface that **cannot be edited after submission without another review
 * cycle**.
 *
 * The field is unusual in that neither copy is authoritative. `manifest.json` is what Chrome
 * ships and what the store indexes; `listing.md` is what a human reads before filling in the
 * dashboard. A drift between them is not a typo, it is two different products described to
 * two different audiences, and the one nobody notices is the one in the manifest.
 */
const manifest = JSON.parse(manifestJson) as { description: string };

/** The summary, as `listing.md` quotes it in its own fenced block. */
const quoted = (): string => {
  const block = /## Summary \/ short description[\s\S]*?```\n([\s\S]*?)\n```/.exec(listingMd);
  return block?.[1]?.trim() ?? '';
};

describe('the store summary is one sentence, in two places, that agree', () => {
  it('is the same string in the manifest and in the listing', () => {
    const fromListing = quoted();
    expect(fromListing, 'listing.md no longer quotes a summary: has the heading moved?').not.toBe(
      '',
    );
    expect(
      manifest.description,
      'manifest.json and docs/store/listing.md describe Buki differently. The manifest is the one the store indexes, and it is the one nobody reads.',
    ).toBe(fromListing);
  });

  it('fits the 132 characters the Chrome Web Store allows', () => {
    // Over the limit the dashboard truncates rather than refusing, so the failure is a
    // sentence that stops mid-word on the listing and nowhere else.
    expect(manifest.description.length).toBeLessThanOrEqual(132);
    expect(manifest.description.length).toBeGreaterThan(40);
  });

  it('spends its first words on something people search for', () => {
    // Rewritten 2026-08-26. It opened with "Catch a book...", and `catch` is Buki's own word
    // for the act: correct inside the product, and a term with no search demand behind it on
    // the surface that is indexed hardest. This does not police the whole sentence, only that
    // the head term survives a future edit that reaches for the brand vocabulary again.
    expect(manifest.description.toLowerCase()).toContain('identify');
    expect(manifest.description.toLowerCase()).toContain('reading list');
  });

  it('carries none of the words the brand rules the summary out of', () => {
    // `.agents/product-marketing.md`, Words to avoid. `AI` is deliberately NOT here: the ban
    // is on `AI-powered` as a claim, and 2026-08-26 recorded the difference. `scan` IS here,
    // because its problem was never the buzzword - it describes a camera pointed at a
    // physical book, which is the phone-app competitor's product and not this one.
    for (const banned of [
      'ai-powered',
      'ai-driven',
      'powered by ai',
      'seamless',
      'organise',
      'organize',
      'game-changing',
      'revolutionise',
      'scan',
    ]) {
      expect(manifest.description.toLowerCase(), `the summary says "${banned}"`).not.toContain(
        banned,
      );
    }
  });
});

/**
 * THE OTHER STORE FIELD WITH A HARD LIMIT AND NO GUARD. `OPENWORK.md` item 46.
 *
 * The dashboard gives host permissions ONE justification field capped at 1000 characters,
 * not one field per host, and `permissions.md` carries a hand-measured "953 characters"
 * note above the block it is pasted from. A number measured by hand once is a number that
 * drifts the next time somebody edits the paragraph above it - which happened on
 * 2026-08-27, when TM-14 removed a host and TM-4 added a sentence about covers, and the
 * block moved to 883 without anyone re-measuring until it was asked for.
 *
 * THE FAILURE MODE IS WHY THIS MATTERS: over the limit the field TRUNCATES rather than
 * refusing, and it truncates from the END. The end is where the wildcard answer lives -
 * the three clauses that turn "this extension wants every site" into "this extension asks
 * for one image host when you right-click an image on it". So the copy that gets silently
 * cut is the copy the whole answer stands on.
 */
const pasteBlock = (): string => {
  const from = permissionsMd.indexOf('## Host permissions');
  const rest = permissionsMd.slice(from);
  const open = rest.indexOf('\n```\n');
  const close = rest.indexOf('\n```\n', open + 5);
  return open < 0 || close < 0 ? '' : rest.slice(open + 5, close + 1).trimEnd();
};

describe('the host-permissions justification fits the field it is pasted into', () => {
  it('is still findable, rather than passing because the heading moved', () => {
    const block = pasteBlock();
    expect(block, 'permissions.md no longer quotes a host-permissions block').not.toBe('');
    expect(block).toContain('get-buki.vercel.app');
  });

  it('fits 1000 characters even if the field counts CRLF', () => {
    // Counted with CRLF, which is the pessimistic reading: nobody knows which the dashboard
    // uses, and being wrong in that direction costs the wildcard answer.
    const crlf = pasteBlock().replace(/\n/g, '\r\n').length;
    expect(crlf, `the paste block is ${crlf} characters and will be cut from the end`).toBeLessThanOrEqual(1000);
  });

  it('keeps all three clauses of the wildcard answer, which is what truncation eats first', () => {
    // Not a length check. A block that fits can still have lost the sentence, and this is
    // the sentence: never granted at install, one host at a time, derived from the image's
    // own URL. `permissions.md` says in as many words that if this ever has to be
    // shortened again, cut a named host and never this.
    const block = pasteBlock();
    expect(block).toContain('never granted at install');
    expect(block).toContain('one host at a time');
    expect(block).toContain("right-clicked image's own URL");
  });

  it('justifies every host the manifest actually asks for, and no host it does not', () => {
    // The drift TM-14 created in the other direction: the manifest lost two hosts and this
    // answer still described them, which is a store answer describing a permission the
    // extension does not hold. Both directions fail here.
    const block = pasteBlock();
    const hosts = (JSON.parse(manifestJson) as { host_permissions: string[] }).host_permissions;
    for (const pattern of hosts) {
      const host = new URL(pattern.replace('/*', '')).hostname;
      expect(block, `the paste block never justifies ${host}`).toContain(host);
    }
    for (const gone of ['x.com,', 'twitter.com']) {
      expect(block, `the paste block still justifies ${gone}, which is not in the manifest`).not.toContain(gone);
    }
  });
});
