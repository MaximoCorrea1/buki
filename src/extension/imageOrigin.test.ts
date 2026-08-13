import { describe, it, expect } from 'vitest';
import { originPatternFor, mayFetch, type PermissionDeps } from './imageOrigin';

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

/**
 * Run something expected to report a failure, and hand back what it reported.
 *
 * The report is the assertion: a swallowed error nobody ever sees is how a catch that
 * quietly does nothing becomes unexplainable, which this project has shipped three times.
 * Capturing it also keeps a deliberate failure out of the suite's own output, where a
 * stack trace under a passing test reads as something being broken.
 */
async function whileWatchingErrors<T>(run: () => Promise<T>): Promise<[T, unknown[][]]> {
  const reported: unknown[][] = [];
  const real = console.error;
  console.error = (...args: unknown[]) => void reported.push(args);
  try {
    return [await run(), reported];
  } finally {
    console.error = real;
  }
}

/** The permission prompt, recorded. `answer` is what the user says to it. */
function fakePrompt(opts: { answer?: boolean; throws?: Error } = {}) {
  const asked: string[][] = [];
  const deps: PermissionDeps = {
    request: async (origins) => {
      asked.push(origins);
      if (opts.throws) throw opts.throws;
      return opts.answer ?? true;
    },
  };
  return { deps, asked };
}

describe('mayFetch', () => {
  it('asks for the one origin this image needs', async () => {
    const prompt = fakePrompt({ answer: true });
    expect(await mayFetch('https://covers.openlibrary.org/b/id/240727-L.jpg', prompt.deps)).toBe(
      true,
    );
    expect(prompt.asked).toEqual([['https://covers.openlibrary.org/*']]);
  });

  it('stops the catch when the user declines', async () => {
    const prompt = fakePrompt({ answer: false });
    expect(await mayFetch('https://covers.openlibrary.org/x.jpg', prompt.deps)).toBe(false);
  });

  it('asks for nothing on a data URL, which carries its own bytes', async () => {
    // The prompt must not appear at all here. An image that needs no permission asking
    // for one is a dialog the user cannot make sense of.
    const prompt = fakePrompt();
    expect(await mayFetch('data:image/png;base64,iVBORw0KGgo=', prompt.deps)).toBe(true);
    expect(prompt.asked).toEqual([]);
  });

  it('carries on when the ask itself throws, rather than silently doing nothing', async () => {
    // A rejection is a refusal and stops the catch. A THROW means the pattern was
    // unusable, and then the honest move is to let the fetch succeed or fail visibly.
    const prompt = fakePrompt({ throws: new Error('Invalid match pattern') });
    const [allowed, reported] = await whileWatchingErrors(() =>
      mayFetch('https://books.example.com/cover.png', prompt.deps),
    );
    expect(allowed).toBe(true);
    expect(reported).toHaveLength(1);
  });
});
