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
