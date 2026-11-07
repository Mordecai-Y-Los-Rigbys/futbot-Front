import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import { buildWsUrl, getMatchLineups } from './matchService';

vi.mock('./api', () => ({ default: { defaults: { baseURL: '' }, get: vi.fn() } }));

const WS_PATH = '/ws/matches/7?token=abc';

describe('buildWsUrl', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_WS_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('usa VITE_WS_URL cuando está definida', () => {
    vi.stubEnv('VITE_WS_URL', 'wss://ws.futbot.com/');
    expect(buildWsUrl(7, 'abc')).toBe(`wss://ws.futbot.com${WS_PATH}`);
  });

  it.each([
    ['http://localhost:8000', 'ws://localhost:8000'],
    ['https://api.futbot.com/', 'wss://api.futbot.com'],
  ])('convierte la base absoluta %s a %s', (baseURL, expected) => {
    api.defaults.baseURL = baseURL;
    expect(buildWsUrl(7, 'abc')).toBe(`${expected}${WS_PATH}`);
  });

  it.each([
    ['/api', 'http:', 'ws://front.local:5173/api'],
    ['/api/', 'https:', 'wss://front.local:5173/api'],
    ['', 'http:', 'ws://front.local:5173'],
    [undefined, 'https:', 'wss://front.local:5173'],
  ])('resuelve la base relativa o vacía %j contra window.location (%s)', (baseURL, protocol, expected) => {
    api.defaults.baseURL = baseURL;
    vi.stubGlobal('location', { protocol, host: 'front.local:5173' });
    expect(buildWsUrl(7, 'abc')).toBe(`${expected}${WS_PATH}`);
  });

  it('codifica el id del partido y el token', () => {
    api.defaults.baseURL = 'http://localhost:8000';
    expect(buildWsUrl('a/b', 't o+k')).toBe('ws://localhost:8000/ws/matches/a%2Fb?token=t%20o%2Bk');
  });
});

describe('getMatchLineups', () => {
  beforeEach(() => {
    api.get.mockReset();
  })

  it('pide GET /matches/{id}/lineups con el id codificado y el signal', async () => {
    const body = { club1: [], club2: null };
    api.get.mockResolvedValue({ data: body });
    const controller = new AbortController();

    await expect(getMatchLineups('a/b', { signal: controller.signal })).resolves.toEqual(body);

    expect(api.get).toHaveBeenCalledWith('/matches/a%2Fb/lineups', { signal: controller.signal });
  });

  it('propaga el error si la request falla', async () => {
    const error = Object.assign(new Error('HTTP 403'), { response: { status: 403 } });
    api.get.mockRejectedValue(error);

    await expect(getMatchLineups(7)).rejects.toBe(error);
  });
});