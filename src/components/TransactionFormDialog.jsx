import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addTransaction, deleteTransaction, updateTransaction } from '../db/repo.js';
import { todayISO } from '../domain/dates.js';
import { balanceOf, balanceText, compareNames, GAVE, GOT, signedAmount } from '../domain/ledger.js';
import { amountToInput, parseAmount } from '../domain/money.js';
import { validateTransactionInput } from '../domain/validation.js';
import { useLedger } from '../state/LedgerContext.js';
import { useConfirm } from './confirm.js';
import Dialog from './Dialog.jsx';
import Field from './Field.jsx';
import { useToast } from './toast.js';

const TYPE_LABELS = {
  withClient: { [GAVE]: 'إديته', [GOT]: 'خدت منه' },
  withoutClient: { [GAVE]: 'خرج', [GOT]: 'دخل' },
};

/**
 * Records an entry, or edits `transaction`. On a client's page the client is fixed
 * (`lockClient`); on the entries screen it can be chosen or left empty.
 */
export default function TransactionFormDialog({ transaction = null, clientId = null, type = GAVE, lockClient = false, onClose }) {
  const { clients, clientsById, balances } = useLedger();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(() => ({
    type: transaction?.type ?? type,
    amount: transaction ? amountToInput(transaction.amount) : '',
    date: transaction?.date ?? todayISO(),
    note: transaction?.note ?? '',
    clientId: (transaction ? transaction.clientId : clientId) ?? '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const client = form.clientId ? clientsById.get(form.clientId) : null;
  const labels = client ? TYPE_LABELS.withClient : TYPE_LABELS.withoutClient;
  const sortedClients = useMemo(() => [...clients].sort(compareNames), [clients]);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  let title = 'حركة جديدة';
  if (transaction) title = 'تعديل الحركة';
  else if (client) title = form.type === GAVE ? `إديت ${client.name}` : `خدت من ${client.name}`;

  // What the client's balance will be after saving, so mistakes are easy to spot.
  let preview = null;
  if (client) {
    const sameClient = transaction && transaction.clientId === client.id;
    const base = balanceOf(balances, client.id) - (sameClient ? signedAmount(transaction) : 0);
    const amount = parseAmount(form.amount);
    preview =
      amount === null
        ? `الرصيد دلوقتي: ${balanceText(base)}`
        : `الرصيد بعد الحركة دي: ${balanceText(base + signedAmount({ type: form.type, amount }))}`;
  }

  const submit = async (event) => {
    event.preventDefault();
    const check = validateTransactionInput(form);
    setErrors(check.errors);
    if (!check.ok) return;

    setSaving(true);
    try {
      if (transaction) {
        await updateTransaction(transaction.id, check.values);
        toast('اتحفظ التعديل');
      } else {
        await addTransaction(check.values);
        toast('اتسجلت الحركة');
      }
      onClose();
    } catch (error) {
      console.error(error);
      setErrors({ form: 'حصلت مشكلة ومتحفظش. جرّب تاني.' });
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'تمسح الحركة دي؟',
      message: 'مش هتعرف ترجّعها غير من نسخة احتياطية.',
      confirmLabel: 'امسحها',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTransaction(transaction.id);
      toast('اتمسحت الحركة');
      onClose();
    } catch (error) {
      console.error(error);
      setErrors({ form: 'حصلت مشكلة ومتمسحتش. جرّب تاني.' });
    }
  };

  return (
    <Dialog title={title} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <fieldset className="segmented">
          <legend className="sr-only">نوع الحركة</legend>
          {[GAVE, GOT].map((value) => (
            <label key={value} className={`segment segment--${value}`}>
              <input
                type="radio"
                name="type"
                value={value}
                checked={form.type === value}
                onChange={() => setForm((current) => ({ ...current, type: value }))}
              />
              <span>{labels[value]}</span>
            </label>
          ))}
        </fieldset>

        <Field label="المبلغ" error={errors.amount} hint={errors.amount ? null : preview}>
          {(props) => (
            <div className="input-with-suffix">
              <input
                {...props}
                className="input input--ltr input--amount"
                inputMode="decimal"
                dir="ltr"
                placeholder="0"
                value={form.amount}
                onChange={update('amount')}
                autoComplete="off"
                autoFocus
              />
              <span className="input-suffix" aria-hidden="true">
                ج.م
              </span>
            </div>
          )}
        </Field>

        {!lockClient && (
          <Field label="العميل">
            {(props) => (
              <select {...props} className="input" value={form.clientId} onChange={update('clientId')}>
                <option value="">بدون عميل (مصروف أو بيع نقدي)</option>
                {sortedClients.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        <div className="form-row">
          <Field label="التاريخ" error={errors.date}>
            {(props) => <input {...props} className="input" type="date" value={form.date} onChange={update('date')} />}
          </Field>
          <Field label="ملاحظة" error={errors.note}>
            {(props) => (
              <input
                {...props}
                className="input"
                placeholder="مثلًا: 2 كيلو سكر"
                value={form.note}
                onChange={update('note')}
                maxLength={200}
                autoComplete="off"
              />
            )}
          </Field>
        </div>

        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="dialog-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {transaction ? 'حفظ' : 'سجّل'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
        {transaction && (
          <button type="button" className="btn btn--link-danger" onClick={remove}>
            <Trash2 aria-hidden="true" size={18} />
            مسح الحركة
          </button>
        )}
      </form>
    </Dialog>
  );
}
