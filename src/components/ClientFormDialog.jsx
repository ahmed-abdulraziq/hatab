import { useState } from 'react';
import { addClient, updateClient } from '../db/repo.js';
import { validateClientInput } from '../domain/validation.js';
import { useLedger } from '../state/LedgerContext.js';
import Dialog from './Dialog.jsx';
import Field from './Field.jsx';
import { useToast } from './toast.js';

/** Adds a client, or edits one when `client` is given. */
export default function ClientFormDialog({ client = null, onClose, onSaved }) {
  const { clients } = useLedger();
  const toast = useToast();
  const [form, setForm] = useState({
    name: client?.name ?? '',
    phone: client?.phone ?? '',
    address: client?.address ?? '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const check = validateClientInput(form, clients, client?.id ?? null);
    setErrors(check.errors);
    if (!check.ok) return;

    setSaving(true);
    try {
      if (client) {
        await updateClient(client.id, check.values);
        toast('اتحفظت بيانات العميل');
        onSaved?.({ ...client, ...check.values });
      } else {
        const created = await addClient(check.values);
        toast(`اتضاف ${created.name}`);
        onSaved?.(created);
      }
      onClose();
    } catch (error) {
      console.error(error);
      setErrors({ form: 'حصلت مشكلة ومتحفظش. جرّب تاني.' });
      setSaving(false);
    }
  };

  return (
    <Dialog title={client ? 'تعديل بيانات العميل' : 'عميل جديد'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="الاسم" error={errors.name}>
          {(props) => (
            <input
              {...props}
              className="input"
              value={form.name}
              onChange={update('name')}
              autoComplete="off"
              maxLength={80}
              autoFocus
            />
          )}
        </Field>
        <Field label="رقم الموبايل" hint="اختياري. بنستخدمه للاتصال وللتذكير على واتساب." error={errors.phone}>
          {(props) => (
            <input
              {...props}
              className="input input--ltr"
              type="tel"
              inputMode="tel"
              dir="ltr"
              placeholder="01012345678"
              value={form.phone}
              onChange={update('phone')}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="العنوان" hint="اختياري" error={errors.address}>
          {(props) => (
            <input
              {...props}
              className="input"
              value={form.address}
              onChange={update('address')}
              autoComplete="off"
              maxLength={200}
            />
          )}
        </Field>
        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="dialog-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {client ? 'حفظ' : 'ضيف العميل'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Dialog>
  );
}
