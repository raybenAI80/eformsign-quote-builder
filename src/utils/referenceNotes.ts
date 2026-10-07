// Reference-note customer placeholder handling.
// Notes are stored with a placeholder and substituted only at render time, so the
// stored text must never contain the substituted customer name.

/** Canonical placeholder shown in the editor and stored in notes. */
export const CUSTOMER_NAME_PLACEHOLDER = '{고객사명}';
/** Fallback text when the customer name is empty. */
export const CUSTOMER_NAME_FALLBACK = '고객사';

// Both legacy (`{customerName}`) and Korean (`{고객사명}`) spellings are accepted.
const PLACEHOLDER_RE = /\{customerName\}|\{고객사명\}/g;

/** Replace every placeholder occurrence with the customer name (or fallback). */
export const renderReferenceNote = (note: string, customerName?: string | null): string => {
  const name = customerName?.trim() ? customerName : CUSTOMER_NAME_FALLBACK;
  return note.replace(PLACEHOLDER_RE, () => name);
};

/** Editor-facing form: unify legacy `{customerName}` into the Korean placeholder. */
export const toEditableReferenceNote = (note: string): string =>
  note.replace(PLACEHOLDER_RE, CUSTOMER_NAME_PLACEHOLDER);

export const hasCustomerPlaceholder = (note: string): boolean => {
  PLACEHOLDER_RE.lastIndex = 0;
  const found = PLACEHOLDER_RE.test(note);
  PLACEHOLDER_RE.lastIndex = 0;
  return found;
};

// Default first note whose placeholder was lost by the old editor (it stored the
// substituted text). Group 1 = the baked-in customer text.
const LOST_PLACEHOLDER_NOTE_RE = /^(본 견적은 『)(.+?)(의 전자계약 (?:서비스|플랫폼) eformsign 도입』)/;

/**
 * Restore the customer placeholder in notes saved by the old editor.
 * Only the default first-note pattern is touched, and only when the baked-in text is
 * the fallback ('고객사') or equals the quote's own customer name — any other company
 * name is left as the user typed it.
 */
export const restoreCustomerPlaceholder = (note: string, customerName?: string | null): string => {
  if (hasCustomerPlaceholder(note)) return note;
  const m = LOST_PLACEHOLDER_NOTE_RE.exec(note);
  if (!m) return note;
  const baked = m[2];
  const name = customerName?.trim() ?? '';
  if (baked !== CUSTOMER_NAME_FALLBACK && !(name && baked === name)) return note;
  return note.replace(LOST_PLACEHOLDER_NOTE_RE, `$1${CUSTOMER_NAME_PLACEHOLDER}$3`);
};

export const restoreCustomerPlaceholders = (
  notes: string[] | undefined,
  customerName?: string | null
): string[] | undefined => {
  if (!notes) return notes;
  let changed = false;
  const next = notes.map(n => {
    const r = restoreCustomerPlaceholder(n, customerName);
    if (r !== n) changed = true;
    return r;
  });
  return changed ? next : notes;
};
