import { describe, it, expect } from 'vitest';
import { createRecognitionLog, MAX_EVENTS, type PendingEvent } from './recognitionLog';
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
});
