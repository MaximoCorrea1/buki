import { describe, it, expect } from 'vitest';
import { readLog } from './storedLog';

/**
 * TS-2, the other half. `OPENWORK.md` item 53. Same one-line cast as the shelf:
 *
 *     return Array.isArray(raw) ? (raw as RecognitionEvent[]) : [];
 *
 * **What this one feeds is arithmetic.** The options page divides these events to show a
 * kept rate and a latency figure, and `MIN_FOR_RATE` exists because a percentage over too
 * few catches is noise. **A single `ms: NaN` in storage poisons a mean into `NaN`**, and a
 * row with a made-up `outcome` is counted in the denominator and in no numerator — so the
 * number moves for a reason nothing on screen explains.
 *
 * That is quieter than the shelf's harm and the same class: **a cast is not a check, and the
 * store is user-editable.**
 */

const good = {
  at: 1_700_000_000_000,
  ms: 1200,
  flow: 'button',
  source: 'vision',
  confidence: 'high',
  outcome: 'confirmed',
};

describe('reading the recognition log out of storage', () => {
  it('keeps a well-formed event', () => {
    expect(readLog([good])).toEqual([good]);
  });

  it('keeps the optional fields when they are the right shape', () => {
    const full = {
      ...good,
      model: 'gemini-flash-lite-latest',
      guess: { title: 'Dune', author: 'Frank Herbert' },
      savedId: 'a1',
      wrong: true,
    };
    expect(readLog([full])).toEqual([full]);
  });

  it('answers an empty log for anything that is not an array', () => {
    for (const raw of [null, undefined, {}, 'events', 42]) {
      expect(readLog(raw), String(raw)).toEqual([]);
    }
  });

  it('drops an event whose timing is not a finite number', () => {
    // THE ARITHMETIC ONE. A NaN here makes every mean NaN, and the options page shows it.
    for (const ms of [Number.NaN, Infinity, '1200', null, undefined]) {
      expect(readLog([{ ...good, ms }]), String(ms)).toEqual([]);
    }
    for (const at of [Number.NaN, 'yesterday', null]) {
      expect(readLog([{ ...good, at }]), String(at)).toEqual([]);
    }
  });

  it('drops an event whose outcome is invented, which would skew the denominator', () => {
    for (const outcome of ['kept', '', undefined, 42]) {
      expect(readLog([{ ...good, outcome }]), String(outcome)).toEqual([]);
    }
  });

  it('drops an event whose flow, source or confidence is not one of ours', () => {
    expect(readLog([{ ...good, flow: 'telepathy' }])).toEqual([]);
    expect(readLog([{ ...good, source: 'guessing' }])).toEqual([]);
    expect(readLog([{ ...good, confidence: 'very' }])).toEqual([]);
  });

  it('drops ONE bad event and keeps the rest, so a history is not lost to a typo', () => {
    const log = readLog([good, { ...good, ms: Number.NaN }, { ...good, at: 2 }]);
    expect(log.map((e) => e.at)).toEqual([good.at, 2]);
  });

  it('strips a malformed optional rather than dropping the event', () => {
    const [kept] = readLog([{ ...good, model: 42, guess: 'Dune', savedId: {}, wrong: 'yes' }]);

    expect(kept?.outcome).toBe('confirmed');
    expect(kept).not.toHaveProperty('model');
    expect(kept).not.toHaveProperty('guess');
    expect(kept).not.toHaveProperty('savedId');
    expect(kept).not.toHaveProperty('wrong');
  });

  it('OMITS optional fields rather than writing them as undefined', () => {
    const [kept] = readLog([good]);
    expect('model' in (kept ?? {})).toBe(false);
    expect('wrong' in (kept ?? {})).toBe(false);
  });
});
