import { describe, it, expect } from 'vitest';
import { CLOTH, clothFor } from './cloth';

describe('clothFor', () => {
  it('gives the same book the same cloth every time', () => {
    const book = { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' };
    expect(clothFor(book)).toBe(clothFor(book));
  });

  it('keys on the ISBN when there is one, so a retitled edition keeps its colour', () => {
    const isbn = '9780441013593';
    expect(clothFor({ title: 'Dune', author: 'Frank Herbert', isbn })).toBe(
      clothFor({ title: 'Dune (50th Anniversary)', author: 'F. Herbert', isbn }),
    );
  });

  it('does not put every book on one colour', () => {
    // Deliberately weak, because that is all the evidence supports. A previous comment
    // claimed djb2 was chosen because the naive *31 variant "bunched real titles onto
    // the same two colours" - on this sample the opposite is true (*31 uses five, djb2
    // three), so that justification was never measured. What actually mattered was
    // having ONE hash: the two files each had their own, so a book was one colour in
    // the picker and another on the shelf.
    const titles = [
      'Dune',
      'Signals and Systems',
      'Clean Code',
      'The Wings of the Dove',
      'Economics in One Lesson',
      'Structure and Interpretation of Computer Programs',
      'Fun Home',
      'Labyrinths',
    ];
    const used = new Set(titles.map((title) => clothFor({ title, author: '' })));
    expect(used.size).toBeGreaterThan(1);
  });

  it('only ever returns a colour from the palette', () => {
    expect(CLOTH).toContain(clothFor({ title: '', author: '' }));
  });
});
