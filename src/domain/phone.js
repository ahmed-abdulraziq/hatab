import { toLatinDigits } from './text.js';

export const DEFAULT_COUNTRY_CODE = '20'; // Egypt

/**
 * Turns a phone number as people write it into the international digits WhatsApp expects:
 * "010 1234 5678" → "201012345678", "+20 10 1234 5678" → "201012345678".
 * Returns null when it doesn't look like a phone number.
 */
export function toWhatsAppNumber(raw, countryCode = DEFAULT_COUNTRY_CODE) {
  let number = toLatinDigits(raw).replace(/[^\d+]/g, '');
  if (!number) return null;

  if (number.startsWith('+')) number = number.slice(1);
  else if (number.startsWith('00')) number = number.slice(2);
  else if (number.startsWith('0')) number = countryCode + number.slice(1);
  else if (countryCode === '20' && /^1[0125]\d{8}$/.test(number)) number = countryCode + number;

  number = number.replace(/\D/g, '');
  return number.length >= 8 && number.length <= 15 ? number : null;
}

/** A "tel:" link that dials the number as written. */
export function telHref(raw) {
  return `tel:${toLatinDigits(raw).replace(/[^\d+]/g, '')}`;
}
