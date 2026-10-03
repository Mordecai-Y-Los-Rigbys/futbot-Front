import api from './api';

export const getPlayers = async (page = 1, options = {}) => {
  const response = await api.get('/players', {
    params: { page },
    ...options,
  });
  const items = Array.isArray(response.data) ? response.data : (response.data?.items ?? []);
  return items;
};
