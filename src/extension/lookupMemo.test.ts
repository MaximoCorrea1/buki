import { describe, it, expect } from 'vitest';
import { createLookupMemo, postKey } from './lookupMemo';

describe('createLookupMemo', () => {
  it('joins a lookup already running instead of starting a second', async () => {
    // Pressing the button twice used to run recognition twice: two vision calls, two sets
    // of OpenLibrary queries, two pickers for one book.
    let started = 0;
    let release: (v: string) => void = () => undefined;
    const memo = createLookupMemo<string>({ now: () => 0 });
    const work = (): Promise<string> => {
      started++;
      return new Promise<string>((resolve) => (release = resolve));
    };

    const first = memo.run('post-1', work);
    const second = memo.run('post-1', work);
    release('Dune');

    expect(await first).toBe('Dune');
    expect(await second).toBe('Dune');
    expect(started).toBe(1);
  });

  it('reuses the answer for a little while after it lands', async () => {
    let started = 0;
    const memo = createLookupMemo<string>({ now: () => 0 });
    const work = async (): Promise<string> => {
      started++;
      return 'Dune';
    };

    await memo.run('post-1', work);
    await memo.run('post-1', work);

    expect(started).toBe(1);
  });

  it('looks again once the answer is stale', async () => {
    let started = 0;
    let clock = 0;
    const memo = createLookupMemo<string>({ now: () => clock, ttlMs: 1000 });
    const work = async (): Promise<string> => {
      started++;
      return 'Dune';
    };

    await memo.run('post-1', work);
    clock = 1001;
    await memo.run('post-1', work);

    expect(started).toBe(2);
  });

  it('keeps different posts apart', async () => {
    let started = 0;
    const memo = createLookupMemo<string>({ now: () => 0 });
    const work = async (): Promise<string> => {
      started++;
      return 'x';
    };

    await memo.run('post-1', work);
    await memo.run('post-2', work);

    expect(started).toBe(2);
  });

  it('does not remember a failure', async () => {
    // A lookup that died because the network blipped has to be retryable straight away.
    let started = 0;
    const memo = createLookupMemo<string>({ now: () => 0 });
    const work = async (): Promise<string> => {
      started++;
      throw new Error('offline');
    };

    await expect(memo.run('post-1', work)).rejects.toThrow('offline');
    await expect(memo.run('post-1', work)).rejects.toThrow('offline');

    expect(started).toBe(2);
  });

  it('forgets a post on request, so a cancelled lookup can be tried again', async () => {
    let started = 0;
    const memo = createLookupMemo<string>({ now: () => 0 });
    const work = async (): Promise<string> => {
      started++;
      return 'Dune';
    };

    await memo.run('post-1', work);
    memo.forget('post-1');
    await memo.run('post-1', work);

    expect(started).toBe(2);
  });
});

describe('postKey', () => {
  it('treats the same post as the same post', () => {
    const a = postKey({ text: 'read this', imageUrls: ['https://pbs.twimg.com/media/x.jpg'] });
    const b = postKey({ text: 'read this', imageUrls: ['https://pbs.twimg.com/media/x.jpg'] });

    expect(a).toBe(b);
  });

  it('tells two different posts apart', () => {
    const a = postKey({ text: 'read this', imageUrls: ['https://pbs.twimg.com/media/x.jpg'] });
    const b = postKey({ text: 'read this', imageUrls: ['https://pbs.twimg.com/media/y.jpg'] });

    expect(a).not.toBe(b);
  });

  it('ignores the size variant Twitter happens to serve', () => {
    // The same media comes back under several ?format=&name= query strings, and the
    // right-click menu reports a different one than the DOM is holding.
    const a = postKey({ text: 't', imageUrls: ['https://pbs.twimg.com/media/x.jpg?name=small'] });
    const b = postKey({ text: 't', imageUrls: ['https://pbs.twimg.com/media/x.jpg?name=large'] });

    expect(a).toBe(b);
  });

  it('does not care what order the images came back in', () => {
    const a = postKey({ text: 't', imageUrls: ['https://p.test/b.jpg', 'https://p.test/a.jpg'] });
    const b = postKey({ text: 't', imageUrls: ['https://p.test/a.jpg', 'https://p.test/b.jpg'] });

    expect(a).toBe(b);
  });
});

/**
 * C-7. `OPENWORK.md` item 47. The key dropped the HOST, so two images sharing a path on
 * different sites were one catch.
 *
 * On X alone this could not bite: every picture comes from `pbs.twimg.com`. Catch-anywhere
 * is what made it reachable, and the cost is not a duplicate row - it is a MEMO HIT. The
 * second post's press returns the first post's books, so the reader saves a book that was
 * never on the page they were looking at, and the recognition log records a catch that did
 * not happen.
 */
describe('postKey tells two sites apart', () => {
  it('does not fold two hosts sharing an image path into one catch', () => {
    const a = postKey({ text: 'look', imageUrls: ['https://one.test/img/cover.jpg'] });
    const b = postKey({ text: 'look', imageUrls: ['https://two.test/img/cover.jpg'] });
    expect(a).not.toBe(b);
  });

  it('still ignores the query string, which is why the path was used', () => {
    // Twitter serves the same media under several `?format=&name=` variants and the
    // right-click menu reports a different one from the DOM. That reason survives intact.
    const a = postKey({ text: 't', imageUrls: ['https://pbs.twimg.com/media/x.jpg?name=small'] });
    const b = postKey({ text: 't', imageUrls: ['https://pbs.twimg.com/media/x.jpg?name=large'] });
    expect(a).toBe(b);
  });

  it('ignores the scheme, so an http and https variant are one picture', () => {
    const a = postKey({ text: 't', imageUrls: ['https://p.test/a.jpg'] });
    const b = postKey({ text: 't', imageUrls: ['http://p.test/a.jpg'] });
    expect(a).toBe(b);
  });

  it('still falls back to the raw string for something that is not a URL', () => {
    expect(() => postKey({ text: 't', imageUrls: ['not a url'] })).not.toThrow();
    expect(postKey({ text: 't', imageUrls: ['not a url'] })).toContain('not a url');
  });
});
