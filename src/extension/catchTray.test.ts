import { describe, it, expect } from 'vitest';
import { createCatchTray, stalledJobs, STALL_MS } from './catchTray';
import { DOWNLOAD_TIMEOUT_MS } from './inlineImage';
import { EXCHANGE_TIMEOUT_MS } from './license';
import { TIMEOUT_MS as VISION_MS, ATTEMPTS as VISION_TRIES } from '../recognizer/llmVision';
import { TIMEOUT_MS as CATALOGUE_MS } from '../recognizer/openLibrary';

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

    tray.say('Buki just updated. Refresh this page.');

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

/**
 * THE WALL: a sixth state of the card that was about to read this cover, not a new
 * surface. It is decided here and drawn by `content.ts`, so the rule that an offer never
 * removes itself is testable without a DOM.
 */
describe('the wall', () => {
  it('replaces the looking card in place, keeping its id and its picture', () => {
    const tray = createCatchTray();
    tray.open('post-1', 'Reading the cover…', 'https://pbs.twimg.com/a.jpg');
    const before = tray.list()[0];
    tray.wall('post-1');
    const after = tray.list()[0];
    expect(after?.state).toBe('wall');
    expect(after?.id).toBe(before?.id);
    expect(after?.image).toBe('https://pbs.twimg.com/a.jpg');
    expect(tray.list()).toHaveLength(1);
  });

  it('is never transient, because it carries a decision', () => {
    // An offer that removes itself after four seconds is an offer nobody read. Every
    // other self-dismissing state in this tray carries no decision.
    const tray = createCatchTray();
    tray.open('post-1', 'Reading the cover…');
    tray.wall('post-1');
    expect(tray.list()[0]?.transient).toBe(false);
  });

  it('offers no candidates, so the renderer cannot draw save buttons on it', () => {
    const tray = createCatchTray();
    tray.open('post-1', 'Reading the cover…');
    tray.wall('post-1');
    expect(tray.list()[0]?.candidates).toEqual([]);
  });

  it('does nothing for a catch that was already dismissed', () => {
    // The user can dismiss while the lookup runs. Putting a paywall back on screen after
    // somebody closed the catch is the exact behaviour that gets an extension removed.
    const tray = createCatchTray();
    tray.open('post-1', 'Reading the cover…');
    tray.dismiss(tray.list()[0]!.id);
    tray.wall('post-1');
    expect(tray.list()).toHaveLength(0);
  });
});

/**
 * HOW MANY PICTURES THE CATCH COVERED. `OPENWORK.md` item 47, C-9.
 *
 * The card SHOWS one picture — `content.ts` opens it with `tweet.imageUrls[0]` — and that
 * is not the same number as how many the catch was about. `shotFor` needs the real one,
 * because storing photograph one as a book's cover is only honest when photograph one was
 * the only photograph.
 *
 * Written after two mutations SURVIVED: the field was added to `Card` and threaded through
 * `content.ts`, and nothing at this level asserted either the default or that it survives a
 * state change. A field a test never reads is a field the compiler protects and nothing
 * else does.
 */
describe('the picture count a card carries', () => {
  it('records the count it was given', () => {
    const tray = createCatchTray();
    tray.open('j', 'Reading the cover…', 'https://p.test/1.jpg', 4);
    expect(tray.list()[0]?.pictures).toBe(4);
  });

  it('defaults to ONE when a picture was given and no count was', () => {
    // The context-menu flow's guarantee, encoded: `background.ts` builds its Tweet as
    // `imageUrls: [info.srcUrl]`, so exactly one picture reached the model.
    const tray = createCatchTray();
    tray.open('j', 'Reading the cover…', 'https://p.test/1.jpg');
    expect(tray.list()[0]?.pictures).toBe(1);
  });

  it('defaults to NONE when there was no picture at all', () => {
    // Not one. A catch with no picture must not let `shotFor` store anything, and
    // defaulting to 1 here would make the guard depend on `image` being undefined
    // somewhere else instead of on the count.
    const tray = createCatchTray();
    tray.open('j', 'Looking…');
    expect(tray.list()[0]?.pictures).toBe(0);
  });

  it('a standalone message covers no picture', () => {
    const tray = createCatchTray();
    tray.say('Something worth saying');
    expect(tray.list()[0]?.pictures).toBe(0);
  });

  it('SURVIVES every state change, because it is a fact about the post', () => {
    // The count is fixed when the card opens. No later transition can learn a different
    // answer, and one that quietly reset it to 1 would put photograph one back on a book
    // from a four-photo post — the original bug, arriving one state later.
    const tray = createCatchTray();
    tray.open('j', 'Reading the cover…', 'https://p.test/1.jpg', 4);

    tray.resolve('j', [{ book: { title: 'Dune', author: 'Frank Herbert' } }], 'vision');
    expect(tray.list()[0]?.pictures, 'lost on resolve').toBe(4);

    tray.retry('j', 'Trying the words');
    expect(tray.list()[0]?.pictures, 'lost on retry').toBe(4);

    tray.wall('j');
    expect(tray.list()[0]?.pictures, 'lost on wall').toBe(4);

    tray.fail('j', "Couldn't read that");
    expect(tray.list()[0]?.pictures, 'lost on fail').toBe(4);

    tray.done('j', 'Saved');
    expect(tray.list()[0]?.pictures, 'lost on done').toBe(4);
  });
});

/**
 * R-3. `OPENWORK.md` item 49. A card that never finishes.
 *
 * The worker answers a catch, and an MV3 worker is torn down aggressively. If it dies
 * mid-catch nothing ever arrives — and on the context-menu flow the card is injected into a
 * page Buki does not own, so "Reading the cover…" stayed for the life of the tab,
 * dismissible only by hand. Nothing timed it out and nothing noticed.
 */
describe('a catch that stops answering', () => {
  const T0 = Date.UTC(2026, 7, 17, 12, 0, 0);
  const at = (ms: number) => createCatchTray(() => T0 + ms);

  it('records when the catch started', () => {
    const tray = at(0);
    tray.open('j', 'Reading the cover…', 'https://p.test/1.jpg');
    expect(tray.list()[0]?.openedAt).toBe(T0);
  });

  it('finds a looking card that has run past the ceiling', () => {
    const tray = at(0);
    tray.open('j', 'Reading the cover…');
    expect(stalledJobs(tray.list(), T0 + STALL_MS)).toEqual(['j']);
  });

  it('leaves a catch that is merely slow alone', () => {
    // Firing early replaces a slow answer with a wrong error, which is worse than the bug.
    const tray = at(0);
    tray.open('j', 'Reading the cover…');
    expect(stalledJobs(tray.list(), T0 + STALL_MS - 1)).toEqual([]);
  });

  it('ignores every state that is not still looking', () => {
    // An answer is an answer however old the card is, and the other states already leave
    // on their own under `transient`. Only `looking` can be stuck.
    const tray = at(0);
    tray.open('a', 'Reading the cover…');
    tray.open('b', 'Reading the cover…');
    tray.open('c', 'Reading the cover…');
    tray.resolve('a', [{ book: { title: 'Dune', author: 'Frank Herbert' } }], 'vision');
    tray.fail('b', 'no');
    expect(stalledJobs(tray.list(), T0 + STALL_MS * 10)).toEqual(['c']);
  });

  it('keeps openedAt across a state change, so age is measured from the START', () => {
    // Measuring from the last transition would restart the clock on a retry and the
    // watchdog would never fire on the catch that needs it most.
    //
    // AN ADVANCING CLOCK, and that is the whole test. The first version used the fixed one
    // above, so `openedAt: now()` on every transition was INVISIBLE to it — the mutation
    // survived because a clock that never moves cannot detect a clock being re-read.
    let clock = T0;
    const tray = createCatchTray(() => clock);
    tray.open('j', 'Reading the cover…');
    clock = T0 + 30_000;
    tray.retry('j', 'Trying the words');
    expect(tray.list()[0]?.openedAt, 'the retry restarted the catch clock').toBe(T0);
  });

  it('still counts a retried catch as stalled once the ORIGINAL start is old enough', () => {
    // The consequence, at the boundary that matters. A catch that retries at 60s and then
    // dies must still be reachable by the watchdog at 90s from when it began.
    let clock = T0;
    const tray = createCatchTray(() => clock);
    tray.open('j', 'Reading the cover…');
    clock = T0 + 60_000;
    tray.retry('j', 'Trying the words');
    expect(stalledJobs(tray.list(), T0 + STALL_MS)).toEqual(['j']);
  });

  it('clears the ceiling the pipeline can legitimately need', () => {
    // THE NUMBER, DERIVED. Computed from the real constants rather than from the comment
    // beside it, so raising any stage's own ceiling without raising this one goes red —
    // and a watchdog that fires inside the budget turns slow catches into false errors.
    const budget = DOWNLOAD_TIMEOUT_MS + VISION_MS * VISION_TRIES + CATALOGUE_MS + EXCHANGE_TIMEOUT_MS;
    expect(STALL_MS).toBeGreaterThan(budget);
    // Pinned against a literal too. The check above also passes at a week, which would
    // leave the card exactly as stuck as it was.
    expect(STALL_MS).toBe(90_000);
  });
});
