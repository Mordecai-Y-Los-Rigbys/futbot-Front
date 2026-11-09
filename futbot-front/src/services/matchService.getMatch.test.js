import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import { getMatch } from './matchService';

vi.mock('./api', () => ({ default: { defaults: { baseURL: '' }, get: vi.fn() } }));

describe('getMatch', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('pide GET /matches/{id} y devuelve el partido (con result.penalties si hubo tanda)', async () => {
    const match = { id: 5, status: 'finished', result: { score1: 1, score2: 1, penalties: { score1: 4, score2: 3, winner: 'club1', kicks: [] } } };
    api.get.mockResolvedValue({ data: match });

    await expect(getMatch(5)).resolves.toEqual(match);
    expect(api.get).toHaveBeenCalledWith('/matches/5', { signal: undefined });
  });

  it('codifica el id y pasa el signal para poder cancelar', async () => {
    api.get.mockResolvedValue({ data: {} });
    const { signal } = new AbortController();

    await getMatch('a/b', { signal });

    expect(api.get).toHaveBeenCalledWith('/matches/a%2Fb', { signal });
  });

  it('propaga los errores de la API (401 / 403 / 404)', async () => {
    api.get.mockRejectedValue(new Error('Request failed with status code 404'));

    await expect(getMatch(5)).rejects.toThrow('status code 404');
  });
});
