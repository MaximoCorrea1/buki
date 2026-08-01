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
