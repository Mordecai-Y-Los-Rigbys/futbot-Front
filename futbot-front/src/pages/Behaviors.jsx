import { useEffect, useState } from 'react';
import axios from 'axios';
import { getBehaviors, PAGE_SIZE } from '../services/behaviorService';
import './Behaviors.css';

const DEBOUNCE_MS = 400;

export default function Behaviors() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  // Lo que el usuario ve en el input (se actualiza en cada tecla)...
  const [searchInput, setSearchInput] = useState('');
  // ...y lo que realmente se manda a la API (se actualiza tras el debounce o con Enter).
  const [debouncedName, setDebouncedName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Se incrementa para forzar una nueva llamada aunque nada más haya cambiado
  // (Enter con el mismo texto, o botón "Reintentar").
  const [reloadKey, setReloadKey] = useState(0);

  // Debounce: cada tecla reinicia el temporizador (el cleanup lo cancela).
  useEffect(() => {
    if (searchInput === debouncedName) return;
    const timer = setTimeout(() => {
      setDebouncedName(searchInput);
      setCurrentPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, debouncedName]);

  // Carga de datos. Se cancela la request anterior si cambian los parámetros
  // antes de que responda, para que una respuesta vieja no pise a una nueva.
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    getBehaviors(debouncedName, currentPage, { signal: controller.signal })
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        // El 401 lo maneja el mecanismo global de autenticación (redirige a Login).
        if (err.response?.status === 401) return;
        setItems([]);
        setTotal(0);
        setError('No pudimos cargar los comportamientos. Revisá tu conexión e intentá de nuevo.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedName, currentPage, reloadKey]);

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    // Enter dispara la búsqueda ya, sin esperar al debounce.
    setDebouncedName(searchInput);
    setCurrentPage(1);
    setReloadKey((key) => key + 1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPagination = total > PAGE_SIZE;
  const isEmpty = !error && !isLoading && items.length === 0;

  return (
    <main className="behaviors">
      <h1>Comportamientos</h1>

      <div className="behaviors__search">
        <label htmlFor="behavior-search">Buscar por nombre</label>
        <input
          id="behavior-search"
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ej: Defensor agresivo"
          autoComplete="off"
        />
      </div>

      {error && (
        <div className="behaviors__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {!error && isLoading && items.length === 0 && (
        <p className="behaviors__status" role="status">Cargando comportamientos…</p>
      )}

      {isEmpty && (
        <p className="behaviors__status">No se encontraron comportamientos.</p>
      )}

      {!error && items.length > 0 && (
        <>
          <p className="behaviors__count" aria-live="polite">
            {total} {total === 1 ? 'comportamiento' : 'comportamientos'}
          </p>
          <ul className="behaviors__list" aria-busy={isLoading}>
            {items.map((behavior) => (
              <li key={behavior.id}>{behavior.name}</li>
            ))}
          </ul>
        </>
      )}

      {showPagination && !error && (
        <nav className="behaviors__pagination" aria-label="Paginación">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => page - 1)}
            disabled={currentPage <= 1 || isLoading}
          >
            Anterior
          </button>
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => page + 1)}
            disabled={currentPage >= totalPages || isLoading}
          >
            Siguiente
          </button>
        </nav>
      )}
    </main>
  );
}