import { describe, it, expect } from 'vitest';
import { createLlmVision, type VisionConfig } from './llmVision';
import type { FetchLike } from './types';

const CFG: VisionConfig = {
  endpoint: 'https://provider.test/v1/chat/completions',
  model: 'test-vision',
  apiKey: 'k-123',
};

/** Stands in for the model, capturing the request so we can assert what it was sent. */
function fakeModel(reply: string | null, opts: { ok?: boolean; status?: number } = {}) {
  const sent: { url?: string; body?: unknown } = {};
  const fetch: FetchLike = async (url, init) => {
    sent.url = url;
    sent.body = init?.body ? JSON.parse(init.body) : undefined;
    return {
      ok: opts.ok ?? true,
      status: opts.status ?? 200,
      async json() {
        return reply === null ? {} : { choices: [{ message: { content: reply } }] };
      },
    };
  };
  return { fetch, sent };
}

describe('createLlmVision', () => {
  it('authenticates when a key is configured, and stays keyless when it is not', async () => {
    // Keyless is the shape a proxy uses: the credential lives on the server, so the
    // extension ships without one.
    const seen: (string | undefined)[] = [];
    const fetch: FetchLike = async (_url, init) => {
      seen.push(init?.headers?.Authorization);
      return { ok: true, status: 200, async json() { return {}; } };
    };
    const img = { imageUrls: ['http://c.jpg'], text: '' };

    await createLlmVision({ fetch, config: CFG }).guessBook(img);
    await createLlmVision({ fetch, config: { ...CFG, apiKey: undefined } }).guessBook(img);

    expect(seen[0]).toBe('Bearer k-123');
    expect(seen[1]).toBeUndefined();
  });

  it('sends the cover image and the tweet text together', async () => {
    const { fetch, sent } = fakeModel('{"title":"Dune","author":"Frank Herbert"}');
    const vision = createLlmVision({ fetch, config: CFG });

    await vision.guessBook({
      imageUrls: ['https://pbs.twimg.com/media/cover.jpg'],
      text: 'just finished this one',
    });

    const body = sent.body as { messages: { content: { type: string; text?: string }[] }[] };
    const parts = JSON.stringify(body.messages[0]?.content);
    // The caption is context the model uses to identify the cover - sending the image
    // alone throws away the best clue on the page.
    expect(parts).toContain('https://pbs.twimg.com/media/cover.jpg');
    expect(parts).toContain('just finished this one');
  });

  it('reads title and author out of the reply', async () => {
    const { fetch } = fakeModel('{"title":"Dune","author":"Frank Herbert","confidence":0.9}');
    const guess = await createLlmVision({ fetch, config: CFG }).guessBook({
      imageUrls: ['http://c.jpg'],
      text: '',
    });

    expect(guess?.title).toBe('Dune');
    expect(guess?.author).toBe('Frank Herbert');
  });

  it('tolerates JSON wrapped in a markdown fence', async () => {
    // Models habitually fence their JSON no matter how the prompt is worded.
    const { fetch } = fakeModel('```json\n{"title":"Clean Code","author":"Robert C. Martin"}\n```');
    const guess = await createLlmVision({ fetch, config: CFG }).guessBook({
      imageUrls: ['http://c.jpg'],
      text: '',
    });

    expect(guess?.title).toBe('Clean Code');
  });

  it('returns null when the model reports no book', async () => {
    const { fetch } = fakeModel('{"title":null,"author":null}');
    expect(
      await createLlmVision({ fetch, config: CFG }).guessBook({ imageUrls: ['http://c.jpg'], text: '' }),
    ).toBeNull();
  });

  it('returns null on unparseable prose instead of throwing', async () => {
    const { fetch } = fakeModel("I'm sorry, I can't identify that image.");
    expect(
      await createLlmVision({ fetch, config: CFG }).guessBook({ imageUrls: ['http://c.jpg'], text: '' }),
    ).toBeNull();
  });

  it('throws on an HTTP error so the caller can say the service failed', async () => {
    const { fetch } = fakeModel(null, { ok: false, status: 429 });
    await expect(
      createLlmVision({ fetch, config: CFG }).guessBook({ imageUrls: ['http://c.jpg'], text: '' }),
    ).rejects.toThrow(/429/);
  });

  it("includes the provider's explanation, not just the status code", async () => {
    // A bare "HTTP 404" points at the URL, which is the wrong layer: the URL is fine and
    // the model name is not. Twice before, this project chased an error message that
    // described a different problem than the real one. The body says which.
    //
    // Google wraps the error in an ARRAY - verified against the live endpoint, not
    // assumed.
    const fetch: FetchLike = async () => ({
      ok: false,
      status: 404,
      async json() {
        return [
          {
            error: {
              code: 404,
              message: 'models/gemini-x is not found for API version v1beta',
              status: 'NOT_FOUND',
            },
          },
        ];
      },
    });

    await expect(
      createLlmVision({ fetch, config: CFG }).guessBook({ imageUrls: ['http://c.jpg'], text: '' }),
    ).rejects.toThrow(/is not found for API version/);
  });

  it('separates a misconfiguration from a bad moment', async () => {
    // Real case: a pinned model was retired for new users. The extension told people to
    // "try again in a moment", which was advice that could never work - retrying a 404
    // forever is worse than saying the setup is wrong.
    const dead: FetchLike = async () => ({
      ok: false,
      status: 404,
      async json() {
        return [{ error: { message: 'This model is no longer available to new users.' } }];
      },
    });
    const busy: FetchLike = async () => ({ ok: false, status: 429, async json() { return {}; } });
    const broken: FetchLike = async () => ({ ok: false, status: 503, async json() { return {}; } });
    const img = { imageUrls: ['http://c.jpg'], text: '' };

    await expect(
      createLlmVision({ fetch: dead, config: CFG }).guessBook(img),
    ).rejects.toMatchObject({ status: 404, permanent: true });

    // Rate limiting and outages pass; waiting is genuinely the right advice for these.
    await expect(
      createLlmVision({ fetch: busy, config: CFG }).guessBook(img),
    ).rejects.toMatchObject({ status: 429, permanent: false });
    await expect(
      createLlmVision({ fetch: broken, config: CFG }).guessBook(img),
    ).rejects.toMatchObject({ status: 503, permanent: false });
  });

  it('says a timeout in words, and treats it as worth retrying', async () => {
    // The raw abort surfaces as "TimeoutError: signal timed out", which reads like a bug
    // in the extension rather than a model that took too long.
    const fetch: FetchLike = async () => {
      throw Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });
    };

    await expect(
      createLlmVision({ fetch, config: CFG }).guessBook({ imageUrls: ['http://c.jpg'], text: '' }),
    ).rejects.toMatchObject({ permanent: false, message: /took too long/ });
  });

  it('still reports the status when the error body cannot be read', async () => {
    // Not every provider answers errors with JSON. Losing the status too would leave
    // nothing at all to go on.
    const fetch: FetchLike = async () => ({
      ok: false,
      status: 502,
      async json(): Promise<unknown> {
        throw new Error('<html>gateway error</html>');
      },
    });

    await expect(
      createLlmVision({ fetch, config: CFG }).guessBook({ imageUrls: ['http://c.jpg'], text: '' }),
    ).rejects.toThrow(/502/);
  });

  it('returns null without calling out when there is no image', async () => {
    let called = false;
    const fetch: FetchLike = async () => {
      called = true;
      return { ok: true, status: 200, async json() { return {}; } };
    };
    expect(
      await createLlmVision({ fetch, config: CFG }).guessBook({ imageUrls: [], text: 'no picture' }),
    ).toBeNull();
    expect(called).toBe(false);
  });
});
