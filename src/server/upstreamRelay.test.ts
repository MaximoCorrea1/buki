import { describe, it, expect } from 'vitest';
import { MAX_ERROR_CHARS, MAX_RELAY_BYTES, relayBody } from './upstreamRelay';

/**
 * AC-9 / TM-6. `OPENWORK.md` item 51.
 *
 * `/api/vision` relayed `await upstream.text()` **verbatim, with no redaction and no length
 * cap**, while `/api/license` has always scrubbed and truncated the same class of data:
 *
 *     detail.split(env.polarToken).join('[redacted]').slice(0, 300)
 *
 * **The endpoint holding the money-spending credential was the one without the scrub.** Two
 * sibling handlers, one rule, applied in one of them — the same shape §5 already records as
 * *"when one handler has a guard, ask what the other one has."*
 *
 * A provider echoing request context into an error body is not exotic; it is the ordinary
 * behaviour of an API that quotes what it received. Quoting an upstream body verbatim is a
 * common way for a server to publish the token it just used.
 */

const KEY = 'PROVIDER-KEY-SECRET';

describe('relaying an upstream body', () => {
  it('scrubs our credential out of a body that echoed it back', () => {
    const out = relayBody(`{"error":{"message":"bad key ${KEY}"}}`, 401, KEY);

    expect(out.ok).toBe(true);
    expect(out.ok && out.body).not.toContain(KEY);
    expect(out.ok && out.body).toContain('[redacted]');
  });

  it('scrubs a SUCCESS body too, not only a failure', () => {
    // A 200 carrying our key would be a provider bug rather than an attack, and it costs
    // one pass over a string we already hold. The cheap half of a guard is not the half to
    // skip: a rule with an exception is a rule somebody will widen.
    const out = relayBody(`{"choices":[{"message":{"content":"${KEY}"}}]}`, 200, KEY);

    expect(out.ok && out.body).not.toContain(KEY);
  });

  it('scrubs EVERY occurrence, not just the first', () => {
    const out = relayBody(`${KEY} and again ${KEY}`, 500, KEY);
    expect(out.ok && out.body).not.toContain(KEY);
  });

  /**
   * ⚠ THE TRAP IN THE SCRUB ITSELF.
   *
   * `text.split(secret).join('[redacted]')` is the shape `licenseHandler` already uses, and
   * with an EMPTY secret `split('')` splits the string into single characters — so the body
   * comes back with `[redacted]` between every letter. `licenseHandler` is safe only because
   * it refuses to run at all with an empty credential, thirty lines earlier and in a
   * different function. **That is safety by distance.**
   */
  it('does not shred the body when the secret is empty', () => {
    const body = '{"choices":[]}';
    const out = relayBody(body, 200, '');

    expect(out.ok).toBe(true);
    expect(out.ok && out.body).toBe(body);
    expect(out.ok && out.body).not.toContain('[redacted]');
  });

  it('caps an error body, because it is diagnostics rather than data', () => {
    const huge = `{"error":{"message":"${'x'.repeat(50_000)}"}}`;
    const out = relayBody(huge, 500, KEY);

    expect(out.ok).toBe(true);
    expect((out.ok && out.body.length) || 0).toBeLessThanOrEqual(MAX_ERROR_CHARS);
  });

  it('leaves a real error message intact, because the client reads it to the reader', () => {
    // `llmVision.explain` pulls `error.message` and slices it to 300. A cap that cut a
    // normal provider error into unparseable JSON would replace a useful sentence with a
    // bare status code - fixing a leak by breaking the error path.
    const real = '{"error":{"message":"You exceeded your current quota. Retry after 30s."}}';
    const out = relayBody(real, 429, KEY);

    expect(out.ok && out.body).toBe(real);
    expect(JSON.parse((out.ok && out.body) || '{}')).toHaveProperty('error.message');
  });

  /**
   * A SUCCESS BODY IS REFUSED RATHER THAN TRUNCATED, and the reason is AC-6 sitting next
   * door. `llmVision` does `typeof raw !== 'string' → return []`, so a truncated success
   * body fails `JSON.parse`, becomes no-books-found, and the reader is told the picture had
   * no book in it. **Truncating here would manufacture exactly the silent-wrong-answer this
   * item exists to remove.** Refusing says what happened.
   */
  it('refuses an oversized SUCCESS body instead of truncating it into a silent lie', () => {
    const huge = `{"choices":[{"message":{"content":"${'x'.repeat(MAX_RELAY_BYTES)}"}}]}`;
    const out = relayBody(huge, 200, KEY);

    expect(out.ok).toBe(false);
    expect(!out.ok && out.message).toMatch(/too (large|long|much)|more than/i);
  });

  it('measures BYTES, not characters, because that is what crossed the wire', () => {
    // One emoji is four bytes and one `.length` of two. A ceiling counted in characters
    // lets a body more than twice the intended size through.
    const under = '🙂'.repeat(Math.floor(MAX_RELAY_BYTES / 4) - 10);
    const over = '🙂'.repeat(Math.floor(MAX_RELAY_BYTES / 4) + 10);

    expect(relayBody(under, 200, KEY).ok).toBe(true);
    expect(relayBody(over, 200, KEY).ok).toBe(false);
  });

  it('lets an ordinary answer straight through', () => {
    const answer = '{"choices":[{"message":{"content":"{\\"books\\":[]}"}}]}';
    expect(relayBody(answer, 200, KEY)).toEqual({ ok: true, body: answer });
  });

  it('keeps the ceilings in the order the design needs', () => {
    // An error cap ABOVE the relay ceiling would mean a huge error body is refused as a
    // success would be, losing the status the client falls back to.
    expect(MAX_ERROR_CHARS).toBeLessThan(MAX_RELAY_BYTES);
  });
});
