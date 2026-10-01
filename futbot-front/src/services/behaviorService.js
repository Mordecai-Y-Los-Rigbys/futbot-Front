import api from './api';

// El backend responde siempre de a 50 elementos; el cliente no puede cambiarlo.
export const PAGE_SIZE = 50;

/**
 * Lista los behaviors del usuario logueado (GET /behaviors/me).
 * @param {string} name  Filtro por nombre (parcial, case-insensitive). Vacío = sin filtro.
 * @param {number} page  Página a pedir, empezando en 1.
 * @param {{ signal?: AbortSignal }} [options]  Permite cancelar la request.
 * @returns {Promise<{ items: {id: number, name: string}[], page: number, pageSize: number, total: number }>}
 */
export async function getBehaviors(name, page = 1, { signal } = {}) {
  const { data } = await api.get('/behaviors/me', {
    // Con `undefined` axios omite el parámetro, así `?name=` no viaja vacío.
    params: { name: name || undefined, page },
    signal,
  });
  return data;
}