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
