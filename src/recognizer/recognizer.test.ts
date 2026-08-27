import { describe, it, expect } from 'vitest';
import { recognizeBook } from './recognizer';
import { GROUND_AT_ONCE } from './mapPool';
import type { Tweet, VisionClient, BooksDb } from './types';

describe('recognizeBook', () => {
  it('never opens more catalogue lookups at once than GROUND_AT_ONCE', async () => {
    /**
     * THE 429 OF 2026-08-27, AS A TEST.
     *
     * This was a bare `Promise.all` over the guesses, and `MAX_BOOKS` is 20, so one
     * photograph of nineteen books opened nineteen simultaneous connections to
     * openlibrary.org from a single address. It came back HTTP 429; the rate-limited
     * address then stopped answering entirely, sixteen 6s timeouts in a row cleared the
     * breaker`s TOLERANCE of 3 six times over, and the catalogue was gone for the whole
     * two-minute COOLDOWN_MS. Every catch in that window returned `unverified` with no
     * cover art, which presented to the user as `covers are not loading`.
     *
     * A source guard would not have caught it: `Promise.all` is not wrong anywhere else
     * in this file. Only the CONCURRENCY is wrong, and only behaviour can see it.
     */
    let live = 0;
    let peak = 0;
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        live += 1;
        peak = Math.max(peak, live);
        await new Promise((r) => setTimeout(r, 5));
        live -= 1;
        return [];
      },
    };
    const nineteen = Array.from({ length: 19 }, (_, i) => ({
      title: `Book ${i}`,
      author: `Author ${i}`,
    }));
    const vision: VisionClient = {
      async guessBooks() {
        return nineteen;
      },
    };

    await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/stack.jpg'], links: [] },
      { vision, books },
    );

    expect(peak).toBeGreaterThan(0);

    // PIN THE CONSTANT, not only the behaviour against it. Asserting `peak <=
    // GROUND_AT_ONCE` alone is self-referential: raising the constant to 20 makes it
    // `19 <= 20` and the test goes green while the 429 comes straight back. Caught by
    // mutating the constant, which is the only way this kind of hole shows itself.
    expect(GROUND_AT_ONCE).toBeLessThanOrEqual(6);
    expect(peak).toBeLessThanOrEqual(GROUND_AT_ONCE);
  });

  it('still grounds every guess, not just the first few', async () => {
    // Bounding the pool must not quietly drop the tail. Nineteen guesses is nineteen
    // lookups, taken four at a time.
    let calls = 0;
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        calls += 1;
        return [];
      },
    };
    const vision: VisionClient = {
      async guessBooks() {
        return Array.from({ length: 19 }, (_, i) => ({ title: `B${i}`, author: `A${i}` }));
      },
    };

    await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/stack.jpg'], links: [] },
      { vision, books },
    );

    expect(calls).toBe(19);
  });

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
      async guessBooks() {
        return [{ title: 'Dune', author: 'Frank Herbert' }];
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
      async guessBooks() {
        return [];
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
      async guessBooks() {
        return [];
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
      async guessBooks() {
        visionCalled = true;
        return [];
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
      async guessBooks() {
        visionCalled = true;
        return [{ title: 'Dune', author: 'Frank Herbert' }];
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
      async guessBooks() {
        return [{ title: 'Ficciones', author: 'Borges' }];
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
      async guessBooks() {
        return [{ title: 'Ficciones', author: 'Borges' }];
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
      async guessBooks() {
        return [{ title: 'Dune', author: 'Frank Herbert' }];
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
      async guessBooks() {
        return [];
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
      async guessBooks() {
        return [];
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
      async guessBooks() {
        return [];
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
      async guessBooks() {
        return [{ title: 'Dune', author: 'Frank Herbert' }];
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
      async guessBooks() {
        return [{ title: 'Unfindable', author: 'Nobody' }];
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
      async guessBooks() {
        return [];
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: [], links: ['https://www.amazon.com/dp/0141439602'] },
      { vision, books },
    );

    expect(result.source).toBe('none');
    expect(result.candidates).toEqual([]);
  });
  // ------------------------------------------------- more than one book in one picture

  it('returns every book in the picture, not just the first', async () => {
    // A stack on a desk, a shelf behind someone's head. The model was asked for one book
    // and answered with one, so whichever it happened to name first became the catch and
    // the rest of the photo was silently discarded.
    const vision: VisionClient = {
      async guessBooks() {
        return [
          { title: 'Dune', author: 'Frank Herbert' },
          { title: 'Ubik', author: 'Philip K. Dick' },
        ];
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search({ title }) {
        return title === 'Dune'
          ? [{ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' }]
          : [{ title: 'Ubik', author: 'Philip K. Dick', isbn: '9780575079229' }];
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/stack.jpg'], links: [] },
      { vision, books },
    );

    expect(result.candidates.map((b) => b.title)).toEqual(['Dune', 'Ubik']);
    expect(result.source).toBe('vision');
  });

  it('files two readings of one book as one book', async () => {
    // The model reads a cover twice - once off the spine, once off the front - and both
    // ground to the same work. Offering it twice would put two identical rows on the card
    // and two identical entries a click away from the shelf.
    const vision: VisionClient = {
      async guessBooks() {
        return [
          { title: 'Dune', author: 'Frank Herbert' },
          { title: 'Dune', author: 'Herbert' },
        ];
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        return [{ title: 'Dune', author: 'Frank Herbert' }];
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/two.jpg'], links: [] },
      { vision, books },
    );

    expect(result.candidates).toHaveLength(1);
  });

  it('keeps the books the catalogue knew and drops the one it did not', async () => {
    // One unreadable spine in a stack must not cost the books either side of it.
    const vision: VisionClient = {
      async guessBooks() {
        return [
          { title: 'Dune', author: 'Frank Herbert' },
          { title: 'Blurry Nonsense', author: '' },
          { title: 'Ubik', author: 'Philip K. Dick' },
        ];
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search({ title }) {
        if (title === 'Dune') return [{ title: 'Dune', author: 'Frank Herbert' }];
        if (title === 'Ubik') return [{ title: 'Ubik', author: 'Philip K. Dick' }];
        return [];
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/three.jpg'], links: [] },
      { vision, books },
    );

    expect(result.candidates.map((b) => b.title)).toEqual(['Dune', 'Ubik']);
  });

  it('offers every unchecked reading when the catalogue is unreachable', async () => {
    const vision: VisionClient = {
      async guessBooks() {
        return [
          { title: 'Dune', author: 'Frank Herbert' },
          { title: 'Ubik', author: 'Philip K. Dick' },
        ];
      },
    };
    const books: BooksDb = {
      async lookupByIsbn() {
        throw new Error('OpenLibrary did not answer within 6s.');
      },
      async search() {
        throw new Error('OpenLibrary did not answer within 6s.');
      },
    };

    const result = await recognizeBook(
      { text: '', imageUrls: ['https://pbs.twimg.com/media/stack.jpg'], links: [] },
      { vision, books },
    );

    expect(result.candidates.map((b) => b.title)).toEqual(['Dune', 'Ubik']);
    expect(result.source).toBe('unverified');
  });
});
