import { useEffect, useMemo, useRef, useState } from 'react';
import { createBehavior } from '../services/behaviorService';
import { validateBehaviorCode } from '../utils/behaviorCodeValidator';
import '../pages/BehaviorDetail.css';
import './CreateBehaviorDialog.css';

const TYPE_OPTIONS = [
  { value: 'playerBehavior', label: 'Jugador' },
  { value: 'coachBehavior', label: 'Director técnico (DT)' },
];

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

// Textarea con una capa detrás que pinta la línea (y el carácter) con error.
function CodeEditor({ id, value, onChange, error, disabled }) {
  const backdropRef = useRef(null);

  const syncScroll = (event) => {
    backdropRef.current.scrollTop = event.target.scrollTop;
    backdropRef.current.scrollLeft = event.target.scrollLeft;
  };

  const lines = value.split('\n');
  const hasMark = error && error.line >= 1 && error.line <= lines.length;
  let backdrop = value;
  if (hasMark) {
    const text = lines[error.line - 1];
    const col = Math.min(Math.max(error.column, 1), text.length + 1);
    const before = lines.slice(0, error.line - 1).map((l) => `${l}\n`).join('');
    const after = lines.slice(error.line).map((l) => `\n${l}`).join('');
    backdrop = (
      <>
        {before}
        <mark className="create-behavior__err-line" data-testid="code-error-line">
          {text.slice(0, col - 1)}
          <span className="create-behavior__err-col">{text.charAt(col - 1) || ' '}</span>
          {text.slice(col)}
        </mark>
        {after}
      </>
    );
  }

  return (
    <div className="create-behavior__editor">
      <pre ref={backdropRef} className="create-behavior__backdrop" aria-hidden="true">
        {backdrop}
        {'\n '}
      </pre>
      <textarea
        id={id}
        className="create-behavior__textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
        disabled={disabled}
        spellCheck={false}
        wrap="off"
        aria-invalid={Boolean(error)}
      />
    </div>
  );
}

export default function CreateBehaviorDialog({ onClose, onCreated }) {
  const dialogRef = useRef(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('playerBehavior');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Error de código que informó el servidor, atado al código/tipo con el que se envió:
  // si el usuario edita, deja de aplicar (se deriva en el render, sin efectos).
  const [serverCodeError, setServerCodeError] = useState(null);

  const clientCodeError = useMemo(() => validateBehaviorCode(code, type), [code, type]);
  const activeServerError =
    serverCodeError && serverCodeError.code === code && serverCodeError.type === type
      ? serverCodeError.error
      : null;
  const codeError = clientCodeError ?? activeServerError;

  const canSubmit =
    name.trim() !== '' && code.trim() !== '' && !clientCodeError && !isSubmitting;

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
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
              <label htmlFor="behavior-type">Tipo</label>
              <select
                id="behavior-type"
                value={type}
                onChange={(event) => setType(event.target.value)}
                disabled={isSubmitting}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="create-behavior__field">
              <label htmlFor="behavior-code">Código</label>
              <CodeEditor
                id="behavior-code"
                value={code}
                onChange={setCode}
                error={codeError}
                disabled={isSubmitting}
              />
              {codeError && (
                <p className="create-behavior__code-error" role="alert">
                  {describeCodeError(codeError)}
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