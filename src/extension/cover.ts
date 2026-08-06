import type { SavedBook } from './storage';
import { bindingFor, titleStep, weaveOf } from './generatedCover';
import { cachedCover, rememberCover, type CoverDeps } from './coverCache';
import { coverSources } from './coverSource';

/**
 * A cover, face out.
 *
 * Real art when the catalogue has any, and a board Buki draws when it does not - which
 * is a large share of books, and was ALL of them for several hours on 2026-08-04 when
 * OpenLibrary stopped answering at all. A face-out shelf where a third of the covers are
 * missing looks broken, so the drawn board is not a fallback so much as the other half
 * of the design.
 */

/**
 * Cells across and down the board, deliberately more than a 118 x 177 cover needs.
 *
 * A mono glyph's advance is about 0.6em, not 1em, so counting cells as if they were
 * square left the cloth covering the left 72px of the board and nothing else. The CSS
 * pins the advance to 5px with `letter-spacing`, but font metrics differ per platform
 * and being short is a visible bug while overflowing is free: the board clips.
 */
const WEAVE_COLS = 26;
const WEAVE_ROWS = 36;

/**
 * Object URLs minted this session, reused across repaints. The search box repaints on
 * every keystroke, so a fresh one per draw would leak one per character typed. The popup
 * being torn down when it closes is what finally releases them.
 */
const localSrc = new Map<string, string>();

/**
 * Draw from the local copy if we have it, otherwise the network, and keep what comes
 * back. See coverCache.ts: the network path is a three-hop redirect that measured 1-4
 * seconds per cover.
 */
async function applyCover(
  img: HTMLImageElement,
  url: string,
  covers: CoverDeps,
): Promise<void> {
  const already = localSrc.get(url);
  if (already) {
    img.src = already;
    return;
  }
  const blob = await cachedCover(url, covers);
  if (!blob) {
    img.src = url;
    void rememberCover(url, covers);
    return;
  }
  const objectUrl = URL.createObjectURL(blob);
  localSrc.set(url, objectUrl);
  img.src = objectUrl;
}

/**
 * The board Buki draws: a deep binding, two stamped rules, the book's own cloth, and the
 * title. What a book looks like once its jacket is gone, which is a real object - so it
 * cannot read as art that failed to load.
 */
export function drawnCover(saved: SavedBook): HTMLElement {
  const board = document.createElement('div');
  board.className = 'board';
  board.style.setProperty('--binding', bindingFor(saved.book));

  // aria-hidden: this is the cloth, not content. A screen reader announcing three
  // hundred block characters would bury the title sitting on top of them.
  const cloth = document.createElement('pre');
  cloth.className = 'cloth';
  cloth.setAttribute('aria-hidden', 'true');
  cloth.textContent = weaveOf(saved.book, WEAVE_COLS, WEAVE_ROWS).join('\n');

  const rules = document.createElement('div');
  rules.className = 'rules';

  const title = document.createElement('div');
  title.className = `stamp ${titleStep(saved.book.title)}`;
  title.textContent = saved.book.title;

  board.append(cloth, rules, title);
  return board;
}

/**
 * The cover for one book: the picture it was caught from, then the catalogue's art, then
 * the board we draw.
 *
 * Each source falls through to the next ON ERROR rather than being chosen once up front,
 * because a URL that resolves today can 404 tomorrow - a deleted post takes its picture
 * with it. Walking the list means the shelf degrades a step at a time instead of showing
 * a broken-image glyph, which is the one outcome that reads as the extension being
 * broken rather than the internet being the internet.
 */
export function coverFor(saved: SavedBook, covers: CoverDeps): HTMLElement {
  const sources = coverSources(saved);
  if (!sources.length) return drawnCover(saved);

  const img = document.createElement('img');
  img.className = 'art';
  img.alt = '';
  img.loading = 'lazy'; // a hundred books must not fire a hundred requests at once

  let next = 0;
  const tryNext = (): void => {
    const url = sources[next++];
    if (!url) {
      img.replaceWith(drawnCover(saved));
      return;
    }
    void applyCover(img, url, covers);
  };
  img.addEventListener('error', tryNext);
  tryNext();
  return img;
}
