import { describe, it, expect } from 'vitest';
import {
  createRecognitionLog,
  summarize,
  mastheadLine,
  MAX_EVENTS,
  MIN_FOR_RATE,
  WRONG_WINDOW_MS,
  type PendingEvent,
  type RecognitionEvent,
} from './recognitionLog';
import type { StorageArea } from './storage';

function fakeStorage(): StorageArea {
  const store: Record<string, unknown> = {};
  return {
    async get(key) {
      return { [key]: store[key] };
    },
    async set(items) {
      Object.assign(store, items);
    },
  };
}

function makeLog() {
  let clock = 1_000_000;
  return createRecognitionLog({ storage: fakeStorage(), now: () => (clock += 1000) });
}

/**
 * TS-2, AT THE WIRING. `OPENWORK.md` item 53. Same gap as the shelf's: `storedLog.test.ts`
 * covers `readLog` in isolation, and a mutation restoring the bare cast in `read()` survived
 * because every test here seeds well-formed events.
 */
describe('the log survives what storage actually holds', () => {
  const seeded = (rows: unknown): StorageArea => {
    const store: Record<string, unknown> = { recognitionLog: rows };
    return {
      async get(key) {
        return { [key]: store[key] };
      },
      async set(items) {
        Object.assign(store, items);
      },
    };
  };

  const ok = {
    at: 1,
    ms: 1200,
    flow: 'button',
    source: 'vision',
    confidence: 'high',
    outcome: 'confirmed',
  };

  it('drops an event whose timing is NaN, which would poison every mean', async () => {
    const log = createRecognitionLog({ storage: seeded([ok, { ...ok, at: 2, ms: Number.NaN }]), now: () => 9 });
    expect((await log.list()).map((e) => e.at)).toEqual([1]);
  });

  it('drops an event whose outcome is invented, which would skew the denominator', async () => {
    const log = createRecognitionLog({ storage: seeded([{ ...ok, outcome: 'kept' }]), now: () => 9 });
    expect(await log.list()).toEqual([]);
  });
});

/** A log whose clock only moves when the test says so. */
function makeClockedLog() {
  let clock = 1_000_000;
  const log = createRecognitionLog({ storage: fakeStorage(), now: () => clock });
  return { log, advance: (ms: number) => (clock += ms) };
}

const attempt = (over: Partial<PendingEvent> = {}): PendingEvent => ({
  ms: 1200,
  flow: 'contextmenu',
  source: 'vision',
  confidence: 'high',
  guess: { title: 'Dune', author: 'Frank Herbert' },
  outcome: 'auto-saved',
  ...over,
});

describe('createRecognitionLog', () => {
  it('records an attempt with the time it landed', async () => {
    const log = makeLog();

    await log.record(attempt({ savedId: 'id-1' }));

    const events = await log.list();
    expect(events).toHaveLength(1);
    expect(events[0]?.outcome).toBe('auto-saved');
    expect(events[0]?.savedId).toBe('id-1');
    expect(events[0]?.ms).toBe(1200);
    expect(events[0]?.at).toBeGreaterThan(0);
  });

  it('records a miss, so the miss rate is visible rather than silently absent', async () => {
    const log = makeLog();

    await log.record(attempt({ outcome: 'no-match', source: 'none', confidence: 'low' }));

    expect((await log.list())[0]?.outcome).toBe('no-match');
  });

  it('keeps only the most recent 200 events', async () => {
    const log = makeLog();

    for (let i = 0; i < MAX_EVENTS + 5; i++) {
      await log.record(attempt({ guess: { title: `Book ${i}`, author: 'A' } }));
    }

    const events = await log.list();
    expect(events).toHaveLength(MAX_EVENTS);
    // The oldest five fell off the front, not the newest off the back.
    expect(events[0]?.guess?.title).toBe('Book 5');
    expect(events[MAX_EVENTS - 1]?.guess?.title).toBe(`Book ${MAX_EVENTS + 4}`);
  });

  it('does not drop an event when two are recorded at once', async () => {
    const log = makeLog();

    await Promise.all([
      log.record(attempt({ guess: { title: 'A', author: 'A' } })),
      log.record(attempt({ guess: { title: 'B', author: 'B' } })),
    ]);

    expect((await log.list()).map((e) => e.guess?.title).sort()).toEqual(['A', 'B']);
  });

  it('empties on clear', async () => {
    const log = makeLog();
    await log.record(attempt());

    await log.clear();

    expect(await log.list()).toEqual([]);
  });

  it('reads an empty log before anything has been written', async () => {
    expect(await makeLog().list()).toEqual([]);
  });

  it('marks a match wrong when its book is deleted soon after saving', async () => {
    const { log, advance } = makeClockedLog();
    await log.record(attempt({ savedId: 'id-1' }));

    advance(WRONG_WINDOW_MS - 1000);
    await log.markWrong('id-1');

    expect((await log.list())[0]?.wrong).toBe(true);
  });

  it('treats a later deletion as changing your mind, not a bad match', async () => {
    const { log, advance } = makeClockedLog();
    await log.record(attempt({ savedId: 'id-1' }));

    advance(WRONG_WINDOW_MS + 1000);
    await log.markWrong('id-1');

    expect((await log.list())[0]?.wrong).toBeUndefined();
  });

  it('ignores a deletion of a book that has no event', async () => {
    const { log } = makeClockedLog();
    await log.record(attempt({ savedId: 'id-1' }));

    await log.markWrong('id-does-not-exist');

    expect((await log.list())[0]?.wrong).toBeUndefined();
  });
});

describe('summarize', () => {
  const event = (over: Partial<RecognitionEvent>): RecognitionEvent => ({
    at: 1,
    ms: 1000,
    flow: 'contextmenu',
    source: 'vision',
    confidence: 'high',
    outcome: 'auto-saved',
    ...over,
  });

  it('counts only attempts that put a book on the shelf', () => {
    const { caught } = summarize([
      event({ outcome: 'auto-saved' }),
      event({ outcome: 'confirmed' }),
      event({ outcome: 'dismissed' }),
      event({ outcome: 'no-match' }),
    ]);

    expect(caught).toBe(2);
  });

  it('hides the rate until there are enough catches to mean anything', () => {
    const events = Array.from({ length: MIN_FOR_RATE - 1 }, () => event({}));

    expect(summarize(events).keptPct).toBeNull();
  });

  it('reports the share of catches that survived', () => {
    const events = [
      ...Array.from({ length: 8 }, () => event({})),
      ...Array.from({ length: 2 }, () => event({ wrong: true })),
    ];

    expect(summarize(events)).toEqual({ caught: 10, keptPct: 80 });
  });

  it('reports nothing at all for an empty log', () => {
    expect(summarize([])).toEqual({ caught: 0, keptPct: null });
  });
});

/**
 * THE MASTHEAD LINE, which lived inline in `popup.ts` and was therefore untestable.
 *
 * `popup.ts` does work at module scope, so no test can import it - see
 * `src/shared/entryPoints.test.ts`. The string it rendered was the one piece of copy in
 * this product that nobody could assert on, which is how it stayed a template literal
 * inside a render function while every number feeding it had tests.
 *
 * Extracted 2026-08-22 when Maximo dropped the kept rate from the masthead. Same move as
 * `handleSaveBook` in item 30: pull the decision out of the unimportable file and the
 * guard becomes possible.
 */
describe('the masthead line', () => {
  it('counts books, and says so', () => {
    expect(mastheadLine(28, 119)).toBe('28 books caught');
  });

  it('says book, singular, for one', () => {
    // A masthead reading "1 books caught" is the kind of thing nobody notices until it is
    // in a screenshot on a store listing.
    expect(mastheadLine(1, 4)).toBe('1 book caught');
  });

  it('no longer reports the kept rate', () => {
    // The whole point of the change. It read `28 caught | 93% kept` until 2026-08-22.
    expect(mastheadLine(28, 119)).not.toMatch(/kept|%/);
  });

  it('falls back to the shelf count for a shelf that predates the log', () => {
    // Deliberate and unchanged: those books were never CAUGHT as far as the log knows, so
    // claiming them would be a lie told by an off-by-one.
    expect(mastheadLine(0, 119)).toBe('119');
  });

  it('says nothing at all when there is nothing to say', () => {
    expect(mastheadLine(0, 0)).toBe('');
  });
});

/**
 * Undo, which `markWrong` had no answer for.
 *
 * Removing a book flags its attempt as a wrong match, because deleting a wrong match is
 * the only grading signal this log gets for free. Undo was added later, when removal moved
 * onto the tile and became one click, and it reversed the DELETION without reversing the
 * FLAG. `shelfEdit.ts` said so in a comment and called it a real todo.
 *
 * Two things are wrong after a remove-then-undo, and the second is the worse one:
 *
 *   the rate stays down    the attempt is still counted as a wrong match
 *   the link is broken     `library.add` issues a NEW id, so the event's savedId names a
 *                          book that is no longer on the shelf, and a later genuine
 *                          removal can never be flagged at all
 */
describe('a book that comes back', () => {
  const five = async (log: ReturnType<typeof makeLog>): Promise<void> => {
    // MIN_FOR_RATE catches, so a percentage exists to be wrong about.
    for (const savedId of ['a', 'b', 'c', 'd', 'e']) await log.record(attempt({ savedId }));
  };

  it('stops being counted as a wrong match', async () => {
    const log = makeLog();
    await five(log);
    expect(summarize(await log.list()).keptPct).toBe(100);

    await log.markWrong('a');
    expect(summarize(await log.list()).keptPct).toBe(80);

    // Undo. The book returns under a new id, which is what `library.add` hands back.
    await log.markRestored('a', 'a-again');
    expect(summarize(await log.list())).toEqual({ caught: 5, keptPct: 100 });
  });

  it('can be flagged again when it is removed for good', async () => {
    // The relink, and the reason `markRestored` takes two ids instead of one. Without it
    // the event still says 'a', `markWrong('a-again')` matches nothing, and the log has
    // quietly lost the ability to score this catch for the rest of its life in the buffer.
    const log = makeLog();
    await five(log);
    await log.markWrong('a');
    await log.markRestored('a', 'a-again');

    await log.markWrong('a-again');
    expect(summarize(await log.list()).keptPct).toBe(80);
  });

  it('leaves every other attempt alone', async () => {
    const log = makeLog();
    await five(log);
    await log.markWrong('a');
    await log.markWrong('b');

    await log.markRestored('a', 'a-again');

    const events = await log.list();
    expect(events.find((e) => e.savedId === 'b')?.wrong).toBe(true);
    expect(events.find((e) => e.savedId === 'a')).toBeUndefined();
    expect(summarize(events).keptPct).toBe(80);
  });

  it('does nothing at all when no event carries that id', async () => {
    // Symmetry with markWrong's "ignores a deletion of a book that has no event". Reached
    // for real once the 200-event ring buffer has evicted the original attempt: the book
    // is still on the shelf and still removable, but its recognition is long gone.
    const log = makeLog();
    await five(log);
    await log.markRestored('never-existed', 'whatever');

    expect(summarize(await log.list())).toEqual({ caught: 5, keptPct: 100 });
  });

  it('relinks EVERY attempt that produced the book, which is the intended reading', async () => {
    // Two events can legitimately share one savedId: `library.add` reuses the id when
    // `sameBook` matches, and the tray lets you save an already-shelved book into another
    // pile. So catching the same book twice writes two attempts against one shelf slot.
    //
    // A review split on whether the map should stop at one. It should not, and this test
    // exists so the behaviour is a DECISION rather than an accident of `.map`: a savedId
    // names a shelf slot, and if the book in it was wrong then every attempt that produced
    // that book was wrong. Restoring it makes every one of them right again. Flagging one
    // and not its twin would be the incoherent state.
    const log = makeLog();
    await log.record(attempt({ savedId: 'dup' }));
    await log.record(attempt({ savedId: 'dup' }));
    await log.markWrong('dup');
    expect((await log.list()).filter((e) => e.wrong)).toHaveLength(2);

    await log.markRestored('dup', 'dup-again');

    const events = await log.list();
    expect(events.every((e) => e.savedId === 'dup-again')).toBe(true);
    expect(events.some((e) => e.wrong)).toBe(false);
  });

  it('relinks even when the removal was too late to have flagged anything', async () => {
    // Past WRONG_WINDOW_MS a deletion says nothing about the recognizer, so `markWrong` is
    // a no-op. The id still changes on the way back in, so the relink is not conditional
    // on there having been a flag to clear.
    const { log, advance } = makeClockedLog();
    await log.record(attempt({ savedId: 'a' }));
    advance(WRONG_WINDOW_MS + 1);
    await log.markWrong('a');
    await log.markRestored('a', 'a-again');

    const events = await log.list();
    expect(events[0]?.savedId).toBe('a-again');
    expect(events[0]?.wrong).toBeUndefined();
  });
});
