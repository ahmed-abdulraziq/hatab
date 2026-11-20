import { describe, expect, it } from 'vitest';
import { GAVE, GOT } from './ledger.js';
import { buildStatement, clientBalanceText, shortDate, statementFileName } from './statement.js';

const client = { id: 'c1', name: 'أحمد علي', phone: '01012345678' };
let seq = 0;
const tx = (type, amount, date, extra = {}) => ({
  id: `t${++seq}`,
  clientId: 'c1',
  type,
  amount,
  date,
  note: '',
  createdAt: `2026-01-01T00:00:${String(seq).padStart(2, '0')}.000Z`,
  ...extra,
});

describe('statement', () => {
  it('speaks to the client: what they took, what they paid, what they owe', () => {
    const model = buildStatement({
      client,
      transactions: [
        tx(GAVE, 15000, '2026-11-01', { note: '2 كيلو سكر' }),
        tx(GOT, 10000, '2026-11-03'),
        tx(GAVE, 999, '2026-11-02', { clientId: 'someone-else' }),
      ],
      shopName: '  بقالة الأمل ',
      today: '2026-11-20',
    });

    expect(model).toMatchObject({
      shopName: 'بقالة الأمل',
      clientName: 'أحمد علي',
      balance: 5000,
      balanceKind: 'owes',
      balanceLabel: 'عليك',
      balanceAmount: '50 ج.م',
      countText: 'حركتين',
      opening: null,
      totals: { took: '150', paid: '100' },
    });
    expect(model.rows).toEqual([
      expect.objectContaining({ date: '1 نوفمبر', note: '2 كيلو سكر', took: '150', paid: '', balance: 'عليك 150 ج.م' }),
      expect.objectContaining({ date: '3 نوفمبر', note: 'دفعت', took: '', paid: '100', balance: 'عليك 50 ج.م' }),
    ]);
  });

  it('folds older entries into an opening balance but totals the whole account', () => {
    const transactions = [
      tx(GAVE, 1000, '2026-01-01'),
      tx(GAVE, 2000, '2026-01-02'),
      tx(GOT, 500, '2026-01-03'),
      tx(GAVE, 100, '2026-01-04'),
    ];
    const model = buildStatement({ client, transactions, today: '2026-11-20', maxRows: 2 });

    expect(model.opening).toEqual({ text: 'رصيد قبل كده (حركتين أقدم)', balance: 'عليك 30 ج.م', kind: 'owes' });
    expect(model.rows.map((row) => row.balance)).toEqual(['عليك 25 ج.م', 'عليك 26 ج.م']);
    expect(model.totals).toEqual({ took: '31', paid: '5' });
    expect(model.countText).toBe('4 حركات');
  });

  it('handles a settled account, credit, and a client with no entries', () => {
    expect(buildStatement({ client, transactions: [], today: '2026-11-20' })).toMatchObject({
      balanceAmount: 'خالص',
      balanceKind: 'settled',
      countText: 'لسه مفيش حركات',
      rows: [],
    });
    expect(clientBalanceText(-2050)).toBe('ليك 20.50 ج.م');
    expect(clientBalanceText(0)).toBe('خالص');
  });

  it('tells the client when payment is due, while they owe', () => {
    const owing = [tx(GAVE, 5000, '2026-11-01')];
    const at = (dueDate, transactions = owing) =>
      buildStatement({ client: { ...client, dueDate }, transactions, today: '2026-11-20' });
    expect(at('2026-11-25')).toMatchObject({ dueText: 'ميعاد السداد 25 نوفمبر 2026', dueOverdue: false });
    expect(at('2026-11-10')).toMatchObject({ dueText: 'ميعاد السداد كان 10 نوفمبر 2026', dueOverdue: true });
    expect(at('').dueText).toBe('');
    expect(at('2026-11-25', []).dueText).toBe('');
  });

  it('shows the year only for other years', () => {
    expect(shortDate('2026-03-05', '2026-11-20')).toBe('5 مارس');
    expect(shortDate('2025-03-05', '2026-11-20')).toBe('5 مارس 2025');
  });

  it('names the file after the client and the day', () => {
    expect(statementFileName(' أحمد  علي/2 ', '2026-11-20')).toBe('كشف-حساب-أحمد-علي2-2026-11-20.png');
    expect(statementFileName('', '2026-11-20')).toBe('كشف-حساب-عميل-2026-11-20.png');
  });
});
