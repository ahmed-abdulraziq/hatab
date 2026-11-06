import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { db } from './db/db.js';
import { addClient } from './db/repo.js';
import { createFakeServer, SERVER } from './test/fakeServer.js';

let server;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  server = createFakeServer();
  vi.stubGlobal('fetch', server.fetch);
  window.history.replaceState(null, '', '#/settings');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillAccountForm(user, card, { mode = 'login', email = 'ahmed@example.com', password = 'secret-pass' } = {}) {
  if (mode === 'register') {
    await user.click(within(card).getByRole('radio', { name: 'حساب جديد' }));
    await user.type(within(card).getByLabelText('اسمك'), 'أحمد');
  }
  await user.type(within(card).getByLabelText('البريد الإلكتروني'), email);
  await user.type(within(card).getByLabelText('كلمة السر'), password);
  await user.type(within(card).getByLabelText('عنوان السيرفر'), SERVER);
  await user.click(within(card).getByRole('button', { name: mode === 'register' ? 'اعمل الحساب' : 'ادخل' }));
}

it('creates an account from Settings, syncs the book, and logs out', async () => {
  await addClient({ name: 'أحمد علي' });
  const user = userEvent.setup();
  render(<App />);
  const card = await screen.findByRole('region', { name: 'الحساب والمزامنة' });

  await fillAccountForm(user, card, { mode: 'register' });

  expect(await within(card).findByText(/داخل باسم/)).toHaveTextContent('أحمد');
  await waitFor(() => expect(within(card).getByRole('status')).toHaveTextContent('آخر مزامنة: النهارده'));
  expect([...server.clients.values()].map((entry) => entry.record.name)).toEqual(['أحمد علي']);

  await user.click(within(card).getByRole('button', { name: 'اخرج من الحساب' }));
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'اخرج' }));
  expect(await within(card).findByRole('button', { name: 'ادخل' })).toBeInTheDocument();
  expect(server.tokens.size).toBe(0);
});

it('shows the server’s message when logging in fails', async () => {
  const user = userEvent.setup();
  render(<App />);
  const card = await screen.findByRole('region', { name: 'الحساب والمزامنة' });

  await fillAccountForm(user, card, { password: 'wrong-password' });

  expect(await within(card).findByText('البريد الإلكتروني أو كلمة السر مش صح.')).toBeInTheDocument();
});

it('says so when the server can’t be reached', async () => {
  server.setOnline(false);
  const user = userEvent.setup();
  render(<App />);
  const card = await screen.findByRole('region', { name: 'الحساب والمزامنة' });

  await fillAccountForm(user, card);

  expect(await within(card).findByRole('alert')).toHaveTextContent('مش قادرين نوصل للسيرفر');
});

it('asks for a proper server address before trying', async () => {
  const user = userEvent.setup();
  render(<App />);
  const card = await screen.findByRole('region', { name: 'الحساب والمزامنة' });

  await user.click(within(card).getByRole('button', { name: 'ادخل' }));

  expect(within(card).getByLabelText('عنوان السيرفر')).toHaveAccessibleDescription(/اكتب عنوان السيرفر/);
  expect(server.calls).toHaveLength(0);
});
