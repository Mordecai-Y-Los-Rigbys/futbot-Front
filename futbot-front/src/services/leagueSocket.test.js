import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLeagueWsUrl, openLeagueSocket } from './leagueSocket';

describe('leagueSocket', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('arma la URL del canal sin token, con la base de la API cambiando http por ws', () => {
    vi.stubEnv('VITE_WS_URL', '');

    expect(buildLeagueWsUrl(5, 'participants')).toBe('ws://localhost:8000/ws/leagues/5/participants');
  });

  it('usa VITE_WS_URL si existe', () => {
    vi.stubEnv('VITE_WS_URL', 'wss://futbot.example.com/api/');

    expect(buildLeagueWsUrl(7, 'matches/next')).toBe('wss://futbot.example.com/api/ws/leagues/7/matches/next');
  });

  it('abre un WebSocket real contra esa URL', () => {
    vi.stubEnv('VITE_WS_URL', '');
    const FakeWebSocket = vi.fn();
    vi.stubGlobal('WebSocket', FakeWebSocket);

    openLeagueSocket(5, 'participants');

    expect(FakeWebSocket).toHaveBeenCalledWith('ws://localhost:8000/ws/leagues/5/participants');
  });
});
