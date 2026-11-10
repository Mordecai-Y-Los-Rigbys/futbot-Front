import api from './api';
import { USE_MOCKS } from '../config/mocks';
import {
  createMatchConnectionMock,
  createMatchSocketMock,
  getMatchMock,
  getMatchBehaviorMock,
  getMatchLineupsMock, 
  getMatchMock,
  getMatchTeamMock,
  getSubstitutionsMock,
  reassignBehaviorMock,
  getSubstitutionsMock,
  setSubstitutionMock,
} from './matchMocks';

// Nunca se activa en los tests (MODE === 'test'): ahí se mockea este módulo.

/**
 * Pide el tokenWs para abrir el WebSocket del partido (POST /matches/{id}/connections).
 * Errores posibles: 401 (sin sesión), 403 (sin acceso), 404 (no existe), 409 (terminado/cancelado).
 * @returns {Promise<{ tokenWs: string, role: 'player' | 'spectator' }>}
 *   `role` dice si la conexión es de jugador o de espectador (solo lectura).
 */
export async function createMatchConnection(matchId) {
  if (USE_MOCKS) return createMatchConnectionMock(matchId);

  const { data } = await api.post(`/matches/${encodeURIComponent(matchId)}/connections`);
  return data;
}

export async function getMatchTeam(matchId, { signal } = {}) {
  if (USE_MOCKS) return getMatchTeamMock(matchId);

  const { data } = await api.get(`/matches/${encodeURIComponent(matchId)}/team`, { signal });
  return data;
}

/**
 * Sustitución de cada equipo (GET /matches/{id}/substitutions): la PENDIENTE (se aplica en la
 * próxima pausa) si el partido no está en pausa, y la APLICADA al empezar la pausa si lo está.
 * Solo la pueden pedir los dos jugadores del partido y solo con el partido en juego.
 * Errores posibles: 401 (sin sesión), 403 (no juega), 404 (no existe), 409 (matchNotStarted).
 * @returns {Promise<{ club1: Substitution|null, club2: Substitution|null }>}
 *   donde Substitution = { starterName, substituteName } (sale / entra).
 */
export async function getSubstitutions(matchId, { signal } = {}) {
  if (USE_MOCKS) return getSubstitutionsMock(matchId, { signal });

  const { data } = await api.get(`/matches/${encodeURIComponent(matchId)}/substitutions`, { signal });
  return data;
}

/**
 * Partido completo (GET /matches/{id}): clubes con su usuario, estado y resultado.
 * Solo lo piden los dos usuarios del partido. Orden de errores: 401 > 404 > 403.
 * @returns {Promise<Match>} con club1 y club2 = UserClub { id, username, name, avatar? };
 *   club2 es null en un amistoso sin rival.
 */
export async function getMatch(matchId, { signal } = {}) {
  if (USE_MOCKS) return getMatchMock(matchId, { signal });

  const { data } = await api.get(`/matches/${encodeURIComponent(matchId)}`, { signal });
  return data;
}

/**
 * Equipo del usuario en el partido (GET /matches/{id}/team). Solo para jugadores del partido.
 * Siempre 6 miembros: los 3 titulares (forward, midfield, defense) y los 3 suplentes (substitute).
 * Refleja las sustituciones ya aplicadas; una pendiente todavía no se ve acá.
 * Errores posibles: 401 (sin sesión), 403 (`notAPlayerInMatch`), 404 (no existe).
 * @returns {Promise<{ members: { playerId: number, name: string, role: string, behavior: object }[],
 *   coachBehavior: object|null }>}
 */
export async function getMatchTeam(matchId, { signal } = {}) {
  if (USE_MOCKS) return getMatchTeamMock(matchId);

  const { data } = await api.get(`/matches/${encodeURIComponent(matchId)}/team`, { signal });
  return data;
}

/**
 * Pide una sustitución (PUT /matches/{id}/substitutions): un suplente entra por un titular.
 * Responde 204 sin body. Queda pendiente y se aplica al empezar la próxima pausa; cada PUT
 * reemplaza a la pendiente anterior.
 * Errores posibles: 400 (`invalidFields`, con `notStarter` / `notSubstitute` si la selección quedó vieja),
 * 401, 403 (no es jugador), 404, 409 (`matchNotStarted`, `matchInPenalties`, `noPausesLeft`).
 */
export async function setSubstitution(matchId, { starterId, substituteId }) {
  if (USE_MOCKS) return setSubstitutionMock(matchId, { starterId, substituteId });

  await api.put(`/matches/${encodeURIComponent(matchId)}/substitutions`, { starterId, substituteId });
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
 * Titulares de ambos clubes (GET /matches/{id}/lineups). Lo pueden pedir los dos usuarios
 * del partido y, en partidos de liga, los espectadores con acceso a la liga.
 * Refleja la alineación efectiva del momento (con las sustituciones ya aplicadas).
 * Errores posibles: 401 (sin sesión), 403 (notAPlayerInMatch / leagueAccessRequired), 404 (no existe).
 * No tiene 409: responde en cualquier estado del partido.
 * @returns {Promise<{ club1: LineupPlayer[], club2: LineupPlayer[]|null }>}
 *   donde LineupPlayer = { playerId, name, role } y role es forward | midfield | defense.
 *   club2 es null en un amistoso sin rival.
 */
export async function getMatchLineups(matchId, { signal } = {}) {
  if (USE_MOCKS) return getMatchLineupsMock(matchId, { signal });

  const { data } = await api.get(`/matches/${encodeURIComponent(matchId)}/lineups`, { signal });
  return data;
}

/**
 * Base absoluta (ws:// o wss://) para el WebSocket.
 * - http(s)://...  -> se cambia el protocolo (http -> ws, https -> wss).
 * - ws(s)://...    -> se usa tal cual.
 * - relativa ("/api") o vacía -> se resuelve contra window.location, con wss si la
 *   página está en https y ws si no. Sin esto quedaría "/api/ws/..." y
 *   new WebSocket() tira SyntaxError.
 */
export function resolveWsBase(rawBase) {
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
// nombre, atributos y behavior activo). El tick del WS solo trae `playerId` y posición,
// así que esto tiene que salir de otro endpoint REST. Pendiente de definir el contrato.