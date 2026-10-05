import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import { createLeague, getLeagues } from './leagueService';

vi.mock('./api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

describe('getLeagues', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('pide GET /leagues con el nombre y la página', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });

    await getLeagues('liga', 2);

    expect(api.get).toHaveBeenCalledWith('/leagues', {
      params: { name: 'liga', page: 2 },
      signal: undefined,
    });
  });

  it('omite el parámetro name cuando viene vacío', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });

    await getLeagues('', 1);

    expect(api.get.mock.calls[0][1].params.name).toBeUndefined();
  });

  it('usa la página 1 por defecto', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });

    await getLeagues('');

    expect(api.get.mock.calls[0][1].params.page).toBe(1);
  });

  it('pasa el signal para poder cancelar la request', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });
    const controller = new AbortController();

    await getLeagues('', 1, { signal: controller.signal });

    expect(api.get.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('devuelve el body de la respuesta', async () => {
    const body = { items: [{ id: 1, name: 'Liga' }], page: 1, pageSize: 50, total: 1 };
    api.get.mockResolvedValue({ data: body });

    await expect(getLeagues('', 1)).resolves.toEqual(body);
  });

  it('propaga el error si la request falla', async () => {
    api.get.mockRejectedValue(new Error('boom'));

    await expect(getLeagues('', 1)).rejects.toThrow('boom');
  });
});

describe('createLeague', () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  it('envía el body completo a POST /leagues y devuelve la liga creada', async () => {
    const leagueData = {
      name: 'Liga de prueba',
      minParticipants: 3,
      maxParticipants: 8,
      matchDuration: 10,
      private: false,
      password: null,
      members: [
        { playerId: 1, role: 'forward', behaviorId: 11 },
        { playerId: 2, role: 'midfield', behaviorId: 12 },
        { playerId: 3, role: 'defense', behaviorId: 13 },
        { playerId: 4, role: 'substitute', behaviorId: 14 },
        { playerId: 5, role: 'substitute', behaviorId: 15 },
        { playerId: 6, role: 'substitute', behaviorId: 16 },
      ],
    };
    const createdLeague = { id: 42, name: 'Liga de prueba' };
    api.post.mockResolvedValue({ data: createdLeague });

    await expect(createLeague(leagueData)).resolves.toEqual(createdLeague);

    expect(api.post).toHaveBeenCalledExactlyOnceWith('/leagues', leagueData);
  });

  it('propaga el error si el POST falla', async () => {
    api.post.mockRejectedValue(new Error('boom'));

    await expect(createLeague({})).rejects.toThrow('boom');
  });
});