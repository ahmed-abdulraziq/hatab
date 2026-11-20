import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { db } from './db/db.js';
import { addClient, addTransaction, setSetting } from './db/repo.js';
import { todayISO } from './domain/dates.js';
import { GAVE, GOT } from './domain/ledger.js';

// jsdom can't draw on a canvas; the drawing itself is checked in a real browser.
const rendered = vi.hoisted(() => []);
vi.mock('./statementImage.js', () => ({
  renderStatement: async (model) => {
    rendered.push(model);
    return new Blob(['png'], { type: 'image/png' });
  },
}));

let client;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  rendered.length = 0;
  URL.createObjectURL = vi.fn(() => 'blob:statement');
  URL.revokeObjectURL = vi.fn();
  client = await addClient({ name: 'أحمد علي', phone: '01012345678' });
  await addTransaction({ clientId: client.id, type: GAVE, amount: 15000, date: todayISO(), note: 'سكر' });
  await addTransaction({ clientId: client.id, type: GOT, amount: 10000, date: todayISO() });
  await setSetting('shopName', 'بقالة الأمل');
  window.history.replaceState(null, '', `#/client/${client.id}`);
});

afterEach(() => {
  delete navigator.share;
  delete navigator.canShare;
});

async function openStatement(user) {
  await user.click(await screen.findByRole('button', { name: 'كشف حساب' }));
  const dialog = await screen.findByRole('dialog', { name: 'كشف حساب أحمد علي' });
  await within(dialog).findByRole('img', { name: 'صورة كشف حساب أحمد علي' });
  return dialog;
}

describe('statement image', () => {
  it('draws the statement and shares it with the reminder as its caption', async () => {
    navigator.canShare = vi.fn(({ files }) => files[0].type === 'image/png');
    navigator.share = vi.fn(async () => {});
    const user = userEvent.setup();
    render(<App />);

    const dialog = await openStatement(user);
    expect(rendered.at(-1)).toMatchObject({ clientName: 'أحمد علي', shopName: 'بقالة الأمل', balanceAmount: '50 ج.م' });

    await user.click(within(dialog).getByRole('button', { name: 'ابعت الصورة' }));
    expect(navigator.share).toHaveBeenCalledTimes(1);
    const [{ files, text }] = navigator.share.mock.calls[0];
    expect(files[0]).toBeInstanceOf(File);
    expect(files[0].name).toBe(`كشف-حساب-أحمد-علي-${todayISO()}.png`);
    expect(text).toContain('عليك 50 ج.م');
    expect(text).toContain('بقالة الأمل');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('stays open when the share sheet is closed', async () => {
    navigator.canShare = () => true;
    navigator.share = vi.fn(async () => {
      throw new DOMException('closed', 'AbortError');
    });
    const user = userEvent.setup();
    render(<App />);

    const dialog = await openStatement(user);
    await user.click(within(dialog).getByRole('button', { name: 'ابعت الصورة' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('without file sharing, offers the download and a WhatsApp chat instead', async () => {
    const user = userEvent.setup();
    render(<App />);

    const dialog = await openStatement(user);
    expect(within(dialog).queryByRole('button', { name: 'ابعت الصورة' })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/نزّل الصورة، وبعدين افتح واتساب/)).toBeInTheDocument();
    const chat = new URL(within(dialog).getByRole('link', { name: 'افتح واتساب' }).href);
    expect(chat.pathname).toBe('/201012345678');

    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await user.click(within(dialog).getByRole('button', { name: 'نزّل الصورة' }));
    expect(click).toHaveBeenCalled();
    expect(await screen.findByText('اتنزّلت صورة الكشف')).toBeInTheDocument();
    click.mockRestore();
  });
});
