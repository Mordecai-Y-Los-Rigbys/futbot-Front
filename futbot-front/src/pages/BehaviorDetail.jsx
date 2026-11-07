import { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import axios from 'axios';
import BehaviorFormDialog from '../components/BehaviorFormDialog';
import { getBehaviorById } from '../services/behaviorService';
import '../components/BehaviorModal.css';
import './BehaviorDetail.css';

const LIST_PATH = '/behaviors';

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

  const goToList = () => navigate(LIST_PATH);

  // Al guardar: se muestra lo editado, se cierra el formulario y se avisa a la lista.
  const handleSaved = (updated) => {
    setResult({ id, behavior: updated, error: null });
    setIsEditing(false);
    outlet?.onBehaviorUpdated?.();
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
  }, [id]);

  // Al abrir, el foco pasa al popup (así Escape y el teclado funcionan de entrada).
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Escape cierra el popup, salvo que esté abierto el formulario de edición
  // (ese se cierra solo con Escape y deja el detalle).
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isEditing) navigate(LIST_PATH);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate, isEditing]);

  return (
    <>
      <div
        className="modal__overlay"
        data-testid="behavior-overlay"
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

            {!isLoading && !error && behavior && (
              <pre className="behavior-detail__code">
                <code>{behavior.code}</code>
              </pre>
            )}
          </div>

          <footer className="modal__footer">
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