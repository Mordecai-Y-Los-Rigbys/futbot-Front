import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import { getBehaviors } from './behaviorService';

vi.mock('./api', () => ({ default: { get: vi.fn() } }));

describe('getBehaviors', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('pide GET /behaviors/me con el nombre y la página', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });

    await getBehaviors('def', 2);

    expect(api.get).toHaveBeenCalledWith('/behaviors/me', {
      params: { name: 'def', page: 2 },
      signal: undefined,
    });
  });

  it('omite el parámetro name cuando viene vacío', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });

    await getBehaviors('', 1);

    expect(api.get.mock.calls[0][1].params.name).toBeUndefined();
  });

  it('pasa el signal para poder cancelar la request', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });
    const controller = new AbortController();

    await getBehaviors('', 1, { signal: controller.signal });

    expect(api.get.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('devuelve el body de la respuesta', async () => {
    const body = { items: [{ id: 1, name: 'Atacante' }], page: 1, pageSize: 50, total: 1 };
    api.get.mockResolvedValue({ data: body });

    await expect(getBehaviors('', 1)).resolves.toEqual(body);
  });

  it('propaga el error si la request falla', async () => {
    api.get.mockRejectedValue(new Error('boom'));

    await expect(getBehaviors('', 1)).rejects.toThrow('boom');
  });
});