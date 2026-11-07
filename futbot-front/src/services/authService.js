import api from './api';
import { getCurrentUserMock, loginMock, registerMock } from './authMocks';
import { USE_MOCKS } from '../config/mocks';

export const loginUser = async (credentials) => {
  if (USE_MOCKS) return loginMock(credentials);
  const response = await api.post('/auth/log-in', credentials);
  return response.data;
};

export async function getCurrentUser() {
  if (USE_MOCKS) return getCurrentUserMock();
  const { data } = await api.get('/users/me');
  return data;
}

export const registerUser = async (userData) => {
  if (USE_MOCKS) return registerMock(userData);
  const response = await api.post('/auth/register', userData);
  return response.data;
};
