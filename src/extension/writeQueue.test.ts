import { describe, it, expect } from 'vitest';
import { createWriteQueue } from './writeQueue';

describe('createWriteQueue', () => {
  it('runs jobs one at a time, in the order they were queued', async () => {
    const serialize = createWriteQueue();
    const events: string[] = [];

    const job = (name: string, delay: number) => async () => {
      events.push(`${name}:start`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      events.push(`${name}:end`);
    };

    // The slow job is queued first: without serialization "b" would start and finish
    // inside "a", which is exactly how the shelf lost a book.
    await Promise.all([serialize(job('a', 20)), serialize(job('b', 0))]);

    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('keeps running after a job throws, and still rejects that job', async () => {
    const serialize = createWriteQueue();

    await expect(
      serialize(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(serialize(async () => 'ok')).resolves.toBe('ok');
  });
});
