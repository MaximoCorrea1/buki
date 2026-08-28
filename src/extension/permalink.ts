import { isFeedHost } from './feedHost';

/**
 * The post a book was caught from, or nothing.
 *
 * ⚠ **THIS USED TO BE A SUBSTRING SELECTOR.** `OPENWORK.md` item 52, TM-10:
 *
 *     const link = article.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
 *     return link?.href ?? null;
 *
 * `*=` matches anywhere in the attribute and `.href` was returned verbatim, so an anchor the
 * page controls — `<a href="javascript:…#/status/1">` — satisfied the selector and its
 * `javascript:` URL was written to the shelf as `source.url`, the link the popup offers as
 * *"the post that sold you"*.
 *
 * **The same shape item 41 already fixed once**, in `isTweetMedia`, which matched the
 * `twimg` host by substring for a year. Same file, one selector along.
 *
 * **It was defused by a single line** — `popup.ts`'s `/^https?:\/\//i` at the one render
 * site — and that is not the same as safe. The bad URL was still STORED, so the safety
 * belonged to a guard a second render site would not have, and a shelf that holds a value it
 * must remember not to trust is a shelf with a trap in it. This checks where the value is
 * READ, so what gets stored is true.
 *
 * The host rule is `feedHost.ts`'s, imported rather than re-spelled: it already anchors to a
 * label boundary, which is the distinction `x.com.evil.test` turns on, and two copies of one
 * rule is how they come to disagree.
 */

/** `/someone/status/123…` — `status` as a PATH SEGMENT, followed by an id. */
const STATUS_PATH = /(^|\/)status\/\d+(\/|$)/;

/** Is this a URL X itself would have served for a post? */
export function isPermalink(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  // HTTPS ONLY. This is the clause that closes the finding: `javascript:`, `data:` and
  // `vbscript:` all die here, and so does a plain `http:` permalink, which X has not served
  // in years and which would be a downgrade if it did.
  if (url.protocol !== 'https:') return false;

  // `url.hostname` is the parsed host, so `https://x.com@evil.test/…` gives `evil.test` -
  // the userinfo trick reads as x.com only to a substring check.
  if (!isFeedHost(url.hostname)) return false;

  // A SEGMENT, not a substring: `/someone/notstatus/1` contains "status/1" and is not a post.
  return STATUS_PATH.test(url.pathname);
}

/**
 * The first href that is really a permalink.
 *
 * WALKS rather than taking the first candidate, because the old selector took the first
 * MATCH — so one forged anchor at the top of an article was enough to shadow the genuine
 * permalink below it. Refusing the whole article on one bad anchor would hand the page a way
 * to suppress the link instead; walking finds the real one.
 */
export function permalinkOf(hrefs: readonly string[]): string | null {
  return hrefs.find(isPermalink) ?? null;
}
