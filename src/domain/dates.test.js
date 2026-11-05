import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysAgoText,
  daysSince,
  formatDate,
  formatDayLabel,
  isISODate,
  parseISODate,
  startOfMonth,
  toISODate,
} from './dates.js';

describe('calendar days', () => {
  it('uses the local day, not UTC', () => {
    expect(toISODate(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05');
    expect(toISODate(new Date(2026, 10, 5, 0, 1))).toBe('2026-11-05');
  });

  it('rejects impossible days', () => {
    expect(parseISODate('2026-02-31')).toBeNull();
    expect(parseISODate('5/11/2026')).toBeNull();
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-02-29')).toBe(false);
  });

  it('moves across months and years', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(startOfMonth('2026-11-05')).toBe('2026-11-01');
  });
});

describe('labels', () => {
  it('formats days in Arabic with Western digits', () => {
    expect(formatDate('2026-11-05')).toBe('5 نوفمبر 2026');
  });

  it('says today and yesterday in Egyptian Arabic', () => {
    expect(formatDayLabel('2026-11-05', '2026-11-05')).toBe('النهارده');
    expect(formatDayLabel('2026-11-04', '2026-11-05')).toBe('امبارح');
    expect(formatDayLabel('2026-11-01', '2026-11-05')).toBe('1 نوفمبر 2026');
  });

  it('counts days since a timestamp', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    expect(daysSince('2026-11-05T08:00:00Z', now)).toBe(0);
    expect(daysSince('2026-10-26T12:00:00Z', now)).toBe(10);
    expect(daysSince('not a date', now)).toBeNull();
  });

  it('describes how long ago in words', () => {
    expect(daysAgoText(0)).toBe('النهارده');
    expect(daysAgoText(1)).toBe('امبارح');
    expect(daysAgoText(2)).toBe('من يومين');
    expect(daysAgoText(5)).toBe('من 5 أيام');
    expect(daysAgoText(12)).toBe('من 12 يوم');
  });
});
