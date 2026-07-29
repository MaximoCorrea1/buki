import { describe, it, expect } from 'vitest';
import { buyLink, type Affiliate } from './buyLink';

const TAGGED: Affiliate = { amazonTag: 'shelfy-20', bookshopId: '98765' };
const UNTAGGED: Affiliate = { amazonTag: '', bookshopId: '' };

const DUNE = { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' };
const NO_ISBN = { title: 'Signals and Systems', author: 'Alan V. Oppenheim' };

describe('buyLink', () => {
  it('searches Amazon by ISBN, carrying the tag', () => {
    const url = new URL(buyLink(DUNE, 'amazon', TAGGED)!);

    // Search rather than /dp/: OpenLibrary hands back ISBN-13 as often as ISBN-10, and
    // only ISBN-10 doubles as an ASIN. A /dp/ link built from an ISBN-13 is a 404.
    expect(url.hostname).toBe('www.amazon.com');
    expect(url.pathname).toBe('/s');
    expect(url.searchParams.get('k')).toBe('9780441013593');
    expect(url.searchParams.get('tag')).toBe('shelfy-20');
  });

  it('falls back to title and author when there is no ISBN', () => {
    const url = new URL(buyLink(NO_ISBN, 'amazon', TAGGED)!);

    expect(url.searchParams.get('k')).toBe('Signals and Systems Alan V. Oppenheim');
  });

  it('links Bookshop through the affiliate path when we have an id', () => {
    expect(buyLink(DUNE, 'bookshop', TAGGED)).toBe('https://bookshop.org/a/98765/9780441013593');
  });

  it('still produces a usable link with no affiliate account at all', () => {
    // The feature has to work before any affiliate account exists, or it cannot be
    // tested until after it is shipped.
    const amazon = new URL(buyLink(DUNE, 'amazon', UNTAGGED)!);
    expect(amazon.searchParams.has('tag')).toBe(false);
    expect(amazon.searchParams.get('k')).toBe('9780441013593');

    expect(buyLink(DUNE, 'bookshop', UNTAGGED)).toBe(
      'https://bookshop.org/search?keywords=9780441013593',
    );
  });

  it('returns nothing when there is nothing to search for', () => {
    expect(buyLink({ title: '', author: '' }, 'amazon', TAGGED)).toBeNull();
  });
});
