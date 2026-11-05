import { Download, FileSpreadsheet, Share2, ShieldCheck, Smartphone, TriangleAlert, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { downloadBackup, shareBackup } from '../backupActions.js';
import { useConfirm } from '../components/confirm.js';
import Field from '../components/Field.jsx';
import { useToast } from '../components/toast.js';
import { AppBar } from '../components/ui.jsx';
import { isStoragePersisted, replaceAllData, setSetting } from '../db/repo.js';
import { BackupError, exportFileName, parseBackup, transactionsToCSV } from '../domain/backup.js';
import { daysAgoText, daysSince } from '../domain/dates.js';
import { cleanText, CLIENT_WORDS, countAr, TX_WORDS } from '../domain/text.js';
import { canShareFiles, downloadFile } from '../files.js';
import { isIOS, isStandalone, promptInstall, useCanInstall } from '../pwa/install.js';
import { useLedger } from '../state/LedgerContext.js';

function describeData(clientCount, txCount) {
  if (clientCount === 0 && txCount === 0) return 'مفيش بيانات';
  const parts = [];
  if (clientCount) parts.push(countAr(clientCount, CLIENT_WORDS));
  if (txCount) parts.push(countAr(txCount, TX_WORDS));
  return parts.join(' و');
}

export default function SettingsScreen() {
  const { settings, clients, transactions, clientsById } = useLedger();
  const toast = useToast();
  const confirm = useConfirm();
  const canInstall = useCanInstall();
  const fileInput = useRef(null);
  const [shopName, setShopName] = useState(settings.shopName ?? '');
  const [persisted, setPersisted] = useState(null);
  const [canShare] = useState(canShareFiles);

  useEffect(() => {
    let active = true;
    isStoragePersisted().then((value) => {
      if (active) setPersisted(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const lastBackupDays = settings.lastBackupAt ? daysSince(settings.lastBackupAt) : null;

  const saveShopName = async (event) => {
    event.preventDefault();
    const value = cleanText(shopName);
    await setSetting('shopName', value);
    setShopName(value);
    toast('اتحفظ الاسم');
  };

  const run = async (action, success) => {
    try {
      const done = await action();
      if (done !== false) toast(success);
    } catch (error) {
      console.error(error);
      toast('حصلت مشكلة. جرّب تاني.', { tone: 'error' });
    }
  };

  const restore = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    let data;
    try {
      data = parseBackup(await file.text());
    } catch (error) {
      toast(error instanceof BackupError ? error.message : 'معرفناش نقرا الملف ده.', { tone: 'error' });
      return;
    }

    const ok = await confirm({
      title: 'ترجّع البيانات من النسخة دي؟',
      message: `اللي على الجهاز دلوقتي (${describeData(clients.length, transactions.length)}) هيتمسح ويتحط مكانه اللي في النسخة (${describeData(data.clients.length, data.transactions.length)}).`,
      confirmLabel: 'رجّع البيانات',
      danger: true,
    });
    if (!ok) return;

    await run(async () => {
      await replaceAllData(data);
      setShopName(data.settings.shopName);
    }, 'رجعت البيانات من النسخة الاحتياطية');
  };

  const exportCsv = () => {
    const csv = transactionsToCSV(transactions, clientsById);
    downloadFile(new File([csv], exportFileName('transactions', 'csv'), { type: 'text/csv;charset=utf-8' }));
  };

  return (
    <>
      <AppBar title="الإعدادات" />
      <main className="screen settings">
        <section className="card">
          <h2 className="card-title">اسم المحل</h2>
          <form className="form" onSubmit={saveShopName}>
            <Field label="اسم المحل أو اسمك" hint="بيظهر في آخر رسالة التذكير على واتساب وفي كشف الحساب.">
              {(props) => (
                <input
                  {...props}
                  className="input"
                  value={shopName}
                  onChange={(event) => setShopName(event.target.value)}
                  maxLength={80}
                  placeholder="مثلًا: بقالة الأمل"
                  autoComplete="organization"
                />
              )}
            </Field>
            <button type="submit" className="btn btn--primary btn--small">
              حفظ
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="card-title">النسخة الاحتياطية</h2>
          <p className="card-text">
            البيانات متسجلة على الجهاز ده بس. لو الموبايل ضاع أو اتمسحت بيانات المتصفح، هتحتاج نسخة احتياطية عشان
            ترجّعها. اعمل واحدة كل أسبوع وابعتها لنفسك.
          </p>
          <p className="card-meta">
            عندك دلوقتي: {describeData(clients.length, transactions.length)}.{' '}
            {lastBackupDays === null ? 'لسه ماعملتش نسخة احتياطية.' : `آخر نسخة: ${daysAgoText(lastBackupDays)}.`}
          </p>
          <div className="button-stack">
            {canShare && (
              <button type="button" className="btn btn--primary" onClick={() => run(shareBackup, 'اتبعتت النسخة الاحتياطية')}>
                <Share2 aria-hidden="true" size={18} />
                ابعت نسخة (واتساب أو Drive)
              </button>
            )}
            <button
              type="button"
              className={`btn ${canShare ? 'btn--ghost' : 'btn--primary'}`}
              onClick={() => run(downloadBackup, 'نزلت النسخة الاحتياطية')}
            >
              <Download aria-hidden="true" size={18} />
              نزّل نسخة على الجهاز
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => fileInput.current?.click()}>
              <Upload aria-hidden="true" size={18} />
              رجّع من نسخة احتياطية
            </button>
            <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={restore} />
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Excel</h2>
          <p className="card-text">نزّل كل الحركات في ملف يفتح في Excel أو Google Sheets.</p>
          <button type="button" className="btn btn--ghost" onClick={exportCsv} disabled={transactions.length === 0}>
            <FileSpreadsheet aria-hidden="true" size={18} />
            نزّل الحركات (CSV)
          </button>
        </section>

        <section className="card">
          <h2 className="card-title">التطبيق</h2>
          {isStandalone() ? (
            <p className="card-text">البرنامج متثبت على الجهاز ده.</p>
          ) : canInstall ? (
            <button type="button" className="btn btn--primary" onClick={() => promptInstall()}>
              <Smartphone aria-hidden="true" size={18} />
              ثبّت البرنامج على الجهاز
            </button>
          ) : (
            <p className="card-text">
              {isIOS()
                ? 'على الآيفون: افتح البرنامج من Safari، دوس على زرار المشاركة، واختار «Add to Home Screen».'
                : 'من قايمة المتصفح اختار «Install app» أو «Add to Home screen» عشان يفتح زي أي تطبيق.'}
            </p>
          )}
          {persisted === true && (
            <p className="card-meta status status--ok">
              <ShieldCheck aria-hidden="true" size={18} />
              المتصفح مش هيمسح بياناتك لوحده.
            </p>
          )}
          {persisted === false && (
            <p className="card-meta status status--warn">
              <TriangleAlert aria-hidden="true" size={18} />
              ممكن المتصفح يمسح البيانات لو مساحة الجهاز قلّت، فخلّي عندك نسخة احتياطية.
            </p>
          )}
          <p className="card-meta">HATAB · الإصدار {__APP_VERSION__}</p>
        </section>
      </main>
    </>
  );
}
