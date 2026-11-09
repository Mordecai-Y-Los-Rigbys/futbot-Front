import { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import axios from 'axios';
import BehaviorFormDialog from '../components/BehaviorFormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { deleteBehavior, getBehaviorById } from '../services/behaviorService';
import '../components/BehaviorModal.css';
import './BehaviorDetail.css';

const LIST_PATH = '/behaviors';

const DELETED_NOTICE = 'Comportamiento eliminado';
const DELETE_BLOCKED_REASON = 'El comportamiento está en uso y no se puede eliminar.';
const DELETE_REASON_ID = 'behavior-delete-reason';

// Motivos del 409 de DELETE /behaviors/{id} (DeleteBehaviorConflict).
const DELETE_CONFLICT_MESSAGES = {
  behaviorInLeagueTeam: 'El comportamiento está siendo usado en un equipo.',
  behaviorInMatch: 'El comportamiento está siendo usado en un partido en curso.',
};

// Mensaje según el status que documenta la API para GET /behaviors/{id}.
const errorMessage = (err) => {
  switch (err.response?.status) {
    case 401:
      return 'Tu sesión expiró. Iniciá sesión de nuevo.';
    case 403:
      return 'No tenés permiso para ver este comportamiento.';
    case 404:
      return 'Recurso no encontrado. El comportamiento no existe o fue eliminado.';
    default:
      return 'No pudimos cargar el comportamiento. Revisá tu conexión e intentá de nuevo.';
  }
};

// Popup que se muestra encima de la lista (ruta anidada /behaviors/:id).
export default function BehaviorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const outlet = useOutletContext(); // undefined si no hay contexto (ej: tests sin él)
  const dialogRef = useRef(null);

  // Resultado de la última request terminada, con el id al que corresponde.
  // `isLoading` y `error` se derivan en el render: mientras el resultado no sea
  // del id actual, estamos cargando (así no hace falta resetear estado en el efecto).
  const [result, setResult] = useState({ id: null, behavior: null, error: null });
  const current = result.id === id ? result : null;
  const isLoading = current === null;
  const behavior = current?.behavior ?? null;
  const error = current?.error ?? null;

  const [isEditing, setIsEditing] = useState(false);

  // Eliminación: confirmación, request en curso y error de la última tentativa.
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  // Se incrementa para volver a pedir el detalle (ej: tras un 409, `deletable` quedó desactualizado).
  const [reloadKey, setReloadKey] = useState(0);
  const deleteButtonRef = useRef(null);

  // `deletable: false` bloquea el botón. Si el campo faltara, decide el servidor (409).
  const canDelete = Boolean(behavior) && behavior.deletable !== false;
  const blockedReason = behavior && behavior.deletable === false ? DELETE_BLOCKED_REASON : null;

  const goToList = () => navigate(LIST_PATH);

  // Al guardar: se muestra lo editado, se cierra el formulario y se avisa a la lista.
  const handleSaved = (updated) => {
    setResult({ id, behavior: updated, error: null });
    setIsEditing(false);
    outlet?.onBehaviorUpdated?.();
  };

  // Vuelve a la lista avisando (y recargándola): el comportamiento ya no está disponible.
  const leaveWithNotice = (message) => {
    outlet?.onBehaviorRemoved?.(message);
    navigate(LIST_PATH);
  };

  const openConfirm = () => {
    if (!canDelete) return;
    setDeleteError(null);
    setIsConfirming(true);
  };

  const cancelConfirm = () => {
    setIsConfirming(false);
    deleteButtonRef.current?.focus();
  };

  const handleDeleteError = (err) => {
    const status = err.response?.status;
    const code = err.response?.data?.code;
    setIsDeleting(false);

    if (status === 404) return leaveWithNotice('El comportamiento ya no existe.');
    if (status === 403) return leaveWithNotice('No tenés permiso para eliminar este comportamiento.');

    setIsConfirming(false);
    if (status === 409) {
      setDeleteError(DELETE_CONFLICT_MESSAGES[code] ?? DELETE_BLOCKED_REASON);
      setReloadKey((key) => key + 1); // refresca `deletable`
    } else if (status === 401) {
      setDeleteError('Tu sesión expiró. Iniciá sesión de nuevo.');
    } else if (!err.response) {
      setDeleteError('No se pudo establecer conexión con el servidor.');
    } else {
      setDeleteError('No pudimos eliminar el comportamiento. Intentá nuevamente.');
    }
    return undefined;
  };

  const handleConfirmDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteBehavior(id);
    } catch (err) {
      handleDeleteError(err);
      return;
    }
    leaveWithNotice(DELETED_NOTICE);
  };

  // Carga del detalle. Se cancela si cambia el id o se desmonta el popup,
  // para que una respuesta vieja no pise a una nueva.
  useEffect(() => {
    const controller = new AbortController();

    getBehaviorById(id, { signal: controller.signal })
      .then((data) => setResult({ id, behavior: data, error: null }))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setResult({ id, behavior: null, error: errorMessage(err) });
      });

    return () => controller.abort();
  }, [id, reloadKey]);

  // Al abrir, el foco pasa al popup (así Escape y el teclado funcionan de entrada).
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Escape cierra el popup, salvo que esté abierto el formulario de edición o la
  // confirmación de borrado (cada uno se cierra solo con Escape y deja el detalle).
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isEditing && !isConfirming) navigate(LIST_PATH);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate, isEditing, isConfirming]);

  return (
    <>
      <div
        className="modal__overlay"
        data-testid="behavior-overlay"
        aria-hidden={isConfirming || undefined}
        onClick={(event) => {
          // Solo cierra si el clic fue en el fondo oscuro, no dentro de la ventana.
          if (event.target === event.currentTarget) goToList();
        }}
      >
        <section
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="behavior-detail-title"
          className="modal__window"
        >
          <header className="modal__header">
            <h2 id="behavior-detail-title">{behavior ? behavior.name : 'Comportamiento'}</h2>
            <button
              type="button"
              className="modal__close"
              aria-label="Cerrar"
              onClick={goToList}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div className="modal__body">
            {isLoading && (
              <div role="status" aria-label="Cargando comportamiento" className="behavior-detail__skeleton">
                <span />
                <span />
                <span />
                <span />
              </div>
            )}

            {!isLoading && error && (
              <p className="modal__error" role="alert">
                {error}
              </p>
            )}

            {!isLoading && deleteError && (
              <p className="modal__error" role="alert">
                {deleteError}
              </p>
            )}

            {!isLoading && !error && behavior && (
              <pre className="behavior-detail__code">
                <code>{behavior.code}</code>
              </pre>
            )}
          </div>

          <footer className="modal__footer">
            {/* Siempre visible. Se usa aria-disabled (no `disabled`) para que siga
                recibiendo foco y el motivo se pueda leer con teclado o lector de pantalla. */}
            <div className="behavior-detail__delete-wrap">
              <button
                ref={deleteButtonRef}
                type="button"
                className="behavior-detail__delete"
                aria-disabled={!canDelete}
                aria-describedby={blockedReason ? DELETE_REASON_ID : undefined}
                onClick={openConfirm}
              >
                Eliminar
              </button>
              {blockedReason && (
                <span id={DELETE_REASON_ID} role="tooltip" className="behavior-detail__tooltip">
                  {blockedReason}
                </span>
              )}
            </div>
            {!isLoading && !error && behavior && (
              <button type="button" onClick={() => setIsEditing(true)}>
                Editar
              </button>
            )}
            <button type="button" onClick={goToList}>
              Volver
            </button>
          </footer>
        </section>
      </div>

      {isConfirming && behavior && (
        <ConfirmDialog
          message={`¿Eliminar "${behavior.name}"? No se puede deshacer.`}
          confirmLabel="Eliminar"
          busyLabel="Eliminando…"
          cancelLabel="Cancelar"
          isBusy={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={cancelConfirm}
        />
      )}

      {isEditing && behavior && (
        <BehaviorFormDialog
          behavior={behavior}
          onClose={() => setIsEditing(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
