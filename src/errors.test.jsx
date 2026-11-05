import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { db } from './db/db.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function Throws({ error }) {
  throw error;
}

describe('when something breaks', () => {
  it('explains a crash instead of leaving the page blank', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Throws error={new TypeError('x is undefined')} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('حصلت مشكلة والبرنامج وقف');
    expect(screen.getByText(/TypeError: x is undefined/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'افتح البرنامج تاني' })).toBeInTheDocument();
  });

  it('says so when the browser refuses to store data, instead of loading forever', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const refused = Object.assign(new Error('The user denied permission to access the database.'), {
      name: 'OpenFailedError',
    });
    vi.spyOn(db, 'open').mockRejectedValue(refused);

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('المتصفح ده مش سامح بحفظ البيانات');
  });
});
