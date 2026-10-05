import api from './api';
import { getLeaguesMock } from './leagueMocks';

// El backend responde siempre de a 50 elementos; el cliente no puede cambiarlo.
export const PAGE_SIZE = 50;

// Modo sin backend: poné VITE_USE_MOCKS=true en futbot-front/.env.local y reiniciá Vite.
// Nunca se activa en los tests (MODE === 'test'), que mockean `api` por su cuenta.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true' && import.meta.env.MODE !== 'test';

/**
 * Lista las ligas (GET /leagues). Requiere sesión: la cookie viaja sola
 * porque `api` usa `withCredentials: true`.
 * Errores posibles: 400 (page inválido), 401 (sin sesión).
 * @param {string} name  Filtro por nombre (parcial, case-insensitive). Vacío = sin filtro.
 * @param {number} page  Página a pedir, empezando en 1.
 * @param {{ signal?: AbortSignal }} [options]  Permite cancelar la request.
 * @returns {Promise<{ items: LeagueSummary[], page: number, pageSize: number, total: number }>}
 *   donde LeagueSummary = { id, name, creator: {id, username, name}, status,
 *   participantsCount, maxParticipants, private, createdAt }.
 *   `items` puede venir vacío con status 200 (sin ligas, sin coincidencias o página fuera de rango).
 */
export async function getLeagues(name, page = 1, { signal } = {}) {
  if (USE_MOCKS) return getLeaguesMock(name, page, { signal });

  const { data } = await api.get('/leagues', {
    // Con `undefined` axios omite el parámetro, así `?name=` no viaja vacío.
    params: { name: name || undefined, page },
    signal,
  });
  return data;
}