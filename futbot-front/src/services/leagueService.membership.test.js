import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import {
  getLeague,
  unlockLeague,
  leaveLeague,
} from './leagueService';

vi.mock('./api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

describe('getLeague', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('pide GET /leagues/{id} y devuelve el body', async () => {
    const league = { id: 5, name: 'Liga del barrio', minParticipants: 3, joined: false };
    api.get.mockResolvedValue({ data: league });

    await expect(getLeague(5)).resolves.toEqual(league);
    expect(api.get).toHaveBeenCalledWith('/leagues/5', { signal: undefined });
  });

  it('pasa el signal para poder cancelar la request', async () => {
    api.get.mockResolvedValue({ data: {} });
    const controller = new AbortController();

    await getLeague(5, { signal: controller.signal });

    expect(api.get.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('propaga el error si la request falla', async () => {
    const error = { response: { status: 404 } };
    api.get.mockRejectedValue(error);

    await expect(getLeague(5)).rejects.toBe(error);
  });
});

describe('unlockLeague', () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  it('pide POST /leagues/{id}/access con la contraseña en el body', async () => {
    api.post.mockResolvedValue({ status: 204 });

    await unlockLeague(5, { password: 'secreta' });

    expect(api.post).toHaveBeenCalledWith('/leagues/5/access', { password: 'secreta' });
  });

  it('propaga el 403 si la contraseña es incorrecta', async () => {
    const error = { response: { status: 403, data: { code: 'invalidLeaguePassword' } } };
    api.post.mockRejectedValue(error);

    await expect(unlockLeague(5, { password: 'mala' })).rejects.toBe(error);
  });
});

describe('leaveLeague', () => {
  beforeEach(() => {
    api.delete.mockReset();
  });

  it('pide DELETE /leagues/{id}/participants/me', async () => {
    api.delete.mockResolvedValue({ status: 204 });

    await leaveLeague(5);

    expect(api.delete).toHaveBeenCalledWith('/leagues/5/participants/me');
  });

  it('propaga el 409 (por ejemplo, el creador no puede abandonar)', async () => {
    const error = { response: { status: 409, data: { code: 'isCreator' } } };
    api.delete.mockRejectedValue(error);

    await expect(leaveLeague(5)).rejects.toBe(error);
  });
});
