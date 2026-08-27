import { describe, it, expect } from 'vitest';
import { bookKey, sameBook } from './bookIdentity';

describe('sameBook', () => {
  it('matches two editions that resolved to different ISBNs', () => {
    // The reported bug. The retailer-link path and the cover path resolve DIFFERENT
    // editions of one book, and identity keyed on the ISBN filed them as two books.
    expect(
      sameBook(
        { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' },
        { title: 'Dune', author: 'Frank Herbert', isbn: '9780340960196' },
      ),
    ).toBe(true);
  });

  it('matches when one path found an ISBN and the other did not', () => {
    // Worse than the edition case: identical text, filed twice, because one key was
    // "isbn:..." and the other was "ta:...".
    expect(
      sameBook(
        { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' },
        { title: 'Dune', author: 'Frank Herbert' },
      ),
    ).toBe(true);
  });

  it('matches the same ISBN even when the titles are written differently', () => {
    expect(
      sameBook(
        { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' },
        { title: 'Dune: Special Edition', author: 'F. Herbert', isbn: '9780441013593' },
      ),
    ).toBe(true);
  });

  it('keeps two different books apart', () => {
    expect(
      sameBook({ title: 'Dune', author: 'Frank Herbert' }, { title: 'Ubik', author: 'P. K. Dick' }),
    ).toBe(false);
  });

  it('does not merge a sequel into its predecessor', () => {
    expect(
      sameBook(
        { title: 'Dune', author: 'Frank Herbert' },
        { title: 'Dune Messiah', author: 'Frank Herbert' },
      ),
    ).toBe(false);
  });
});

describe('bookKey', () => {
  it('ignores case, spacing and punctuation', () => {
    expect(bookKey({ title: '  The  Dispossessed! ', author: 'Ursula K. Le Guin' })).toBe(
      bookKey({ title: 'the dispossessed', author: 'ursula k le guin' }),
    );
  });

  it('ignores a subtitle after a colon', () => {
    // OpenLibrary answers one query with "Sapiens: A Brief History of Humankind" and
    // another with "Sapiens". One book.
    expect(
      bookKey({ title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari' }),
    ).toBe(bookKey({ title: 'Sapiens', author: 'Yuval Noah Harari' }));
  });

  it('ignores a leading article', () => {
    expect(bookKey({ title: 'The Hobbit', author: 'J. R. R. Tolkien' })).toBe(
      bookKey({ title: 'Hobbit', author: 'J R R Tolkien' }),
    );
  });

  it('matches an author given surname-first against the same author given first-name-first', () => {
    // The model answers "Ursula K. Le Guin"; OpenLibrary often has "Le Guin, Ursula K.".
    expect(bookKey({ title: 'The Dispossessed', author: 'Ursula K. Le Guin' })).toBe(
      bookKey({ title: 'The Dispossessed', author: 'Le Guin, Ursula K.' }),
    );
  });

  it('matches a shortened author list against the full one', () => {
    // Real case from the dogfood shelf: OpenLibrary returns "Abelson, Sussman" for one
    // query and "Harold Abelson, Gerald Jay Sussman" for another.
    expect(
      bookKey({ title: 'Structure and Interpretation of Computer Programs', author: 'Abelson, Sussman' }),
    ).toBe(
      bookKey({
        title: 'Structure and Interpretation of Computer Programs',
        author: 'Harold Abelson, Gerald Jay Sussman',
      }),
    );
  });

  it('strips accents so one spelling does not become two books', () => {
    expect(bookKey({ title: 'Rayuela', author: 'Julio Cortázar' })).toBe(
      bookKey({ title: 'Rayuela', author: 'Julio Cortazar' }),
    );
  });

  it('still separates two books that share an author', () => {
    expect(bookKey({ title: 'Dune', author: 'Frank Herbert' })).not.toBe(
      bookKey({ title: 'Children of Dune', author: 'Frank Herbert' }),
    );
  });
});

/**
 * C-5 AND C-6. `OPENWORK.md` item 47, and both are FALSE MERGES — the expensive direction.
 * A missed match costs a duplicate row the reader can see and delete. A false match
 * overwrites a book they already had, silently, and the tray says "Moved".
 */
describe('two volumes of one series are two books', () => {
  const TOLKIEN = 'J. R. R. Tolkien';

  it('does not merge The Two Towers into The Return of the King', () => {
    // `normTitle` takes everything before the first colon, so both reduced to "lord of the
    // rings" and shared a surname. Saving the second REPLACED the first, and a differing
    // ISBN could not veto because the ISBN check can only ADD a match.
    expect(
      sameBook(
        { title: 'The Lord of the Rings: The Two Towers', author: TOLKIEN },
        { title: 'The Lord of the Rings: The Return of the King', author: TOLKIEN },
      ),
    ).toBe(false);
  });

  it('STILL merges a subtitle one catalogue omits, which is why the split exists', () => {
    // The case the subtitle strip was written for, and it must survive the fix. One
    // catalogue writes "Sapiens" and another writes the full title; they are one book.
    expect(
      sameBook(
        { title: 'Sapiens', author: 'Yuval Noah Harari' },
        { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari' },
      ),
    ).toBe(true);
  });

  it('merges two spellings of the SAME subtitle', () => {
    expect(
      sameBook(
        { title: 'The Lord of the Rings: The Two Towers', author: TOLKIEN },
        { title: 'the lord of the rings: the two towers!', author: TOLKIEN },
      ),
    ).toBe(true);
  });

  it('lets a matching ISBN override the subtitle difference', () => {
    // Identity is the WORK, and an ISBN is direct evidence of it. If two records carry the
    // same ISBN they are the same edition of the same book, whatever the titles say.
    expect(
      sameBook(
        { title: 'The Lord of the Rings: The Two Towers', author: TOLKIEN, isbn: '9780261102361' },
        { title: 'The Lord of the Rings: Book Two', author: TOLKIEN, isbn: '9780261102361' },
      ),
    ).toBe(true);
  });
});

describe('the surname is the surname, not the longest word', () => {
  it('matches a full name against one with an initial', () => {
    // `normAuthor` took the LONGEST token after sorting. "gabriel" and "marquez" are both
    // seven letters, so the tie resolved alphabetically to "gabriel" for the full name and
    // to "marquez" for the initialled one. Two keys, one author, one book filed twice.
    expect(bookKey({ title: 'Cien años de soledad', author: 'Gabriel García Márquez' })).toBe(
      bookKey({ title: 'Cien años de soledad', author: 'G. García Márquez' }),
    );
  });

  it('takes the surname from either name order', () => {
    expect(bookKey({ title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin' })).toBe(
      bookKey({ title: 'A Wizard of Earthsea', author: 'Le Guin, Ursula K.' }),
    );
  });

  it('takes the FIRST author when a catalogue lists several', () => {
    expect(bookKey({ title: 'SICP', author: 'Harold Abelson, Gerald Jay Sussman' })).toBe(
      bookKey({ title: 'SICP', author: 'Abelson, Sussman' }),
    );
  });

  it('still keeps two different authors of the same title apart', () => {
    expect(bookKey({ title: 'Ulysses', author: 'James Joyce' })).not.toBe(
      bookKey({ title: 'Ulysses', author: 'Alfred Tennyson' }),
    );
  });

  it('survives an author string with nothing usable in it', () => {
    expect(() => bookKey({ title: 'Anon', author: '' })).not.toThrow();
    expect(() => bookKey({ title: 'Anon', author: '   ,  ' })).not.toThrow();
  });
});
