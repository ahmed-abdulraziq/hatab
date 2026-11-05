import { describe, expect, it } from 'vitest';
import { CLIENT_WORDS, countAr, digitsOnly, matchesSearch, normalizeForSearch, toLatinDigits, TX_WORDS } from './text.js';

describe('toLatinDigits', () => {
  it('converts Arabic-Indic and Eastern Arabic-Indic digits', () => {
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(toLatinDigits('۱۲۳')).toBe('123');
    expect(toLatinDigits('رقم ٠١٠ و 5')).toBe('رقم 010 و 5');
    expect(toLatinDigits(null)).toBe('');
  });
});

describe('normalizeForSearch', () => {
  it('treats common Arabic spelling variants as the same', () => {
    expect(normalizeForSearch('أحمد')).toBe(normalizeForSearch('احمد'));
    expect(normalizeForSearch('إيمان')).toBe(normalizeForSearch('ايمان'));
    expect(normalizeForSearch('مكة')).toBe(normalizeForSearch('مكه'));
    expect(normalizeForSearch('مصطفى')).toBe(normalizeForSearch('مصطفي'));
  });

  it('ignores diacritics, tatweel, case and extra spaces', () => {
    expect(normalizeForSearch('مُحَمَّد')).toBe('محمد');
    expect(normalizeForSearch('محـــمد')).toBe('محمد');
    expect(normalizeForSearch('  Ahmed   ALI ')).toBe('ahmed ali');
  });
});

describe('matchesSearch', () => {
  it('matches any field and accepts an empty query', () => {
    expect(matchesSearch(['أحمد علي', ''], 'احمد')).toBe(true);
    expect(matchesSearch(['سكر'], 'رز')).toBe(false);
    expect(matchesSearch(['anything'], '   ')).toBe(true);
  });
});

describe('digitsOnly', () => {
  it('keeps digits only, converting Arabic ones', () => {
    expect(digitsOnly('٠١٠-123 45')).toBe('01012345');
  });
});

describe('countAr', () => {
  it('follows Arabic counting rules', () => {
    expect(countAr(1, CLIENT_WORDS)).toBe('عميل واحد');
    expect(countAr(2, CLIENT_WORDS)).toBe('عميلين');
    expect(countAr(3, CLIENT_WORDS)).toBe('3 عملاء');
    expect(countAr(10, TX_WORDS)).toBe('10 حركات');
    expect(countAr(11, TX_WORDS)).toBe('11 حركة');
    expect(countAr(100, TX_WORDS)).toBe('100 حركة');
    expect(countAr(105, TX_WORDS)).toBe('105 حركات');
  });
});
