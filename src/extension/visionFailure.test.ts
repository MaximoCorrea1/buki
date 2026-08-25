import { describe, it, expect } from 'vitest';
import { readVisionFailure, needsSetup, NoKeyError } from './visionFailure';
import { VisionHttpError } from '../recognizer/llmVision';

/**
 * THE TWO STATUSES THAT TOLD PEOPLE A LIE.
 *
 * `background.ts` classified every permanent failure as "your setup is broken", and
 * `permanent` is `status < 500 && status !== 429 && status !== 408`. So a 401 (our session
 * expired) and a 402 (we paused the trial ourselves) both produced *"Recognition needs
 * setting up"* — to a reader who has no setup, on our own proxy, about something they
 * cannot influence.
 *
 * The review filed these as AC-3 and AC-7. They are one predicate, which is why they are one
 * module and one commit.
 */

const proxy = { ownKey: false };
const own = { ownKey: true };

const http = (status: number, message = `Recognition service failed (HTTP ${status})`) =>
  new VisionHttpError(status, message);

describe('a session that is no longer honoured', () => {
  it('asks for a re-exchange rather than blaming the reader', () => {
    // AC-3. 401 is the ONE status that names an action which can fix this, and
    // `policy.ts:51` and `visionHandler.ts:63` both say so in prose. `grep 401
    // src/extension/` found two comments and zero handlers.
    const failure = readVisionFailure(http(401), proxy);
    expect(failure.act).toBe('session');
    expect(needsSetup(failure), 'told a keyless reader to fix their settings').toBe(false);
  });

  it('does not tell them it is permanent, because it is not', () => {
    const failure = readVisionFailure(http(401), proxy);
    expect(failure.message).not.toMatch(/setting up|settings/i);
    expect(failure.message).toMatch(/try/i);
  });

  it('IS a setup problem when the key is the reader’s own', () => {
    // Their credential, their provider. A 401 there means the key is wrong or revoked, and
    // settings is exactly where that is fixed.
    expect(readVisionFailure(http(401), own).act).toBe('setup');
  });
});

describe('the trial kill switch', () => {
  it('does not tell a trial user their setup is broken', () => {
    // AC-7. `BUKI_TRIAL_CLOSED=1` is one of only three pre-launch incident levers, and a
    // lever that lies to every trial user the moment it is pulled is a lever nobody pulls.
    const failure = readVisionFailure(http(402), proxy);
    expect(failure.act).toBe('closed');
    expect(needsSetup(failure)).toBe(false);
  });

  it('says what still works, because most of it does', () => {
    // Shop-link catches, the shelf, the piles and anyone with their own key are all
    // untouched by the switch. A message that implies the product is down is a worse lie
    // than the one it replaced.
    expect(readVisionFailure(http(402), proxy).message).toMatch(/shelf|shop/i);
  });
});

describe('our own endpoint refusing us', () => {
  it('never reads as the reader’s setup, whatever the status', () => {
    // A keyless reader configured nothing: they installed the extension. So a 400, a 403 or
    // a 404 from our own proxy is our bug, our deploy or our extension id.
    for (const status of [400, 403, 404, 413]) {
      const failure = readVisionFailure(http(status), proxy);
      expect(failure.act, `${status}`).toBe('ours');
      expect(needsSetup(failure), `${status} blamed the reader`).toBe(false);
    }
  });

  it('says so plainly rather than showing a status code', () => {
    expect(readVisionFailure(http(403), proxy).message).toMatch(/nothing is wrong on your side/i);
  });
});

describe('what has always been true and must stay true', () => {
  it('a missing key IS a setup problem', () => {
    const failure = readVisionFailure(new NoKeyError('no key'), proxy);
    expect(failure.act).toBe('setup');
    expect(needsSetup(failure)).toBe(true);
    expect(failure.message).toMatch(/settings/i);
  });

  it('a retired model on the reader’s OWN provider is a setup problem, with its words', () => {
    // Google answers a bad model with the exact name it could not find, which turns a
    // guessing game into a one-line fix. That message must survive.
    const failure = readVisionFailure(
      http(404, 'Recognition service failed (HTTP 404) - models/gemini-1.0-pro is not found'),
      own,
    );
    expect(failure.act).toBe('setup');
    expect(failure.message).toContain('gemini-1.0-pro');
  });

  it('a bad minute is transient on either path, and keeps the provider’s words', () => {
    for (const ctx of [proxy, own]) {
      for (const status of [429, 408, 500, 502, 503]) {
        const failure = readVisionFailure(http(status), ctx);
        expect(failure.act, `${status} ownKey=${ctx.ownKey}`).toBe('transient');
      }
    }
    expect(readVisionFailure(http(429, 'slow down please'), proxy).message).toContain(
      'slow down please',
    );
  });

  it('anything that is not an HTTP failure is transient, and never a diagnosis', () => {
    // A network drop, a bug, an aborted catch. Offering a diagnosis for something we have
    // not diagnosed is how "Recognition needs setting up" ended up in front of people whose
    // setup was fine.
    const failure = readVisionFailure(new TypeError('Failed to fetch'), proxy);
    expect(failure.act).toBe('transient');
    expect(needsSetup(failure)).toBe(false);
  });
});

describe('needsSetup', () => {
  it('is true for exactly one of the five outcomes', () => {
    // GUARDS THE VACUOUS PASS. The predicate used to be true for four of these, and the
    // whole fix is that it is now true for one. Enumerated so that adding a sixth outcome
    // without deciding its answer fails here.
    const outcomes = [
      readVisionFailure(new NoKeyError('no key'), proxy),
      readVisionFailure(http(401), proxy),
      readVisionFailure(http(402), proxy),
      readVisionFailure(http(403), proxy),
      readVisionFailure(http(503), proxy),
    ];
    expect(outcomes.map((o) => o.act)).toEqual([
      'setup',
      'session',
      'closed',
      'ours',
      'transient',
    ]);
    expect(outcomes.filter(needsSetup)).toHaveLength(1);
  });
});
