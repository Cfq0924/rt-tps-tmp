import { describe, it, expect } from 'vitest';
import {
  STRUCTURE_DICTIONARY,
  ROI_TYPES,
  inferTypeFromName,
  findDictionaryEntry,
} from './structureDictionary.js';

describe('structureDictionary', () => {
  it('contains common target and OAR names', () => {
    const names = STRUCTURE_DICTIONARY.map(e => e.name);
    for (const n of ['GTV', 'CTV', 'PTV', 'Body', 'SpinalCord', 'Lung_L', 'Heart']) {
      expect(names).toContain(n);
    }
  });

  it('every entry has a valid type and color', () => {
    for (const e of STRUCTURE_DICTIONARY) {
      expect(ROI_TYPES).toContain(e.type);
      expect(e.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(e.name.length).toBeGreaterThan(0);
    }
  });

  it('inferTypeFromName matches Eclipse-style prefixes', () => {
    expect(inferTypeFromName('PTV_High')).toBe('PTV');
    expect(inferTypeFromName('CTV_Low')).toBe('CTV');
    expect(inferTypeFromName('GTV_Primary')).toBe('GTV');
    expect(inferTypeFromName('Body')).toBe('EXTERNAL');
    expect(inferTypeFromName('Bolus_5mm')).toBe('BOLUS');
    expect(inferTypeFromName('SpinalCord_PRV03')).toBe('AVOIDANCE');
    expect(inferTypeFromName('Heart')).toBe('ORGAN');
    expect(inferTypeFromName('')).toBe('ORGAN');
  });

  it('findDictionaryEntry is exact-name', () => {
    expect(findDictionaryEntry('Heart')?.type).toBe('ORGAN');
    expect(findDictionaryEntry('heart')).toBeNull();
  });
});
