import { describe, it, expect } from 'vitest';
import { originPatternFor } from './imageOrigin';

describe('originPatternFor', () => {
  it('asks for the host of an https image', () => {
    expect(originPatternFor('https://covers.openlibrary.org/b/id/240727-L.jpg')).toBe(
      'https://covers.openlibrary.org/*',
    );
  });

  it('drops the port, because a match pattern has no port and Chrome rejects one', () => {
    expect(originPatternFor('https://books.example.com:8443/cover.png')).toBe(
      'https://books.example.com/*',
    );
  });

  it('asks for nothing on a data URL, which needs no permission to read', () => {
    expect(originPatternFor('data:image/png;base64,iVBORw0KGgo=')).toBeNull();
  });

  it('asks for nothing on a blob URL, which no origin permission can make fetchable', () => {
    expect(originPatternFor('blob:https://example.com/8f8d-4c1a')).toBeNull();
  });

  it('asks for nothing on http, which optional_host_permissions cannot grant', () => {
    expect(originPatternFor('http://example.com/cover.png')).toBeNull();
  });

  it('asks for nothing for an extension page image', () => {
    expect(originPatternFor('chrome-extension://abcdefg/icons/icon128.png')).toBeNull();
  });

  it('asks for nothing when the string is not a URL at all', () => {
    expect(originPatternFor('not a url')).toBeNull();
    expect(originPatternFor('')).toBeNull();
  });

  it('keeps a bare IP host', () => {
    expect(originPatternFor('https://192.168.1.14/shelf/cover.jpg')).toBe(
      'https://192.168.1.14/*',
    );
  });

  it('asks for nothing for an IPv6 literal, which is not a legal match pattern host', () => {
    // hostname keeps the brackets, and "https://[::1]/*" makes permissions.request throw.
    expect(originPatternFor('https://[::1]/cover.png')).toBeNull();
  });

  it('never returns a pattern containing a wildcard host', () => {
    // A pattern built from attacker-influenced input must not widen into every host.
    // "https://*/*" would grant the whole web from one right click.
    const sneaky = originPatternFor('https://*/evil.png');
    expect(sneaky).toBeNull();
  });
});
