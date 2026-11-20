import { CalendarClock, ChevronLeft, CloudUpload, Search, Smartphone, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { downloadBackup, needsBackupReminder, shareBackup, snoozeBackupReminder } from '../backupActions.js';
import ClientFormDialog from '../components/ClientFormDialog.jsx';
import { useToast } from '../components/toast.js';
import { AppBar, BalanceTag, EmptyState, Fab } from '../components/ui.jsx';
import { setSetting } from '../db/repo.js';
import { daysAgoText, daysSince, formatDayLabel, todayISO } from '../domain/dates.js';
import { clientsDueNow, dueStatus } from '../domain/due.js';
import { balanceOf, CLIENT_SORTS, clientMatches, sortClients } from '../domain/ledger.js';
import { formatMoney } from '../domain/money.js';
import { CLIENT_WORDS, countAr } from '../domain/text.js';
import { canShareFiles } from '../files.js';
import { isStandalone, promptInstall, useCanInstall } from '../pwa/install.js';
import { useLedger } from '../state/LedgerContext.js';
import { clientPath, navigate } from '../router.js';

export default function ClientsScreen() {
  const ledger = useLedger();
  const { clients, balances, summary } = ledger;
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [adding, setAdding] = useState(false);
  const [onlyDue, setOnlyDue] = useState(false);
  const today = todayISO();

  const dueNow = useMemo(() => clientsDueNow(clients, balances, today), [clients, balances, today]);
  const showingDue = onlyDue && dueNow.length > 0;
  const rows = useMemo(() => {
    const dueIds = new Set(dueNow.map((client) => client.id));
    const matching = clients.filter((client) => clientMatches(client, query) && (!showingDue || dueIds.has(client.id)));
    return sortClients(matching, balances, sortBy);
  }, [clients, balances, query, sortBy, dueNow, showingDue]);

  return (
    <>
      <AppBar title="HATAB" subtitle="دفتر الحسابات" />
      <main className="screen">
        <section className="summary" aria-label="الملخص">
          <div className="summary-item summary-item--owes">
            <span className="summary-label">ليك عند الناس</span>
            <strong className="summary-value">{formatMoney(summary.receivable)}</strong>
          </div>
          <div className="summary-item summary-item--owed">
            <span className="summary-label">عليك للناس</span>
            <strong className="summary-value">{formatMoney(summary.payable)}</strong>
          </div>
        </section>

        {dueNow.length > 0 && (
          <DueNotice dueNow={dueNow} today={today} showing={showingDue} onToggle={() => setOnlyDue(!showingDue)} />
        )}

        <Reminders ledger={ledger} />

        {clients.length === 0 ? (
          <EmptyState
            Icon={Users}
            title="لسه مفيش عملاء"
            text="ضيف أول عميل، وسجّل اللي إديته واللي خدته منه، والبرنامج يحسب الرصيد لوحده."
          >
            <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
              ضيف أول عميل
            </button>
          </EmptyState>
        ) : (
          <>
            <div className="toolbar">
              <label className="search">
                <Search aria-hidden="true" size={20} />
                <span className="sr-only">دوّر على عميل</span>
                <input
                  type="search"
                  className="search-input"
                  placeholder="دوّر بالاسم أو الرقم"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  enterKeyHint="search"
                />
              </label>
              <select
                className="input input--compact"
                aria-label="ترتيب العملاء"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                {Object.entries(CLIENT_SORTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <p className="list-meta">
              {showingDue
                ? `${countAr(dueNow.length, CLIENT_WORDS)} ميعاد سدادهم جه`
                : countAr(clients.length, CLIENT_WORDS)}
            </p>

            {rows.length === 0 ? (
              <p className="no-results">مفيش عميل بالاسم ده.</p>
            ) : (
              <ul className="list" aria-label="العملاء">
                {rows.map((client) => {
                  const info = balances.get(client.id);
                  const due = dueStatus(client.dueDate, balanceOf(balances, client.id), today);
                  return (
                    <li key={client.id}>
                      <a
                        className="row"
                        href={`#${clientPath(client.id)}`}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(clientPath(client.id));
                        }}
                      >
                        <span className="avatar" aria-hidden="true">
                          {Array.from(client.name)[0]}
                        </span>
                        <span className="row-main">
                          <span className="row-title">{client.name}</span>
                          <span className="row-sub">
                            {info ? `آخر حركة: ${formatDayLabel(info.lastDate, today)}` : 'مفيش حركات لسه'}
                          </span>
                          {due && <span className={`due-badge due-badge--${due.kind}`}>{due.short}</span>}
                        </span>
                        <BalanceTag balance={info?.balance ?? 0} />
                        <ChevronLeft aria-hidden="true" size={18} className="row-chevron" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>

      {clients.length > 0 && <Fab label="عميل جديد" onClick={() => setAdding(true)} />}
      {adding && (
        <ClientFormDialog onClose={() => setAdding(false)} onSaved={(client) => navigate(clientPath(client.id))} />
      )}
    </>
  );
}

/** Clients whose due date came: open the one, or list them all. */
function DueNotice({ dueNow, today, showing, onToggle }) {
  const [first] = dueNow;
  const names = dueNow.slice(0, 3).map((client) => client.name);
  const more = dueNow.length - names.length;

  let title;
  if (dueNow.length === 1) {
    title = first.dueDate === today ? `ميعاد سداد ${first.name} النهارده` : `ميعاد سداد ${first.name} فات`;
  } else {
    title = `${countAr(dueNow.length, CLIENT_WORDS)} ميعاد سدادهم جه`;
  }

  return (
    <section className="notice notice--due" aria-label="مواعيد السداد">
      <CalendarClock aria-hidden="true" size={22} className="notice-icon" />
      <div className="notice-text">
        <strong>{title}</strong>
        <span>
          {dueNow.length > 1 && `${names.join('، ')}${more > 0 ? ` و${countAr(more, CLIENT_WORDS)} كمان` : ''}. `}
          كلمهم أو ابعتلهم تذكير على واتساب.
        </span>
      </div>
      <div className="notice-actions">
        {dueNow.length === 1 ? (
          <button type="button" className="btn btn--primary btn--small" onClick={() => navigate(clientPath(first.id))}>
            افتح حسابه
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--small" aria-pressed={showing} onClick={onToggle}>
            {showing ? 'اعرض كل العملاء' : 'اعرضهم'}
          </button>
        )}
      </div>
    </section>
  );
}

/** One gentle nudge at a time: back up the data first, then install the app. */
function Reminders({ ledger }) {
  const toast = useToast();
  const canInstall = useCanInstall();
  const { settings } = ledger;

  if (needsBackupReminder(ledger)) {
    const days = settings.lastBackupAt ? daysSince(settings.lastBackupAt) : null;
    const backUp = async () => {
      try {
        if (canShareFiles()) {
          if (!(await shareBackup())) return;
        } else {
          await downloadBackup();
        }
        toast('تمام، اتعملت نسخة احتياطية');
      } catch (error) {
        console.error(error);
        toast('معرفناش نعمل النسخة. جرّب من الإعدادات.', { tone: 'error' });
      }
    };
    return (
      <section className="notice">
        <CloudUpload aria-hidden="true" size={22} className="notice-icon" />
        <div className="notice-text">
          <strong>{days === null ? 'لسه ماعملتش نسخة احتياطية' : `آخر نسخة احتياطية ${daysAgoText(days)}`}</strong>
          <span>البيانات على الموبايل ده بس. ابعت نسخة لنفسك على واتساب أو Drive.</span>
        </div>
        <div className="notice-actions">
          <button type="button" className="btn btn--primary btn--small" onClick={backUp}>
            اعمل نسخة
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => snoozeBackupReminder()}>
            بعدين
          </button>
        </div>
      </section>
    );
  }

  if (canInstall && !settings.installDismissed && !isStandalone()) {
    return (
      <section className="notice">
        <Smartphone aria-hidden="true" size={22} className="notice-icon" />
        <div className="notice-text">
          <strong>ثبّت HATAB على موبايلك</strong>
          <span>يفتح من الشاشة الرئيسية زي أي تطبيق، ويشتغل من غير نت.</span>
        </div>
        <div className="notice-actions">
          <button type="button" className="btn btn--primary btn--small" onClick={() => promptInstall()}>
            ثبّت
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="مش دلوقتي"
            onClick={() => setSetting('installDismissed', true)}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
      </section>
    );
  }

  return null;
}
