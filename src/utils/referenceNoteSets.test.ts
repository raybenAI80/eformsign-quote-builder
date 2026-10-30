// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CUSTOM_NOTES_KEYS,
  LEGACY_CUSTOM_NOTES_KEY,
  builtInNotes,
  notesForType,
  readCustomNotes,
  sameNotes,
  writeCustomNotes,
} from './referenceNoteSets';
import { DEFAULT_REFERENCE_NOTES, PREPAID_REFERENCE_NOTES, SUBSCRIPTION_REFERENCE_NOTES } from '../constants';

describe('reference note defaults', () => {
  it('DEFAULT_REFERENCE_NOTES is the prepaid set; subscription has 9 lines', () => {
    expect(DEFAULT_REFERENCE_NOTES).toBe(PREPAID_REFERENCE_NOTES);
    expect(PREPAID_REFERENCE_NOTES).toHaveLength(8);
    expect(SUBSCRIPTION_REFERENCE_NOTES).toHaveLength(9);
    expect(SUBSCRIPTION_REFERENCE_NOTES[3]).toContain('1건당 600원');
    expect(SUBSCRIPTION_REFERENCE_NOTES.slice(5)).toEqual(PREPAID_REFERENCE_NOTES.slice(4));
    // 문장 끝은 모두 「~합니다.」로 통일했다(줄바꿈 문자 없음)
    expect([...PREPAID_REFERENCE_NOTES, ...SUBSCRIPTION_REFERENCE_NOTES].some(n => n.includes('\n'))).toBe(false);
    expect(SUBSCRIPTION_REFERENCE_NOTES[1]).toBe('청구일: 익월 1일에 청구하고, 7일에 등록된 카드로 결제합니다.');
  });
});

describe('custom note sets', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to built-in when nothing is saved', () => {
    expect(readCustomNotes('prepaid')).toBeNull();
    expect(notesForType('subscription')).toEqual(builtInNotes('subscription'));
  });
  it('round-trips each type independently', () => {
    expect(writeCustomNotes('subscription', ['a', 'b'])).toBe(true);
    expect(readCustomNotes('subscription')).toEqual(['a', 'b']);
    expect(readCustomNotes('prepaid')).toBeNull();
  });
  it('reads the legacy key as the prepaid set only, without deleting it', () => {
    localStorage.setItem(LEGACY_CUSTOM_NOTES_KEY, JSON.stringify(['legacy']));
    expect(readCustomNotes('prepaid')).toEqual(['legacy']);
    expect(readCustomNotes('subscription')).toBeNull();
    expect(localStorage.getItem(LEGACY_CUSTOM_NOTES_KEY)).not.toBeNull();
    writeCustomNotes('prepaid', ['new']);
    expect(readCustomNotes('prepaid')).toEqual(['new']);
  });
  it('ignores broken or non-array values instead of throwing', () => {
    localStorage.setItem(CUSTOM_NOTES_KEYS.prepaid, '{not json');
    expect(readCustomNotes('prepaid')).toBeNull();
    localStorage.setItem(CUSTOM_NOTES_KEYS.prepaid, JSON.stringify({ a: 1 }));
    expect(readCustomNotes('prepaid')).toBeNull();
    localStorage.setItem(CUSTOM_NOTES_KEYS.prepaid, JSON.stringify([1, 2]));
    expect(readCustomNotes('prepaid')).toBeNull();
    localStorage.setItem(CUSTOM_NOTES_KEYS.prepaid, JSON.stringify([]));
    expect(notesForType('prepaid')).toEqual(builtInNotes('prepaid'));
  });
  it('sameNotes compares by value', () => {
    expect(sameNotes(['a'], ['a'])).toBe(true);
    expect(sameNotes(['a'], ['a', 'b'])).toBe(false);
  });
});
