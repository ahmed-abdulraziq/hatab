import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App.jsx';
import { db } from './db/db.js';
import { addClient, addTransaction, setDueDate } from './db/repo.js';
import { addDays, formatDate, todayISO } from './domain/dates.js';
import { GAVE } from './domain/ledger.js';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  window.history.replaceState(null, '', '#/');
});

async function owingClient(name, dueDate = '') {
  const client = await addClient({ name, phone: '01012345678' });
  await addTransaction({ clientId: client.id, type: GAVE, amount: 15000, date: todayISO() });
  if (dueDate) await setDueDate(client.id, dueDate);
  return client;
}

describe('due dates on screen', () => {
  it('sets a due date from the client page, and the reminder mentions it', async () => {
    const client = await owingClient('أحمد علي');
    window.history.replaceState(null, '', `#/client/${client.id}`);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /حدد ميعاد سداد/ }));
    const dialog = await screen.findByRole('dialog', { name: 'ميعاد السداد' });
    await user.click(within(dialog).getByRole('button', { name: 'بعد 3 أيام' }));
    expect(within(dialog).getByRole('button', { name: 'بعد 3 أيام' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(dialog).getByRole('button', { name: 'احفظ الميعاد' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const due = addDays(todayISO(), 3);
    expect(await screen.findByRole('button', { name: new RegExp(`ميعاد السداد ${formatDate(due)}`) })).toHaveTextContent(
      'ميعاد السداد بعد 3 أيام',
    );
    const reminder = new URL(screen.getByRole('link', { name: /تذكير واتساب/ }).href);
    expect(reminder.searchParams.get('text')).toContain(`ميعاد السداد يوم ${formatDate(due)}.`);
    expect((await db.clients.get(client.id)).dueDate).toBe(due);
  });

  it('refuses a day in the past, and can remove the date', async () => {
    const client = await owingClient('منى', addDays(todayISO(), 2));
    window.history.replaceState(null, '', `#/client/${client.id}`);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /ميعاد السداد/ }));
    const dialog = await screen.findByRole('dialog', { name: 'ميعاد السداد' });
    const input = within(dialog).getByLabelText('اليوم');
    expect(input).toHaveValue(addDays(todayISO(), 2));
    await user.clear(input);
    await user.type(input, addDays(todayISO(), -1));
    await user.click(within(dialog).getByRole('button', { name: 'احفظ الميعاد' }));
    expect(input).toHaveAccessibleDescription('اختار النهارده أو يوم جاي.');

    await user.click(within(dialog).getByRole('button', { name: 'شيل الميعاد' }));
    expect(await screen.findByRole('button', { name: /حدد ميعاد سداد/ })).toBeInTheDocument();
    expect((await db.clients.get(client.id)).dueDate).toBe('');
  });

  it('offers no due date to a client who owes nothing', async () => {
    const client = await addClient({ name: 'سامح' });
    window.history.replaceState(null, '', `#/client/${client.id}`);
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: 'سامح' });
    expect(screen.queryByRole('button', { name: /ميعاد سداد/ })).not.toBeInTheDocument();
  });

  it('reminds on the clients list and lists only the clients to chase', async () => {
    await owingClient('أحمد', addDays(todayISO(), -3));
    await owingClient('منى', todayISO());
    await owingClient('سامح', addDays(todayISO(), 10));
    await owingClient('هدى');
    const user = userEvent.setup();
    render(<App />);

    const notice = await screen.findByRole('region', { name: 'مواعيد السداد' });
    expect(notice).toHaveTextContent('عميلين ميعاد سدادهم جه');
    expect(notice).toHaveTextContent('أحمد، منى.');

    const list = screen.getByRole('list', { name: 'العملاء' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(within(list).getByText('فات ميعاده')).toBeInTheDocument();
    expect(within(list).getByText('ميعاده النهارده')).toBeInTheDocument();
    expect(within(list).getByText('ميعاده بعد 10 أيام')).toBeInTheDocument();

    await user.click(within(notice).getByRole('button', { name: 'اعرضهم' }));
    const names = within(screen.getByRole('list', { name: 'العملاء' }))
      .getAllByRole('listitem')
      .map((item) => item.querySelector('.row-title').textContent);
    expect(names.sort()).toEqual(['أحمد', 'منى']);

    await user.click(within(notice).getByRole('button', { name: 'اعرض كل العملاء' }));
    expect(within(screen.getByRole('list', { name: 'العملاء' })).getAllByRole('listitem')).toHaveLength(4);
  });

  it('opens the one client whose date came', async () => {
    const client = await owingClient('أحمد', todayISO());
    const user = userEvent.setup();
    render(<App />);

    const notice = await screen.findByRole('region', { name: 'مواعيد السداد' });
    expect(notice).toHaveTextContent('ميعاد سداد أحمد النهارده');
    await user.click(within(notice).getByRole('button', { name: 'افتح حسابه' }));
    expect(window.location.hash).toBe(`#/client/${client.id}`);
  });
});
