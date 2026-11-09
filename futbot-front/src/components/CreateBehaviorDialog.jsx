import { useEffect, useMemo, useRef, useState } from 'react';
import { createBehavior } from '../services/behaviorService';
import { validateBehaviorCodeAll, validateBehaviorCodeLength } from '../utils/behaviorCodeValidator';
import BehaviorCodeEditor from './BehaviorCodeEditor';
import '../pages/BehaviorDetail.css';
import './CreateBehaviorDialog.css';

const MAX_LISTED_ERRORS = 5;

// Por ahora el front solo crea comportamientos de jugador (el DT quedó fuera de alcance).
const BEHAVIOR_TYPE = 'playerBehavior';

// Mensajes de cada motivo del 409 de POST /behaviors.
const CONFLICT_MESSAGES = {
  duplicateName: 'Ya tenés un comportamiento con ese nombre. Elegí otro.',
  codeTooLong: 'El código es demasiado largo (máximo 250 líneas y 20000 caracteres).',
  invalidCode: 'El código no respeta la API de comportamientos del tipo elegido.',
};

const errorMessageFor = (err) => {
  if (!err.response) return 'No se pudo establecer conexión con el servidor.';
  const { status, data } = err.response;
  if (status === 400) {
    return data?.message || 'Los datos enviados no son válidos. Revisá el formulario.';
  }
  if (status === 401) {
    return data?.message || 'Tu sesión venció o no es válida. Iniciá sesión nuevamente.';
  }
  if (status === 409) {
    return CONFLICT_MESSAGES[data?.code] ?? data?.message ?? 'No se pudo crear el comportamiento.';
  }
  return data?.message || 'No se pudo crear el comportamiento. Intentá nuevamente.';
};

const describeCodeError = ({ line, column, message }) => `Línea ${line}, columna ${column}: ${message}`;

export default function CreateBehaviorDialog({ onClose, onCreated }) {
  const dialogRef = useRef(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const type = BEHAVIOR_TYPE; 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Error de código que informó el servidor, atado al código/tipo con el que se envió:
  // si el usuario edita, deja de aplicar (se deriva en el render, sin efectos).
  const [serverCodeError, setServerCodeError] = useState(null);

  const clientErrors = useMemo(() => validateBehaviorCodeAll(code, type), [code, type]);
  const lengthError = useMemo(() => validateBehaviorCodeLength(code), [code]);
  const activeServerError =
    serverCodeError && serverCodeError.code === code && serverCodeError.type === type
      ? serverCodeError.error
      : null;
  // Los del cliente tienen prioridad; el del servidor solo se muestra si el cliente no encuentra nada.
  const codeErrors = useMemo(
    () => (clientErrors.length > 0 ? clientErrors : activeServerError ? [activeServerError] : []),
    [clientErrors, activeServerError],
  );

  const canSubmit =
    name.trim() !== '' && code.trim() !== '' && clientErrors.length === 0 && !lengthError && !isSubmitting;

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Escape cierra el formulario, salvo mientras se escribe en el editor de código
  // (ahí Escape es para salir del editor con el teclado).
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || isSubmitting) return;
      if (event.target instanceof Element && event.target.closest('.cm-editor')) return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, isSubmitting]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await createBehavior({ name: name.trim(), code, type });
      onCreated(created);
    } catch (err) {
      setError(errorMessageFor(err));
      const data = err.response?.data;
      const isInvalidCode = err.response?.status === 409 && data?.code === 'invalidCode';
      setServerCodeError(
        isInvalidCode && data.codeError ? { code, type, error: data.codeError } : null,
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="behavior-detail__overlay"
      data-testid="create-behavior-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-behavior-title"
        className="behavior-detail__window"
      >
        <header className="behavior-detail__header">
          <h2 id="create-behavior-title">Crear comportamiento</h2>
          <button
            type="button"
            className="behavior-detail__close"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form className="create-behavior__form" onSubmit={handleSubmit} noValidate>
          <div className="behavior-detail__body create-behavior__fields">
            {error && (
              <p className="behavior-detail__error" role="alert">
                {error}
              </p>
            )}

            <div className="create-behavior__field">
              <label htmlFor="behavior-name">Nombre</label>
              <input
                id="behavior-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isSubmitting}
                autoComplete="off"
              />
            </div>

            <div className="create-behavior__field">
              <span id="behavior-code-label" className="create-behavior__label">Código</span>
              <BehaviorCodeEditor
                value={code}
                onChange={setCode}
                diagnostics={codeErrors}
                disabled={isSubmitting}
                labelledBy="behavior-code-label"
              />
              {codeErrors.length > 0 && (
                <ul className="create-behavior__code-error" role="alert">
                  {codeErrors.slice(0, MAX_LISTED_ERRORS).map((codeError) => (
                    <li key={`${codeError.line}:${codeError.column}:${codeError.rule}`}>
                      {describeCodeError(codeError)}
                    </li>
                  ))}
                  {codeErrors.length > MAX_LISTED_ERRORS && (
                    <li>…y {codeErrors.length - MAX_LISTED_ERRORS} errores más.</li>
                  )}
                </ul>
              )}
              {lengthError && (
                <p className="create-behavior__code-error" role="alert">
                  {lengthError.message}
                </p>
              )}
            </div>
          </div>

          <footer className="behavior-detail__footer create-behavior__footer">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" disabled={!canSubmit}>
              {isSubmitting ? 'Creando…' : 'Confirmar'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}