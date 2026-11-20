import { useState } from 'react';
import { setDueDate } from '../db/repo.js';
import { dueDateChoices, validateDueDate } from '../domain/due.js';
import { formatDate } from '../domain/dates.js';
import Dialog from './Dialog.jsx';
import Field from './Field.jsx';
import { useToast } from './toast.js';

/** Sets, changes or removes the day a client promised to pay by. */
export default function DueDateDialog({ client, today, onClose }) {
  const toast = useToast();
  const choices = dueDateChoices(today);
  const [value, setValue] = useState(client.dueDate && client.dueDate >= today ? client.dueDate : choices[1].date);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async (dueDate, message) => {
    setSaving(true);
    try {
      await setDueDate(client.id, dueDate);
      toast(message);
      onClose();
    } catch (failure) {
      console.error(failure);
      setError('حصلت مشكلة ومتحفظش. جرّب تاني.');
      setSaving(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    const problem = validateDueDate(value, today);
    setError(problem);
    if (!problem) save(value, `ميعاد السداد: ${formatDate(value)}`);
  };

  return (
    <Dialog title="ميعاد السداد" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <p className="dialog-text">{client.name} هيدفع اللي عليه إمتى؟ لما الميعاد ييجي، هيظهر لك أول ما تفتح البرنامج.</p>

        <div className="chips" role="group" aria-label="اختيارات سريعة">
          {choices.map((choice) => (
            <button
              key={choice.label}
              type="button"
              className="chip"
              aria-pressed={value === choice.date}
              onClick={() => {
                setValue(choice.date);
                setError(null);
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>

        <Field label="اليوم" error={error} hint={error ? null : formatDate(value)}>
          {(props) => (
            <input
              {...props}
              type="date"
              className="input"
              min={today}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </Field>

        <div className="dialog-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            احفظ الميعاد
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
        {client.dueDate && (
          <button
            type="button"
            className="btn btn--link-danger"
            disabled={saving}
            onClick={() => save('', 'اتشال ميعاد السداد')}
          >
            شيل الميعاد
          </button>
        )}
      </form>
    </Dialog>
  );
}
