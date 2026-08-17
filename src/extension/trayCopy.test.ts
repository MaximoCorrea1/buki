import { describe, it, expect } from 'vitest';
import { foundHeading, INTENT_LABEL, PROVENANCE } from './trayCopy';

/**
 * The words on a catch card.
 *
 * They live in their own module because `content.ts` registers
 * `chrome.runtime.onMessage` at module scope and cannot be imported at all — the same
 * split `slotTravel.ts` exists for. Copy that cannot be tested is copy that quietly
 * pluralises wrongly for a year.
 */

describe('what a catch card says', () => {
  it('names Buki and says what it did, because a bare count is not a sentence', () => {
    // Maximo, 2026-08-17: 'should have something like "buki found xbooks on this image"'.
    // It replaced a bare "3 books in this picture", which reads as a label on a form.
    expect(foundHeading(3)).toBe('Buki found 3 books in this picture');
  });

  it('says one book, not 1 books', () => {
    expect(foundHeading(1)).toBe('Buki found one book in this picture');
  });

  it('never renders a count of zero as a found card', () => {
    // A card with nothing on it takes the empty state, which is a different sentence
    // entirely. Reaching here with 0 is a bug in the caller, so it says so rather than
    // printing "Buki found 0 books".
    expect(() => foundHeading(0)).toThrow();
  });

  it('labels the three actions with the verb, so a button says what pressing it does', () => {
    // The pile names alone ("now", "next", "someday") read as three nouns with no verb.
    expect(INTENT_LABEL.now).toBe('Read now');
    expect(INTENT_LABEL.next).toBe('Read next');
    expect(INTENT_LABEL.someday).toBe('Read someday');
  });

  it('no longer tells the reader a catch is "unverified"', () => {
    // Removed on Maximo's instruction: 'what is that, remove it'. The distinction it drew
    // — cover read, catalogue unreachable — was real but it is an internal state, and
    // putting it on the card asked the reader to adjudicate something they cannot check.
    // The card still says WHERE the answer came from, which is the part that earns trust.
    const all = Object.values(PROVENANCE).join(' ').toLowerCase();
    expect(all).not.toContain('unverified');
  });

  it('still says where every answer came from, because that is the audit trail', () => {
    for (const key of ['vision', 'unverified', 'link', 'text'] as const) {
      expect(PROVENANCE[key], `${key} has no label`).toBeTruthy();
    }
    // An answer read off the cover says so whether or not the catalogue confirmed it.
    expect(PROVENANCE.unverified).toBe(PROVENANCE.vision);
  });
});
