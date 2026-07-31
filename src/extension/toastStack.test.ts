import { describe, it, expect } from 'vitest';
import { createToastStack } from './toastStack';

const texts = (s: { list(): { text: string }[] }): string[] => s.list().map((p) => p.text);

describe('toastStack', () => {
  it('gives two books recognized at once their own progress pill each', () => {
    // The bug: `stage` was one module-level variable for the whole page, so the second
    // book's progress overwrote the first's. Both said "Looking up the book..." so the
    // screen appeared frozen while two lookups ran.
    const stack = createToastStack();

    stack.stage('book-a', 'Looking up the book…');
    stack.stage('book-b', 'Looking up the book…');

    expect(stack.list()).toHaveLength(2);
  });

  it('updates a book\'s own progress pill rather than adding another', () => {
    const stack = createToastStack();

    stack.stage('book-a', 'Looking up the book…');
    stack.stage('book-a', 'Reading the cover…');

    expect(texts(stack)).toEqual(['Reading the cover…']);
  });

  it('routes a progress update to the right book when two are in flight', () => {
    const stack = createToastStack();

    stack.stage('book-a', 'Looking up A…');
    stack.stage('book-b', 'Looking up B…');
    stack.stage('book-a', 'Reading A\'s cover…');

    expect(texts(stack)).toEqual(['Reading A\'s cover…', 'Looking up B…']);
  });

  it('leaves the other book\'s progress alone when one finishes', () => {
    // The second half of the same bug: finishing dismissed whatever `stage` pointed at,
    // which by then belonged to the book still running. It lost its indicator entirely.
    const stack = createToastStack();
    stack.stage('book-a', 'Looking up A…');
    stack.stage('book-b', 'Looking up B…');

    stack.done('book-a', 'Found 2');

    expect(texts(stack)).toContain('Looking up B…');
  });

  it('clears a book\'s progress pill when that book finishes', () => {
    const stack = createToastStack();
    stack.stage('book-a', 'Looking up A…');

    stack.done('book-a', 'Found 2');

    expect(texts(stack)).toEqual(['Found 2']);
  });

  it('keeps several confirmations instead of collapsing them into one', () => {
    // "Saved: X" three times in a row must read as three saves, not one.
    const stack = createToastStack();

    stack.done('a', 'Saved: Dune');
    stack.done('b', 'Saved: Ubik');

    expect(texts(stack)).toEqual(['Saved: Dune', 'Saved: Ubik']);
  });

  it('drops the stalest message once the corner is full', () => {
    const stack = createToastStack(3);

    stack.done(null, 'one');
    stack.done(null, 'two');
    stack.done(null, 'three');
    stack.done(null, 'four');

    expect(texts(stack)).toEqual(['two', 'three', 'four']);
  });

  it('sacrifices a finished message before a book that is still working', () => {
    // Trimming by age alone would drop a live progress pill and leave a stale
    // confirmation sitting there - the user would watch the book they are waiting on
    // vanish while "Saved: something else" stayed.
    const stack = createToastStack(2);
    stack.stage('slow', 'Looking up the book…');
    stack.done(null, 'Saved: Dune');

    stack.done(null, 'Saved: Ubik');

    expect(texts(stack)).toEqual(['Looking up the book…', 'Saved: Ubik']);
  });

  it('forgets a dismissed pill', () => {
    const stack = createToastStack();
    stack.done(null, 'gone soon');
    const [pill] = stack.list();

    stack.dismiss(pill!.id);

    expect(stack.list()).toEqual([]);
  });

  it('gives every pill a distinct id so the renderer can tell them apart', () => {
    const stack = createToastStack();

    stack.stage('a', 'A');
    stack.done(null, 'B');

    const ids = stack.list().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
