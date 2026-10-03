import api from './api';

/**
 * Crea un nuevo jugador para el usuario autenticado.
 * @param {Object} playerData
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Object>}
 */
export async function createPlayer(playerData, { signal } = {}) {
  const { data } = await api.post('/players', playerData, { signal });
  return data;
}
