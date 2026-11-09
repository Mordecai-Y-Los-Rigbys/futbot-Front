import { useEffect, useId, useRef } from 'react';
import './Modal.css';

// Ventana modal simple: tapa la pantalla, se cierra con Escape y devuelve el foco al abrirse.
// `isBusy` bloquea el cierre con Escape mientras hay una request en curso.
export default function Modal({ title, onClose, isBusy = false, children }) {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isBusy) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isBusy]);

  return (
    <div className="modal__overlay">
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
