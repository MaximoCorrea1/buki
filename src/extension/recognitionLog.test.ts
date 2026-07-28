import { describe, it, expect } from 'vitest';
import {
  createRecognitionLog,
  summarize,
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
