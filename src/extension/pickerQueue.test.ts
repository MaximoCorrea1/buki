import { describe, it, expect } from 'vitest';
import { createPickerQueue } from './pickerQueue';

describe('pickerQueue', () => {
  it('does not throw away the first book when a second is recognized', () => {
    // The bug that lost books: openPicker() called closePanel() unconditionally, and the
    // 📚 flow can ONLY save through a picker. Catching a second book before choosing an
    // intent for the first destroyed the first panel, so that book was never saved - and
    // its cleanup logged it as "dismissed", corrupting the kept rate with a decision the
    // user never made.
    const queue = createPickerQueue<string>();

    queue.push('Dune');
    queue.push('Ubik');

    expect(queue.current()).toBe('Dune');
    expect(queue.waiting()).toBe(1);
  });

  it('opens the next book once the open one is settled', () => {
    const queue = createPickerQueue<string>();
    queue.push('Dune');
    queue.push('Ubik');

    queue.settle();

    expect(queue.current()).toBe('Ubik');
    expect(queue.waiting()).toBe(0);
  });

  it('leaves nothing open after the last book is settled', () => {
    const queue = createPickerQueue<string>();
    queue.push('Dune');

    queue.settle();

    expect(queue.current()).toBeNull();
  });

  it('counts only the books still queued, not the one on screen', () => {
    const queue = createPickerQueue<string>();

    queue.push('Dune');

    expect(queue.waiting()).toBe(0);
  });

  it('settling an empty queue is harmless', () => {
    const queue = createPickerQueue<string>();

    queue.settle();

    expect(queue.current()).toBeNull();
    expect(queue.waiting()).toBe(0);
  });

  it('drops everything when the page gives up on the whole queue', () => {
    // An orphaned content script must not keep offering pickers it can no longer save
    // through.
    const queue = createPickerQueue<string>();
    queue.push('Dune');
    queue.push('Ubik');

    const abandoned = queue.clear();

    expect(abandoned).toEqual(['Dune', 'Ubik']);
    expect(queue.current()).toBeNull();
  });
});
