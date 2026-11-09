import { useEffect, useId, useRef } from 'react';
import './BehaviorModal.css';
import './ConfirmDialog.css';

/**
 * Confirmación de una acción destructiva. Se dibuja encima de lo que haya (popup sobre popup).
 * Escape, clic en el fondo y "Cancelar" cancelan, salvo mientras `isBusy` (request en curso).
 */
export default function ConfirmDialog({
  message,
  confirmLabel = 'Confirmar',
  busyLabel,
  cancelLabel = 'Cancelar',
  isBusy = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const messageId = useId();

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isBusy) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel, isBusy]);

  return (
    <div
      className="modal__overlay"
      data-testid="confirm-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={messageId}
        className="modal__window confirm__window"
      >
        <div className="modal__body">
          <p id={messageId} className="confirm__message">
            {message}
          </p>
        </div>
        <footer className="modal__footer">
          <button type="button" onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </button>
          <button type="button" className="confirm__danger" onClick={onConfirm} disabled={isBusy}>
            {isBusy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
