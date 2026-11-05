import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

/**
 * A modal built on the native <dialog>: it keeps keyboard focus inside, closes with Esc,
 * and closes when tapping outside. Render it only while it should be open.
 */
export default function Dialog({ title, onClose, children, alert = false }) {
  const ref = useRef(null);
  const pressedOutside = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const handleCancel = (event) => {
    event.preventDefault();
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      role={alert ? 'alertdialog' : undefined}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onPointerDown={(event) => {
        pressedOutside.current = event.target === ref.current;
      }}
      onClick={(event) => {
        if (pressedOutside.current && event.target === ref.current) onClose();
        pressedOutside.current = false;
      }}
    >
      <div className="dialog-body">
        <header className="dialog-header">
          <h2 id={titleId} className="dialog-title">
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="قفل">
            <X aria-hidden="true" size={22} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
