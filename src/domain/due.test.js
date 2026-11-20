import { describe, expect, it } from 'vitest';
import { clientsDueNow, daysBetween, dueDateChoices, dueStatus, isDueNow, validateDueDate } from './due.js';

const TODAY = '2026-11-20';

describe('due dates', () => {
  it('counts calendar days, whatever the clock change', () => {
    expect(daysBetween('2026-11-20', '2026-11-25')).toBe(5);
    expect(daysBetween('2026-11-20', '2026-11-18')).toBe(-2);
    expect(daysBetween('2026-03-25', '2026-04-05')).toBe(11);
    expect(daysBetween('2026-10-20', '2026-11-02')).toBe(13);
    expect(daysBetween('nope', '2026-11-02')).toBeNull();
  });

  it('says where the client stands', () => {
    expect(dueStatus('2026-11-17', 100, TODAY)).toMatchObject({
      kind: 'overdue',
      short: 'فات ميعاده',
      text: 'فات ميعاد السداد من 3 أيام',
      dateText: '17 نوفمبر 2026',
    });
    expect(dueStatus('2026-11-19', 100, TODAY).text).toBe('فات ميعاد السداد امبارح');
    expect(dueStatus(TODAY, 100, TODAY)).toMatchObject({ kind: 'today', text: 'ميعاد السداد النهارده' });
    expect(dueStatus('2026-11-21', 100, TODAY)).toMatchObject({ kind: 'soon', short: 'ميعاده بكره' });
    expect(dueStatus('2026-11-22', 100, TODAY)).toMatchObject({ kind: 'soon', text: 'ميعاد السداد بعد يومين' });
    expect(dueStatus('2026-11-30', 100, TODAY)).toMatchObject({ kind: 'later', short: 'ميعاده بعد 10 أيام' });
  });

  it('has nothing to say without a date or a debt', () => {
    expect(dueStatus('', 100, TODAY)).toBeNull();
    expect(dueStatus(null, 100, TODAY)).toBeNull();
    expect(dueStatus('2026-11-17', 0, TODAY)).toBeNull();
    expect(dueStatus('2026-11-17', -500, TODAY)).toBeNull();
    expect(isDueNow(null)).toBe(false);
  });

  it('lists the clients to chase, earliest date first', () => {
    const clients = [
      { id: 'a', name: 'بعدين', dueDate: '2026-11-25' },
      { id: 'b', name: 'النهارده', dueDate: TODAY },
      { id: 'c', name: 'فات', dueDate: '2026-11-10' },
      { id: 'd', name: 'دفع', dueDate: '2026-11-01' },
      { id: 'e', name: 'من غير ميعاد', dueDate: '' },
    ];
    const balances = new Map(['a', 'b', 'c', 'e'].map((id) => [id, { balance: 100 }]));
    expect(clientsDueNow(clients, balances, TODAY).map((client) => client.name)).toEqual(['فات', 'النهارده']);
  });

  it('offers quick choices, including the first of next month', () => {
    expect(dueDateChoices(TODAY)).toEqual([
      { label: 'بعد 3 أيام', date: '2026-11-23' },
      { label: 'بعد أسبوع', date: '2026-11-27' },
      { label: 'بعد أسبوعين', date: '2026-12-04' },
      { label: 'أول الشهر الجاي', date: '2026-12-01' },
    ]);
    expect(dueDateChoices('2026-12-31').at(-1).date).toBe('2027-01-01');
  });

  it('accepts today or a later day', () => {
    expect(validateDueDate(TODAY, TODAY)).toBeNull();
    expect(validateDueDate('2027-01-01', TODAY)).toBeNull();
    expect(validateDueDate('2026-11-19', TODAY)).toBe('اختار النهارده أو يوم جاي.');
    expect(validateDueDate('', TODAY)).toBe('اختار يوم السداد.');
    expect(validateDueDate('2026-02-31', TODAY)).toBe('اختار يوم السداد.');
  });
});
