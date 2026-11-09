import api from './api';
import { createLeagueSocketMock } from './leagueMocks';
import { resolveWsBase } from './matchService';

// Nunca se activa en los tests (MODE === 'test'): ahí se mockea este módulo.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true' && import.meta.env.MODE !== 'test';

/**
 * URL de un canal de liga: `/ws/leagues/{id}/{channel}` (participants, fixture, ranking, matches/next).
 * A diferencia del canal de partido no hay `tokenWs`: el navegador manda la cookie de sesión solo
 * en el handshake. Usa la misma base que el WebSocket de partido (VITE_WS_URL o la URL de la API).
 */
export function buildLeagueWsUrl(leagueId, channel) {
  const base = resolveWsBase(import.meta.env.VITE_WS_URL || api.defaults.baseURL);
  return `${base}/ws/leagues/${encodeURIComponent(leagueId)}/${channel}`;
}

/** Abre un canal de liga (real o simulado según VITE_USE_MOCKS). */
export function openLeagueSocket(leagueId, channel) {
  if (USE_MOCKS) return createLeagueSocketMock(leagueId, channel);
  return new WebSocket(buildLeagueWsUrl(leagueId, channel));
}
