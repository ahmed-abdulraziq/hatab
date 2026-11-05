import { ArrowRight, Plus, ReceiptText, Settings, Users } from 'lucide-react';
import { describeBalance } from '../domain/ledger.js';
import { formatAmount, formatMoney } from '../domain/money.js';
import { goBack, navigate } from '../router.js';

export function AppBar({ title, subtitle, back = false, actions = null }) {
  return (
    <header className="appbar">
      {back && (
        <button type="button" className="icon-btn icon-btn--on-brand" onClick={() => goBack()} aria-label="رجوع">
          <ArrowRight aria-hidden="true" size={24} />
        </button>
      )}
      <div className="appbar-titles">
        <h1 className="appbar-title">{title}</h1>
        {subtitle && <p className="appbar-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="appbar-actions">{actions}</div>}
    </header>
  );
}

const TABS = [
  { route: 'clients', path: '/', label: 'العملاء', Icon: Users },
  { route: 'transactions', path: '/transactions', label: 'الحركات', Icon: ReceiptText },
  { route: 'settings', path: '/settings', label: 'الإعدادات', Icon: Settings },
];

export function TabBar({ current }) {
  return (
    <nav className="tabbar" aria-label="أقسام البرنامج">
      {TABS.map(({ route, path, label, Icon }) => (
        <a
          key={route}
          href={`#${path}`}
          className="tab"
          aria-current={current === route ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            navigate(path, { replace: true });
          }}
        >
          <Icon aria-hidden="true" size={22} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}

export function Fab({ label, onClick }) {
  return (
    <button type="button" className="fab" onClick={onClick}>
      <Plus aria-hidden="true" size={22} />
      <span>{label}</span>
    </button>
  );
}

export function EmptyState({ Icon, title, text, children }) {
  return (
    <div className="empty">
      {Icon && <Icon aria-hidden="true" size={40} className="empty-icon" />}
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
      {children}
    </div>
  );
}

/** "150 ج.م / عليه" — what a client owes (red) or is owed (green). */
export function BalanceTag({ balance }) {
  const { kind, label } = describeBalance(balance);
  return (
    <span className={`balance-tag balance-tag--${kind}`}>
      {kind !== 'settled' && <span className="balance-tag-amount">{formatMoney(balance)}</span>}
      <span className="balance-tag-label">{label}</span>
    </span>
  );
}

/** A signed amount that reads correctly inside Arabic text: "−1,250 ج.م". */
export function SignedMoney({ value }) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return (
    <>
      <bdi dir="ltr">
        {sign}
        {formatAmount(value)}
      </bdi>{' '}
      ج.م
    </>
  );
}
