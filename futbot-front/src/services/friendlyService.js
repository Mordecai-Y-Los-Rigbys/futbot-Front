import api from './api';

export const joinFriendlyMatch = async (friendlyId, members) => {
  const response = await api.post(`/friendlies/${friendlyId}/members`, { members });
  return response.data;
};
