import { Download, LoaderCircle, MessageCircle, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { buildStatement, statementFileName } from '../domain/statement.js';
import { reminderMessage, whatsappUrl } from '../domain/whatsapp.js';
import { canShareFiles, downloadFile } from '../files.js';
import { renderStatement } from '../statementImage.js';
import Dialog from './Dialog.jsx';
import { useToast } from './toast.js';

/**
 * Shows the client's statement as a picture and sends it. The picture is drawn as soon as
 * the dialog opens, so tapping "ابعت" opens the share sheet right away: phones only allow
 * sharing straight after a tap, and drawing first would lose it on some of them.
 */
export default function StatementDialog({ client, transactions, balance, shopName, today, onClose }) {
  const toast = useToast();
  const [state, setState] = useState({ status: 'drawing' });

  useEffect(() => {
    let cancelled = false;
    const model = buildStatement({ client, transactions, shopName, today });
    renderStatement(model)
      .then((blob) => {
        if (cancelled) return;
        const file = new File([blob], statementFileName(client.name, today), { type: 'image/png' });
        setState({ status: 'ready', file, url: URL.createObjectURL(blob), canShare: canShareFiles(file) });
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setState({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [client, transactions, shopName, today]);

  // Each new picture replaces the last one; free the old one only once it's off screen.
  useEffect(() => {
    const { url } = state;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state]);

  const caption = reminderMessage({ clientName: client.name, balance, shopName, today });

  const share = async () => {
    try {
      await navigator.share({ files: [state.file], text: caption });
      onClose();
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error(error);
      downloadFile(state.file);
      toast('الموبايل مقبلش يبعت الصورة، فنزّلناها. ابعتها من المعرض.', { tone: 'error' });
    }
  };

  const download = () => {
    downloadFile(state.file);
    toast('اتنزّلت صورة الكشف');
  };

  return (
    <Dialog title={`كشف حساب ${client.name}`} onClose={onClose}>
      <div className="statement-preview">
        {state.status === 'drawing' && (
          <LoaderCircle className="spin" aria-label="بنجهّز الصورة" size={32} />
        )}
        {state.status === 'ready' && <img src={state.url} alt={`صورة كشف حساب ${client.name}`} />}
        {state.status === 'failed' && <p className="dialog-text">معرفناش نعمل الصورة. جرّب «طباعة» بدلها.</p>}
      </div>

      {state.status === 'ready' && !state.canShare && (
        <p className="statement-hint">
          المتصفح ده مش بيبعت صور على طول. نزّل الصورة، وبعدين افتح واتساب وابعتها من المرفقات.
        </p>
      )}

      <div className="dialog-actions">
        {state.canShare ? (
          <button type="button" className="btn btn--primary" onClick={share} disabled={state.status !== 'ready'}>
            <Share2 aria-hidden="true" size={18} />
            ابعت الصورة
          </button>
        ) : (
          <a
            className="btn btn--primary"
            href={whatsappUrl(client.phone, caption)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden="true" size={18} />
            افتح واتساب
          </a>
        )}
        <button type="button" className="btn btn--ghost" onClick={download} disabled={state.status !== 'ready'}>
          <Download aria-hidden="true" size={18} />
          نزّل الصورة
        </button>
      </div>
    </Dialog>
  );
}
