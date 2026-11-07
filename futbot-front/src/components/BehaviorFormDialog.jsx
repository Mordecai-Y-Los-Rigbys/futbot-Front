import { useEffect, useMemo, useRef, useState } from 'react';
import { createBehavior, updateBehavior } from '../services/behaviorService';
import { validateBehaviorCodeAll, validateBehaviorCodeLength } from '../utils/behaviorCodeValidator';
import BehaviorCodeEditor from './BehaviorCodeEditor';
import '../pages/BehaviorDetail.css';
import './BehaviorModal.css';
import './BehaviorFormDialog.css';

const MAX_LISTED_ERRORS = 5;

// El front solo maneja comportamientos de jugador (el DT quedó fuera de alcance).
// Se usa para validar el código; el tipo no se muestra ni se envía al editar.
const BEHAVIOR_TYPE = 'playerBehavior';

const COPY = {
  create: {
    title: 'Crear comportamiento',
    submit: 'Confirmar',
    pending: 'Creando…',
    failure: 'No se pudo crear el comportamiento.',
  },
  edit: {
    title: 'Editar comportamiento',
    submit: 'Confirmar',
    pending: 'Guardando…',
    failure: 'No se pudo guardar el comportamiento.',
  },
};

// Mensajes de cada motivo del 409 (POST y PUT /behaviors).
const CONFLICT_MESSAGES = {
  duplicateName: 'Ya tenés un comportamiento con ese nombre. Elegí otro.',
  codeTooLong: 'El código es demasiado largo (máximo 250 líneas y 20000 caracteres).',
  invalidCode: 'El código no respeta la API de comportamientos.',
};

const errorMessageFor = (err, copy) => {
  if (!err.response) return 'No se pudo establecer conexión con el servidor.';
  const { status, data } = err.response;
  if (status === 400) {
    return data?.message || 'Los datos enviados no son válidos. Revisá el formulario.';
  }
  if (status === 401) {
    return data?.message || 'Tu sesión venció o no es válida. Iniciá sesión nuevamente.';
  }
  if (status === 403) return 'No tenés permiso para modificar este comportamiento.';
  if (status === 404) {
    return data?.code === 'deletedConcurrently'
      ? 'Este comportamiento fue eliminado mientras lo editabas.'
      : 'El comportamiento no existe o fue eliminado.';
  }
  if (status === 409) {
    return CONFLICT_MESSAGES[data?.code] ?? data?.message ?? copy.failure;
  }
  return data?.message || `${copy.failure} Intentá nuevamente.`;
};

const describeCodeError = ({ line, column, message }) => `Línea ${line}, columna ${column}: ${message}`;

/**
 * Formulario de comportamiento. Sin `behavior` crea (POST); con `behavior`
 * ({ id, name, code }) edita (PUT) partiendo de los valores actuales.
 * `onSaved` recibe el comportamiento creado o ya actualizado.
 */
export default function BehaviorFormDialog({ behavior = null, onClose, onSaved }) {
  const isEdit = behavior !== null;
  const copy = isEdit ? COPY.edit : COPY.create;
  // Al editar se valida contra el tipo del behavior (no se puede cambiar ni se muestra);
  // al crear, siempre jugador (el DT quedó fuera de alcance).
  const type = behavior?.type ?? BEHAVIOR_TYPE;

  const dialogRef = useRef(null);
  const [name, setName] = useState(behavior?.name ?? '');
  const [code, setCode] = useState(behavior?.code ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Error de código que informó el servidor, atado al código con el que se envió:
  // si el usuario edita, deja de aplicar (se deriva en el render, sin efectos).
  const [serverCodeError, setServerCodeError] = useState(null);

  const clientErrors = useMemo(() => validateBehaviorCodeAll(code, type), [code, type]);
  const lengthError = useMemo(() => validateBehaviorCodeLength(code), [code]);
  const activeServerError =
    serverCodeError && serverCodeError.code === code ? serverCodeError.error : null;
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

    const payload = { name: name.trim(), code };

    try {
      if (isEdit) {
        const updated = await updateBehavior(behavior.id, payload);
        // Si el back no devuelve el body completo, se conservan los valores enviados.
        onSaved({ ...behavior, ...payload, ...updated });
      } else {
        const created = await createBehavior({ ...payload, type });
        onSaved(created);
      }
    } catch (err) {
      setError(errorMessageFor(err, copy));
      const data = err.response?.data;
      const isInvalidCode = err.response?.status === 409 && data?.code === 'invalidCode';
      setServerCodeError(isInvalidCode && data.codeError ? { code, error: data.codeError } : null);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal__overlay"
      data-testid="behavior-form-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="behavior-form-title"
        className="modal__window"
      >
        <header className="modal__header">
          <h2 id="behavior-form-title">{copy.title}</h2>
          <button
            type="button"
            className="modal__close"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form className="create-behavior__form" onSubmit={handleSubmit} noValidate>
          <div className="modal__body create-behavior__fields">
            {error && (
              <p className="modal__error" role="alert">
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

          <footer className="modal__footer create-behavior__footer">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" disabled={!canSubmit}>
              {isSubmitting ? copy.pending : copy.submit}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}