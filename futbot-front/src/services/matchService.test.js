import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import { buildWsUrl, getMatchBehavior, getMatchTeam, reassignBehavior } from './matchService';

vi.mock('./api', () => ({
  default: {
    defaults: { baseURL: '' },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

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

describe('servicios de comportamiento del partido', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.put.mockReset();
  });

  it('obtiene los titulares del equipo y permite cancelar la request', async () => {
    const team = { starters: [] };
    const controller = new AbortController();
    api.get.mockResolvedValue({ data: team });

    await expect(getMatchTeam('match/7', { signal: controller.signal })).resolves.toBe(team);

    expect(api.get).toHaveBeenCalledWith('/matches/match%2F7/team', { signal: controller.signal });
  });

  it('obtiene el comportamiento actual de un titular', async () => {
    const behavior = { name: 'Defensivo', code: 'return;' };
    api.get.mockResolvedValue({ data: behavior });

    await expect(getMatchBehavior(7, 3)).resolves.toBe(behavior);

    expect(api.get).toHaveBeenCalledWith('/matches/7/behavior', {
      params: { playerId: 3 },
      signal: undefined,
    });
  });

  it('envía el titular y el comportamiento elegido', async () => {
    api.put.mockResolvedValue({ status: 204 });

    await reassignBehavior(7, { playerId: 3, behaviorId: 22 });

    expect(api.put).toHaveBeenCalledWith('/matches/7/behavior', { playerId: 3, behaviorId: 22 });
  });

  it('propaga errores de la API', async () => {
    api.put.mockRejectedValue(new Error('boom'));

    await expect(reassignBehavior(7, { playerId: 3, behaviorId: 22 })).rejects.toThrow('boom');
  });
});