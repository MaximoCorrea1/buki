import { describe, it, expect } from 'vitest';
import { withSignal } from './cancellable';
import type { FetchLike } from '../recognizer/types';

/** Records the init each call received, and answers like a minimal Response. */
function spy() {
  const seen: { signal?: AbortSignal; method?: string; body?: string }[] = [];
  const base: FetchLike = async (_url, init) => {
    seen.push({
      ...(init?.signal ? { signal: init.signal } : {}),
      ...(init?.method ? { method: init.method } : {}),
      ...(init?.body ? { body: init.body } : {}),
    });
    return { ok: true, status: 200, json: async () => ({}) };
  };
  return { base, seen };
}

describe('withSignal', () => {
  it('gives the job signal to a client that sends none of its own', async () => {
    const job = new AbortController();
    const { base, seen } = spy();

    await withSignal(base, job.signal)('https://example.test');

    expect(seen[0]?.signal).toBeDefined();
    expect(seen[0]?.signal?.aborted).toBe(false);
  });

  it('aborts an in-flight request when the job is cancelled', async () => {
    const job = new AbortController();
    const { base, seen } = spy();

    await withSignal(base, job.signal)('https://example.test');
    job.abort();

    expect(seen[0]?.signal?.aborted).toBe(true);
  });

  it("keeps the client's own timeout as well as the job signal", async () => {
    // openLibrary and llmVision each set AbortSignal.timeout themselves, and that is the
    // only thing stopping a hung request from pinning a catch open forever. Replacing it
    // with the job signal would quietly remove that guard.
    const job = new AbortController();
    const own = new AbortController();
    const { base, seen } = spy();

    await withSignal(base, job.signal)('https://example.test', { signal: own.signal });
    own.abort();

    expect(seen[0]?.signal?.aborted).toBe(true);
  });

  it('is aborted by the job even when the client brought its own signal', async () => {
    const job = new AbortController();
    const own = new AbortController();
    const { base, seen } = spy();

    await withSignal(base, job.signal)('https://example.test', { signal: own.signal });
    job.abort();

    expect(seen[0]?.signal?.aborted).toBe(true);
  });

  it('leaves the rest of the request untouched', async () => {
    const job = new AbortController();
    const { base, seen } = spy();

    await withSignal(base, job.signal)('https://example.test', {
      method: 'POST',
      body: '{"a":1}',
    });

    expect(seen[0]?.method).toBe('POST');
    expect(seen[0]?.body).toBe('{"a":1}');
  });
});
