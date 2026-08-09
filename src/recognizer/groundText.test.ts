import { describe, it, expect } from 'vitest';
import { groundText, rank, MAX_QUERIES } from './groundText';
import type { BooksDb } from './types';

/** A BooksDb that only resolves the exact titles given, recording every query tried. */
function fakeBooks(known: Record<string, { title: string; author: string }[]>) {
  const queriesTried: string[] = [];
  const books: BooksDb = {
    async lookupByIsbn() {
      return null;
    },
    async search({ title }) {
      queriesTried.push(title);
      return known[title] ?? [];
    },
  };
  return { books, queriesTried };
}

describe('groundText', () => {
  it('skips a garbage line that resolves to nothing and grounds a later real one', async () => {
    const { books, queriesTried } = fakeBooks({
      'Structure and Interpretation of Computer Programs': [
        {
          title: 'Structure and Interpretation of Computer Programs',
          author: 'Abelson, Sussman',
        },
      ],
    });
    const text = 'Second Eton Tm iT\nStructure and Interpretation of Computer Programs';

    const result = await groundText(text, books);

    expect(result[0]?.book.author).toBe('Abelson, Sussman');
    expect(queriesTried[0]).toBe('Second Eton Tm iT'); // proves the miss was tried first
  });

  it('returns nothing when no line grounds', async () => {
    const { books } = fakeBooks({});
    expect(await groundText('qqqq\nwwww\neeee', books)).toEqual([]);
  });

  it('rejects a match that shares no words with the query (fuzzy false positive)', async () => {
    const { books } = fakeBooks({
      HOME: [{ title: 'The Wings of the Dove', author: 'Henry James' }],
    });
    expect(await groundText('HOME', books)).toEqual([]);
  });

  it('caps how many queries a dense-text image can fire', async () => {
    const { books, queriesTried } = fakeBooks({});
    const dense = Array.from({ length: 60 }, (_, i) => `line number ${i} of noise`).join('\n');

    await groundText(dense, books);

    expect(queriesTried.length).toBeLessThanOrEqual(MAX_QUERIES);
  });

  it('sends one query for a single-line cover (dedups the whole-text fallback)', async () => {
    const { books, queriesTried } = fakeBooks({});
    await groundText('Clean Code', books);
    expect(queriesTried).toEqual(['Clean Code']);
  });

  it('finds a book named on one line of a tweet that lists several', async () => {
    // Real dogfood case: this tweet returned 0 candidates because the whole blob was
    // searched as a single query.
    const { books } = fakeBooks({
      '1 Economics in One Lesson': [
        { title: 'Economics in One Lesson', author: 'Henry Hazlitt' },
      ],
    });
    const tweet =
      '10 books that could replace an economics degree:\n\n1) Economics in One Lesson\n2) Basic Economics';

    const result = await groundText(tweet, books);

    expect(result[0]?.book.title).toBe('Economics in One Lesson');
  });

  it('fires its queries together, not one after another', async () => {
    // Serially this cost up to MAX_QUERIES round trips against a 6s end-to-end budget.
    // Asserting elapsed time beats asserting call order: a regression to `await` inside
    // the loop keeps the order identical and only shows up as latency.
    const DELAY = 40;
    const books: BooksDb = {
      async lookupByIsbn() {
        return null;
      },
      async search() {
        await new Promise((resolve) => setTimeout(resolve, DELAY));
        return [];
      },
    };
    const text = ['alpha line', 'beta line', 'gamma line', 'delta line'].join('\n');

    const started = Date.now();
    await groundText(text, books);
    const elapsed = Date.now() - started;

    // Five queries (four lines plus the whole-text join). Serial would be ~200ms.
    expect(elapsed).toBeLessThan(DELAY * 3);
  });

  it('ranks the closest match first rather than trusting the API order', async () => {
    // The right-click flow auto-saves candidates[0], so ordering decides correctness.
    const { books } = fakeBooks({
      'Signals and Systems': [
        { title: 'Systems Engineering', author: 'Someone Else' },
        { title: 'Signals and Systems', author: 'Alan V. Oppenheim' },
      ],
    });

    const result = await groundText('Signals and Systems', books);

    expect(result[0]?.book.title).toBe('Signals and Systems');
    expect(result[0]?.book.author).toBe('Alan V. Oppenheim');
  });

  it('reports how many words each match shares with the query', async () => {
    // The score is the evidence confidence is derived from, so it has to survive the
    // trip out of here rather than being computed and dropped.
    const { books } = fakeBooks({
      'Signals and Systems': [
        { title: 'Signals and Systems', author: 'Alan V. Oppenheim' },
        { title: 'Systems Engineering', author: 'Someone Else' },
      ],
    });

    const result = await groundText('Signals and Systems', books);

    expect(result[0]?.book.title).toBe('Signals and Systems');
    expect(result[0]?.score).toBe(2); // "signals" + "systems"
    expect(result[1]?.score).toBe(1); // "systems" only
  });
});

describe('rank', () => {
  it('drops results that share no real word with the query', () => {
    const ranked = rank('Signals and Systems', [
      { title: 'The Wings of the Dove', author: 'Henry James' },
    ]);

    expect(ranked).toEqual([]);
  });

  it('orders by how much of the query each result accounts for', () => {
    const ranked = rank('Dune Frank Herbert', [
      { title: 'Dune Messiah', author: 'Nobody' },
      { title: 'Dune', author: 'Frank Herbert' },
    ]);

    expect(ranked.map((r) => r.book.title)).toEqual(['Dune', 'Dune Messiah']);
    expect(ranked[0]?.score).toBe(3);
  });
});

describe('rank tie-breaking', () => {
  // The real top of OpenLibrary's answer for this query on 2026-08-06, in its order.
  // Every one of these is by Frank Herbert and contains the word Dune, so matchScore
  // gives all four the same 3 and the catalogue's own ordering decides. It chose wrong.
  const QUERY = 'Dune Frank Herbert';
  const RESULTS = [
    { title: 'Children of Dune', author: 'Frank Herbert' },
    { title: 'God Emperor of Dune', author: 'Frank Herbert' },
    { title: 'Heretics of Dune', author: 'Frank Herbert' },
    { title: 'Dune', author: 'Frank Herbert' },
  ];

  it('puts the book that was asked for first, not its sequel', () => {
    expect(rank(QUERY, RESULTS)[0]?.book.title).toBe('Dune');
  });

  it('still keeps the sequels, because they did match', () => {
    // The tie-break REORDERS. It must not filter: the caller shows alternatives.
    expect(rank(QUERY, RESULTS)).toHaveLength(4);
  });

  it('does not let a longer title win by sharing one more word', () => {
    // Score still leads. A book sharing two query words beats one sharing one, however
    // many extra words of its own the loser carries.
    const results = [
      { title: 'Dune', author: 'Someone Else' },
      { title: 'Dune', author: 'Frank Herbert' },
    ];
    expect(rank(QUERY, results)[0]?.book.author).toBe('Frank Herbert');
  });

  it('leaves noisy OCR grounding alone', () => {
    // groundText feeds raw OCR lines, where the query is longer than the title and every
    // result carries words the query never had. The tie-break must not throw those away.
    const noisy = 'THE LEFT HAND OF DARKNESS URSULA K LE GUIN ACE SCIENCE FICTION';
    const results = [{ title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin' }];
    expect(rank(noisy, results)).toHaveLength(1);
  });
});
