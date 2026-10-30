// Per-plan-type reference-note sets: built-in text and the user's saved custom set (browser localStorage).
import { PREPAID_REFERENCE_NOTES, SUBSCRIPTION_REFERENCE_NOTES } from '../constants';

export type NoteSetType = 'prepaid' | 'subscription';

export const CUSTOM_NOTES_KEYS: Record<NoteSetType, string> = {
  prepaid: 'eformsign_custom_reference_notes_prepaid',
  subscription: 'eformsign_custom_reference_notes_subscription',
};
/** Key used before the two sets were split. It is read as the prepaid custom set and never deleted. */
export const LEGACY_CUSTOM_NOTES_KEY = 'eformsign_custom_reference_notes';

export const builtInNotes = (type: NoteSetType): string[] =>
  [...(type === 'subscription' ? SUBSCRIPTION_REFERENCE_NOTES : PREPAID_REFERENCE_NOTES)];

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'string');

const readKey = (key: string): string[] | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStringArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/** The saved custom set for a type, or null when none (or the stored value is broken). */
export const readCustomNotes = (type: NoteSetType): string[] | null => {
  const own = readKey(CUSTOM_NOTES_KEYS[type]);
  if (own) return own;
  return type === 'prepaid' ? readKey(LEGACY_CUSTOM_NOTES_KEY) : null;
};

/** Saved custom set if present, else the built-in set. */
export const notesForType = (type: NoteSetType): string[] => readCustomNotes(type) ?? builtInNotes(type);

/** Returns false when the browser refuses the write (private mode, quota). */
export const writeCustomNotes = (type: NoteSetType, notes: ReadonlyArray<string>): boolean => {
  try {
    localStorage.setItem(CUSTOM_NOTES_KEYS[type], JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
};

export const sameNotes = (a: ReadonlyArray<string> | undefined, b: ReadonlyArray<string> | undefined): boolean => {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((n, i) => n === y[i]);
};
