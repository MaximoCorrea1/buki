import type { RecognitionEvent } from './recognitionLog';

/**
 * The recognition log, read defensively out of storage.
 *
 * TS-2, the other half. `OPENWORK.md` item 53. It was the same one-line cast the shelf had:
 *
 *     return Array.isArray(raw) ? (raw as RecognitionEvent[]) : [];
 *
 * **What these events feed is arithmetic.** The options page divides them into a kept rate
 * and a mean latency, and `MIN_FOR_RATE` exists precisely because a percentage over too few
 * catches is noise. **A single `ms: NaN` in storage makes every mean `NaN`**, and a row with
 * an invented `outcome` lands in the denominator and in no numerator — so the number moves
 * for a reason nothing on screen can explain.
 *
 * Quieter than the shelf's harm, identical in class: a cast is not a check, and
 * `chrome.storage.local` is user-editable.
 *
 * Same two rules as `storedShelf.ts`. **Drop a bad row, do not throw** — a history is not
 * worth losing to one typo. **Strip a malformed optional rather than dropping the event**,
 * because a junk `model` string is not a reason to forget that a catch happened.
 */

const FLOWS: readonly string[] = ['button', 'contextmenu'];
const SOURCES: readonly string[] = ['link', 'vision', 'unverified', 'text', 'none'];
const CONFIDENCES: readonly string[] = ['high', 'medium', 'low'];
const OUTCOMES: readonly string[] = ['auto-saved', 'confirmed', 'dismissed', 'no-match'];

const text = (v: unknown): v is string => typeof v === 'string' && v !== '';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = (v: unknown, allowed: readonly string[]): boolean =>
  typeof v === 'string' && allowed.includes(v);

/** The book the model named, or nothing. Both halves, because a titleless guess is padding. */
function guess(raw: unknown): { title: string; author: string } | null {
  if (!object(raw)) return null;
  if (!text(raw['title']) || typeof raw['author'] !== 'string') return null;
  return { title: raw['title'], author: raw['author'] };
}

function event(raw: unknown): RecognitionEvent | null {
  if (!object(raw)) return null;

  // FATAL, all six. `at` and `ms` are what the arithmetic runs on; the other four are the
  // dimensions it is grouped by, and a value outside the set is counted nowhere while still
  // being counted.
  if (!num(raw['at']) || !num(raw['ms'])) return null;
  if (!oneOf(raw['flow'], FLOWS)) return null;
  if (!oneOf(raw['source'], SOURCES)) return null;
  if (!oneOf(raw['confidence'], CONFIDENCES)) return null;
  if (!oneOf(raw['outcome'], OUTCOMES)) return null;

  const model = raw['model'];
  const savedId = raw['savedId'];
  const theGuess = guess(raw['guess']);

  return {
    at: raw['at'],
    ms: raw['ms'],
    flow: raw['flow'] as RecognitionEvent['flow'],
    source: raw['source'] as RecognitionEvent['source'],
    confidence: raw['confidence'] as RecognitionEvent['confidence'],
    outcome: raw['outcome'] as RecognitionEvent['outcome'],
    ...(text(model) ? { model } : {}),
    ...(theGuess ? { guess: theGuess } : {}),
    ...(text(savedId) ? { savedId } : {}),
    ...(typeof raw['wrong'] === 'boolean' ? { wrong: raw['wrong'] } : {}),
  };
}

/** Every row storage holds that is really a recognition event, in order. */
export function readLog(raw: unknown): RecognitionEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(event).filter((e): e is RecognitionEvent => e !== null);
}
