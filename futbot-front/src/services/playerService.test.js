import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import { getPlayers } from './playerService';

vi.mock('./api', () => ({ default: { get: vi.fn() } }));

describe('getPlayers', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('pide los jugadores de la página solicitada', async () => {
    const players = [{ id: 1, name: 'Delantero' }];
    api.get.mockResolvedValue({ data: players });

    await expect(getPlayers(2)).resolves.toEqual(players);
    expect(api.get).toHaveBeenCalledWith('/players/me', { params: { page: 2 } });
  });

  it('acepta una respuesta de API con los jugadores dentro de items', async () => {
    const players = [{ id: 1, name: 'Delantero' }];
    api.get.mockResolvedValue({ data: { items: players } });

    await expect(getPlayers()).resolves.toEqual(players);
  });
});
