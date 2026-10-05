import api from './api';
import { createMatchConnectionMock } from './matchMocks';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export const createMatchConnection = async (matchId) => {
  let result = null;
  if (USE_MOCKS) {
    result = await createMatchConnectionMock(matchId);
  } else {
    const response = await api.post(`/matches/${matchId}/connections`);
    result = response.data;
  }
  return result;
};
