import api from './api';
import { loginMock } from './authMocks';

// Modo sin backend: VITE_USE_MOCKS=true en futbot-front/.env.local y reiniciar Vite.
// Nunca se activa en los tests (MODE === 'test'), que mockean `api` por su cuenta.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true' && import.meta.env.MODE !== 'test';

export const loginUser = async (credentials) => {
  if (USE_MOCKS) return loginMock(credentials);
  const response = await api.post('/auth/log-in', credentials);
  return response.data;
};

export async function getCurrentUser() {
  const { data } = await api.get('/users/me');
  return data;
}

export const registerUser = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};
