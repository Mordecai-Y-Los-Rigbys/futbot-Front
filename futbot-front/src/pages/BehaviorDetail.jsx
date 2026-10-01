import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { getBehaviorById } from '../services/behaviorService';
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
  const dialogRef = useRef(null);

  // Resultado de la última request terminada, con el id al que corresponde.
  // `isLoading` y `error` se derivan en el render: mientras el resultado no sea
  // del id actual, estamos cargando (así no hace falta resetear estado en el efecto).
  const [result, setResult] = useState({ id: null, behavior: null, error: null });
  const current = result.id === id ? result : null;
  const isLoading = current === null;
  const behavior = current?.behavior ?? null;
  const error = current?.error ?? null;

  const goToList = () => navigate(LIST_PATH);

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

  // Escape cierra el popup.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') navigate(LIST_PATH);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  return (
    <div
      className="behavior-detail__overlay"
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
        className="behavior-detail__window"
      >
        <header className="behavior-detail__header">
          <h2 id="behavior-detail-title">{behavior ? behavior.name : 'Comportamiento'}</h2>
          <button
            type="button"
            className="behavior-detail__close"
            aria-label="Cerrar"
            onClick={goToList}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="behavior-detail__body">
          {isLoading && (
            <div role="status" aria-label="Cargando comportamiento" className="behavior-detail__skeleton">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}

          {!isLoading && error && (
            <p className="behavior-detail__error" role="alert">
              {error}
            </p>
          )}

          {!isLoading && !error && behavior && (
            <pre className="behavior-detail__code">
              <code>{behavior.code}</code>
            </pre>
          )}
        </div>

        <footer className="behavior-detail__footer">
          <button type="button" onClick={goToList}>
            Volver
          </button>
        </footer>
      </section>
    </div>
  );
}