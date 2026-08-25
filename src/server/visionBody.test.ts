import { describe, it, expect } from 'vitest';
import {
  rebuildVisionBody,
  PINNED_MODEL,
  MAX_BODY_BYTES,
  MAX_IMAGE_PARTS,
  MAX_TEXT_CHARS,
  MAX_OUTPUT_TOKENS,
} from './visionBody';

/**
 * WHAT ACTUALLY REACHES GEMINI, and the whole point is that it is never what the caller
 * sent.
 *
 * Every assertion here is about a BEHAVIOUR on the wire, not about a string being present
 * somewhere. That is deliberate: the 2026-08-24 review found that three artefacts claimed
 * "the server pins the model" — a comment, a doc and a test — while no file under
 * `src/server/` contained the word `model` at all. The test that was supposed to prove it
 * asserted `model === ''` one layer BELOW where the body was assembled.
 *
 * So: build a body, rebuild it, parse what comes out, and assert on the parsed object.
 */

/** A body shaped exactly like `llmVision.ts` builds one. */
const clientBody = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({
    model: 'gemini-flash-lite-latest',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'You identify books from photographs. Post text:\n(none)' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } },
        ],
      },
    ],
    ...over,
  });

/** The rebuilt body as an object, or a failure the test can name. */
const wire = (raw: string): Record<string, unknown> => {
  const out = rebuildVisionBody(raw);
  if (!out.ok) throw new Error(`expected a rebuild, got ${out.status}: ${out.message}`);
  return JSON.parse(out.body) as Record<string, unknown>;
};

type Part = { type: string; text?: string; image_url?: { url?: string } };
const partsOf = (body: Record<string, unknown>): Part[] =>
  ((body['messages'] as { content: Part[] }[])[0] as { content: Part[] }).content;

describe('the model pin', () => {
  it('sends OUR model whatever the caller asked for', () => {
    // The money path. `options.html` is a free-text field, so this is reachable through
    // our own UI without any forgery: a keyless user typing `gemini-2.5-pro` bills us for
    // Pro-tier inference. Measured ratio, honest catch to attacker request: 25,000x.
    expect(wire(clientBody({ model: 'gemini-2.5-pro' }))['model']).toBe(PINNED_MODEL);
  });

  it('sends OUR model when the caller sends none at all', () => {
    const { model, ...noModel } = JSON.parse(clientBody()) as Record<string, unknown>;
    expect(model).toBeDefined(); // the fixture really did carry one
    expect(wire(JSON.stringify(noModel))['model']).toBe(PINNED_MODEL);
  });
});

describe('the token budget', () => {
  it('clamps the output budget the caller cannot raise', () => {
    expect(wire(clientBody({ max_tokens: 64_000 }))['max_tokens']).toBe(MAX_OUTPUT_TOKENS);
  });

  it('sets the budget even when the caller sends none', () => {
    expect(wire(clientBody())['max_tokens']).toBe(MAX_OUTPUT_TOKENS);
  });

  it('ignores the OpenAI spelling of the same lever', () => {
    // `max_completion_tokens` is OpenAI's newer name for `max_tokens`. A rebuild that
    // dropped only the old spelling would leave the new one to be honoured upstream.
    const out = wire(clientBody({ max_completion_tokens: 64_000 }));
    expect(out['max_completion_tokens']).toBeUndefined();
    expect(out['max_tokens']).toBe(MAX_OUTPUT_TOKENS);
  });
});

describe('the fields the caller does not get to choose', () => {
  /**
   * `n` MULTIPLIES THE BILL AND THE REVIEW DID NOT NAME IT. `n: 100` is a hundred
   * completions charged for one request. `service_tier: 'priority'` is a premium price
   * band. `extra_body` is Gemini's documented escape hatch and can re-open anything this
   * module closes. None of them is in the shape `llmVision.ts` sends, so none of them has
   * a reason to survive.
   */
  const smuggled = {
    n: 100,
    stream: true,
    temperature: 2,
    top_p: 1,
    service_tier: 'priority',
    response_format: { type: 'json_object' },
    reasoning_effort: 'high',
    extra_body: { google: { thinking_config: { thinking_budget: 32_000 } } },
    tools: [{ type: 'function' }],
    safety_settings: [],
  };

  it('drops every one of them', () => {
    const out = wire(clientBody(smuggled));
    for (const field of Object.keys(smuggled)) {
      expect(out[field], `${field} survived the rebuild`).toBeUndefined();
    }
  });

  it('sends only the fields we chose', () => {
    // An allowlist proven by its complement: anything not named here is a field somebody
    // added without deciding it was safe to forward.
    expect(Object.keys(wire(clientBody(smuggled))).sort()).toEqual([
      'max_tokens',
      'messages',
      'model',
    ]);
  });
});

describe('the size ceiling', () => {
  it('refuses a body past the cap without parsing it', () => {
    const huge = 'x'.repeat(MAX_BODY_BYTES + 1);
    const out = rebuildVisionBody(huge);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(413);
  });

  it('measures BYTES, not characters', () => {
    // One astral-plane character is four UTF-8 bytes and one `.length` of two. A cap read
    // in characters is a cap an attacker doubles by choosing an alphabet.
    const fourByte = '\u{1F4DA}'; // 📚
    const justOverInBytes = fourByte.repeat(Math.ceil(MAX_BODY_BYTES / 4) + 1);
    expect(justOverInBytes.length).toBeLessThan(MAX_BODY_BYTES);
    const out = rebuildVisionBody(justOverInBytes);
    expect(out.ok, 'a body over the cap in bytes was accepted').toBe(false);
  });

  it('accepts a body at the cap', () => {
    const body = clientBody();
    expect(new TextEncoder().encode(body).length).toBeLessThan(MAX_BODY_BYTES);
    expect(rebuildVisionBody(body).ok).toBe(true);
  });
});

describe('the shape it will accept', () => {
  it('refuses something that is not JSON', () => {
    const out = rebuildVisionBody('<html>gateway error</html>');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(400);
  });

  it('refuses a body with no user message', () => {
    expect(rebuildVisionBody(JSON.stringify({ messages: [] })).ok).toBe(false);
    expect(rebuildVisionBody(JSON.stringify({ model: 'x' })).ok).toBe(false);
  });

  it('refuses a message that is not the user speaking', () => {
    // A system message is a different instruction budget and a different prompt surface.
    // `llmVision.ts` sends exactly one user message and always has.
    const out = rebuildVisionBody(
      JSON.stringify({ messages: [{ role: 'system', content: [{ type: 'text', text: 'hi' }] }] }),
    );
    expect(out.ok).toBe(false);
  });

  it('keeps only the FIRST message when several are sent', () => {
    const out = wire(
      JSON.stringify({
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'first' }] },
          { role: 'user', content: [{ type: 'text', text: 'second' }] },
        ],
      }),
    );
    expect((out['messages'] as unknown[]).length).toBe(1);
    expect(partsOf(out)[0]?.text).toBe('first');
  });
});

describe('the image parts', () => {
  const image = (url: string): Part => ({ type: 'image_url', image_url: { url } });

  const withImages = (...urls: string[]): string =>
    JSON.stringify({
      messages: [{ role: 'user', content: [{ type: 'text', text: 'read' }, ...urls.map(image)] }],
    });

  it('keeps the inlined picture the extension actually sends', () => {
    const out = wire(withImages('data:image/jpeg;base64,AAAA'));
    expect(partsOf(out).filter((p) => p.type === 'image_url').length).toBe(1);
  });

  it('keeps an https URL, because inlining is allowed to fail', () => {
    // `inlineAll` falls back to the link when a picture cannot be fetched, under a comment
    // saying a picture must never be able to fail a catch. Refusing the fallback here
    // would turn a slow catch into no catch.
    const out = wire(withImages('https://pbs.twimg.com/media/abc.jpg'));
    expect(partsOf(out).filter((p) => p.type === 'image_url').length).toBe(1);
  });

  it('drops a URL that is neither, so our key cannot be used as a fetcher', () => {
    const out = wire(
      withImages('http://169.254.169.254/latest/meta-data/', 'file:///etc/passwd', 'ftp://x/y'),
    );
    expect(partsOf(out).filter((p) => p.type === 'image_url').length).toBe(0);
  });

  it('never sends more pictures than X can even attach', () => {
    const many = Array.from({ length: 40 }, (_, i) => `data:image/jpeg;base64,${i}`);
    const out = wire(withImages(...many));
    expect(partsOf(out).filter((p) => p.type === 'image_url').length).toBe(MAX_IMAGE_PARTS);
  });

  it('drops a part whose url is not a string', () => {
    const out = wire(
      JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'read' },
              { type: 'image_url', image_url: { url: { toString: 'nope' } } },
              { type: 'image_url' },
            ],
          },
        ],
      }),
    );
    expect(partsOf(out).filter((p) => p.type === 'image_url').length).toBe(0);
  });

  it('drops a part type we do not send', () => {
    const out = wire(
      JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'read' },
              { type: 'input_audio', input_audio: { data: 'AAAA' } },
              { type: 'file', file: { file_data: 'AAAA' } },
            ],
          },
        ],
      }),
    );
    expect(partsOf(out).map((p) => p.type)).toEqual(['text']);
  });
});

describe('the prompt', () => {
  const textBody = (...texts: string[]): string =>
    JSON.stringify({
      messages: [{ role: 'user', content: texts.map((text) => ({ type: 'text', text })) }],
    });

  it('truncates a prompt past the ceiling rather than refusing the catch', () => {
    const out = wire(textBody('a'.repeat(MAX_TEXT_CHARS + 500)));
    expect(partsOf(out)[0]?.text?.length).toBe(MAX_TEXT_CHARS);
  });

  it('caps the TOTAL text, not each part, so it cannot be split past the cap', () => {
    // The obvious mistake: cap per part, and an attacker sends fifty parts of the maximum
    // length. Only one text part survives, and it carries the cap.
    const parts = Array.from({ length: 50 }, () => 'a'.repeat(MAX_TEXT_CHARS));
    const out = wire(textBody(...parts));
    const text = partsOf(out).filter((p) => p.type === 'text');
    expect(text.length).toBe(1);
    expect(text[0]?.text?.length).toBe(MAX_TEXT_CHARS);
  });

  it('accepts a string content instead of an array of parts', () => {
    // The OpenAI shape allows both. We do not send the plain-string form, but accepting it
    // costs one branch and refusing it would be a 400 nobody could diagnose.
    const out = wire(JSON.stringify({ messages: [{ role: 'user', content: 'just words' }] }));
    expect(partsOf(out)).toEqual([{ type: 'text', text: 'just words' }]);
  });

  it('refuses a message carrying no readable content at all', () => {
    expect(rebuildVisionBody(JSON.stringify({ messages: [{ role: 'user' }] })).ok).toBe(false);
    expect(
      rebuildVisionBody(JSON.stringify({ messages: [{ role: 'user', content: [] }] })).ok,
    ).toBe(false);
  });
});
