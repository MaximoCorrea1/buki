import type { FetchLike, VisionClient } from './types';

/**
 * Recognition by a vision model, over the OpenAI chat-completions shape.
 *
 * Why a model rather than local OCR: Tesseract reads *characters*, and cover
 * typography is what it is worst at - stylised display faces, angles, glare. Measured
 * at roughly 5% on real tweet covers. A vision model looks at the picture, reads the
 * caption beside it, and names the book.
 *
 * Why this shape: Gemini, Cloudflare Workers AI, OpenRouter and a self-hosted proxy all
 * speak it, so moving between providers is a config change rather than a rewrite. That
 * matters more than usual here - the first provider chosen (Pollinations) withdrew its
 * keyless vision tier while this was being built.
 */
export interface VisionConfig {
  endpoint: string;
  model: string;
  /** Omitted when a proxy holds the credential, which is how users stay keyless. */
  apiKey?: string;
}

/** Google's OpenAI-compatible endpoint. Free tier; key from aistudio.google.com. */
export const GEMINI: Omit<VisionConfig, 'apiKey'> = {
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  model: 'gemini-2.5-flash-lite',
};

const TIMEOUT_MS = 25_000;

const INSTRUCTION = [
  'You identify books from photographs.',
  'The image usually shows a book cover; the text is the social media post it appeared in.',
  'Reply with ONLY a JSON object: {"title": string|null, "author": string|null}.',
  'Use the post text as a hint when the cover is hard to read.',
  'If the image is not a book, or you cannot identify it, use null for both fields.',
  'Never guess a plausible-sounding book you are not actually reading in the image.',
].join(' ');

interface ChatReply {
  choices?: { message?: { content?: string } }[];
}

/**
 * Pull the provider's own explanation out of an error response.
 *
 * A bare status code points at the wrong layer: "HTTP 404" reads as a broken URL when
 * the URL is fine and the model name is not. Google answers a bad model with the exact
 * name it could not find, which turns a guessing game into a one-line fix.
 *
 * Google wraps its error in an array; OpenAI and OpenRouter use a bare object. Both
 * shapes are read, and an unreadable body still leaves the status.
 */
async function explain(res: { json(): Promise<unknown> }): Promise<string> {
  try {
    const body = await res.json();
    const first = Array.isArray(body) ? body[0] : body;
    const message = (first as { error?: { message?: unknown } } | null)?.error?.message;
    return typeof message === 'string' && message ? ` - ${message.slice(0, 300)}` : '';
  } catch {
    return ''; // HTML from a gateway, an empty body, a truncated response
  }
}

/** Models fence their JSON no matter how firmly the prompt says not to. */
function parseGuess(raw: string): { title: string; author: string } | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { title?: unknown; author?: unknown };
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    if (!title) return null;
    return { title, author: typeof parsed.author === 'string' ? parsed.author.trim() : '' };
  } catch {
    return null; // prose, a refusal, or truncated output
  }
}

export function createLlmVision(deps: { fetch: FetchLike; config: VisionConfig }): VisionClient {
  const { endpoint, model, apiKey } = deps.config;

  return {
    async guessBook({ imageUrls, text, altText }) {
      const image = imageUrls[0];
      if (!image) return null; // nothing to look at - don't spend a request

      const caption = [text, altText].filter(Boolean).join('\n').slice(0, 600);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const res = await deps.fetch(endpoint, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: `${INSTRUCTION}\n\nPost text:\n${caption || '(none)'}` },
                { type: 'image_url', image_url: { url: image } },
              ],
            },
          ],
        }),
      });

      if (res.ok === false) {
        throw new Error(`Recognition service failed (HTTP ${res.status})${await explain(res)}`);
      }

      const data = (await res.json()) as ChatReply | null;
      const raw = data?.choices?.[0]?.message?.content;
      if (typeof raw !== 'string') return null;

      const guess = parseGuess(raw);
      // Confidence is nominal: grounding decides what is real, so a guess here is a
      // query, never an answer.
      return guess ? { ...guess, confidence: 0.7 } : null;
    },
  };
}
