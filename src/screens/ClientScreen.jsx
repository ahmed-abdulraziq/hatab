import { MapPin, MessageCircle, Pencil, Phone, Printer, ReceiptText, Trash2, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import ClientFormDialog from '../components/ClientFormDialog.jsx';
import { useConfirm } from '../components/confirm.js';
import TransactionFormDialog from '../components/TransactionFormDialog.jsx';
import { useToast } from '../components/toast.js';
import { AppBar, EmptyState } from '../components/ui.jsx';
import { deleteClient } from '../db/repo.js';
import { formatDate, formatDayLabel, todayISO } from '../domain/dates.js';
import {
  balanceOf,
  balanceText,
  describeBalance,
  GAVE,
  GOT,
  groupByDate,
  txLabel,
  withRunningBalance,
} from '../domain/ledger.js';
import { formatMoney } from '../domain/money.js';
import { telHref } from '../domain/phone.js';
import { countAr, TX_WORDS } from '../domain/text.js';
import { reminderMessage, whatsappUrl } from '../domain/whatsapp.js';
import { goBack, navigate } from '../router.js';
import { useLedger } from '../state/LedgerContext.js';

export default function ClientScreen({ id }) {
  const { clientsById, transactions, balances, settings } = useLedger();
  const toast = useToast();
  const confirm = useConfirm();
  const [editingClient, setEditingClient] = useState(false);
  const [newEntryType, setNewEntryType] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);

  const client = clientsById.get(id);
  const entries = useMemo(
    () => withRunningBalance(transactions.filter((tx) => tx.clientId === id)).reverse(),
    [transactions, id],
  );

  if (!client) {
    return (
      <>
        <AppBar title="العميل" back />
        <main className="screen">
          <EmptyState Icon={UserX} title="العميل ده مش موجود" text="ممكن يكون اتمسح.">
            <button type="button" className="btn btn--primary" onClick={() => navigate('/', { replace: true })}>
              ارجع للعملاء
            </button>
          </EmptyState>
        </main>
      </>
    );
  }

  const balance = balanceOf(balances, id);
  const { kind, label } = describeBalance(balance);
  const today = todayISO();
  const reminderUrl = whatsappUrl(
    client.phone,
    reminderMessage({ clientName: client.name, balance, shopName: settings.shopName ?? '', today }),
  );

  const remove = async () => {
    const ok = await confirm({
      title: `تمسح ${client.name}؟`,
      message:
        entries.length > 0
          ? `هيتمسح العميل ومعاه ${countAr(entries.length, TX_WORDS)}. مش هتعرف ترجّعهم غير من نسخة احتياطية.`
          : 'مش هتعرف ترجّعه غير من نسخة احتياطية.',
      confirmLabel: 'امسح العميل',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteClient(id);
      toast(`اتمسح ${client.name}`);
      goBack();
    } catch (error) {
      console.error(error);
      toast('حصلت مشكلة ومتمسحش. جرّب تاني.', { tone: 'error' });
    }
  };

  return (
    <>
      <AppBar
        back
        title={client.name}
        subtitle={client.phone ? <bdi dir="ltr">{client.phone}</bdi> : null}
        actions={
          <button
            type="button"
            className="icon-btn icon-btn--on-brand"
            onClick={() => setEditingClient(true)}
            aria-label="تعديل بيانات العميل"
          >
            <Pencil aria-hidden="true" size={20} />
          </button>
        }
      />

      <main className="screen screen--with-actions">
        <div className="print-only print-header">
          <h1>كشف حساب: {client.name}</h1>
          {client.phone && (
            <p>
              <bdi dir="ltr">{client.phone}</bdi>
            </p>
          )}
          {settings.shopName && <p>{settings.shopName}</p>}
          <p>بتاريخ {formatDate(today)}</p>
        </div>

        <section className={`balance-card balance-card--${kind}`} aria-label="رصيد العميل">
          <span className="balance-card-label">{kind === 'settled' ? 'الحساب' : label}</span>
          <strong className="balance-card-amount">{kind === 'settled' ? 'خالص' : formatMoney(balance)}</strong>
          {entries.length > 0 && <span className="balance-card-meta">{countAr(entries.length, TX_WORDS)}</span>}
        </section>

        <div className="quick-actions no-print">
          <a className="chip chip--whatsapp" href={reminderUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" size={18} />
            تذكير واتساب
          </a>
          {client.phone && (
            <a className="chip" href={telHref(client.phone)}>
              <Phone aria-hidden="true" size={18} />
              اتصال
            </a>
          )}
          <button type="button" className="chip" onClick={() => window.print()}>
            <Printer aria-hidden="true" size={18} />
            كشف حساب
          </button>
        </div>

        {client.address && (
          <p className="client-address">
            <MapPin aria-hidden="true" size={16} />
            {client.address}
          </p>
        )}

        {entries.length === 0 ? (
          <EmptyState
            Icon={ReceiptText}
            title="لسه مفيش حركات"
            text="لو إديته بضاعة أو فلوس دوس «إديته»، ولو خدت منه فلوس دوس «خدت منه»."
          />
        ) : (
          groupByDate(entries).map((group) => (
            <section key={group.date} className="day">
              <h2 className="day-title">
                {formatDayLabel(group.date, today)}
                {formatDayLabel(group.date, today) !== formatDate(group.date) && (
                  <span className="print-only-inline"> ({formatDate(group.date)})</span>
                )}
              </h2>
              <ul className="list">
                {group.items.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" className="row" onClick={() => setEditingEntry(entry)}>
                      <span className="row-main">
                        <span className="row-title">{entry.note || txLabel(entry)}</span>
                        <span className="row-sub">الرصيد بعدها: {balanceText(entry.balanceAfter)}</span>
                      </span>
                      <span className={`amount amount--${entry.type}`}>
                        <span className="amount-value">{formatMoney(entry.amount)}</span>
                        <span className="amount-label">{txLabel(entry)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <button type="button" className="btn btn--link-danger no-print" onClick={remove}>
          <Trash2 aria-hidden="true" size={18} />
          مسح العميل
        </button>
      </main>

      <div className="action-bar no-print">
        <button type="button" className="btn btn--gave" onClick={() => setNewEntryType(GAVE)}>
          إديته
        </button>
        <button type="button" className="btn btn--got" onClick={() => setNewEntryType(GOT)}>
          خدت منه
        </button>
      </div>

      {editingClient && <ClientFormDialog client={client} onClose={() => setEditingClient(false)} />}
      {newEntryType && (
        <TransactionFormDialog clientId={id} type={newEntryType} lockClient onClose={() => setNewEntryType(null)} />
      )}
      {editingEntry && (
        <TransactionFormDialog transaction={editingEntry} lockClient onClose={() => setEditingEntry(null)} />
      )}
    </>
  );
}
