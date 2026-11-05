import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App.jsx';
import { db } from './db/db.js';
import { addClient, addTransaction } from './db/repo.js';
import { addDays, todayISO } from './domain/dates.js';
import { GAVE, GOT } from './domain/ledger.js';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  window.history.replaceState(null, '', '#/');
});

async function addEntry(user, button, amount, note = '') {
  await user.click(await screen.findByRole('button', { name: button }));
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByLabelText('المبلغ'), amount);
  if (note) await user.type(within(dialog).getByLabelText('ملاحظة'), note);
  await user.click(within(dialog).getByRole('button', { name: 'سجّل' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

describe('HATAB', () => {
  it('adds a client, records what I gave and got, and keeps the balance', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'ضيف أول عميل' }));
    await user.type(screen.getByLabelText('الاسم'), 'أحمد علي');
    await user.type(screen.getByLabelText('رقم الموبايل'), '010 1234 5678');
    await user.click(screen.getByRole('button', { name: 'ضيف العميل' }));

    // The very first client shows up right away and opens their page.
    expect(await screen.findByRole('heading', { level: 1, name: 'أحمد علي' })).toBeInTheDocument();

    await addEntry(user, 'إديته', '150', '2 كيلو سكر');
    await addEntry(user, 'خدت منه', '100');

    const balance = screen.getByRole('region', { name: 'رصيد العميل' });
    await waitFor(() => expect(balance).toHaveTextContent(/عليه\s*50 ج.م/));
    expect(screen.getByText('2 كيلو سكر')).toBeInTheDocument();
    expect(screen.getByText('الرصيد بعدها: عليه 150 ج.م')).toBeInTheDocument();

    const reminder = new URL(screen.getByRole('link', { name: /تذكير واتساب/ }).href);
    expect(reminder.pathname).toBe('/201012345678');
    expect(reminder.searchParams.get('text')).toContain('عليك 50 ج.م');

    // Back on the list, the client and the totals match.
    await user.click(screen.getByRole('button', { name: 'رجوع' }));
    const list = await screen.findByRole('list', { name: 'العملاء' });
    expect(within(list).getByText('أحمد علي')).toBeInTheDocument();
    expect(within(list).getByText('عليه')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'الملخص' })).toHaveTextContent(/ليك عند الناس\s*50 ج.م/);
  });

  it('refuses a duplicate name and an empty amount', async () => {
    await addClient({ name: 'منى' });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'عميل جديد' }));
    await user.type(screen.getByLabelText('الاسم'), 'منى');
    await user.click(screen.getByRole('button', { name: 'ضيف العميل' }));
    expect(screen.getByLabelText('الاسم')).toHaveAccessibleDescription(/فيه عميل بنفس الاسم ده/);
    await user.click(screen.getByRole('button', { name: 'إلغاء' }));

    await user.click(screen.getByText('منى'));
    await user.click(await screen.findByRole('button', { name: 'إديته' }));
    await user.click(screen.getByRole('button', { name: 'سجّل' }));
    expect(screen.getByLabelText('المبلغ')).toHaveAccessibleDescription('اكتب مبلغ صحيح أكبر من صفر');
    expect(await db.transactions.count()).toBe(0);
  });

  it('edits an entry, and asks before deleting it', async () => {
    const client = await addClient({ name: 'سامح' });
    await addTransaction({ clientId: client.id, type: GAVE, amount: 20000, date: todayISO(), note: 'رز' });
    window.history.replaceState(null, '', `#/client/${client.id}`);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /رز/ }));
    const amount = screen.getByLabelText('المبلغ');
    expect(amount).toHaveValue('200');
    await user.clear(amount);
    await user.type(amount, '250.5');
    expect(amount).toHaveAccessibleDescription('الرصيد بعد الحركة دي: عليه 250.50 ج.م');
    await user.click(screen.getByRole('button', { name: 'حفظ' }));
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'رصيد العميل' })).toHaveTextContent(/عليه\s*250.50 ج.م/),
    );

    await user.click(screen.getByRole('button', { name: /رز/ }));
    await user.click(screen.getByRole('button', { name: 'مسح الحركة' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'تمسح الحركة دي؟' });
    await user.click(within(confirm).getByRole('button', { name: 'لأ، رجوع' }));
    expect(await db.transactions.count()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'مسح الحركة' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'امسحها' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'رصيد العميل' })).toHaveTextContent('خالص'));
    expect(await db.transactions.count()).toBe(0);
  });

  it('shows a whole day when "from" and "to" are the same day', async () => {
    const today = todayISO();
    await addTransaction({ type: GOT, amount: 5000, date: today, note: 'بيع نقدي' });
    await addTransaction({ type: GAVE, amount: 1500, date: today, note: 'كهربا' });
    await addTransaction({ type: GAVE, amount: 9900, date: addDays(today, -3), note: 'إيجار' });
    window.history.replaceState(null, '', '#/transactions');
    const user = userEvent.setup();
    render(<App />);

    const totals = await screen.findByRole('region', { name: 'الإجمالي' });
    expect(totals).toHaveTextContent(/الصافي\s*−64 ج.م/);

    await user.click(screen.getByRole('button', { name: 'فلتر' }));
    await user.click(screen.getByRole('button', { name: 'النهارده' }));

    await waitFor(() => expect(screen.queryByText('إيجار')).not.toBeInTheDocument());
    expect(screen.getByText('بيع نقدي')).toBeInTheDocument();
    expect(screen.getByText('كهربا')).toBeInTheDocument();
    expect(totals).toHaveTextContent(/الداخل\s*50 ج.م/);
    expect(totals).toHaveTextContent(/الصافي\s*\+35 ج.م/);
  });
});
