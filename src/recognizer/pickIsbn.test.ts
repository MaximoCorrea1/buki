import { describe, it, expect } from 'vitest';
import { pickIsbn } from './pickIsbn';

/**
 * The real array OpenLibrary returned for *The Nvidia Way* on 2026-09-01, in its own order.
 * Entry zero is a 978-7 prefix, which is CHINA, and it is the one the app stored.
 */
const NVIDIA_WAY = [
  '9787521770162',
  '1324086718',
  '1324086726',
  '9781324086710',
  '7521770161',
  '9781324086727',
];

describe('pickIsbn', () => {
  it('does not hand a Chinese edition to a US bookshop', () => {
    // THE CASE THIS EXISTS FOR. `buyLink` builds bookshop.org/a/<id>/<isbn> straight from
    // this value, and Bookshop is a US and UK retailer. The founder caught this book on
    // 2026-09-01 and the app stored 9787521770162.
    expect(pickIsbn(NVIDIA_WAY)).toBe('9781324086710');
  });

  it('prefers a 13 over a 10, because only a 10 doubles as an ASIN and neither is the point', () => {
    // ISBN-13 is the current standard and is what a retailer's catalogue is keyed on.
    // `buyLink` already searches rather than deep-links for exactly this reason.
    expect(pickIsbn(['1324086718', '9781324086710'])).toBe('9781324086710');
  });

  it('still prefers the 13 among editions of the same non-English market', () => {
    // ADDED AFTER A MUTATION SURVIVED. The case below lists the 13 first, so the last-resort
    // `valid[0]` returns it anyway and deleting the any-13 tier changed nothing. With the
    // 10 first, the tier is the only thing standing between the shelf and an ISBN-10.
    expect(pickIsbn(['8432234567', '9788432234567'])).toBe('9788432234567');
  });

  it('keeps a Spanish edition when there is no English one', () => {
    // The rule prefers the English market because that is where the Buy links point, not
    // because other editions are worth less. With no English edition it must not fall
    // through to nothing.
    expect(pickIsbn(['9788432234567', '8432234567'])).toBe('9788432234567');
  });

  it('falls back to a 10 when the catalogue holds no 13 at all', () => {
    expect(pickIsbn(['0140449132'])).toBe('0140449132');
  });

  it('prefers an English 10 over another market\'s 13, because the market is the reason', () => {
    // ADDED AFTER A MUTATION SURVIVED. The tiers used to read English-13, any-13, English-10
    // - format before market - while the docblock argued market. A Spanish ISBN-13 beat an
    // English ISBN-10 and the Bookshop link went to an edition it does not stock. Nothing
    // in the suite noticed, because no case had both.
    expect(pickIsbn(['9788432234567', '0140449132'])).toBe('0140449132');
  });

  it('keeps the caller\'s order among equally English editions', () => {
    // ADDED AFTER A MUTATION SURVIVED. Replacing the search with a sort gave the same answer
    // for every array in this file, because they all happened to sort the same way. A sort
    // invents a total order over editions nobody asked for, and the shelf colour and the
    // dedup key both hang off this answer.
    expect(pickIsbn(['9781324086727', '9781324086710'])).toBe('9781324086727');
  });

  it('returns nothing when every entry is junk, rather than the junk', () => {
    // ADDED AFTER A MUTATION SURVIVED. The earlier junk case put a real ISBN-13 alongside
    // the junk, so the right answer won on its own merits whether or not anything was
    // validated. This is the case that actually needs the guard: with no valid entry, the
    // last tier reaches for `valid[0]`, and without validation that is the junk itself -
    // straight into a Bookshop url and a spreadsheet formula.
    expect(pickIsbn(['not an isbn', 'DROP TABLE books'])).toBeUndefined();
  });

  it('takes the hyphens out, because a retailer url must not carry them', () => {
    expect(pickIsbn(['978-1-324-08671-0'])).toBe('9781324086710');
  });

  it('ignores what is not an ISBN, because openlibrary.org is a wiki anyone may edit', () => {
    // `goodreadsCsv.ts` already says this out loud and validates shape before writing a
    // spreadsheet formula. Validating at the SOURCE as well is defence in depth, not a
    // reason to drop the guard downstream.
    expect(pickIsbn(['not an isbn', '="x"&cmd|\'/c calc\'!A0&""', '9781324086710'])).toBe('9781324086710');
  });

  it('has nothing to say about an empty list', () => {
    expect(pickIsbn([])).toBeUndefined();
    expect(pickIsbn(undefined)).toBeUndefined();
  });

  it('answers the same way twice, because a colour and a dedup key hang off it', () => {
    // `cloth.ts` hashes the shelf colour from the isbn and `bookIdentity.sameBook` compares
    // them. A rule that reordered its own input would repaint a shelf at random.
    expect(pickIsbn(NVIDIA_WAY)).toBe(pickIsbn([...NVIDIA_WAY]));
  });

  it('leaves the caller\'s array alone', () => {
    const original = [...NVIDIA_WAY];
    pickIsbn(original);
    expect(original).toEqual(NVIDIA_WAY);
  });
});
