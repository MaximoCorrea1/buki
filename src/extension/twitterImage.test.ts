import { describe, it, expect } from 'vitest';
import { bestQuality, distinctMedia, isTweetMedia, keepTweetMedia } from './twitterImage';

describe('bestQuality', () => {
  // This asked for `large` (~2048px) while the picture was being sent to the model as a
  // URL, so the size cost us nothing - the provider did the downloading. It downloads
  // here now, and is then shrunk to 768 before it is sent, so fetching 2048px is paying
  // for four times the pixels in order to throw three of them away. `medium` (~1200px)
  // is the smallest variant still comfortably above what the shrink needs.

  it('asks for a variant big enough to read, not the feed thumbnail', () => {
    // The feed renders covers at name=small (~680px). Downscaling to THAT is what
    // destroys cover typography, and the typography is what is being read.
    expect(bestQuality('https://pbs.twimg.com/media/ABC123?format=jpg&name=small')).toBe(
      'https://pbs.twimg.com/media/ABC123?format=jpg&name=medium',
    );
  });

  it('adds the size when the URL carries none', () => {
    expect(bestQuality('https://pbs.twimg.com/media/ABC123')).toBe(
      'https://pbs.twimg.com/media/ABC123?name=medium',
    );
  });

  it('brings an oversized variant down too', () => {
    // Not just an upgrade any more: `large` is now more than the shrink can use.
    expect(bestQuality('https://pbs.twimg.com/media/ABC123?format=png&name=large')).toBe(
      'https://pbs.twimg.com/media/ABC123?format=png&name=medium',
    );
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

describe('isTweetMedia', () => {
  /**
   * THE SUBSTRING BUG, AND THE FIX WAS THREE LINES AWAY.
   *
   * `content.ts:548` filtered scraped images with `src.includes('twimg.com/media')` while
   * `bestQuality`, in this same file, already did `parsed.hostname !== 'pbs.twimg.com'`.
   * The two disagreed for a year and only one of them was on the path where a hostile page
   * chooses the string.
   *
   * What it cost: a forged `article[data-testid="tweet"]` on any page carrying
   * `https://attacker.example/twimg.com/media/x.png` passed the filter, was sent to the
   * model on our key, and — via `.buki-intent` → `shotFor` → `saveBook` — was PERSISTED as
   * the book's `shot`. `cover.ts:49` then fetches that URL from the extension origin every
   * time the popup opens, for ever. A permanent beacon, saved by the user's own shelf.
   */

  it('accepts the media URL X actually serves', () => {
    expect(isTweetMedia('https://pbs.twimg.com/media/ABC123?format=jpg&name=small')).toBe(true);
  });

  it('REFUSES a foreign host that merely spells the path', () => {
    expect(isTweetMedia('https://attacker.example/twimg.com/media/x.png')).toBe(false);
  });

  it('refuses a host that merely ends with the name', () => {
    expect(isTweetMedia('https://pbs.twimg.com.evil.test/media/x.png')).toBe(false);
  });

  it('refuses the name hidden in a query string', () => {
    expect(isTweetMedia('https://evil.test/x.png?ref=pbs.twimg.com/media/y')).toBe(false);
  });

  it('refuses plain http, because the manifest only ever granted https', () => {
    expect(isTweetMedia('http://pbs.twimg.com/media/ABC123')).toBe(false);
  });

  it('refuses a path on the right host that is not media', () => {
    // Same narrowing the substring filter already had: an avatar is not a book cover, and
    // widening this while fixing the host would be a second change wearing the first's
    // justification.
    expect(isTweetMedia('https://pbs.twimg.com/profile_images/1/avatar.jpg')).toBe(false);
    expect(isTweetMedia('https://pbs.twimg.com/card_img/1/thumb.jpg')).toBe(false);
  });

  it('refuses anything that is not a URL at all', () => {
    expect(isTweetMedia('javascript:alert(1)')).toBe(false);
    expect(isTweetMedia('data:image/png;base64,AAAA')).toBe(false);
    expect(isTweetMedia('')).toBe(false);
    expect(isTweetMedia('not a url')).toBe(false);
  });
});

describe('keepTweetMedia', () => {
  /**
   * The SECOND place the same question is asked, and it is asked again on purpose.
   *
   * `content.ts` filters what it scrapes, but the worker receives that list over
   * `chrome.runtime.sendMessage` from a script running in a page Buki does not control. A
   * filter applied only on the far side of a trust boundary is a filter the attacker is
   * standing next to.
   *
   * The CONTEXT-MENU flow is deliberately not filtered by this: there the URL comes from
   * Chrome's own `info.srcUrl`, which reports what the user actually right-clicked, and
   * catching a book from any image on any site is the product.
   */

  it('drops the forged one and keeps the real one', () => {
    expect(
      keepTweetMedia([
        'https://pbs.twimg.com/media/REAL?name=small',
        'https://attacker.example/twimg.com/media/FORGED.png',
      ]),
    ).toEqual(['https://pbs.twimg.com/media/REAL?name=small']);
  });

  it('keeps the order, because the first attachment is likeliest to hold the book', () => {
    expect(
      keepTweetMedia([
        'https://pbs.twimg.com/media/A',
        'https://evil.test/twimg.com/media/B',
        'https://pbs.twimg.com/media/C',
      ]),
    ).toEqual(['https://pbs.twimg.com/media/A', 'https://pbs.twimg.com/media/C']);
  });

  it('answers with nothing when nothing survives, rather than throwing', () => {
    // `llmVision.guessBooks` returns early on an empty list without spending a request,
    // so an all-forged post costs nothing and the card says no book was found.
    expect(keepTweetMedia(['https://evil.test/twimg.com/media/x'])).toEqual([]);
    expect(keepTweetMedia([])).toEqual([]);
  });
});
