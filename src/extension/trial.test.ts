import { describe, it, expect } from 'vitest';
import { createTrial } from './trial';
import type { StorageArea } from './storage';

function fakeStorage(seed: Record<string, unknown> = {}): StorageArea {
  const data: Record<string, unknown> = { ...seed };
  return {
    get: async (key) => (key in data ? { [key]: data[key] } : {}),
    set: async (items) => {
      Object.assign(data, items);
    },
  };
}

describe('createTrial', () => {
  it('starts at nothing spent', async () => {
    expect(await createTrial({ storage: fakeStorage() }).spent()).toBe(0);
  });

  it('counts one catch at a time', async () => {
    const trial = createTrial({ storage: fakeStorage() });
    expect(await trial.spend()).toBe(1);
    expect(await trial.spend()).toBe(2);
    expect(await trial.spent()).toBe(2);
  });

  it('survives a value that is not a number', async () => {
    // Storage is shared with everything else in the extension and is user-editable.
    // A corrupt count must not make every catch free, nor throw on read.
    const trial = createTrial({ storage: fakeStorage({ trialSpent: 'lots' }) });
    expect(await trial.spent()).toBe(0);
  });

  it('refuses a negative count, which would be free catches forever', async () => {
    const trial = createTrial({ storage: fakeStorage({ trialSpent: -50 }) });
    expect(await trial.spent()).toBe(0);
  });

  it('does not lose a catch when two land at once', async () => {
    // Two tabs can catch simultaneously. Read-modify-write on one key is exactly the race
    // that lost books before storage.ts grew a write queue.
    const trial = createTrial({ storage: fakeStorage() });
    await Promise.all([trial.spend(), trial.spend(), trial.spend()]);
    expect(await trial.spent()).toBe(3);
  });
});

describe('the attempt counter', () => {
  /**
   * THE ONE A MUTATION CAUGHT. Replacing `attempts: () => read(ATTEMPTS_KEY)` with
   * `attempts: async () => 0` left the whole suite green: attempts were written on every
   * catch and read back as zero for ever, so the ceiling could never be reached and the ×
   * loop was still unbounded.
   *
   * **That is character-for-character the failure `OPENWORK.md` item 27 records twice.**
   * `writePro` stored the activation id and `readPro` rebuilt a subset without it, so the
   * value was written on every exchange and dropped on every read, and a subscriber went on
   * burning one of five permanent slots a day with 550 tests green. A counter that is
   * written and never read back is not a counter.
   *
   * So this round-trips through storage rather than asserting either half alone.
   */

  it('reads back what it wrote, which is the whole job', async () => {
    const trial = createTrial({ storage: fakeStorage() });
    await trial.attempt();
    await trial.attempt();
    expect(await trial.attempts()).toBe(2);
  });

  it('lands in its OWN key, not on top of the advertised count', async () => {
    // Two counters, two meanings. Sharing a key would make a called-off catch cost one of
    // the ten, which is the promise `trial.ts` exists to keep.
    const store = fakeStorage();
    const trial = createTrial({ storage: store });
    await trial.attempt();
    await trial.attempt();
    await trial.attempt();
    await trial.spend();

    expect(await trial.attempts()).toBe(3);
    expect(await trial.spent(), 'an attempt was charged as a reading').toBe(1);
  });

  it('survives a corrupt or negative value the same way the other one does', async () => {
    for (const raw of ['lots', -50, NaN, null]) {
      const trial = createTrial({ storage: fakeStorage({ trialAttempts: raw }) });
      expect(await trial.attempts(), `${String(raw)}`).toBe(0);
    }
  });

  it('does not lose an attempt when two catches land at once', async () => {
    const trial = createTrial({ storage: fakeStorage() });
    await Promise.all([trial.attempt(), trial.attempt(), trial.attempt()]);
    expect(await trial.attempts()).toBe(3);
  });

  it('keeps the two counters out of each other\'s queue', async () => {
    // One `createWriteQueue` serialises both, which is correct - they are two keys in one
    // storage area and a catch touches both - but it must not make one overwrite the other.
    const trial = createTrial({ storage: fakeStorage() });
    await Promise.all([trial.spend(), trial.attempt(), trial.spend(), trial.attempt()]);
    expect(await trial.spent()).toBe(2);
    expect(await trial.attempts()).toBe(2);
  });
});
