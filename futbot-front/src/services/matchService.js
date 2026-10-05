import api from './api';
import { createMatchConnectionMock, createMatchSocketMock } from './matchMocks';

// Nunca se activa en los tests (MODE === 'test'): ahí se mockea este módulo.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true' && import.meta.env.MODE !== 'test';

/**
 * Pide el tokenWs para abrir el WebSocket del partido (POST /matches/{id}/connections).
 * Errores posibles: 401 (sin sesión), 403 (no participa), 404 (no existe), 409 (terminado/cancelado).
 * @returns {Promise<{ tokenWs: string }>}
 */
export async function createMatchConnection(matchId) {
  if (USE_MOCKS) return createMatchConnectionMock(matchId);

  const { data } = await api.post(`/matches/${encodeURIComponent(matchId)}/connections`);
  return data;
}

/**
 * URL del WebSocket. Usa VITE_WS_URL si existe; si no, deriva la base de la URL
 * de la API REST (http -> ws, https -> wss).
 */
export function buildWsUrl(matchId, tokenWs) {
  const base = (import.meta.env.VITE_WS_URL || api.defaults.baseURL || '')
    .replace(/^http/, 'ws')
    .replace(/\/$/, '');
  return `${base}/ws/matches/${encodeURIComponent(matchId)}?token=${encodeURIComponent(tokenWs)}`;
}

/** Abre el socket del partido (real o simulado según VITE_USE_MOCKS). */
export function openMatchSocket(matchId, tokenWs) {
  if (USE_MOCKS) return createMatchSocketMock();
  return new WebSocket(buildWsUrl(matchId, tokenWs));
}

// TODO: datos estáticos del partido (nombre/usuario/avatar de cada club y, por jugador,
// nombre, atributos y behavior activo). El tick del WS solo trae `playerId` y posición,
// así que esto tiene que salir de otro endpoint REST. Pendiente de definir el contrato.