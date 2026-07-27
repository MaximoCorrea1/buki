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
    expect(result.confidence).toBe('medium');
    expect(result.candidates[0]?.isbn).toBe('9780441013593');
  });
});
