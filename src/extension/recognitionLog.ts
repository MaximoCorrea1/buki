import type { Confidence, RecognitionSource } from '../recognizer/types';
import type { StorageArea } from './storage';
import { createWriteQueue } from './writeQueue';

/**
 * One record per recognition attempt. Local only, never transmitted: this exists so the
 * recognizer can be judged on real use instead of on how it feels, and grading a week of
 * catches by hand is exactly the kind of homework that stops getting done.
 */
export interface RecognitionEvent {
  at: number;
  /** Wall-clock cost of the whole attempt. Without this the latency bar is unmeasurable. */
  ms: number;
  flow: 'button' | 'contextmenu';
  source: RecognitionSource;
  confidence: Confidence;
  /**
   * Which model answered. The default is an alias that can be repointed without notice,
   * so without this a drop in the kept rate is indistinguishable from Google swapping
   * the model underneath it.
   */
  model?: string;
  guess?: { title: string; author: string };
  outcome: 'auto-saved' | 'confirmed' | 'dismissed' | 'no-match';
  /** Links this attempt to its `SavedBook`, so a later delete can mark it wrong. */
  savedId?: string;
  wrong?: boolean;
}

/** An event minus what only the log knows (when it landed) or infers later (`wrong`). */
export type PendingEvent = Omit<RecognitionEvent, 'at' | 'wrong'>;

/**
 * The evidence half of an event, carried between contexts while the user decides.
 * The background stamps this and hands it to whoever finishes the attempt, so a pending
 * attempt never lives in the worker's memory - service workers are terminated after
 * ~30s idle, which would lose every event whose picker stayed open.
 */
export type AttemptDraft = Omit<PendingEvent, 'outcome' | 'savedId'>;

const KEY = 'recognitionLog';

/**
 * A ring buffer, not a journal. An unbounded log in `chrome.storage.local` is a slow
 * quota failure, and 200 attempts is already several weeks of normal use.
 */
export const MAX_EVENTS = 200;

/**
 * How long after a save a deletion still counts as "that was the wrong book". Past this
 * you are changing your mind about reading it, which says nothing about the recognizer.
 */
export const WRONG_WINDOW_MS = 10 * 60 * 1000;

/** Below this many catches a percentage is noise, so no rate is shown at all. */
export const MIN_FOR_RATE = 5;

export function createRecognitionLog(deps: { storage: StorageArea; now: () => number }) {
  const serialize = createWriteQueue();

  async function read(): Promise<RecognitionEvent[]> {
    const got = await deps.storage.get(KEY);
    const raw = got[KEY];
    return Array.isArray(raw) ? (raw as RecognitionEvent[]) : [];
  }

  return {
    async record(event: PendingEvent): Promise<void> {
      return serialize(async () => {
        const existing = await read();
        const next = [...existing, { ...event, at: deps.now() }].slice(-MAX_EVENTS);
        await deps.storage.set({ [KEY]: next });
      });
    },

    /**
     * Deleting a wrong match is both the fix and the measurement - it is the only signal
     * this log gets for free, which is why dogfooding doesn't need a grading step.
     */
    async markWrong(savedId: string): Promise<void> {
      return serialize(async () => {
        const existing = await read();
        const now = deps.now();
        let changed = false;

        const next = existing.map((event) => {
          if (event.savedId !== savedId || event.wrong) return event;
          if (now - event.at > WRONG_WINDOW_MS) return event;
          changed = true;
          return { ...event, wrong: true };
        });

        if (changed) await deps.storage.set({ [KEY]: next });
      });
    },

    /**
     * The way back, which `markWrong` on its own does not have.
     *
     * Undo reverses the deletion; without this it does not reverse the FLAG, so a book you
     * removed by accident and put straight back stays counted as a wrong match forever.
     *
     * It takes two ids because `library.add` issues a NEW one on the way back in. Clearing
     * the flag without relinking would leave the event naming a book that is not on the
     * shelf, and a later genuine removal would match nothing: the log would silently lose
     * the ability to score that catch at all. That is the worse of the two bugs and the
     * one you cannot see in the number.
     *
     * NOT gated on `WRONG_WINDOW_MS`. That window decides whether a deletion MEANS
     * anything; the id changes either way, so a restore outside it still has to relink.
     */
    async markRestored(previousId: string, savedId: string): Promise<void> {
      return serialize(async () => {
        const existing = await read();
        let changed = false;

        const next = existing.map((event) => {
          if (event.savedId !== previousId) return event;
          changed = true;
          const restored: RecognitionEvent = { ...event, savedId };
          // Deleted rather than set false, so a restored attempt is indistinguishable from
          // one that was never flagged. This is a ring buffer in chrome.storage.local; a
          // key carrying `false` is a key stored 200 times to say nothing.
          delete restored.wrong;
          return restored;
        });

        if (changed) await deps.storage.set({ [KEY]: next });
      });
    },

    /** Oldest first, so the newest event is the last one. */
    async list(): Promise<RecognitionEvent[]> {
      return read();
    },

    async clear(): Promise<void> {
      return serialize(async () => {
        await deps.storage.set({ [KEY]: [] });
      });
    },
  };
}

/**
 * The one number worth watching: of the books this put on your shelf, how many did you
 * keep? Pure, so the popup renders it and the tests check the maths without storage.
 */
export function summarize(events: RecognitionEvent[]): { caught: number; keptPct: number | null } {
  const saved = events.filter((e) => e.outcome === 'auto-saved' || e.outcome === 'confirmed');
  const kept = saved.filter((e) => !e.wrong).length;

  return {
    caught: saved.length,
    keptPct: saved.length < MIN_FOR_RATE ? null : Math.round((kept / saved.length) * 100),
  };
}
