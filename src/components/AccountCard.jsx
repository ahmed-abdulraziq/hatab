import { useLiveQuery } from 'dexie-react-hooks';
import { CloudCheck, CloudOff, LogOut, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { formatMoment } from '../domain/dates.js';
import { CHANGE_WORDS, cleanText, countAr } from '../domain/text.js';
import { ApiError, DEFAULT_SERVER_URL, describeError, normalizeServerUrl } from '../sync/api.js';
import { countPending, signIn, signOut } from '../sync/engine.js';
import { syncNow, useSyncState } from '../sync/scheduler.js';
import { useLedger } from '../state/LedgerContext.js';
import { useConfirm } from './confirm.js';
import Field from './Field.jsx';
import { useToast } from './toast.js';

/** Settings card: log in or create an account, then see how syncing is going. */
export default function AccountCard() {
  const { settings } = useLedger();
  return (
    <section className="card" aria-labelledby="account-title">
      <h2 id="account-title" className="card-title">
        الحساب والمزامنة
      </h2>
      {settings.authToken ? <SignedIn settings={settings} /> : <SignedOut settings={settings} />}
    </section>
  );
}

const MODES = { login: 'عندي حساب', register: 'حساب جديد' };

function SignedOut({ settings }) {
  const toast = useToast();
  const sync = useSyncState();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    name: '',
    email: settings.account?.email ?? '',
    password: '',
    serverUrl: settings.serverUrl || DEFAULT_SERVER_URL,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const loggedOutByServer = sync.phase === 'error' && sync.error instanceof ApiError && sync.error.status === 401;

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (mode === 'register' && !cleanText(form.name)) found.name = 'اكتب اسمك';
    if (!form.email.trim()) found.email = 'اكتب البريد الإلكتروني';
    if (!form.password) found.password = 'اكتب كلمة السر';
    const serverUrl = normalizeServerUrl(form.serverUrl);
    if (!/^https?:\/\/\S+$/i.test(serverUrl)) found.serverUrl = 'اكتب عنوان السيرفر، زي https://api.example.com';
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const { user, replacedBook } = await signIn({
        mode,
        serverUrl,
        name: cleanText(form.name),
        email: form.email.trim(),
        password: form.password,
      });
      toast(
        replacedBook
          ? 'دخلت. الدفتر اللي كان على الجهاز تبع حساب تاني، فهنجيب دفتر الحساب ده.'
          : `أهلًا يا ${user.name}. بنزامن دفترك دلوقتي.`,
        { duration: 5000 },
      );
      void syncNow();
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.status === 422) {
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])));
      } else {
        setErrors({ form: describeError(error) });
      }
    }
  };

  const serverField = (
    <Field label="عنوان السيرفر" hint="عنوان الـ API، زي https://api.example.com" error={errors.serverUrl}>
      {(props) => (
        <input
          {...props}
          className="input input--ltr"
          type="url"
          inputMode="url"
          dir="ltr"
          value={form.serverUrl}
          onChange={update('serverUrl')}
          autoComplete="url"
          placeholder="https://"
        />
      )}
    </Field>
  );

  return (
    <>
      <p className="card-text">
        ادخل بحسابك عشان دفترك يتحفظ على السيرفر ويتزامن مع أي جهاز تاني تدخل منه. البرنامج هيفضل شغال من غير
        نت زي ما هو.
      </p>
      {loggedOutByServer && (
        <p className="card-meta status status--warn">
          <TriangleAlert aria-hidden="true" size={18} />
          {describeError(sync.error)}
        </p>
      )}
      <form className="form" onSubmit={submit} noValidate>
        <fieldset className="segmented">
          <legend className="sr-only">دخول أو حساب جديد</legend>
          {Object.entries(MODES).map(([value, label]) => (
            <label key={value} className="segment segment--mode">
              <input
                type="radio"
                name="account-mode"
                value={value}
                checked={mode === value}
                onChange={() => {
                  setMode(value);
                  setErrors({});
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        {mode === 'register' && (
          <Field label="اسمك" error={errors.name}>
            {(props) => (
              <input {...props} className="input" value={form.name} onChange={update('name')} autoComplete="name" maxLength={80} />
            )}
          </Field>
        )}
        <Field label="البريد الإلكتروني" error={errors.email}>
          {(props) => (
            <input
              {...props}
              className="input input--ltr"
              type="email"
              inputMode="email"
              dir="ltr"
              value={form.email}
              onChange={update('email')}
              autoComplete="email"
            />
          )}
        </Field>
        <Field label="كلمة السر" hint={mode === 'register' ? '8 حروف على الأقل' : null} error={errors.password}>
          {(props) => (
            <input
              {...props}
              className="input input--ltr"
              type="password"
              dir="ltr"
              value={form.password}
              onChange={update('password')}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          )}
        </Field>

        {DEFAULT_SERVER_URL ? (
          <details className="server-details" open={Boolean(errors.serverUrl)}>
            <summary>عنوان السيرفر</summary>
            {serverField}
          </details>
        ) : (
          serverField
        )}

        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {mode === 'register' ? 'اعمل الحساب' : 'ادخل'}
        </button>
      </form>
    </>
  );
}

function SignedIn({ settings }) {
  const toast = useToast();
  const confirm = useConfirm();
  const sync = useSyncState();
  const pending = useLiveQuery(countPending, [], 0);
  const account = settings.account ?? {};

  const logout = async () => {
    const ok = await confirm({
      title: 'تخرج من الحساب؟',
      message:
        pending > 0
          ? `فيه ${countAr(pending, CHANGE_WORDS)} على الجهاز ده لسه ماوصلتش للسيرفر. لو دخلت بعد كده بحساب تاني هيضيعوا، فالأحسن تزامن الأول.`
          : 'دفترك هيفضل على الجهاز ده وتقدر تستخدمه من غير نت، بس مش هيتزامن لحد ما تدخل تاني.',
      confirmLabel: 'اخرج',
      danger: pending > 0,
    });
    if (!ok) return;
    await signOut();
    toast('خرجت من الحساب');
  };

  let status;
  if (sync.phase === 'syncing') {
    status = { tone: 'ok', Icon: RefreshCw, text: 'بيزامن دلوقتي…' };
  } else if (sync.phase === 'offline') {
    status = { tone: 'warn', Icon: CloudOff, text: 'مفيش اتصال بالسيرفر. هنزامن لوحدنا لما النت يرجع.' };
  } else if (sync.phase === 'error') {
    status = { tone: 'warn', Icon: TriangleAlert, text: describeError(sync.error) };
  } else {
    const parts = [settings.lastSyncAt ? `آخر مزامنة: ${formatMoment(settings.lastSyncAt)}` : 'لسه مزامنش'];
    if (pending > 0) parts.push(`${countAr(pending, CHANGE_WORDS)} مستني يتبعت`);
    status = { tone: 'ok', Icon: CloudCheck, text: parts.join(' · ') };
  }

  return (
    <>
      <p className="card-text">
        داخل باسم <strong>{account.name}</strong>
        <br />
        <bdi dir="ltr" className="muted">
          {account.email}
        </bdi>
      </p>
      <p className={`card-meta status status--${status.tone}`} role="status">
        <status.Icon aria-hidden="true" size={18} />
        {status.text}
      </p>
      {sync.rejected > 0 && (
        <p className="card-meta status status--warn">
          <TriangleAlert aria-hidden="true" size={18} />
          {`فيه ${countAr(sync.rejected, CHANGE_WORDS)} تبع حساب تاني، ومش هيتزامنوا.`}
        </p>
      )}
      <div className="button-stack">
        <button type="button" className="btn btn--primary" onClick={() => syncNow()} disabled={sync.phase === 'syncing'}>
          <RefreshCw aria-hidden="true" size={18} />
          زامن دلوقتي
        </button>
        <button type="button" className="btn btn--ghost" onClick={logout}>
          <LogOut aria-hidden="true" size={18} />
          اخرج من الحساب
        </button>
      </div>
    </>
  );
}
