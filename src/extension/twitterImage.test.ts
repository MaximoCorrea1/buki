import { describe, it, expect } from 'vitest';
import { bestQuality, distinctMedia } from './twitterImage';

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

describe('distinctMedia', () => {
  it('sends one photo once, however many URLs the page has for it', () => {
    // Twitter serves one media id under several query strings, and a post's DOM can carry
    // more than one of them for the same picture. Each duplicate is a full image the
    // provider has to download before it can start reading - paid for twice, for nothing.
    expect(
      distinctMedia([
        'https://pbs.twimg.com/media/ABC123?format=jpg&name=small',
        'https://pbs.twimg.com/media/ABC123?format=jpg&name=900x900',
      ]),
    ).toEqual(['https://pbs.twimg.com/media/ABC123?format=jpg&name=small']);
  });

  it('keeps genuinely different pictures', () => {
    const urls = [
      'https://pbs.twimg.com/media/AAA?name=small',
      'https://pbs.twimg.com/media/BBB?name=small',
    ];
    expect(distinctMedia(urls)).toEqual(urls);
  });

  it('keeps the order the post put them in', () => {
    // The first attachment is the likeliest to hold the book, and MAX_IMAGES slices from
    // the front - so reordering here would quietly change what the model is shown.
    expect(
      distinctMedia([
        'https://pbs.twimg.com/media/AAA?name=small',
        'https://pbs.twimg.com/media/BBB?name=small',
        'https://pbs.twimg.com/media/AAA?name=large',
        'https://pbs.twimg.com/media/CCC?name=small',
      ]),
    ).toEqual([
      'https://pbs.twimg.com/media/AAA?name=small',
      'https://pbs.twimg.com/media/BBB?name=small',
      'https://pbs.twimg.com/media/CCC?name=small',
    ]);
  });

  it('does not collapse two unparseable URLs into one', () => {
    expect(distinctMedia(['not a url', 'also not a url'])).toEqual(['not a url', 'also not a url']);
  });
});
