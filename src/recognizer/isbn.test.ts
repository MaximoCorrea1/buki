import { describe, it, expect } from 'vitest';
import { extractIsbnFromLinks } from './isbn';

describe('extractIsbnFromLinks', () => {
  it('pulls the ISBN-10 / ASIN out of an Amazon /dp/ book link', () => {
    const links = [
      'https://twitter.com/someone/status/1790000000000000000',
      'https://www.amazon.com/dp/0141439602?ref_=abc',
    ];

    expect(extractIsbnFromLinks(links)).toBe('0141439602');
  });

  it('returns null when no link carries an identifier', () => {
    expect(extractIsbnFromLinks(['https://example.com/blog'])).toBeNull();
  });

  it('ignores a /dp/ pattern from a non-retailer host', () => {
    // Tweet markup is attacker-shapeable, so a lookalike URL must not seed a
    // "high confidence" match.
    expect(extractIsbnFromLinks(['https://evil.example/dp/0141439602'])).toBeNull();
  });
});
