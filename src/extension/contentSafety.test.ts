import { describe, it, expect } from 'vitest';
import content from './content.ts?raw';
import background from './background.ts?raw';

/**
 * THE RULES THAT HOLD BECAUSE THE TRAY RUNS IN SOMEBODY ELSE'S PAGE.
 *
 * `content.ts` cannot be imported by a test — it touches `document` at module scope — so
 * what is left is its source text. §5 already records at length that **a `?raw` guard
 * cannot see control flow**, and the 2026-08-24 review found three separate guards that
 * passed on a string surviving in a comment.
 *
 * So every assertion in this file is an ABSENCE, which is the one thing source text proves
 * cleanly: not "the safe call is somewhere in here" — a comment satisfies that — but "there
 * is no second way in". The behaviour itself is tested for real, against real events and
 * real URLs, in `realClick.test.ts`, `feedHost.test.ts` and `twitterImage.test.ts`. This
 * file only proves those seams are the ONLY seams.
 *
 * Each assertion below was mutation-tested when it was written: the unsafe form was put
 * back, and this file went red.
 */

/** Source with comments removed, so a rule can never be satisfied by prose about it. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const CONTENT = code(content);
const BACKGROUND = code(background);

describe('every click the tray acts on came from a person', () => {
  /**
   * `grep -rc isTrusted src/` returned ZERO until 2026-08-25, and the tray's buttons live
   * in the host page's DOM. `button.click()` from page script ran the whole pipeline: a
   * free catch spent, attacker text and images sent to the model on our key, and a
   * page-chosen URL persisted as the book's `shot` — which `cover.ts:49` then re-fetches
   * from the extension origin every time the popup opens, for ever.
   */

  it('binds no click listener of its own', () => {
    // The whole point of one seam. `onRealClick` is where `isTrusted` is checked, and a
    // second binding anywhere in this file is a door that check is not standing in.
    const bare = [...CONTENT.matchAll(/addEventListener\(\s*'click'/g)];
    expect(bare.length, 'a click listener bypasses onRealClick').toBe(0);
  });

  it('binds no click listener with a variable event name either', () => {
    // The obvious way round the rule above: `addEventListener(kind, …)`. There is no
    // reason for one in this file, so its absence is the assertion.
    const indirect = [...CONTENT.matchAll(/addEventListener\(\s*(?!'(?:error|click)')[A-Za-z_$]/g)];
    expect(indirect.length, 'a click listener may be hiding behind a variable').toBe(0);
  });

  it('still has its buttons wired', () => {
    // GUARDS THE VACUOUS PASS. Zero bare listeners is also what a file with no buttons at
    // all looks like — and a deleted listener is exactly the mutation that survived a green
    // suite for `theme.ts`, whose button rendered, focused, and did nothing.
    //
    // Greater-than, not equal: adding a control should not fail this, removing one must.
    const wired = [...CONTENT.matchAll(/onRealClick\(/g)];
    expect(wired.length, 'a control lost its click handler').toBeGreaterThanOrEqual(7);
  });
});

describe('the feed scanner arms only where there is a feed', () => {
  it('starts no timer or observer at module scope', () => {
    // Column 0 is module scope, which is every page `content.js` is ever injected into.
    // `optionsPage.test.ts` asserts the mirror image of this — that `wirePro()` IS at
    // column 0 — for the same reason: indentation is the one structural fact source text
    // can be trusted about.
    expect(/^setInterval\(/m.test(CONTENT), 'a timer runs on every page').toBe(false);
    expect(/^new MutationObserver\(/m.test(CONTENT), 'an observer runs on every page').toBe(
      false,
    );
    expect(/^scan\(/m.test(CONTENT), 'the feed is scanned on every page').toBe(false);
  });

  it('never calls the arming function unguarded', () => {
    // `if (armed) armFeedScan();` does not start at column 0. `armFeedScan();` does.
    expect(/^armFeedScan\(/m.test(CONTENT), 'the scanner arms unconditionally').toBe(false);
  });

  it('asks feedHost.ts the question rather than answering it inline', () => {
    // An import line is the one presence a `?raw` guard proves cleanly: a comment cannot
    // satisfy it, and the module it names is tested against the near-misses.
    expect(/^import \{[^}]*\bisFeedHost\b[^}]*\} from '\.\/feedHost';$/m.test(content)).toBe(true);
  });
});

describe('a picture is only a picture X served', () => {
  it('nowhere asks whether a URL CONTAINS the host', () => {
    // `src.includes('twimg.com/media')` passed `https://attacker.example/twimg.com/media/x.png`
    // for a year, while `bestQuality` in the sibling file already did the hostname check
    // three lines from where it was needed.
    expect(/\.includes\(\s*'[^']*twimg/.test(CONTENT), 'the substring filter is back').toBe(
      false,
    );
    expect(/\.includes\(\s*'[^']*twitter\.com/.test(CONTENT)).toBe(false);
  });

  it('hands the worker only what survived the filter', () => {
    // Asked twice on purpose: this message crosses a trust boundary, and a filter applied
    // only on the far side is one the attacker is standing next to.
    expect(/lookUp\(\s*msg\.tweet/.test(BACKGROUND), 'the worker trusts the page').toBe(false);
    expect(/^import \{[^}]*\bkeepTweetMedia\b[^}]*\} from '\.\/twitterImage';$/m.test(background)).toBe(
      true,
    );
  });
});

/**
 * THE WATCHDOG'S WIRING. `OPENWORK.md` item 49, R-3.
 *
 * `stalledJobs` and `STALL_MS` are proved in `catchTray.test.ts` with real values. What
 * cannot be proved there is that `content.ts` arms anything at all — and there is an
 * ordering trap in the one place it does.
 */
describe('a stuck card is armed with a watchdog', () => {
  const code = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

  it('arms it BEFORE the transient guard, which would otherwise skip every looking card', () => {
    // THE TRAP, and it is one line wide. `tick` continues on `!card.transient`, and a
    // `looking` card is precisely the one with `transient: false` — so an `armWatchdog`
    // call placed after that guard is never reached by the only state it exists for. The
    // code would read correctly and do nothing.
    const arm = code.indexOf('armWatchdog(card);');
    const guard = code.indexOf('if (!card.transient');
    expect(arm, 'nothing arms a watchdog').toBeGreaterThan(-1);
    expect(guard, 'the transient guard has moved; re-check this ordering').toBeGreaterThan(-1);
    expect(arm, 'the watchdog is armed after a guard that skips every looking card').toBeLessThan(
      guard,
    );
  });

  it('RE-ASKS at fire time rather than trusting the card it closed over', () => {
    // A catch that answered between arming and firing must not be failed by its own
    // watchdog. The timer holds a card from 90 seconds ago; the tray holds the truth.
    expect(code).toMatch(/stalledJobs\(tray\.list\(\), Date\.now\(\)\)/);
  });

  it('disarms on any state that is no longer looking, not merely on the card vanishing', () => {
    // The sweep has to include `state === 'looking'`. Clearing only when the card is GONE
    // leaves a live timer on every answered catch, and each one wakes up 90 seconds later
    // to ask a question it can no longer act on.
    expect(code).toMatch(/watching\)\s*\{[\s\S]{0,160}?c\.state === 'looking'/);
  });
});
