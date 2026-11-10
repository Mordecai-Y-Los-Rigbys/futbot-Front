import api from './api';
import { USE_MOCKS } from '../config/mocks';
import { resolveWsBase } from './matchService';
import { createTestConnectionMock, createTestSocketMock } from './behaviorTestMocks';

// El tokenWs vence a los 5 minutos (es reutilizable hasta entonces).
export const TEST_TOKEN_TTL_MS = 5 * 60 * 1000;

/**
 * Pide el tokenWs de una prueba de comportamiento (POST /behaviors/{id}/test-connections).
 * No es un partido: no tiene id de partido, no aparece en listados ni afecta rankings.
 *
 * @param {number} behaviorId  Behavior del delantero de club1 (también es el {id} del canal WS).
 * @param {{ playerId: number, club: 'club1'|'club2', role: string, behaviorId: number }[]} members  6 miembros.
 * Errores: 400 invalidFields, 401, 403, 404, 409 (notPlayerBehavior | playerOrBehaviorNotOwned | behaviorTypeMismatch).
 * @returns {Promise<{ tokenWs: string }>}
 */
export async function createBehaviorTestConnection(behaviorId, members, { signal } = {}) {
  if (USE_MOCKS) return createTestConnectionMock(behaviorId, members);

  const { data } = await api.post(
    `/behaviors/${encodeURIComponent(behaviorId)}/test-connections`,
    { members },
    { signal },
  );
  return data;
}

/** URL del canal de prueba: /ws/behaviors/{id}/test?token=<tokenWs> (sin cookie, igual que el de partido). */
export function buildTestWsUrl(behaviorId, tokenWs) {
  const base = resolveWsBase(import.meta.env.VITE_WS_URL || api.defaults.baseURL);
  return `${base}/ws/behaviors/${encodeURIComponent(behaviorId)}/test?token=${encodeURIComponent(tokenWs)}`;
}

/** Abre el socket de la prueba (real o simulado según VITE_USE_MOCKS). `members` solo lo usa el mock. */
export function openTestSocket(behaviorId, tokenWs, members) {
  if (USE_MOCKS) return createTestSocketMock(members);
  return new WebSocket(buildTestWsUrl(behaviorId, tokenWs));
}

// ---------------------------------------------------------------------------
// Errores del POST: siempre se decide por `code`, nunca por `message`.
// ---------------------------------------------------------------------------

export const TEST_POST_ERROR_MESSAGES = {
  notPlayerBehavior: 'El comportamiento del delantero aliado es de DT. Elegí uno de jugador.',
  playerOrBehaviorNotOwned:
    'Algún jugador o comportamiento ya no está disponible. Actualizamos las listas: revisá la alineación.',
  behaviorTypeMismatch: 'Alguno de los comportamientos es de DT. Usá solo comportamientos de jugador.',
};

// Vocabulario único de `reason` (OpenAPI, convención 6.d). Los que cruzan campos y no aplican acá
// (invalidSum, lessThanMin, notStarter, notSubstitute) caen en el mensaje genérico.
const FIELD_REASON_MESSAGES = {
  required: 'Completá este campo.',
  invalidType: 'Valor inválido.',
  outOfRange: 'Valor fuera de rango.',
  invalidValue: 'Valor inválido.',
  invalidTeam: 'Cada club necesita un delantero, un mediocampista y un defensor, con jugadores distintos.',
};

/**
 * Mapea errors[] del 400 invalidFields a { 'members.2.playerId': 'msg', members: 'msg' }.
 * `field` puede ser `members[i].playerId|club|role|behaviorId`, `members[i]` (el elemento no es un
 * objeto: se muestra en el jugador de esa fila) o `members` (required / invalidType / invalidTeam).
 * Un reason por campo; se informan todos a la vez.
 */
export function mapTestFieldErrors(errors = []) {
  const result = {};
  errors.forEach(({ field, reason }) => {
    const message = FIELD_REASON_MESSAGES[reason] ?? 'Revisá este campo.';
    const byField = /^members\[(\d+)\]\.(playerId|club|role|behaviorId)$/.exec(field ?? '');
    const byElement = /^members\[(\d+)\]$/.exec(field ?? '');
    let key = 'members';
    if (byField) key = `members.${byField[1]}.${byField[2]}`;
    else if (byElement) key = `members.${byElement[1]}.playerId`;
    if (!(key in result)) result[key] = message;
  });
  return result;
}
