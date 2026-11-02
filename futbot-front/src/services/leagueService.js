import api from './api';
import {
  createLeagueMock,
  getLeagueMock,
  getLeagueParticipantsMock,
  getLeaguesMock,
  joinLeagueMock,
  unlockLeagueMock,
} from './leagueMocks';

// El backend responde siempre de a 50 elementos; el cliente no puede cambiarlo.
export const PAGE_SIZE = 50;

// Modo sin backend: poné VITE_USE_MOCKS=true en futbot-front/.env.local y reiniciá Vite.
// Nunca se activa en los tests (MODE === 'test'), que mockean `api` por su cuenta.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true' && import.meta.env.MODE !== 'test';

/**
 * Lista las ligas (GET /leagues). Requiere sesión: la cookie viaja sola
 * porque `api` usa `withCredentials: true`.
 * Errores posibles: 400 (page inválido), 401 (sin sesión).
 * @param {string} name  Filtro por nombre (parcial, case-insensitive). Vacío = sin filtro.
 * @param {number} page  Página a pedir, empezando en 1.
 * @param {{ signal?: AbortSignal }} [options]  Permite cancelar la request.
 * @returns {Promise<{ items: LeagueSummary[], page: number, pageSize: number, total: number }>}
 *   donde LeagueSummary = { id, name, creator: {id, username, name}, status,
 *   participantsCount, maxParticipants, private, createdAt }.
 *   `items` puede venir vacío con status 200 (sin ligas, sin coincidencias o página fuera de rango).
 */
export async function getLeagues(name, page = 1, { signal } = {}) {
  if (USE_MOCKS) return getLeaguesMock(name, page, { signal });

  const { data } = await api.get('/leagues', {
    // Con `undefined` axios omite el parámetro, así `?name=` no viaja vacío.
    params: { name: name || undefined, page },
    signal,
  });
  return data;
}

/**
 * Crea una liga (POST /leagues). La cookie de sesión viaja automáticamente
 * porque `api` usa `withCredentials: true`.
 * @param {CreateLeagueRequest} leagueData Datos completos de la liga, incluidos sus members.
 * @returns {Promise<LeagueSummary>} Liga creada por el backend.
 */
export async function createLeague(leagueData) {
  if (USE_MOCKS) return createLeagueMock(leagueData);

  const { data } = await api.post('/leagues', leagueData);
  return data;
}

/**
 * Obtiene el detalle de una liga (GET /leagues/{id}). No requiere acceso de liga: sirve también
 * para ligas privadas.
 * Errores posibles: 401 (sin sesión), 404 (no existe).
 * @param {string|number} id  Id de la liga (normalmente el param de la URL).
 * @param {{ signal?: AbortSignal }} [options]  Permite cancelar la request.
 * @returns {Promise<LeagueDetail>} LeagueSummary más `minParticipants` y `joined`
 *   (`true` si el usuario participa; el creador siempre participa).
 */
export async function getLeague(id, { signal } = {}) {
  if (USE_MOCKS) return getLeagueMock(id, { signal });

  const { data } = await api.get(`/leagues/${encodeURIComponent(id)}`, { signal });
  return data;
}

/**
 * Lista los participantes de una liga (GET /leagues/{id}/participants).
 * Si la liga es privada hace falta ser creador, participante o haberla desbloqueado en la sesión
 * con `unlockLeague` (convención 11 del contrato). No viaja ninguna contraseña.
 * Responde la lista actual en cualquier estado de la liga.
 * Errores posibles: 401 (sin sesión), 403 (code: leagueAccessRequired), 404.
 * @param {string|number} id
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ id: number, username: string, name: string, avatar: number }[]>}
 */
export async function getLeagueParticipants(id, { signal } = {}) {
  if (USE_MOCKS) return getLeagueParticipantsMock(id, { signal });

  const { data } = await api.get(`/leagues/${encodeURIComponent(id)}/participants`, { signal });
  return data;
}

/**
 * Desbloquea una liga privada para la sesión actual (POST /leagues/{id}/access). Responde 204.
 * El servidor recuerda el desbloqueo en la sesión (la cookie que ya existe): el cliente no guarda
 * ni reenvía nada, ni la contraseña ni un token. Dura hasta el log-out o la expiración.
 * Errores posibles: 400 (falta la contraseña), 401, 403 (code: invalidLeaguePassword), 404.
 * @param {string|number} id
 * @param {{ password: string }} credentials
 * @returns {Promise<void>}
 */
export async function unlockLeague(id, { password }) {
  if (USE_MOCKS) return unlockLeagueMock(id, { password });

  await api.post(`/leagues/${encodeURIComponent(id)}/access`, { password });
}

/**
 * Inscribe al usuario en una liga con un equipo (POST /leagues/{id}/participants). Responde 201 sin body.
 * En una liga privada la contraseña va en el body y se valida acá mismo (no hace falta haberla
 * desbloqueado antes); si la inscripción sale bien, la liga queda desbloqueada en la sesión.
 * Errores posibles: 400 (campos inválidos), 401, 403 (invalidLeaguePassword), 404,
 * 409 (code: notInPreparation | leagueFull | alreadyParticipating | playerOrBehaviorNotOwned | behaviorTypeMismatch).
 * @param {string|number} id
 * @param {{ password?: string, members: Member[] }} team
 *   `password` solo se manda si la liga es privada (si es `undefined`, JSON lo omite).
 *   No se manda `coachBehaviorId`: por ahora el modo DT no se usa, y según la convención 10 del
 *   contrato un equipo sin `coachBehaviorId` queda sin director técnico. OJO: el schema de
 *   JoinLeagueRequest lo lista como requerido; si el backend responde 400 por ese campo, mandar `null`.
 * @returns {Promise<void>}
 */
export async function joinLeague(id, { password, members }) {
  if (USE_MOCKS) return joinLeagueMock(id, { password, members });

  await api.post(`/leagues/${encodeURIComponent(id)}/participants`, { password, members });
}
