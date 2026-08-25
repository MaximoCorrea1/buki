import { describe, it, expect } from 'vitest';
import { isFeedHost } from './feedHost';

/**
 * Where the feed scanner is allowed to arm.
 *
 * The manifest scopes `content_scripts` to X, but that is only half of how this file gets
 * onto a page. The other half is `ensureTray` → `background.ts`, which runs
 * `executeScript({ files: ['dist/content.js'] })` on ANY tab when somebody uses the
 * right-click menu — the catch-anywhere flow, working as designed.
 *
 * What was NOT designed is what happened next. Once injected, the script observed
 * `document.body` with `{ childList: true, subtree: true }` and ran `setInterval(scan, 2000)`
 * for the lifetime of the tab, with no `clearInterval` anywhere in the file. On a page that
 * has no tweets that is provably zero-yield work forever; on a hostile page it is a
 * permanently armed scanner waiting for forged `article[data-testid="tweet"]` markup.
 *
 * The tray itself does NOT depend on this. It is message-driven — the worker tells it to
 * open a card — so catch-anywhere keeps working exactly as before. Only the button
 * injection is gated, and buttons off X had nothing to attach to.
 */

describe('isFeedHost', () => {
  it('arms on X', () => {
    expect(isFeedHost('x.com')).toBe(true);
    expect(isFeedHost('twitter.com')).toBe(true);
  });

  it("arms on X's own subdomains, because the feed has lived on several", () => {
    expect(isFeedHost('www.x.com')).toBe(true);
    expect(isFeedHost('mobile.twitter.com')).toBe(true);
  });

  it('does NOT arm on a host that merely ends with the name', () => {
    // The substring mistake, one level up. `x.com.evil.test` contains `x.com`, and a
    // filter that asked whether the string was in there would arm on it.
    expect(isFeedHost('x.com.evil.test')).toBe(false);
    expect(isFeedHost('twitter.com.evil.test')).toBe(false);
  });

  it('does NOT arm on a host that merely contains the name', () => {
    expect(isFeedHost('notx.com')).toBe(false);
    expect(isFeedHost('fakex.com')).toBe(false);
    expect(isFeedHost('mytwitter.com')).toBe(false);
  });

  it('does not arm anywhere else, which is every page catch-anywhere reaches', () => {
    expect(isFeedHost('attacker.example')).toBe(false);
    expect(isFeedHost('news.ycombinator.com')).toBe(false);
    expect(isFeedHost('')).toBe(false);
  });

  it('is case-insensitive, because a hostname is', () => {
    expect(isFeedHost('X.COM')).toBe(true);
    expect(isFeedHost('Twitter.Com')).toBe(true);
  });
});
