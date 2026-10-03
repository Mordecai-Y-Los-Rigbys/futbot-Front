import api from './api';
import { joinFriendlyMatchMock } from './friendlyMocks';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export const joinFriendlyMatch = async (friendlyId, members) => {
  if (USE_MOCKS) {
    return joinFriendlyMatchMock(friendlyId, members);
  }
  const response = await api.post(`/friendlies/${friendlyId}/members`, { members });
  return response.data;
};
