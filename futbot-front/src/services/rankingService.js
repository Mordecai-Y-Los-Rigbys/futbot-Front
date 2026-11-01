import api from './api';

/**
 * Ranking global de clubes (GET /ranking). Requiere sesión: la cookie viaja sola
 * porque `api` usa `withCredentials: true`.
 * Errores posibles: 400 (page inválida), 401 (sin sesión).
 * @param {string} name  Filtro por nombre de club (parcial, case-insensitive). Vacío = sin filtro.
 * @param {number} page  Página a pedir, empezando en 1. El tamaño (50) lo fija el back.
 * @param {{ signal?: AbortSignal }} [options]  Permite cancelar la request.
 * @returns {Promise<{ items: RankingEntry[], page: number, pageSize: number, total: number }>}
 *   donde RankingEntry = { position, name, avatar, score, goalDifference, goals,
 *   wonRegular, wonPenalties, lost }. `position` viene calculado sobre el ranking
 *   completo: no se recalcula ni se reordena en el cliente.
 */
export async function getGlobalRanking(name, page = 1, { signal } = {}) {
  const { data } = await api.get('/ranking', {
    // Con `undefined` axios omite el parámetro, así `?name=` no viaja vacío.
    params: { name: name || undefined, page },
    signal,
  });
  return data;
}