import api from './api';
import { getPlayersMock } from './playerMocks';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export const getPlayers = async (page = 1, options = {}) => {
  if (USE_MOCKS) {
    return getPlayersMock(page, options);
  }
  const response = await api.get('/players', {
    params: { page },
    ...options,
  });
  return Array.isArray(response.data) ? response.data : (response.data?.items ?? []);
};
