import { describe, expect, it } from 'vitest';
import { GAVE } from './ledger.js';
import { validateClientInput, validateTransactionInput } from './validation.js';

const existing = [{ id: 'a', name: 'أحمد علي' }];

describe('validateClientInput', () => {
  it('cleans the values', () => {
    const { ok, values } = validateClientInput({ name: '  منى   حسن ', phone: '٠١٠١٢٣٤٥٦٧٨', address: ' شبرا ' }, existing);
    expect(ok).toBe(true);
    expect(values).toEqual({ name: 'منى حسن', phone: '01012345678', address: 'شبرا' });
  });

  it('needs a name', () => {
    expect(validateClientInput({ name: '   ' }).errors.name).toBe('اكتب اسم العميل');
  });

  it('refuses a second client with the same name, even spelled slightly differently', () => {
    expect(validateClientInput({ name: 'أحمد سعيد' }, existing).ok).toBe(true);
    expect(validateClientInput({ name: 'احمد على' }, existing).errors.name).toMatch(/فيه عميل بنفس الاسم/);
  });

  it('lets a client keep their own name when editing', () => {
    expect(validateClientInput({ name: 'أحمد علي' }, existing, 'a').ok).toBe(true);
  });

  it('checks the phone number only when there is one', () => {
    expect(validateClientInput({ name: 'منى', phone: '' }).ok).toBe(true);
    expect(validateClientInput({ name: 'منى', phone: '123' }).errors.phone).toBeDefined();
  });
});

describe('validateTransactionInput', () => {
  const valid = { type: GAVE, amount: '150.5', date: '2026-11-05', note: ' سكر ', clientId: 'a' };

  it('returns the amount in piasters', () => {
    const { ok, values } = validateTransactionInput(valid);
    expect(ok).toBe(true);
    expect(values).toEqual({ type: GAVE, amount: 15050, date: '2026-11-05', note: 'سكر', clientId: 'a' });
  });

  it('reports every problem', () => {
    const { ok, errors } = validateTransactionInput({ type: 'other', amount: '0', date: '', note: '' });
    expect(ok).toBe(false);
    expect(Object.keys(errors).sort()).toEqual(['amount', 'date', 'type']);
  });

  it('stores entries without a client as null', () => {
    expect(validateTransactionInput({ ...valid, clientId: '' }).values.clientId).toBeNull();
  });
});
