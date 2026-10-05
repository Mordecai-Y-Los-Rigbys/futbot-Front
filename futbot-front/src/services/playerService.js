import api from './api';
import { createPlayerMock } from './playerMocks';

const USE_MOCKS =
  import.meta.env.VITE_USE_MOCKS === 'true' && import.meta.env.MODE === 'development';

export async function getPlayers(page = 1, options = {}) {
  const response = await api.get('/players', {
    params: { page },
    ...options,
  });
  return Array.isArray(response.data) ? response.data : (response.data?.items ?? []);
}

/**
 * Crea un nuevo jugador para el usuario autenticado.
 * @param {Object} playerData
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Object>}
 */
export async function createPlayer(playerData, { signal } = {}) {
  if (USE_MOCKS) return createPlayerMock(playerData);

  const { data } = await api.post('/players', playerData, { signal });
  return data;
}
