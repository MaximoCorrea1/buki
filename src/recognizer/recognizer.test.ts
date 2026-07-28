import { describe, it, expect } from 'vitest';
import { recognizeBook } from './recognizer';
import type { Tweet, VisionClient, BooksDb } from './types';

describe('recognizeBook', () => {
  it('short-circuits to the linked book and never calls the vision model', async () => {
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
    expect(visionCalled).toBe(false);
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

    const result = await recognizeBook(
      { text: '10 books:\n\n1) Economics in One Lesson', imageUrls: [], links: [] },
      { vision, books },
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

    const result = await recognizeBook(
      { text: 'Structure and Interpretation of Computer Programs', imageUrls: [], links: [] },
      { vision, books },
    );

    // Four shared words - as strong as text evidence ever gets, and still medium.
    expect(result.confidence).toBe('medium');
  });
});
