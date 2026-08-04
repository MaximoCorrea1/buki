import { describe, it, expect } from 'vitest';
import { recognizeBook } from './recognizer';
import type { Tweet, VisionClient, BooksDb } from './types';

describe('recognizeBook', () => {
  it('reads the cover rather than trusting a link to a different book', async () => {
    // A post that SHOWS one book and LINKS to another is common - a quote from the book
    // beside an affiliate link to something else. The link used to short-circuit before
    // the model ever saw the photo, so the picture on screen was ignored entirely.
    const books: BooksDb = {
      async lookupByIsbn() {
        return { title: 'Linked Book', author: 'Someone Else', isbn: '0141439602' };
      },
      async search() {
        return [{ title: 'Dune', author: 'Frank Herbert' }];
      },
    };
    const vision: VisionClient = {
      async guessBook() {
        return { title: 'Dune', author: 'Frank Herbert', confidence: 0.9 };
      },
    };

    const result = await recognizeBook(
      {
        text: '',
        imageUrls: ['https://pbs.twimg.com/media/cover.jpg'],
        links: ['https://www.amazon.com/dp/0141439602'],
      },
      { vision, books },
    );

    expect(result.candidates[0]?.title).toBe('Dune');
    expect(result.source).toBe('vision');
  });

  it('does not reach for the post text unless it was asked to', async () => {
    // Text grounding as a silent fallback produced books that were never in the image,
    // and nothing on screen distinguished them. It is now an explicit action.
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        return [{ title: 'Some Book From The Words', author: 'Anyone' }];
      },
    };
    const vision: VisionClient = {
      async guessBook() {
        return null;
      },
    };

    const result = await recognizeBook(
      { text: 'Some Book From The Words', imageUrls: ['https://a.test/x.jpg'], links: [] },
      { vision, books },
    );

    expect(result.candidates).toEqual([]);
    expect(result.source).toBe('none');
  });

  it('grounds the post text when it is asked to', async () => {
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        return [{ title: 'Some Book From The Words', author: 'Anyone' }];
      },
    };
    const vision: VisionClient = {
      async guessBook() {
        return null;
      },
    };

    const result = await recognizeBook(
      { text: 'Some Book From The Words', imageUrls: [], links: [] },
      { vision, books },
      { fromText: true },
    );

    expect(result.source).toBe('text');
    expect(result.confidence).toBe('medium');
  });

  it('uses the link when the cover gave nothing, having looked at it first', async () => {
    let visionCalled = false;
    const vision: VisionClient = {
      async guessBook() {
        visionCalled = true;
        return null;
      },
    };
    const books: BooksDb = {
      async lookupByIsbn(isbn) {
        return isbn === '0141439602'
          ? { title: 'Pride and Prejudice', author: 'Jane Austen', isbn }
          : null;
      },
      async search() {
        return [];
      },
    };

    const tweet: Tweet = {
      text: 'one of my favourites',
      imageUrls: ['https://pbs.twimg.com/media/x.jpg'],
      links: ['https://www.amazon.com/dp/0141439602'],
    };

    const result = await recognizeBook(tweet, { vision, books });

    expect(result.source).toBe('link');
    expect(result.confidence).toBe('high');
    expect(result.candidates[0]?.title).toBe('Pride and Prejudice');
    // Reversed on purpose. This used to assert the model was NEVER called when a link was
    // present - which is precisely how a post showing one book and linking to another
    // returned the wrong one. The cover is now always read first; the link is what
    // answers when the cover gives nothing.
    expect(visionCalled).toBe(true);
  });

  it('falls back to vision and grounds the guess against the books DB', async () => {
    let visionCalled = false;
    const vision: VisionClient = {
      async guessBook() {
        visionCalled = true;
        return { title: 'Dune', author: 'Frank Herbert', confidence: 0.9 };
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search(query) {
        return query.title === 'Dune'
          ? [{ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593', coverUrl: 'c' }]
          : [];
      },
    };

    const tweet: Tweet = {
      text: 'this cover is gorgeous',
      imageUrls: ['https://pbs.twimg.com/media/dune.jpg'],
      links: [],
    };

    const result = await recognizeBook(tweet, { vision, books });

    expect(visionCalled).toBe(true);
    expect(result.source).toBe('vision');
    // Three shared words between the guess and the match: the strongest evidence the
    // vision path can produce, and the whole point of carrying the score out.
    expect(result.confidence).toBe('high');
    expect(result.candidates[0]?.isbn).toBe('9780441013593');
  });

  it('drops to medium when the match shares only one word with the guess', async () => {
    // One shared word is a real match but a weak one - the model could have read the
    // author and invented the title. Weak evidence asks instead of deciding.
    const vision: VisionClient = {
      async guessBook() {
        return { title: 'Ficciones', author: 'Borges', confidence: 0.6 };
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        return [{ title: 'Labyrinths', author: 'Jorge Luis Borges' }];
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/b.jpg'], links: [] },
      { vision, books },
    );

    expect(result.confidence).toBe('medium');
    expect(result.candidates[0]?.title).toBe('Labyrinths');
  });

  it('reports nothing rather than a fuzzy match that shares no word with the guess', async () => {
    const vision: VisionClient = {
      async guessBook() {
        return { title: 'Ficciones', author: 'Borges', confidence: 0.6 };
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        return [{ title: 'The Wings of the Dove', author: 'Henry James' }];
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/c.jpg'], links: [] },
      { vision, books },
    );

    expect(result.candidates).toEqual([]);
    expect(result.confidence).toBe('low');
    expect(result.source).toBe('none');
  });

  it('ranks the closest match first rather than trusting the API order', async () => {
    const vision: VisionClient = {
      async guessBook() {
        return { title: 'Dune', author: 'Frank Herbert', confidence: 0.9 };
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        return [
          { title: 'Dune Messiah', author: 'Nobody' },
          { title: 'Dune', author: 'Frank Herbert' },
        ];
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/d.jpg'], links: [] },
      { vision, books },
    );

    expect(result.candidates[0]?.title).toBe('Dune');
    expect(result.confidence).toBe('high');
  });

  it('asks rather than saving when the post only incidentally shares a word', async () => {
    // Characterization test, written from a live OpenLibrary call. The word "HOME" on a
    // meme returns Fun Home / Coming Home / An Island home - all of which genuinely
    // DO share the queried word, so the score-0 filter never sees them.
    //
    // The filter is therefore a weaker guard than it looks, and the real protection is
    // the tier: one incidental word scores 1, and 1 never auto-saves. If this ever
    // reports 'high', a meme can put a book on the shelf without being asked.
    const vision: VisionClient = {
      async guessBook() {
        return null;
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        return [{ title: 'Fun Home', author: 'Alison Bechdel' }];
      },
    };

    // `fromText` is now required: grounding the caption is something the card asks for,
    // not something that happens when the picture came back empty. The guarantee this
    // test protects - a word-overlap match must never reach `high` - is unchanged.
    const result = await recognizeBook(
      { text: 'HOME', imageUrls: [], links: [] },
      { vision, books },
      { fromText: true },
    );

    expect(result.candidates[0]?.title).toBe('Fun Home');
    expect(result.confidence).not.toBe('high');
  });

  it('falls back to the post text when the image gives nothing', async () => {
    const vision: VisionClient = {
      async guessBook() {
        return null;
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search({ title }) {
        return title === '1 Economics in One Lesson'
          ? [{ title: 'Economics in One Lesson', author: 'Henry Hazlitt' }]
          : [];
      },
    };

    // Asked for explicitly now - see the sibling test that proves it does NOT happen on
    // its own. The line-by-line grounding this covers is unchanged.
    const result = await recognizeBook(
      { text: '10 books:\n\n1) Economics in One Lesson', imageUrls: [], links: [] },
      { vision, books },
      { fromText: true },
    );

    expect(result.source).toBe('text');
    expect(result.candidates[0]?.title).toBe('Economics in One Lesson');
  });

  it('never lets the post text alone reach high confidence', async () => {
    // A post listing ten books can ground the wrong line to a real book, and that
    // failure is invisible - so text-only evidence always asks, however well it scores.
    const vision: VisionClient = {
      async guessBook() {
        return null;
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search({ title }) {
        return title === 'Structure and Interpretation of Computer Programs'
          ? [{ title: 'Structure and Interpretation of Computer Programs', author: 'Abelson' }]
          : [];
      },
    };

    // Asked for explicitly now; the ceiling it protects is unchanged.
    const result = await recognizeBook(
      { text: 'Structure and Interpretation of Computer Programs', imageUrls: [], links: [] },
      { vision, books },
      { fromText: true },
    );

    // Four shared words - as strong as text evidence ever gets, and still medium.
    expect(result.confidence).toBe('medium');
  });

  // ------------------------------------------------------- when the catalogue is down

  it('offers what the cover said when the catalogue never answers', async () => {
    // Measured 2026-08-04: OpenLibrary's search index returned nothing within 20s, for
    // every query, uncontended. Grounding was mandatory, so a cover the model read
    // perfectly failed the whole catch - reported to the user as "signal timed out".
    // A reading nobody could check is still worth offering; it just has to say so.
    const books: BooksDb = {
      async lookupByIsbn() {
        throw new Error('OpenLibrary did not answer within 6s.');
      },
      async search() {
        throw new Error('OpenLibrary did not answer within 6s.');
      },
    };
    const vision: VisionClient = {
      async guessBook() {
        return { title: 'Dune', author: 'Frank Herbert', confidence: 0.9 };
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/cover.jpg'], links: [] },
      { vision, books },
    );

    expect(result.candidates).toEqual([{ title: 'Dune', author: 'Frank Herbert' }]);
    expect(result.source).toBe('unverified');
    // Nothing corroborated it, and the card has to be able to say that.
    expect(result.confidence).toBe('low');
  });

  it('keeps looking when the catalogue answers and simply has nothing', async () => {
    // The distinction that matters: "I could not ask" is not "the answer is no". A
    // catalogue that replies with an empty list has done its job, so the link still
    // deserves its turn.
    const books: BooksDb = {
      async lookupByIsbn() {
        return { title: 'Linked Book', author: 'Someone', isbn: '0141439602' };
      },
      async search() {
        return [];
      },
    };
    const vision: VisionClient = {
      async guessBook() {
        return { title: 'Unfindable', author: 'Nobody', confidence: 0.9 };
      },
    };

    const result = await recognizeBook(
      {
        text: '',
        imageUrls: ['https://pbs.twimg.com/media/cover.jpg'],
        links: ['https://www.amazon.com/dp/0141439602'],
      },
      { vision, books },
    );

    expect(result.source).toBe('link');
  });

  it('does not let a failing ISBN lookup take the catch down with it', async () => {
    const books: BooksDb = {
      async lookupByIsbn() {
        throw new Error('OpenLibrary did not answer within 6s.');
      },
      async search() {
        return [];
      },
    };
    const vision: VisionClient = {
      async guessBook() {
        return null;
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: [], links: ['https://www.amazon.com/dp/0141439602'] },
      { vision, books },
    );

    expect(result.source).toBe('none');
    expect(result.candidates).toEqual([]);
  });
});
