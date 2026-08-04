import { describe, it, expect } from 'vitest';
import { createCatchTray } from './catchTray';

const DUNE = { title: 'Dune', author: 'Frank Herbert' };
const UBIK = { title: 'Ubik', author: 'Philip K. Dick' };

const states = (t: { list(): { state: string }[] }): string[] => t.list().map((c) => c.state);

describe('catchTray', () => {
  it('shows a card the moment a catch starts', () => {
    const tray = createCatchTray();

    tray.open('job1', 'Reading the cover…');

    expect(states(tray)).toEqual(['looking']);
  });

  it('gives two catches at once a card each', () => {
    const tray = createCatchTray();

    tray.open('job1', 'Reading the cover…');
    tray.open('job2', 'Reading the cover…');

    expect(tray.list()).toHaveLength(2);
  });

  it('turns a catch into its result in place, keeping its position', () => {
    // The old design removed the progress toast and appended a separate confirmation, so
    // the result arrived at the bottom of the stack while the pills still working sat
    // above it. A card is one object for the whole life of a catch.
    const tray = createCatchTray();
    tray.open('a', 'Reading…');
    tray.open('b', 'Reading…');
    tray.open('c', 'Reading…');
    const idBefore = tray.list()[0]!.id;

    tray.resolve('a', [{ book: DUNE, shelved: false }]);

    expect(states(tray)).toEqual(['found', 'looking', 'looking']);
    expect(tray.list()[0]!.id).toBe(idBefore);
  });

  it('holds every candidate so the choice is on the card', () => {
    const tray = createCatchTray();
    tray.open('a', 'Reading…');

    tray.resolve('a', [
      { book: DUNE, shelved: false },
      { book: UBIK, shelved: false },
    ]);

    expect(tray.list()[0]!.candidates.map((c) => c.book.title)).toEqual(['Dune', 'Ubik']);
  });

  it('marks a candidate that is already on the shelf', () => {
    const tray = createCatchTray();
    tray.open('a', 'Reading…');

    tray.resolve('a', [{ book: DUNE, shelved: true }]);

    expect(tray.list()[0]!.candidates[0]!.shelved).toBe(true);
  });

  it('says so rather than vanishing when the cover held no book', () => {
    const tray = createCatchTray();
    tray.open('a', 'Reading…');

    tray.resolve('a', []);

    expect(states(tray)).toEqual(['empty']);
  });

  it('never puts a found card on a timer', () => {
    // The whole complaint about auto-save: a book appeared for a second and was gone.
    // A card holding a decision waits as long as the decision takes.
    const tray = createCatchTray();
    tray.open('a', 'Reading…');

    tray.resolve('a', [{ book: DUNE, shelved: false }]);

    expect(tray.list()[0]!.transient).toBe(false);
  });

  it('lets an error leave on its own', () => {
    const tray = createCatchTray();
    tray.open('a', 'Reading…');

    tray.fail('a', 'Book lookup failed.');

    expect(states(tray)).toEqual(['error']);
    expect(tray.list()[0]!.transient).toBe(true);
  });

  it('lets a confirmation leave on its own once the choice is made', () => {
    const tray = createCatchTray();
    tray.open('a', 'Reading…');
    tray.resolve('a', [{ book: DUNE, shelved: false }]);

    tray.done('a', 'Saved: Dune → Now');

    expect(tray.list()[0]!.transient).toBe(true);
    expect(tray.list()[0]!.text).toBe('Saved: Dune → Now');
  });

  it('dismisses one card and leaves the others alone', () => {
    const tray = createCatchTray();
    tray.open('a', 'Reading A…');
    tray.open('b', 'Reading B…');
    const [first] = tray.list();

    tray.dismiss(first!.id);

    expect(tray.list()).toHaveLength(1);
    expect(tray.list()[0]!.job).toBe('b');
  });

  it('ignores an answer for a catch that is no longer on screen', () => {
    // Dismiss a card, then its lookup finishes. Resurrecting it would put a decision back
    // in front of someone who already said they were done with it.
    const tray = createCatchTray();
    tray.open('a', 'Reading…');
    const [card] = tray.list();
    tray.dismiss(card!.id);

    tray.resolve('a', [{ book: DUNE, shelved: false }]);

    expect(tray.list()).toEqual([]);
  });

  it('keeps the job on the card so it can be called off', () => {
    const tray = createCatchTray();

    tray.open('job7', 'Reading…');

    expect(tray.list()[0]!.job).toBe('job7');
  });
});
