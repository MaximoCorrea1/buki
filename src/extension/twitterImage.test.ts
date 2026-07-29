import { describe, it, expect } from 'vitest';
import { bestQuality } from './twitterImage';

describe('bestQuality', () => {
  it('asks for the large variant of a feed thumbnail', () => {
    // The feed renders covers at name=small (~680px). Cover typography is exactly what
    // downscaling destroys, and the model is being asked to read it.
    expect(bestQuality('https://pbs.twimg.com/media/ABC123?format=jpg&name=small')).toBe(
      'https://pbs.twimg.com/media/ABC123?format=jpg&name=large',
    );
  });

  it('adds the size when the URL carries none', () => {
    expect(bestQuality('https://pbs.twimg.com/media/ABC123')).toBe(
      'https://pbs.twimg.com/media/ABC123?name=large',
    );
  });

  it('keeps an already-large URL as it is', () => {
    const url = 'https://pbs.twimg.com/media/ABC123?format=png&name=large';
    expect(bestQuality(url)).toBe(url);
  });

  it('leaves other hosts alone', () => {
    // The right-click menu works on any image on the page, not only Twitter's.
    const url = 'https://covers.openlibrary.org/b/id/123-M.jpg';
    expect(bestQuality(url)).toBe(url);
  });

  it('returns a malformed URL untouched rather than throwing', () => {
    expect(bestQuality('not a url')).toBe('not a url');
  });
});
