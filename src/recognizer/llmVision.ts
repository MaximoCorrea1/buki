import type { FetchLike, VisionClient, VisionGuess } from './types';

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

/**
 * Per ATTEMPT, not per catch.
 *
 * Measured 2026-08-05 across five real catches: 1.7s, 4.6s, 5.3s, 6.0s - and one that sat
 * until the old 25s ceiling and died. A request still running at twelve seconds is stuck
 * rather than slow, and waiting another thirteen only delays the retry that fixes it.
 * With two attempts the ceiling is unchanged; what changes is that a hung request no
 * longer takes the whole catch down with it.
 */
const TIMEOUT_MS = 12_000;

/** One retry. A second failure is a pattern rather than a blip, and someone is waiting. */
const ATTEMPTS = 2;

/** Long enough for a rate-limit window to move, short enough not to be felt. */
const BACKOFF_MS = 400;

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

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
  'List EVERY distinct book you can see in the images: a stack on a desk, a shelf behind someone, several covers side by side.',
  'Only books you can actually see. Do not add a book because the text mentions it.',
  'The post text is context only: use it to disambiguate a cover you can partly read, never to name a book you cannot see.',
  'Order them by how clearly you can read them, clearest first.',
  'If the images show no book at all, reply with an empty array.',
  'Reply with ONLY a JSON array: [{"title": string, "author": string}].',
].join(' ');

/**
 * Most books to take from one picture.
 *
 * A photographed bookshelf can hold fifty spines, and a card offering fifty decisions is
 * not a card. Ordered clearest-first by the prompt, so the cut falls on the ones least
 * likely to be read correctly anyway.
 */
export const MAX_BOOKS = 8;

interface ChatReply {
  choices?: { message?: { content?: string } }[];
  /** Where the wait went. See the note where this is logged. */
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
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

/** One entry, if it names a book. A titleless entry is the model padding the array. */
function toGuess(entry: unknown): VisionGuess | null {
  const { title, author } = (entry ?? {}) as { title?: unknown; author?: unknown };
  const named = typeof title === 'string' ? title.trim() : '';
  if (!named) return null;
  return { title: named, author: typeof author === 'string' ? author.trim() : '' };
}

/**
 * Models fence their JSON no matter how firmly the prompt says not to - and having been
 * asked for an array, they still answer with a bare object often enough that refusing one
 * would throw away a perfectly good reading. Both shapes are accepted.
 */
function parseGuesses(raw: string): VisionGuess[] {
  const match = raw.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed: unknown = JSON.parse(match[0]);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.map(toGuess).filter((g): g is VisionGuess => g !== null);
  } catch {
    return []; // prose, a refusal, or truncated output
  }
}

export function createLlmVision(deps: { fetch: FetchLike; config: VisionConfig }): VisionClient {
  const { endpoint, model, apiKey } = deps.config;

  return {
    async guessBooks({ imageUrls, text, altText }) {
      // Every attachment, not just the first: a post can put the book second, and three
      // of four pictures used to be discarded before the model ever saw them.
      const images = imageUrls.slice(0, MAX_IMAGES);
      if (!images.length) return []; // nothing to look at - don't spend a request

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

      const once = async (): Promise<VisionGuess[]> => {
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

      // Whether the model spent the wait THINKING.
      //
      // Google's docs say 2.5 Flash Lite does not think by default - but the configured
      // model is the `-latest` ALIAS, deliberately, and an alias can be repointed at a
      // model that does. Reasoning tokens are the only way to tell from outside, and a
      // 12s cover read is worth being able to attribute rather than guess at.
      const usage = data?.usage;
      if (usage) {
        console.info(
          `[Buki] vision tokens · prompt ${usage.prompt_tokens ?? '?'}` +
            ` · completion ${usage.completion_tokens ?? '?'}` +
            ` · reasoning ${usage.completion_tokens_details?.reasoning_tokens ?? 0}`,
        );
      }

      const raw = data?.choices?.[0]?.message?.content;
      if (typeof raw !== 'string') return [];

      // No confidence attached, deliberately: grounding decides what is real, so a
      // reading here is a QUERY, never an answer.
      return parseGuesses(raw).slice(0, MAX_BOOKS);
      };

      // Ask again only when the answer could genuinely differ next time. A retired model
      // or a revoked key answers the same forever, and repeating it wastes the wait twice
      // before delivering the one message that helps: go and fix your settings.
      for (let attempt = 1; ; attempt++) {
        try {
          return await once();
        } catch (err) {
          const worthRepeating = err instanceof VisionHttpError && !err.permanent;
          if (!worthRepeating || attempt >= ATTEMPTS) throw err;
          console.info(`[Buki] cover read failed (${err.message}); asking once more`);
          await sleep(BACKOFF_MS);
        }
      }
    },
  };
}
