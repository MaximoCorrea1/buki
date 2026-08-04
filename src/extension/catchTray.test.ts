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

    tray.resolve('a', [{ book: DUNE }]);

    expect(states(tray)).toEqual(['found', 'looking', 'looking']);
    expect(tray.list()[0]!.id).toBe(idBefore);
  });

  it('holds every candidate so the choice is on the card', () => {
    const tray = createCatchTray();
    tray.open('a', 'Reading…');

    tray.resolve('a', [{ book: DUNE }, { book: UBIK }]);

    expect(tray.list()[0]!.candidates.map((c) => c.book.title)).toEqual(['Dune', 'Ubik']);
  });

  it('says which pile a book is already in', () => {
    // "IT SAVED A BOOK I ALREADY SAVED." Knowing it is on the shelf is half the answer;
    // knowing it is under Next is what lets you decide whether to move it.
    const tray = createCatchTray();
    tray.open('a', 'Reading…');

    tray.resolve('a', [{ book: DUNE, shelvedIn: 'next' }]);

    expect(tray.list()[0]!.candidates[0]!.shelvedIn).toBe('next');
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

    tray.resolve('a', [{ book: DUNE }]);

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
    tray.resolve('a', [{ book: DUNE }]);

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

    tray.resolve('a', [{ book: DUNE }]);

    expect(tray.list()).toEqual([]);
  });

  it('keeps the job on the card so it can be called off', () => {
    const tray = createCatchTray();

    tray.open('job7', 'Reading…');

    expect(tray.list()[0]!.job).toBe('job7');
  });

  // ------------------------------------------------------------ one catch per post

  it('gives one card to a post pressed ten times, not ten cards', () => {
    // The reported behaviour: clicking the same image repeatedly stacked a lookup and a
    // toast per click. A catch is identified by the post it is about, so a second press
    // on a post already being read is the same catch, not a new one.
    const tray = createCatchTray();

    for (let i = 0; i < 10; i++) tray.open('post:dune', 'Reading the cover…');

    expect(tray.list()).toHaveLength(1);
  });

  it('says whether it actually opened a card, so a repeat press can nudge the first', () => {
    const tray = createCatchTray();

    expect(tray.open('post:dune', 'Reading…')).toBe(true);
    expect(tray.open('post:dune', 'Reading…')).toBe(false);
  });

  it('does not let a repeat press wipe a result that already arrived', () => {
    const tray = createCatchTray();
    tray.open('post:dune', 'Reading…');
    tray.resolve('post:dune', [{ book: DUNE }]);

    tray.open('post:dune', 'Reading…');

    expect(states(tray)).toEqual(['found']);
  });

  it('lets a dismissed post be caught again', () => {
    // Dismissing is "I am done with this one", not "never again". The next press starts
    // a fresh card - the memo upstream is what stops it paying for the lookup twice.
    const tray = createCatchTray();
    tray.open('post:dune', 'Reading…');
    tray.dismiss(tray.list()[0]!.id);

    expect(tray.open('post:dune', 'Reading…')).toBe(true);
    expect(states(tray)).toEqual(['looking']);
  });

  // ------------------------------------------------------------ what the card can say

  it('remembers the picture it is reading', () => {
    // A column of three identical "Reading the cover..." cards tells you nothing about
    // which catch is which. The photo does.
    const tray = createCatchTray();

    tray.open('a', 'Reading…', 'https://pbs.twimg.com/media/abc.jpg');

    expect(tray.list()[0]!.image).toBe('https://pbs.twimg.com/media/abc.jpg');
  });

  it('records what the answer was built from', () => {
    // "THE IMAGE! NOT THE TEXT." The card has to be able to prove which one it used,
    // or the fix is invisible and has to be taken on trust.
    const tray = createCatchTray();
    tray.open('a', 'Reading…');

    tray.resolve('a', [{ book: DUNE }], 'vision');

    expect(tray.list()[0]!.source).toBe('vision');
  });

  // ------------------------------------------------------------ not this book

  it('offers the first candidate until told otherwise', () => {
    const tray = createCatchTray();
    tray.open('a', 'Reading…');

    tray.resolve('a', [{ book: DUNE }, { book: UBIK }]);

    expect(tray.list()[0]!.showing).toBe(0);
  });

  it('promotes an alternate when the top guess is wrong', () => {
    const tray = createCatchTray();
    tray.open('a', 'Reading…');
    tray.resolve('a', [{ book: DUNE }, { book: UBIK }]);

    tray.show(tray.list()[0]!.id, 1);

    expect(tray.list()[0]!.showing).toBe(1);
  });

  it('refuses a candidate that is not there', () => {
    const tray = createCatchTray();
    tray.open('a', 'Reading…');
    tray.resolve('a', [{ book: DUNE }]);

    tray.show(tray.list()[0]!.id, 4);

    expect(tray.list()[0]!.showing).toBe(0);
  });

  it('starts a re-lookup back at the top candidate', () => {
    // "Try the post's words" resolves the same card a second time. Leaving `showing` at 1
    // would point at a book from the previous answer, which is a different book entirely.
    const tray = createCatchTray();
    tray.open('a', 'Reading…');
    tray.resolve('a', [{ book: DUNE }, { book: UBIK }]);
    tray.show(tray.list()[0]!.id, 1);

    tray.resolve('a', [{ book: UBIK }]);

    expect(tray.list()[0]!.showing).toBe(0);
  });

  // ------------------------------------------------------------ asking a second way

  it('puts a card back to work when it is asked a different question', () => {
    // "No book on that cover" is a dead end unless the card offers a way on. Trying the
    // post's WORDS is the same catch being asked differently, so it belongs on the card
    // that came back empty - not on a second card stacked underneath it.
    const tray = createCatchTray();
    tray.open('a', 'Reading…');
    tray.resolve('a', []);

    tray.retry('a', "Reading the post's words…");

    expect(states(tray)).toEqual(['looking']);
    expect(tray.list()[0]!.text).toBe("Reading the post's words…");
  });

  it('clears the old answer when it starts asking again', () => {
    // Leaving the previous candidates on a looking card would offer books from an answer
    // that is being replaced.
    const tray = createCatchTray();
    tray.open('a', 'Reading…');
    tray.resolve('a', [{ book: DUNE }], 'vision');

    tray.retry('a', 'Reading…');

    expect(tray.list()[0]!.candidates).toEqual([]);
    expect(tray.list()[0]!.transient).toBe(false);
  });

  // ------------------------------------------------------------ messages with no catch

  it('carries a message that belongs to no catch', () => {
    // "Buki just updated - refresh this page." Nothing to decide, nobody to belong to,
    // but it still has to appear somewhere, and the tray is the only somewhere left.
    const tray = createCatchTray();
    tray.open('a', 'Reading…');

    tray.say('Buki just updated — refresh this page.');

    expect(tray.list()).toHaveLength(2);
    expect(tray.list()[1]!.job).toBe('');
    expect(tray.list()[1]!.transient).toBe(true);
  });

  it('does not let a message be mistaken for a catch', () => {
    // Standalone messages all carry job '', and every update finds its card BY job - so
    // an answer arriving for the empty job would rewrite the oldest message on screen
    // instead of a catch. There is no catch called '', so nothing should match one.
    const tray = createCatchTray();
    tray.say('One.');
    tray.say('Two.');

    tray.resolve('', [{ book: DUNE }]);

    expect(tray.list().map((c) => c.text)).toEqual(['One.', 'Two.']);
    expect(states(tray)).toEqual(['error', 'error']);
  });
});
