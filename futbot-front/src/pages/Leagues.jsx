import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getLeagues, PAGE_SIZE } from '../services/leagueService';
import './Leagues.css';

const DEBOUNCE_MS = 400;

// Con 400 (página inválida) estando en una página > 1 se vuelve a la 1.
const OUT_OF_RANGE_STATUSES = [400];

const LOAD_ERROR_MESSAGE = 'No pudimos cargar las ligas. Revisá tu conexión e intentá de nuevo.';

const STATUS_LABELS = {
  preparation: 'En preparación',
  started: 'En curso',
  cancelled: 'Cancelada',
  finished: 'Finalizada',
};

// Identifica una request concreta. Cambia cuando cambia cualquier parámetro o se fuerza un reload.
const requestKeyFor = (name, page, reload) => `${name}|${page}|${reload}`;

function LeagueRow({ league, onOpen }) {
  // Se lee `league.private` (no se desestructura: `private` es palabra reservada).
  const privacyLabel = league.private ? 'Privada' : 'Pública';

  return (
    <li>
      <div
        className="leagues__row"
        role="link"
        tabIndex={0}
        onClick={() => onOpen(league.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onOpen(league.id);
        }}
      >
        <span className="leagues__name">{league.name}</span>
        <span className="leagues__creator">{`${league.creator.name} · @${league.creator.username}`}</span>
        <span className="leagues__status">{STATUS_LABELS[league.status] ?? league.status}</span>
        {/* Capacidad combinada: un solo dato, nunca dos separados. */}
        <span className="leagues__capacity">{`${league.participantsCount}/${league.maxParticipants}`}</span>
        {/* Texto alternativo para lectores de pantalla (aria-label) y tooltip al pasar el mouse (title);
            no hay texto visible permanente. */}
        <span className="leagues__privacy" role="img" aria-label={privacyLabel} title={privacyLabel}>
          {league.private ? '🔒' : '🔓'}
        </span>
      </div>
    </li>
  );
}

export default function Leagues() {
  const navigate = useNavigate();

  // `id` y `createdAt` quedan en el estado pero no se muestran. El id solo sirve para navegar.
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  // Lo que el usuario ve en el input (se actualiza en cada tecla)...
  const [searchInput, setSearchInput] = useState('');
  // ...y lo que realmente se manda a la API (ya con trim; se actualiza tras el debounce o con Enter).
  const [debouncedName, setDebouncedName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Se incrementa para forzar una nueva llamada aunque nada más haya cambiado
  // (Enter con el mismo texto, "Reintentar" o vuelta a la página 1).
  const [reloadKey, setReloadKey] = useState(0);

  // Última request terminada (su key) y cómo terminó: 'ok' | 'error' | 'unauthorized'.
  // `isLoading` y `error` se derivan en el render: si la key terminada no es la de la
  // request actual, estamos cargando. Así el efecto no resetea estado al arrancar.
  const [settled, setSettled] = useState({ key: null, status: null });

  const isLoading = settled.key !== requestKeyFor(debouncedName, currentPage, reloadKey);
  const status = isLoading ? null : settled.status;
  const error = status === 'error' ? LOAD_ERROR_MESSAGE : null;

  // Debounce: cada tecla reinicia el temporizador (el cleanup lo cancela).
  // Si el texto efectivo (con trim) no cambió, no se hace nada.
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === debouncedName) return;
    const timer = setTimeout(() => {
      setDebouncedName(trimmed);
      setCurrentPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, debouncedName]);

  // Carga de datos. Se cancela la request anterior si cambian los parámetros
  // antes de que responda, para que una respuesta vieja no pise a una nueva.
  useEffect(() => {
    const controller = new AbortController();
    const key = requestKeyFor(debouncedName, currentPage, reloadKey);

    // Vuelve a la página 1. Se incrementa también reloadKey para que la key de la
    // nueva request sea inédita y la pantalla siga en "cargando" (sin parpadeo de
    // "sin resultados" ni de error).
    const backToFirstPage = () => {
      setCurrentPage(1);
      setReloadKey((value) => value + 1);
    };

    getLeagues(debouncedName, currentPage, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        // Página vacía pero no es la primera: la página ya no existe.
        if (data.items.length === 0 && currentPage > 1) {
          backToFirstPage();
          return;
        }
        setItems(data.items);
        setTotal(data.total);
        setSettled({ key, status: 'ok' });
      })
      .catch((err) => {
        if (axios.isCancel(err) || controller.signal.aborted) return;
        const httpStatus = err.response?.status;
        // El 401 lo maneja el mecanismo global de autenticación (redirige a Login):
        // acá no se muestra error ni lista vacía.
        if (httpStatus === 401) {
          setItems([]);
          setTotal(0);
          setSettled({ key, status: 'unauthorized' });
          return;
        }
        // Página inválida estando en una página > 1: volvemos a la 1 en lugar de mostrar el error.
        // Solo desde páginas > 1, así un 400 en la 1 muestra el error y no entra en loop.
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
    // Enter dispara la búsqueda ya, sin esperar al temporizador. Al actualizar
    // debouncedName, el efecto del debounce cancela su timer pendiente (sin llamada duplicada).
    setDebouncedName(searchInput.trim());
    setCurrentPage(1);
    setReloadKey((key) => key + 1);
  };

  const openLeague = (id) => navigate(`/leagues/${id}`);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPagination = total > PAGE_SIZE && !error;
  const isEmpty = status === 'ok' && items.length === 0;
  const hasFilter = debouncedName !== '';

  return (
    <main className="leagues">
      <h1>Ligas</h1>

      <div className="leagues__search">
        <label htmlFor="league-search">Buscar por nombre</label>
        <input
          id="league-search"
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ej: Liga de campeones"
          autoComplete="off"
        />
      </div>

      {error && (
        <div className="leagues__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {isLoading && items.length === 0 && (
        <p className="leagues__message" role="status">Cargando ligas…</p>
      )}

      {isEmpty && (
        <p className="leagues__message">
          {hasFilter
            ? 'No se encontraron ligas que coincidan con la búsqueda'
            : 'No hay ligas disponibles en este momento'}
        </p>
      )}

      {!error && items.length > 0 && (
        <ul className="leagues__list" aria-busy={isLoading}>
          {items.map((league) => (
            <LeagueRow key={league.id} league={league} onOpen={openLeague} />
          ))}
        </ul>
      )}

      {showPagination && (
        <nav className="leagues__pagination" aria-label="Paginación">
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