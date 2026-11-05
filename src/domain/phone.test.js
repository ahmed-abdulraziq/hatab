import { describe, expect, it } from 'vitest';
import { telHref, toWhatsAppNumber } from './phone.js';

describe('toWhatsAppNumber', () => {
  it.each([
    ['01012345678', '201012345678'],
    ['010 1234 5678', '201012345678'],
    ['010-1234-5678', '201012345678'],
    ['+20 10 1234 5678', '201012345678'],
    ['00201012345678', '201012345678'],
    ['٠١٠١٢٣٤٥٦٧٨', '201012345678'],
    ['1012345678', '201012345678'],
    ['0223456789', '20223456789'],
    ['+966 50 123 4567', '966501234567'],
  ])('turns %j into %j', (input, expected) => {
    expect(toWhatsAppNumber(input)).toBe(expected);
  });

  it.each(['', '123', 'مفيش', '+', '0+10'])('rejects %j', (input) => {
    expect(toWhatsAppNumber(input)).toBeNull();
  });
});

describe('telHref', () => {
  it('dials the number as written', () => {
    expect(telHref('010 1234 5678')).toBe('tel:01012345678');
    expect(telHref('+20 ١٠')).toBe('tel:+2010');
  });
});
