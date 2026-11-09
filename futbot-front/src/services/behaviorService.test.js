import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import { getBehaviorById, getBehaviors, createBehavior, updateBehavior } from './behaviorService';

vi.mock('./api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

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

  it('filtra por tipo cuando se especifica', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });

    await getBehaviors('', 1, { type: 'playerBehavior' });

    expect(api.get).toHaveBeenCalledWith('/behaviors/me', {
      params: { name: undefined, page: 1, type: 'playerBehavior' },
      signal: undefined,
    });
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

describe('updateBehavior', () => {
  beforeEach(() => {
    api.put.mockReset();
  });

  it('pide PUT /behaviors/{id} solo con nombre y código (sin tipo)', async () => {
    api.put.mockResolvedValue({ data: { id: 7, name: 'A', code: 'x' } });

    await updateBehavior(7, { name: 'A', code: 'x', type: 'coachBehavior' });

    expect(api.put).toHaveBeenCalledWith('/behaviors/7', { name: 'A', code: 'x' }, { signal: undefined });
  });

  it('devuelve el body y propaga los errores', async () => {
    const body = { id: 7, name: 'A', code: 'x' };
    api.put.mockResolvedValueOnce({ data: body });
    await expect(updateBehavior(7, { name: 'A', code: 'x' })).resolves.toEqual(body);

    api.put.mockRejectedValueOnce(new Error('boom'));
    await expect(updateBehavior(7, { name: 'A', code: 'x' })).rejects.toThrow('boom');
  });
});

describe('getBehaviorById', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('pide GET /behaviors/{id} y devuelve el body', async () => {
    const body = { id: 7, name: 'Atacante', type: 'playerBehavior', code: 'x' };
    api.get.mockResolvedValue({ data: body });

    await expect(getBehaviorById(7)).resolves.toEqual(body);
    expect(api.get).toHaveBeenCalledWith('/behaviors/7', { signal: undefined });
  });

  it('codifica el id y pasa el signal', async () => {
    api.get.mockResolvedValue({ data: {} });
    const controller = new AbortController();

    await getBehaviorById('a/b', { signal: controller.signal });

    expect(api.get).toHaveBeenCalledWith('/behaviors/a%2Fb', { signal: controller.signal });
  });

  it('propaga el error (ej: 404)', async () => {
    const error = Object.assign(new Error('404'), { response: { status: 404 } });
    api.get.mockRejectedValue(error);

    await expect(getBehaviorById(9)).rejects.toBe(error);
  });
});

describe('createBehavior', () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  it('pide POST /behaviors con nombre, código y tipo, y devuelve el body', async () => {
    const created = { id: 1, name: 'A', type: 'playerBehavior', code: 'x' };
    api.post.mockResolvedValue({ data: created });

    await expect(createBehavior({ name: 'A', code: 'x', type: 'playerBehavior' })).resolves.toEqual(created);
    expect(api.post).toHaveBeenCalledWith(
      '/behaviors',
      { name: 'A', code: 'x', type: 'playerBehavior' },
      { signal: undefined },
    );
  });

  it('propaga el error (ej: 409)', async () => {
    const error = Object.assign(new Error('409'), { response: { status: 409 } });
    api.post.mockRejectedValue(error);

    await expect(createBehavior({ name: 'A', code: 'x', type: 'playerBehavior' })).rejects.toBe(error);
  });
});