import api from './api';
import { getBehaviorByIdMock, getBehaviorsMock } from './behaviorMocks';
import { USE_MOCKS } from '../config/mocks';

// El backend responde siempre de a 50 elementos; el cliente no puede cambiarlo.
export const PAGE_SIZE = 50;

// Modo sin backend: poné VITE_USE_MOCKS=true en futbot-front/.env.local y reiniciá Vite.
// Nunca se activa en los tests (MODE === 'test'), que mockean `api` por su cuenta.

/**
 * Lista los behaviors del usuario logueado (GET /behaviors/me).
 * @param {string} name  Filtro por nombre (parcial, case-insensitive). Vacío = sin filtro.
 * @param {number} page  Página a pedir, empezando en 1.
 * @param {{ signal?: AbortSignal, type?: 'playerBehavior' | 'coachBehavior' }} [options]
 *   `signal` permite cancelar la request. `type` filtra por tipo en el servidor: sirve para llenar
 *   el selector de behaviors de jugador (`members`) o el del DT (`coachBehaviorId`) sin filtrar en
 *   el cliente, lo que rompería la paginación. Sin `type` trae ambos tipos.
 * @returns {Promise<{ items: {id: number, name: string, type: string}[], page: number, pageSize: number, total: number }>}
 */
export async function getBehaviors(name, page = 1, { signal, type } = {}) {
  if (USE_MOCKS) return getBehaviorsMock(name, page, { signal, type });

  const { data } = await api.get('/behaviors/me', {
    // Con `undefined` axios omite el parámetro, así `?name=` o `?type=` no viajan vacíos.
    params: { name: name || undefined, type, page },
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
