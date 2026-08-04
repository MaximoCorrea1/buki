import { describe, it, expect } from 'vitest';
import { createBreaker, COOLDOWN_MS, TOLERANCE } from './breaker';

/** A clock the test drives, so cooldowns are asserted rather than waited out. */
function at(start = 0) {
  let now = start;
  return { now: () => now, tick: (ms: number) => (now += ms) };
}

describe('createBreaker', () => {
  it('lets the first request through', () => {
    expect(createBreaker(at()).ready()).toBe(true);
  });

  it('keeps trying while failures are still occasional', () => {
    // One timeout is a blip. Refusing to ask again after a single miss would turn every
    // hiccup into a shelf full of unverified books.
    const breaker = createBreaker(at());
    breaker.failed();

    expect(breaker.ready()).toBe(true);
  });

  it('stops asking a catalogue that has stopped answering', () => {
    // Measured 2026-08-04: OpenLibrary's search index failed EVERY query for hours. Six
    // seconds of waiting, per catch, to be told the same thing each time.
    const breaker = createBreaker(at());
    for (let i = 0; i < TOLERANCE; i++) breaker.failed();

    expect(breaker.ready()).toBe(false);
  });

  it('forgets a run of failures as soon as one request succeeds', () => {
    const clock = at();
    const breaker = createBreaker(clock);
    for (let i = 0; i < TOLERANCE - 1; i++) breaker.failed();

    breaker.ok();
    breaker.failed();

    expect(breaker.ready()).toBe(true);
  });

  it('tries again once the cooldown has passed', () => {
    // An outage that is over has to be noticed without anyone restarting anything.
    const clock = at();
    const breaker = createBreaker(clock);
    for (let i = 0; i < TOLERANCE; i++) breaker.failed();

    clock.tick(COOLDOWN_MS + 1);

    expect(breaker.ready()).toBe(true);
  });

  it('waits out another cooldown when the probe fails too', () => {
    // The one request let through after a cooldown is a PROBE. If it fails, the outage
    // is still on, and the next catch must not pay six seconds to rediscover that.
    const clock = at();
    const breaker = createBreaker(clock);
    for (let i = 0; i < TOLERANCE; i++) breaker.failed();
    clock.tick(COOLDOWN_MS + 1);
    expect(breaker.ready()).toBe(true);

    breaker.failed();

    expect(breaker.ready()).toBe(false);
  });

  it('reopens for good when the probe succeeds', () => {
    const clock = at();
    const breaker = createBreaker(clock);
    for (let i = 0; i < TOLERANCE; i++) breaker.failed();
    clock.tick(COOLDOWN_MS + 1);

    breaker.ok();

    expect(breaker.ready()).toBe(true);
    breaker.failed();
    expect(breaker.ready()).toBe(true); // the count started over, it is not one from open
  });
});
