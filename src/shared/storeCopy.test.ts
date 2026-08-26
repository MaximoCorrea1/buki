import { describe, it, expect } from 'vitest';
import manifestJson from '../../manifest.json?raw';
import listingMd from '../../docs/store/listing.md?raw';

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
