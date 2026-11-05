import { useCallback, useState } from 'react';
import { ConfirmContext } from './confirm.js';
import Dialog from './Dialog.jsx';

export default function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setRequest({ ...options, resolve });
      }),
    [],
  );

  const answer = (value) => {
    request?.resolve(value);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <Dialog title={request.title} onClose={() => answer(false)} alert>
          <p className="dialog-text">{request.message}</p>
          <div className="dialog-actions">
            <button
              type="button"
              className={`btn ${request.danger ? 'btn--danger' : 'btn--primary'}`}
              onClick={() => answer(true)}
            >
              {request.confirmLabel ?? 'تمام'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => answer(false)} autoFocus>
              {request.cancelLabel ?? 'لأ، رجوع'}
            </button>
          </div>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}
