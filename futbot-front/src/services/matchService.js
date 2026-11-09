import api from './api';
import {
  createMatchConnectionMock,
  createMatchSocketMock,
  getMatchBehaviorMock,
  getMatchTeamMock,
  reassignBehaviorMock,
} from './matchMocks';

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
 * Obtiene los titulares del equipo del usuario en el partido.
 * Contrato provisional: { starters: { playerId, playerName, role }[] }.
 * @returns {Promise<{ starters: { playerId: number, playerName: string, role: string }[] }>}
 */
export async function getMatchTeam(matchId, { signal } = {}) {
  if (USE_MOCKS) return getMatchTeamMock(matchId);

  const { data } = await api.get(`/matches/${encodeURIComponent(matchId)}/team`, { signal });
  return data;
}

/** Obtiene el comportamiento actual de un titular durante el partido. */
export async function getMatchBehavior(matchId, playerId, { signal } = {}) {
  if (USE_MOCKS) return getMatchBehaviorMock(matchId, playerId);

  const { data } = await api.get(`/matches/${encodeURIComponent(matchId)}/behavior`, {
    params: { playerId },
    signal,
  });
  return data;
}

/** Solicita cambiar el comportamiento de un titular durante el partido. */
export async function reassignBehavior(matchId, { playerId, behaviorId }) {
  if (USE_MOCKS) return reassignBehaviorMock(matchId, { playerId, behaviorId });

  await api.put(`/matches/${encodeURIComponent(matchId)}/behavior`, { playerId, behaviorId });
}

/**
 * Base absoluta (ws:// o wss://) para el WebSocket.
 * - http(s)://...  -> se cambia el protocolo (http -> ws, https -> wss).
 * - ws(s)://...    -> se usa tal cual.
 * - relativa ("/api") o vacía -> se resuelve contra window.location, con wss si la
 *   página está en https y ws si no. Sin esto quedaría "/api/ws/..." y
 *   new WebSocket() tira SyntaxError.
 */
function resolveWsBase(rawBase) {
  const base = (rawBase || '').trim().replace(/\/+$/, '');
  if (/^wss?:\/\//i.test(base)) return base;
  if (/^https?:\/\//i.test(base)) return base.replace(/^http/i, 'ws');

  const { protocol, host } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  const path = base && !base.startsWith('/') ? `/${base}` : base;
  return `${wsProtocol}//${host}${path}`;
}

/**
 * URL del WebSocket. Usa VITE_WS_URL si existe; si no, deriva la base de la URL
 * de la API REST. Ver resolveWsBase para los casos de URL relativa o vacía.
 */
export function buildWsUrl(matchId, tokenWs) {
  const base = resolveWsBase(import.meta.env.VITE_WS_URL || api.defaults.baseURL);
  return `${base}/ws/matches/${encodeURIComponent(matchId)}?token=${encodeURIComponent(tokenWs)}`;
}

/** Abre el socket del partido (real o simulado según VITE_USE_MOCKS). */
export function openMatchSocket(matchId, tokenWs) {
  if (USE_MOCKS) return createMatchSocketMock();
  return new WebSocket(buildWsUrl(matchId, tokenWs));
}

// TODO: datos estáticos del partido (nombre/usuario/avatar de cada club y, por jugador,
// nombre y atributos). El tick del WS solo trae `playerId` y posición, así que esto
// tiene que salir de otro endpoint REST. Pendiente de definir el contrato.