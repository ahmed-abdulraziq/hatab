import { ReceiptText, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import Field from '../components/Field.jsx';
import TransactionFormDialog from '../components/TransactionFormDialog.jsx';
import { AppBar, EmptyState, Fab, SignedMoney } from '../components/ui.jsx';
import { addDays, formatDayLabel, startOfMonth, todayISO } from '../domain/dates.js';
import {
  ALL,
  compareNames,
  filterTransactions,
  GAVE,
  GOT,
  groupByDate,
  newestFirst,
  NO_CLIENT,
  totals,
  txLabel,
} from '../domain/ledger.js';
import { formatMoney } from '../domain/money.js';
import { countAr, TX_WORDS } from '../domain/text.js';
import { useLedger } from '../state/LedgerContext.js';

const NO_FILTERS = { from: '', to: '', type: ALL, clientId: ALL };

export default function TransactionsScreen() {
  const { transactions, clients, clientsById } = useLedger();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const today = todayISO();
  const filtered = useMemo(
    () => filterTransactions(transactions, { query, ...filters }, clientsById).sort(newestFirst),
    [transactions, clientsById, query, filters],
  );
  const sums = useMemo(() => totals(filtered), [filtered]);
  const sortedClients = useMemo(() => [...clients].sort(compareNames), [clients]);
  const activeFilters = Object.keys(NO_FILTERS).filter((key) => filters[key] !== NO_FILTERS[key]).length;
  const setFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const setRange = (from, to) => setFilters((current) => ({ ...current, from, to }));
  const presets = [
    ['النهارده', today, today],
    ['آخر 7 أيام', addDays(today, -6), today],
    ['الشهر ده', startOfMonth(today), today],
  ];

  return (
    <>
      <AppBar title="الحركات" subtitle="كل اللي دخل وخرج" />
      <main className="screen">
        <section className="totals" aria-label="الإجمالي">
          <div className="totals-item totals-item--got">
            <span>الداخل</span>
            <strong>{formatMoney(sums.moneyIn)}</strong>
          </div>
          <div className="totals-item totals-item--gave">
            <span>الخارج</span>
            <strong>{formatMoney(sums.moneyOut)}</strong>
          </div>
          <div className={`totals-item ${sums.net < 0 ? 'totals-item--gave' : 'totals-item--got'}`}>
            <span>الصافي</span>
            <strong>
              <SignedMoney value={sums.net} />
            </strong>
          </div>
        </section>

        <div className="toolbar">
          <label className="search">
            <Search aria-hidden="true" size={20} />
            <span className="sr-only">دوّر في الحركات</span>
            <input
              type="search"
              className="search-input"
              placeholder="دوّر بالاسم أو الملاحظة"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              enterKeyHint="search"
            />
          </label>
          <button
            type="button"
            className={`btn btn--ghost btn--filter${activeFilters ? ' is-active' : ''}`}
            aria-expanded={showFilters}
            aria-controls="filters"
            onClick={() => setShowFilters((open) => !open)}
          >
            <SlidersHorizontal aria-hidden="true" size={18} />
            فلتر{activeFilters > 0 && <span className="badge">{activeFilters}</span>}
          </button>
        </div>

        {showFilters && (
          <section id="filters" className="filters" aria-label="الفلاتر">
            <div className="chips">
              {presets.map(([label, from, to]) => (
                <button
                  key={label}
                  type="button"
                  className="chip"
                  aria-pressed={filters.from === from && filters.to === to}
                  onClick={() => setRange(from, to)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="form-row">
              <Field label="من يوم">
                {(props) => (
                  <input {...props} className="input" type="date" value={filters.from} max={filters.to || undefined} onChange={setFilter('from')} />
                )}
              </Field>
              <Field label="لحد يوم">
                {(props) => (
                  <input {...props} className="input" type="date" value={filters.to} min={filters.from || undefined} onChange={setFilter('to')} />
                )}
              </Field>
            </div>
            <div className="form-row">
              <Field label="النوع">
                {(props) => (
                  <select {...props} className="input" value={filters.type} onChange={setFilter('type')}>
                    <option value={ALL}>الكل</option>
                    <option value={GOT}>داخل (خدت)</option>
                    <option value={GAVE}>خارج (إديت)</option>
                  </select>
                )}
              </Field>
              <Field label="العميل">
                {(props) => (
                  <select {...props} className="input" value={filters.clientId} onChange={setFilter('clientId')}>
                    <option value={ALL}>كل العملاء</option>
                    <option value={NO_CLIENT}>بدون عميل</option>
                    {sortedClients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            {activeFilters > 0 && (
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setFilters(NO_FILTERS)}>
                امسح الفلاتر
              </button>
            )}
          </section>
        )}

        {transactions.length === 0 ? (
          <EmptyState
            Icon={ReceiptText}
            title="لسه مفيش حركات"
            text="سجّل هنا المصاريف والبيع النقدي، أو أي حركة لعميل."
          />
        ) : filtered.length === 0 ? (
          <p className="no-results">مفيش حركات بالفلاتر دي.</p>
        ) : (
          <>
            <p className="list-meta">{countAr(filtered.length, TX_WORDS)}</p>
            {groupByDate(filtered).map((group) => (
              <section key={group.date} className="day">
                <h2 className="day-title">{formatDayLabel(group.date, today)}</h2>
                <ul className="list">
                  {group.items.map((tx) => (
                    <li key={tx.id}>
                      <button type="button" className="row" onClick={() => setEditing(tx)}>
                        <span className="row-main">
                          <span className="row-title">
                            {tx.clientId ? (clientsById.get(tx.clientId)?.name ?? '—') : 'بدون عميل'}
                          </span>
                          {tx.note && <span className="row-sub">{tx.note}</span>}
                        </span>
                        <span className={`amount amount--${tx.type}`}>
                          <span className="amount-value">{formatMoney(tx.amount)}</span>
                          <span className="amount-label">{txLabel(tx)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </main>

      <Fab label="حركة جديدة" onClick={() => setAdding(true)} />
      {adding && <TransactionFormDialog onClose={() => setAdding(false)} />}
      {editing && <TransactionFormDialog transaction={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
