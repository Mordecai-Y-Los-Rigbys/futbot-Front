import { useEffect, useState } from 'react';
import axios from 'axios';
import { getGlobalRanking } from '../services/rankingService';
import { getAvatarSrc } from '../utils/avatars';
import './Ranking.css';

const DEBOUNCE_MS = 400;
const DEFAULT_PAGE_SIZE = 50;

// Con 400 (página inválida) estando en una página > 1 se vuelve a la 1.
const OUT_OF_RANGE_STATUSES = [400];

const LOAD_ERROR_MESSAGE = 'No pudimos cargar el ranking. Revisá tu conexión e intentá de nuevo.';

// Columnas numéricas, en el orden en que se muestran después del club.
const STAT_COLUMNS = [
  { key: 'score', label: 'P', title: 'Puntos' },
  { key: 'goalDifference', label: 'DG', title: 'Diferencia de gol' },
  { key: 'goals', label: 'Goles', title: 'Goles convertidos' },
  { key: 'wonRegular', label: 'PG', title: 'Partidos ganados' },
  { key: 'wonPenalties', label: 'PGP', title: 'Partidos ganados por penales' },
  { key: 'lost', label: 'PP', title: 'Partidos perdidos' },
];

// Identifica una request concreta. Cambia cuando cambia cualquier parámetro o se fuerza un reload.
const requestKeyFor = (name, page, reload) => `${name}|${page}|${reload}`;

function ClubCell({ entry }) {
  const src = getAvatarSrc(entry.avatar);
  return (
    <td className="ranking__club">
      {src ? (
        <img className="ranking__avatar" src={src} alt="" width={32} height={32} />
      ) : (
        <span className="ranking__avatar ranking__avatar--fallback" aria-hidden="true">
          {entry.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="ranking__name">{entry.name}</span>
    </td>
  );
}

export default function Ranking() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Lo que el usuario ve en el input (se actualiza en cada tecla)...
  const [searchInput, setSearchInput] = useState('');
  // ...y lo que realmente se manda a la API (ya con trim; tras el debounce o con Enter).
  const [debouncedName, setDebouncedName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Se incrementa para forzar una nueva llamada aunque nada más haya cambiado.
  const [reloadKey, setReloadKey] = useState(0);

  // Última request terminada (su key) y cómo terminó: 'ok' | 'error' | 'unauthorized'.
  // `isLoading` y `error` se derivan en el render.
  const [settled, setSettled] = useState({ key: null, status: null });

  const isLoading = settled.key !== requestKeyFor(debouncedName, currentPage, reloadKey);
  const status = isLoading ? null : settled.status;
  const error = status === 'error' ? LOAD_ERROR_MESSAGE : null;

  // Debounce: cada tecla reinicia el temporizador (el cleanup lo cancela).
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === debouncedName) return;
    const timer = setTimeout(() => {
      setDebouncedName(trimmed);
      setCurrentPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, debouncedName]);

  // Carga de datos. Se cancela la request anterior si cambian los parámetros.
  useEffect(() => {
    const controller = new AbortController();
    const key = requestKeyFor(debouncedName, currentPage, reloadKey);

    const backToFirstPage = () => {
      setCurrentPage(1);
      setReloadKey((value) => value + 1);
    };

    getGlobalRanking(debouncedName, currentPage, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        // Página vacía pero no es la primera: la página ya no existe.
        if (data.items.length === 0 && currentPage > 1) {
          backToFirstPage();
          return;
        }
        setItems(data.items);
        setTotal(data.total);
        setPageSize(data.pageSize || DEFAULT_PAGE_SIZE);
        setSettled({ key, status: 'ok' });
      })
      .catch((err) => {
        if (axios.isCancel(err) || controller.signal.aborted) return;
        const httpStatus = err.response?.status;
        // El 401 lo maneja el mecanismo global de autenticación: sin error ni lista vacía.
        if (httpStatus === 401) {
          setItems([]);
          setTotal(0);
          setSettled({ key, status: 'unauthorized' });
          return;
        }
        if (currentPage > 1 && OUT_OF_RANGE_STATUSES.includes(httpStatus)) {
          backToFirstPage();
          return;
        }
        setItems([]);
        setTotal(0);
        setSettled({ key, status: 'error' });
      });

    return () => controller.abort();
  }, [debouncedName, currentPage, reloadKey]);

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    // Enter dispara la búsqueda ya, sin esperar al temporizador.
    setDebouncedName(searchInput.trim());
    setCurrentPage(1);
    setReloadKey((key) => key + 1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showPagination = total > pageSize && !error;
  const isEmpty = status === 'ok' && items.length === 0;
  const hasFilter = debouncedName !== '';

  return (
    <main className="ranking">
      <h1>Ranking Global</h1>

      <div className="ranking__search">
        <label htmlFor="ranking-search">Buscar por nombre de club</label>
        <input
          id="ranking-search"
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ej: Boca"
          autoComplete="off"
        />
      </div>

      {error && (
        <div className="ranking__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {isLoading && items.length === 0 && (
        <p className="ranking__message" role="status">Cargando ranking…</p>
      )}

      {isEmpty && (
        <p className="ranking__message">
          {hasFilter
            ? 'No se encontraron clubes que coincidan con la búsqueda'
            : 'Todavía no hay clubes en el ranking'}
        </p>
      )}

      {!error && items.length > 0 && (
        <div className="ranking__table-wrapper" aria-busy={isLoading}>
          <table className="ranking__table">
            <thead>
              <tr>
                <th scope="col" title="Puesto">Puesto</th>
                <th scope="col" className="ranking__club-head">Club</th>
                {STAT_COLUMNS.map((column) => (
                  <th key={column.key} scope="col" title={column.title}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Se respeta el orden y el `position` que manda el back (los empatados repiten puesto). */}
              {items.map((entry, index) => (
                <tr key={`${entry.position}-${entry.name}-${index}`}>
                  <td className="ranking__position">{entry.position}</td>
                  <ClubCell entry={entry} />
                  {STAT_COLUMNS.map((column) => (
                    <td key={column.key}>{entry[column.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showPagination && (
        <nav className="ranking__pagination" aria-label="Paginación">
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