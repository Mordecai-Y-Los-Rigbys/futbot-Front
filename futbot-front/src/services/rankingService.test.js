import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import { getGlobalRanking } from './rankingService';

vi.mock('./api', () => ({ default: { get: vi.fn() } }));

describe('getGlobalRanking', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('pide GET /ranking con el nombre y la página', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });

    await getGlobalRanking('boca', 2);

    expect(api.get).toHaveBeenCalledWith('/ranking', {
      params: { name: 'boca', page: 2 },
      signal: undefined,
    });
  });

  it('omite el parámetro name cuando viene vacío', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });

    await getGlobalRanking('', 1);

    expect(api.get.mock.calls[0][1].params.name).toBeUndefined();
  });

  it('usa la página 1 por defecto', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });

    await getGlobalRanking('');

    expect(api.get.mock.calls[0][1].params.page).toBe(1);
  });

  it('pasa el signal para poder cancelar la request', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });
    const controller = new AbortController();

    await getGlobalRanking('', 1, { signal: controller.signal });

    expect(api.get.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('devuelve el body de la respuesta', async () => {
    const body = { items: [{ position: 1, name: 'Boca' }], page: 1, pageSize: 50, total: 1 };
    api.get.mockResolvedValue({ data: body });

    await expect(getGlobalRanking('', 1)).resolves.toEqual(body);
  });

  it('propaga el error si la request falla', async () => {
    api.get.mockRejectedValue(new Error('boom'));

    await expect(getGlobalRanking('', 1)).rejects.toThrow('boom');
  });
});