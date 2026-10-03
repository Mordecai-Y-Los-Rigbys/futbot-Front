// services/authService.test.js

import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import { loginUser } from './authService';

vi.mock('./api', () => ({ default: { post: vi.fn() } }));

describe('loginUser', () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  it('pide POST /auth/log-in con las credenciales tal cual', async () => {
    api.post.mockResolvedValue({ data: { id: 1, username: 'santi', clubName: 'FC Santi' } });

    await loginUser({ email: 'santi@mail.com', password: 'secreta123' });

    expect(api.post).toHaveBeenCalledWith('/auth/log-in', {
      email: 'santi@mail.com',
      password: 'secreta123',
    });
  });

  it('devuelve el body de la respuesta', async () => {
    const user = { id: 1, username: 'santi', clubName: 'FC Santi' };
    api.post.mockResolvedValue({ data: user });

    await expect(loginUser({ email: 'a@b.com', password: 'x' })).resolves.toEqual(user);
  });

  it('propaga el error 401 para que la pantalla lo maneje', async () => {
    const error = Object.assign(new Error('401'), { response: { status: 401 } });
    api.post.mockRejectedValue(error);

    await expect(loginUser({ email: 'a@b.com', password: 'x' })).rejects.toBe(error);
  });

  it('propaga el error si no hay conexión', async () => {
    api.post.mockRejectedValue(new Error('Network Error'));

    await expect(loginUser({ email: 'a@b.com', password: 'x' })).rejects.toThrow('Network Error');
  });
});
