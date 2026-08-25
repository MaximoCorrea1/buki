/**
 * What actually reaches Gemini — REBUILT, never relayed.
 *
 * `visionHandler.ts` used to be `body: await request.text()`, and that one line was the
 * entire body handling on the only code path in this product that spends money. The caller
 * therefore chose the model, the token budget and the number of completions, all billed to
 * `GEMINI_API_KEY`. Measured against Google's published pricing: an honest catch costs
 * $0.000135 and a crafted one ~$3.46. A 25,000x ratio, and every cost control in the
 * system — `TRIAL_PER_IP_PER_DAY`, the kill switch, whatever ceiling the provider cap is
 * set to — was priced against the first number.
 *
 * THE APPROACH IS A REBUILD, NOT A SANITISE, and the difference is the whole design. A
 * sanitiser has to enumerate what is dangerous and is wrong the day the provider adds a
 * field. This builds the upstream request from the two things we actually need — the
 * prompt and the pictures — and everything else the caller sent simply has nowhere to go.
 * The allowlist is the object literal at the bottom of this file, and
 * `visionBody.test.ts` asserts its complement: any key not named there is a field somebody
 * added without deciding it was safe to forward.
 *
 * SERVER-SIDE ONLY, deliberately. `background.ts:164` has a matching client bug — its
 * `model: route.model || settings.model` puts the user's free-text model back on the proxy
 * path under a comment claiming it only does so "when we are talking to a provider
 * directly", and the `||` never checks the endpoint. Correcting that closes the path
 * through our own UI and NOT the vulnerability: the client is not the thing being
 * defended, because an attacker does not use it.
 */

/**
 * The alias, pinned HERE and nowhere else.
 *
 * The same string is `GEMINI.model` in `llmVision.ts`, and the two are deliberately NOT
 * imported from one place. That constant is the default for a user spending their OWN key
 * against Google directly; this one is what Buki pays for. They agree today and they are
 * allowed to diverge, and coupling them would let a client edit change what the server
 * buys.
 *
 * An ALIAS rather than a pinned version, for the reason `llmVision.ts` records at length:
 * two pinned models were found retired inside one afternoon, and a pinned default keeps
 * working for whoever pinned it while 404ing for every new user. Not an environment
 * variable either — `launch.md` already hands six of those across by hand and a seventh
 * that silently defaults would be a seventh way to ship half-configured.
 */
export const PINNED_MODEL = 'gemini-flash-lite-latest';

/**
 * The largest request that can possibly be a catch.
 *
 * Four pictures is X's own attachment limit and `inlineImage.ts` shrinks each to one 768px
 * tile at JPEG q0.82 — 55-138KB measured, so ~73-184KB once base64 grows it by a third.
 * Four of the largest is ~736KB, so this is roughly double the worst honest case.
 */
export const MAX_BODY_BYTES = 1_500_000;

/** X allows four attachments, and `llmVision.MAX_IMAGES` already slices to four. */
export const MAX_IMAGE_PARTS = 4;

/**
 * The prompt ceiling.
 *
 * `llmVision.ts` sends its instruction (~700 characters) plus at most 600 characters of
 * post text, so an honest prompt is around 1,300. Four thousand is generous enough that a
 * rewritten instruction does not silently lose its tail, and small enough that the input
 * side of the bill cannot be chosen by the caller: 4,000 characters is roughly 1,000
 * tokens, against the million-token request the review priced at $2.50 of input alone.
 *
 * Truncated rather than refused, because a refusal on this path is a lost catch. The
 * seam test in `visionBody.test.ts` is what stops the truncation being silent: it builds
 * a real client body and fails if the instruction no longer fits.
 */
export const MAX_TEXT_CHARS = 4_000;

/**
 * The output ceiling, and it is NOT as tight as it could be, on purpose.
 *
 * Twenty books is `MAX_BOOKS`, and twenty `{"title","author"}` entries is roughly 400
 * tokens, so a few hundred would truncate a real answer into invalid JSON that
 * `parseGuesses` reads as "no books found" — the silent failure this codebase keeps
 * producing. Worse, `max_tokens` maps to Gemini's `maxOutputTokens`, which on a thinking
 * model is a COMBINED budget for reasoning and output; the pinned alias does not think
 * today, and `llmVision.ts` already records that an alias can be repointed at one that
 * does. So the number carries about 5x headroom over the largest honest answer and still
 * takes 64,000 tokens of attacker-chosen output down to 2,048.
 */
export const MAX_OUTPUT_TOKENS = 2_048;

export type Rebuild =
  | { ok: true; body: string }
  | { ok: false; status: 400 | 413; message: string };

type TextPart = { type: 'text'; text: string };
type ImagePart = { type: 'image_url'; image_url: { url: string } };
type Part = TextPart | ImagePart;

const refuse = (status: 400 | 413, message: string): Rebuild => ({ ok: false, status, message });

/**
 * A picture we are willing to hand the provider.
 *
 * `data:` is what `inlineImage.ts` produces. `https:` is its documented fallback: a picture
 * that cannot be fetched is sent as a link instead, under a comment saying a picture must
 * never be able to fail a catch. Everything else is refused — not because it is likely,
 * but because relaying an arbitrary scheme makes our metered credential a fetcher for
 * whatever the caller names, `http://169.254.169.254/` included.
 */
function usableImage(url: string): boolean {
  if (url.startsWith('data:image/')) return true;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** The one text and up to four pictures, in that order, from whatever the caller sent. */
function partsFrom(content: unknown): Part[] {
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content.slice(0, MAX_TEXT_CHARS) }] : [];
  }
  if (!Array.isArray(content)) return [];

  let text: string | null = null;
  const images: ImagePart[] = [];

  for (const raw of content) {
    if (!raw || typeof raw !== 'object') continue;
    const part = raw as { type?: unknown; text?: unknown; image_url?: { url?: unknown } };

    // ONE text part, the first. Capping each part instead of the total is the obvious
    // mistake: fifty parts of the maximum length is fifty times the cap.
    if (part.type === 'text' && typeof part.text === 'string') {
      if (text === null) text = part.text.slice(0, MAX_TEXT_CHARS);
      continue;
    }

    if (part.type === 'image_url' && images.length < MAX_IMAGE_PARTS) {
      const url = part.image_url?.url;
      if (typeof url === 'string' && usableImage(url)) {
        images.push({ type: 'image_url', image_url: { url } });
      }
    }
    // Audio, files, anything a future provider adds: dropped. This reader knows two shapes.
  }

  return [...(text === null ? [] : [{ type: 'text' as const, text }]), ...images];
}

/**
 * The caller's request in, ours out.
 *
 * Returns the exact string to put on the wire, or the status to answer with. It never
 * throws: this runs on the money path and an exception here would read to the extension
 * as a provider outage.
 */
export function rebuildVisionBody(raw: string): Rebuild {
  // Cheap reject first. UTF-8 is never fewer bytes than characters, so a string longer
  // than the cap is over it without measuring; the encode below then bounds the honest
  // case rather than every case.
  if (raw.length > MAX_BODY_BYTES) return refuse(413, 'That request is too large to read.');
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return refuse(413, 'That request is too large to read.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return refuse(400, 'Buki could not read that request.');
  }

  const messages = (parsed as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return refuse(400, 'Buki could not read that request.');
  }

  // The FIRST message only. `llmVision.ts` sends exactly one and always has, so a second
  // is either a bug or a second prompt somebody wants us to pay for. A system message is
  // refused for the same reason: it is a prompt surface we do not use.
  const first = messages[0] as { role?: unknown; content?: unknown } | null;
  if (!first || typeof first !== 'object' || first.role !== 'user') {
    return refuse(400, 'Buki could not read that request.');
  }

  const content = partsFrom(first.content);
  if (content.length === 0) return refuse(400, 'Buki could not read that request.');

  // THE ALLOWLIST. Three keys, and `visionBody.test.ts` asserts there are exactly three:
  // every other field the caller sent — `n`, `stream`, `service_tier`, `response_format`,
  // `reasoning_effort`, `extra_body`, `tools` — has nowhere to go because nothing here
  // copies it.
  return {
    ok: true,
    body: JSON.stringify({
      model: PINNED_MODEL,
      messages: [{ role: 'user', content }],
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  };
}
