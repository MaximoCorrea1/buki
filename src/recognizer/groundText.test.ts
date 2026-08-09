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

  it('a parenthesised edition on the correct record beats a bare wrong sequel', () => {
    // Verified bug: matchScore ties at 3 (both share dune+frank+herbert), and the OLD
    // stray count compared raw titles, so "(Deluxe Edition)"'s own words outweighed the
    // sequel's one stray word ("children") and picked wrong.
    const results = [
      { title: 'Dune (Deluxe Edition)', author: 'Frank Herbert' },
      { title: 'Children of Dune', author: 'Frank Herbert' },
    ];
    expect(rank(QUERY, results)[0]?.book.title).toBe('Dune (Deluxe Edition)');
  });

  it('a colon subtitle on the correct record beats a bare wrong sequel', () => {
    // Worse than the parenthetical case: unstripped, "Dune:" doesn't even tokenize as
    // "dune", so this record used to SCORE lower (2) than the sequel (3) and lose before
    // the tie-break ever ran.
    const results = [
      { title: 'Dune: Special Edition', author: 'Frank Herbert' },
      { title: 'Children of Dune', author: 'Frank Herbert' },
    ];
    expect(rank(QUERY, results)[0]?.book.title).toBe('Dune: Special Edition');
  });

  it('a subtitled correct record still beats the whole sequel fixture', () => {
    // Same RESULTS as the top of this block, with the correct record written the way
    // OpenLibrary actually writes it (see bookIdentity.test.ts's own 'Dune: Special
    // Edition' fixture) instead of the clean 'Dune' the earlier tests used.
    const withSubtitle = RESULTS.map((book) =>
      book.title === 'Dune' ? { ...book, title: 'Dune: Special Edition' } : book,
    );
    expect(rank(QUERY, withSubtitle)[0]?.book.title).toBe('Dune: Special Edition');
  });

  it('lets score outrank a longer title, however many stray words it carries', () => {
    // Score still leads over the tie-break. A record sharing all three query words beats
    // one sharing only "dune", no matter how much extra text the loser's title carries.
    const results = [
      { title: 'The Dune Encyclopedia', author: 'Willis E. McNelly' }, // shares "dune" only
      { title: 'Dune', author: 'Frank Herbert' }, // shares "dune", "frank", "herbert"
    ];
    expect(rank(QUERY, results)[0]?.book.author).toBe('Frank Herbert');
  });

  it('leaves noisy OCR grounding alone, but still prefers the plain title on a tie', () => {
    // groundText feeds raw OCR lines, where the query is longer than the title and every
    // result carries words the query never had. A single candidate can't tell a REORDER
    // from a FILTER, so this needs a second one that also matches: the tie-break must
    // still prefer the fewer stray words even when the query itself is the noisy side.
    const noisy = 'THE LEFT HAND OF DARKNESS URSULA K LE GUIN ACE SCIENCE FICTION';
    const results = [
      { title: 'The Left Hand of Darkness and Other Stories', author: 'Ursula K. Le Guin' },
      { title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin' },
    ];

    const ranked = rank(noisy, results);

    expect(ranked).toHaveLength(2); // reorder, not filter
    expect(ranked[0]?.book.title).toBe('The Left Hand of Darkness');
  });
});

describe('tokenizing does not destroy hyphenated words', () => {
  // Stripping punctuation everywhere splits a compound into pieces that are each too
  // short to be significant, so a cover reading only "X-MEN" grounded to nothing at all.
  // Punctuation at the EDGE of a token is noise; punctuation inside it is the word.
  it('grounds a title whose only word is a short hyphenated compound', () => {
    expect(rank('X-Men', [{ title: 'X-Men', author: 'Chris Claremont' }])).toHaveLength(1);
  });

  it('does not let half a hyphenated name match an unrelated book', () => {
    // Splitting "Jean-Paul" hands every book by any Paul a free point, and a score above
    // zero is the only thing standing between a stray word and a save.
    const hits = rank('Nausea Jean-Paul Sartre', [
      { title: 'Nausea', author: 'Jean-Paul Sartre' },
      { title: 'Unrelated Book', author: 'Paul Someone' },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.book.title).toBe('Nausea');
  });

  it('still ignores punctuation stuck to the outside of a word', () => {
    // The thing the strip was added for, which must keep working: a subtitled record
    // has to match on its main title.
    expect(rank('Dune Frank Herbert', [{ title: 'Dune: Special Edition', author: 'Frank Herbert' }]))
      .toHaveLength(1);
  });
});

describe('score outranks the tie-break', () => {
  // Nothing in the suite proved this. Swapping the comparator's two operands left every
  // test green, so the ordering that makes the whole thing safe was untested.
  it('prefers the better match even when it carries more stray words', () => {
    // A: shares dune, frank, herbert (3) and carries 2 stray words of its own.
    // B: shares only dune (1) and carries none.
    // Score must win. Stray-first would pick B.
    const hits = rank('Dune Frank Herbert', [
      { title: 'Dune Wormhole Chronicles', author: 'Frank Herbert' },
      { title: 'Dune', author: 'Someone Else' },
    ]);
    expect(hits[0]?.book.title).toBe('Dune Wormhole Chronicles');
  });
});
