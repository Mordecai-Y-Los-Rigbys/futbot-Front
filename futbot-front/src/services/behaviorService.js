import api from './api';
import { getBehaviorByIdMock, getBehaviorsMock } from './behaviorMocks';

// El backend responde siempre de a 50 elementos; el cliente no puede cambiarlo.
export const PAGE_SIZE = 50;

// Modo sin backend: poné VITE_USE_MOCKS=true en futbot-front/.env.local y reiniciá Vite.
// Nunca se activa en los tests (MODE === 'test'), que mockean `api` por su cuenta.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true' && import.meta.env.MODE !== 'test';

/**
 * Lista los behaviors del usuario logueado (GET /behaviors/me).
 * @param {string} name  Filtro por nombre (parcial, case-insensitive). Vacío = sin filtro.
 * @param {number} page  Página a pedir, empezando en 1.
 * @param {{ signal?: AbortSignal }} [options]  Permite cancelar la request.
 * @returns {Promise<{ items: {id: number, name: string}[], page: number, pageSize: number, total: number }>}
 */
export async function getBehaviors(name, page = 1, { signal } = {}) {
  if (USE_MOCKS) return getBehaviorsMock(name, page, { signal });

  const { data } = await api.get('/behaviors/me', {
    // Con `undefined` axios omite el parámetro, así `?name=` no viaja vacío.
    params: { name: name || undefined, page },
    signal,
  });
  return data;
}

/**
 * Obtiene nombre y código de un behavior (GET /behaviors/{id}).
 * La cookie de sesión viaja sola porque `api` usa `withCredentials: true`.
 * Errores posibles: 401 (sin sesión), 403 (no es del usuario), 404 (no existe o id inválido).
 * @param {string|number} id  Id del behavior (normalmente el param de la URL).
 * @param {{ signal?: AbortSignal }} [options]  Permite cancelar la request.
 * @returns {Promise<{ id: number, name: string, code: string }>}
 */
export async function getBehaviorById(id, { signal } = {}) {
  if (USE_MOCKS) return getBehaviorByIdMock(id, { signal });

  const { data } = await api.get(`/behaviors/${encodeURIComponent(id)}`, { signal });
  return data;
}