import api from './api';
import { getPlayersMock } from './playerMocks';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export const getPlayers = async (page = 1, options = {}) => {
  if (USE_MOCKS) {
    return getPlayersMock(page, options);
  }
  const response = await api.get('/players/me', {
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
