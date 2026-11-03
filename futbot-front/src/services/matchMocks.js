import { getBehaviorByIdMock } from './behaviorMocks';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const httpError = (status, data) => {
  const err = new Error(`Request failed with status code ${status}`);
  err.response = { status, data };
  return err;
};

export async function createMatchConnectionMock(matchId) {
  await wait(200);

  if (matchId === 'error401') {
    throw httpError(401, { message: 'Sesión expirada.' });
  }
  if (matchId === 'error409') {
    throw httpError(409, { message: 'El partido ya terminó o fue cancelado.' });
  }
  if (matchId === 'error500') {
    throw httpError(500, { message: 'Error interno al generar conexión.' });
  }

  return {
    tokenWs: `mock_ws_token_match_${matchId}_${Date.now()}`,
  };
}

const MOCK_STARTERS = [
  { playerId: 1, playerName: 'Lionel Messi', role: 'forward' },
  { playerId: 2, playerName: 'Rodrigo De Paul', role: 'midfield' },
  { playerId: 3, playerName: 'Cristian Romero', role: 'defense' },
];
const matchBehaviorIds = new Map();
const behaviorKey = (matchId, playerId) => `${matchId}:${playerId}`;

export async function getMatchTeamMock(matchId) {
  await wait(200);

  if (matchId === 'error403') throw httpError(403, { code: 'notAPlayerInMatch' });
  if (matchId === 'error404') throw httpError(404, { message: 'El partido no existe.' });
  if (matchId === 'error500') throw httpError(500, { message: 'Error interno al cargar el equipo.' });

  return { starters: MOCK_STARTERS };
}

export async function getMatchBehaviorMock(matchId, playerId) {
  await wait(200);
  const behaviorId = matchBehaviorIds.get(behaviorKey(matchId, playerId)) ?? playerId;
  const { name, code } = await getBehaviorByIdMock(behaviorId);
  return { name, code };
}

export async function reassignBehaviorMock(matchId, { playerId, behaviorId }) {
  await wait(200);
  await getBehaviorByIdMock(behaviorId);
  matchBehaviorIds.set(behaviorKey(matchId, playerId), behaviorId);
}

// Socket falso para desarrollar sin backend: abre y queda en silencio,
// o sea, la pantalla muestra "Esperando al rival…".
export function createMatchSocketMock() {
  const timer = setTimeout(() => socket.onopen?.(), 100);
  const socket = {
    onopen: null,
    onmessage: null,
    onclose: null,
    close() {
      clearTimeout(timer);
    },
  };
  return socket;
}
