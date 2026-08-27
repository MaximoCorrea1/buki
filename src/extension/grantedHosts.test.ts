import { describe, it, expect } from 'vitest';
import { revocableHosts, NO_HOSTS_YET, forgotten, stillAllowed } from './grantedHosts';
import manifestJson from '../../manifest.json?raw';

const REQUIRED = (JSON.parse(manifestJson) as { host_permissions: string[] }).host_permissions;

describe('revocableHosts', () => {
  it('lists a site the reader granted, as a site rather than a match pattern', () => {
    // A match pattern is a thing Chrome reads. The reader is being asked "do you still
    // want Buki to be able to reach this?", and the honest form of that question names a
    // site the way they would say it.
    expect(revocableHosts(['https://covers.example.com/*'], REQUIRED)).toEqual([
      { origin: 'https://covers.example.com/*', host: 'covers.example.com' },
    ]);
  });

  it('never offers to remove a permission the manifest requires', () => {
    // `chrome.permissions.remove` silently declines a required host: it resolves false and
    // nothing changes. A control that does nothing is worse than no control, because the
    // reader believes they have taken the grant back.
    expect(revocableHosts([...REQUIRED], REQUIRED)).toEqual([]);
  });

  it('keeps the optional grants when required ones are mixed in', () => {
    // What `chrome.permissions.getAll()` actually returns: required and optional together,
    // in one array, indistinguishable without the manifest.
    const all = [...REQUIRED, 'https://cdn.example.com/*'];
    expect(revocableHosts(all, REQUIRED).map((h) => h.host)).toEqual(['cdn.example.com']);
  });

  it('DOES offer the whole-web wildcard, which is the one that matters most', () => {
    // `originPatternFor` never returns this, so it should not arise. If it ever does, it
    // is the single most important grant a reader could want back, and the temptation to
    // filter out "weird" patterns would hide exactly that one.
    expect(revocableHosts(['https://*/*'], REQUIRED)).toEqual([
      { origin: 'https://*/*', host: 'every site' },
    ]);
  });

  it('names a subdomain wildcard as a subdomain wildcard', () => {
    expect(revocableHosts(['https://*.example.com/*'], REQUIRED)[0]?.host).toBe('*.example.com');
  });

  it('sorts by the name the reader reads, so the list does not reshuffle', () => {
    const list = revocableHosts(
      ['https://zeta.example/*', 'https://alpha.example/*', 'https://mid.example/*'],
      REQUIRED,
    );
    expect(list.map((h) => h.host)).toEqual(['alpha.example', 'mid.example', 'zeta.example']);
  });

  it('shows one row per site even when Chrome reports a duplicate', () => {
    expect(revocableHosts(['https://a.example/*', 'https://a.example/*'], REQUIRED)).toHaveLength(1);
  });

  it('is empty rather than throwing when Chrome reports no origins at all', () => {
    // `permissions.getAll()` may omit `origins` entirely. An options page that throws here
    // loses every section below it, not just this one.
    expect(revocableHosts(undefined, REQUIRED)).toEqual([]);
    expect(revocableHosts([], REQUIRED)).toEqual([]);
  });

  it('drops a pattern it cannot read rather than rendering the raw string', () => {
    expect(revocableHosts(['not a pattern'], REQUIRED)).toEqual([]);
  });

  it('says what a removal actually did, including the part people expect to be worse', () => {
    // The fear behind this button is "will this delete the books I caught there?". It
    // will not, and the sentence that removes that fear costs nothing to say here.
    expect(forgotten('example.com')).toContain('example.com');
    expect(forgotten('example.com')).toMatch(/ask again/i);
  });

  it('names what failed and does not apologise', () => {
    // `docs/brand.md`: an error names what failed and never apologises. It also has to say
    // what is now TRUE, because a failed removal leaves the grant in place and the reader
    // has to know that rather than assume the button worked.
    expect(stillAllowed('example.com')).toContain('example.com');
    expect(stillAllowed('example.com')).toMatch(/still/i);
    expect(stillAllowed('example.com')).not.toMatch(/sorry|apolog|oops|unfortunately/i);
  });

  it('offers an empty state that invites rather than reports', () => {
    // `docs/brand.md`: an empty state is an invitation. "No sites" is a status line; this
    // has to tell the reader when one would appear, or the section reads as broken.
    expect(NO_HOSTS_YET).toContain('right-click');
    expect(NO_HOSTS_YET).not.toMatch(/none|nothing|empty/i);
  });
});
