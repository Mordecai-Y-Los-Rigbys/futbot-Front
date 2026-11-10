import api from './api';
import { createPlayerMock, getPlayersMock, getPlayersPageMock } from './playerMocks';
import { USE_MOCKS } from '../config/mocks';


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


// El backend responde de a 50 jugadores por página.
export const PLAYERS_PAGE_SIZE = 50;

/**
 * Página de jugadores del usuario con filtro por nombre (GET /players/me?name=&page=).
 * Lo usan los selectores paginados de la prueba de comportamientos.
 * Contrato (OpenAPI PlayerPage): { items, page, pageSize: 50, total }. Se tolera un array pelado por compatibilidad
 * con `getPlayers`; en ese caso `total` queda en null y se deduce por el tamaño de la página.
 * @returns {Promise<{ items: {id: number, name: string}[], page: number, total: number | null }>}
 */
export async function getPlayersPage(name, page = 1, { signal } = {}) {
  if (USE_MOCKS) return getPlayersPageMock(name, page, { signal });

  const { data } = await api.get('/players/me', {
    params: { name: name || undefined, page },
    signal,
  });
  const items = Array.isArray(data) ? data : (data?.items ?? []);
  return { items, page, total: Array.isArray(data) ? null : (data?.total ?? null) };
}
