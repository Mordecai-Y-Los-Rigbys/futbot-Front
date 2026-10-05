import api from './api';
import { joinFriendlyMatchMock } from './friendlyMocks';
import { getPlayersMock } from './friendlyMocks';
import { createFriendlyMatchMock } from './friendlyMocks';
import { getAvailableFriendliesMock } from './friendlyMocks';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export const getPlayers = async () => {
  if (USE_MOCKS) {
    return getPlayersMock();
  }
  const response = await api.get('/players');
  return response.data;
};

export const createFriendlyMatch = async ({ name, members }) => {
  if (USE_MOCKS) {
    return createFriendlyMatchMock({ name, members });
  }
  const response = await api.post('/friendlies', { name, members });
  return response.data;
};

export const joinFriendlyMatch = async (friendlyId, members) => {
  if (USE_MOCKS) {
    return joinFriendlyMatchMock(friendlyId, members);
  }
  const response = await api.post(`/friendlies/${friendlyId}/members`, { members });
  return response.data;
};

export const getAvailableFriendlies = async ({ page = 1, name = '' } = {}) => {
  if (USE_MOCKS) {
    return getAvailableFriendliesMock({ page, name });
  }
  const params = { page };
  if (name && name.trim()) {
    params.name = name.trim();
  }
  const response = await api.get('/friendlies', { params });
  return response.data;
};