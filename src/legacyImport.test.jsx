import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from './App.jsx';

it('moves the data of the first version of the app into the new one', async () => {
  localStorage.setItem('client', JSON.stringify([{ id: 0.42, name: 'Ahmed', phone: '01012345678', address: 'Cairo' }]));
  localStorage.setItem(
    'cash',
    JSON.stringify([
      { id: 0.1, cash: 300, name: 'Ahmed', type: 'cach out', date: 'Nov 01 2026 10:00:00 ' },
      { id: 0.2, cash: 120, name: 'Ahmed', type: 'cach in', date: 'Nov 02 2026 10:00:00 ' },
    ]),
  );
  render(<App />);

  expect(await screen.findByText('نقلنا بياناتك من النسخة القديمة: عميل واحد وحركتين.')).toBeInTheDocument();
  const list = await screen.findByRole('list', { name: 'العملاء' });
  expect(within(list).getByText('Ahmed')).toBeInTheDocument();
  expect(within(list).getByText('180 ج.م')).toBeInTheDocument();
  // The old data stays where it was, just in case.
  expect(localStorage.getItem('client')).not.toBeNull();
});
