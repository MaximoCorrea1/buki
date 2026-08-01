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

/**
 * Google's OpenAI-compatible endpoint. Free tier; key from aistudio.google.com.
 *
 * The model is an ALIAS, deliberately. Pinned versions are retired for new users while
 * continuing to serve existing ones, so a pinned default keeps working on the developer's
 * machine and 404s on every fresh install - invisible to the person who could fix it.
 * Two pinned models (`gemini-2.5-flash-lite`, `gemini-2.5-flash`) were found dead this
 * way within a single afternoon.
 *
 * The trade is that the model can change under us. `RecognitionEvent.model` records which
 * one answered, so a shift in the kept rate can be told apart from a shift in the model.
 */
export const GEMINI: Omit<VisionConfig, 'apiKey'> = {
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  model: 'gemini-flash-lite-latest',
};

const TIMEOUT_MS = 25_000;

/** Request Timeout. Not a status any provider sends here - we raise it ourselves. */
const TIMEOUT_STATUS = 408;

/**
 * A rejected request, carrying whether waiting could ever help.
 *
 * A retired model answers 404 forever, but the extension used to tell people to "try
 * again in a moment" - advice that could never work. Rate limits and outages really do
 * pass; a wrong model, a revoked key or a bad endpoint never do, and the honest response
 * is to send the user to settings.
 */
export class VisionHttpError extends Error {
  readonly permanent: boolean;

  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'VisionHttpError';
    // 429 and 408 are client-class statuses that clear on their own; everything else
    // below 500 is something about this request that will not change until the setup does.
    this.permanent = status < 500 && status !== 429 && status !== TIMEOUT_STATUS;
  }
}

/**
 * X allows four attachments. Beyond that we would be paying to look at someone else's
 * gallery, and the book is not going to be the ninth picture.
 */
export const MAX_IMAGES = 4;

/**
 * The images are the evidence; the caption is context.
 *
 * The previous wording ("use the post text as a hint") invited the model to answer from
 * the caption, so a post that showed one book and talked about another returned the one
 * it was talking about. That is not a hint, it is a different source.
 */
const INSTRUCTION = [
  'You identify books from photographs.',
  'Identify the book shown IN THE IMAGES. There may be several; use whichever actually shows a book.',
  'The post text is context only: use it to disambiguate a cover you can partly read, never to name a book you cannot see.',
  'If the images show no book, reply with null for both fields even if the text names one.',
  'Reply with ONLY a JSON object: {"title": string|null, "author": string|null}.',
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
      // Every attachment, not just the first: a post can put the book second, and three
      // of four pictures used to be discarded before the model ever saw them.
      const images = imageUrls.slice(0, MAX_IMAGES);
      if (!images.length) return null; // nothing to look at - don't spend a request

      const caption = [text, altText].filter(Boolean).join('\n').slice(0, 600);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const body = JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `${INSTRUCTION}\n\nPost text:\n${caption || '(none)'}` },
              ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
            ],
          },
        ],
      });

      let res;
      try {
        res = await deps.fetch(endpoint, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(TIMEOUT_MS),
          body,
        });
      } catch (err) {
        // An aborted fetch surfaces as "TimeoutError: signal timed out", which reads like
        // a bug in the extension rather than a model that took too long to answer.
        if (err instanceof Error && /timeout|abort/i.test(`${err.name} ${err.message}`)) {
          throw new VisionHttpError(
            TIMEOUT_STATUS,
            `Reading the cover took too long (over ${TIMEOUT_MS / 1000}s).`,
          );
        }
        throw err;
      }

      if (res.ok === false) {
        const status = res.status ?? 0;
        throw new VisionHttpError(
          status,
          `Recognition service failed (HTTP ${status})${await explain(res)}`,
        );
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
