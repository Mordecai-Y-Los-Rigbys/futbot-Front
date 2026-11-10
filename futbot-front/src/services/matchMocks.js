const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const httpError = (status, data) => {
  const err = new Error(`Request failed with status code ${status}`);
  err.response = { status, data };
  return err;
};

// Penales de ejemplo: club1 gana 4 - 3 (el 5.º de club1 se erra y el 5.º de club2 también).
const MOCK_KICKERS = {
  club1: [
    { kickerId: 1, kickerName: 'Messi' },
    { kickerId: 2, kickerName: 'Di María' },
    { kickerId: 3, kickerName: 'Dybala' },
  ],
  club2: [
    { kickerId: 4, kickerName: 'Haaland' },
    { kickerId: 5, kickerName: 'De Bruyne' },
    { kickerId: 6, kickerName: 'Foden' },
  ],
};
const MOCK_SCORED = { club1: [true, true, true, true, false], club2: [true, false, true, true, false] };

const mockKicks = () =>
  [1, 2, 3, 4, 5].flatMap((round) =>
    ['club1', 'club2'].map((club) => ({
      club,
      ...MOCK_KICKERS[club][(round - 1) % 3],
      round,
      scored: MOCK_SCORED[club][round - 1],
    })),
  );

// GET /matches/{id} simulado. Con el id "finished" devuelve un partido terminado por penales
// (para ver la pantalla final al recargar); con "error500" falla; cualquier otro está en juego.
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
    role: matchId === 'spectator' ? 'spectator' : 'player',
  };
}

const MOCK_MEMBERS = [
  { playerId: 1, name: 'Lionel Messi', role: 'forward' },
  { playerId: 2, name: 'Rodrigo De Paul', role: 'midfield' },
  { playerId: 3, name: 'Cristian Romero', role: 'defense' },
  { playerId: 7, name: 'Ángel Di María', role: 'substitute' },
  { playerId: 8, name: 'Julián Álvarez', role: 'substitute' },
  { playerId: 9, name: 'Emiliano Martínez', role: 'substitute' },
].map((m) => ({ ...m, behavior: { id: m.playerId, name: 'Ofensivo', type: 'playerBehavior' } }));
const matchBehaviorIds = new Map();
const behaviorKey = (matchId, playerId) => `${matchId}:${playerId}`;

export async function getMatchTeamMock(matchId) {
  await wait(200);

  if (matchId === 'error403') throw httpError(403, { code: 'notAPlayerInMatch' });
  if (matchId === 'error404') throw httpError(404, { message: 'El partido no existe.' });
  if (matchId === 'error500') throw httpError(500, { message: 'Error interno al cargar el equipo.' });

  return { members: MOCK_MEMBERS, coachBehavior: null };
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

// Ids "trampa": error400 -> 400 notStarter, error403, error404, error409 (matchNotStarted).
export async function setSubstitutionMock(matchId) {
  await wait(300);

  if (matchId === 'error400') {
    throw httpError(400, {
      code: 'invalidFields',
      message: 'Revisá los campos marcados.',
      errors: [{ field: 'starterId', reason: 'notStarter' }],
    });
  }
  if (matchId === 'error403') throw httpError(403, { code: null, message: 'No sos jugador de este partido.' });
  if (matchId === 'error404') throw httpError(404, { code: null, message: 'El partido no existe.' });
  if (matchId === 'error409') throw httpError(409, { code: 'noPausesLeft', message: 'No quedan pausas.' });
}

// Ids "trampa": 4031 -> 403, 4041 -> 404, 4091 -> 409, 0 -> ambos clubes sin cambios.
export async function getSubstitutionsMock(matchId) {
  await wait(300);

  if (matchId === '4031') throw httpError(403, { message: 'El partido no te pertenece.' });
  if (matchId === '4041') throw httpError(404, { message: 'El partido no existe.' });
  if (matchId === '4091') throw httpError(409, { code: 'matchNotStarted', message: 'El partido no está en juego.' });
  if (matchId === '0') return { club1: null, club2: null };

  return {
    club1: { starterName: 'Lionel Messi', substituteName: 'Ángel Di María' },
    club2: null,
  };
}

export async function getMatchMock(matchId) {
  await wait(300);

  if (matchId === '4031') throw httpError(403, { message: 'El partido no te pertenece.' });
  if (matchId === '4041') throw httpError(404, { message: 'El partido no existe.' });

  // Id "finished": partido terminado por penales (para ver la pantalla final al recargar).
  if (matchId === 'finished') {
    return {
      id: 99,
      name: 'Final mock',
      status: 'finished',
      club1: { id: 10, username: 'scaloni', name: 'La Scaloneta FC', avatar: 1 },
      club2: { id: 11, username: 'guardiola', name: 'Manchester City', avatar: 4 },
      scheduledAt: null,
      createdAt: '2026-10-25T18:00:00Z',
      result: { score1: 1, score2: 1, penalties: { score1: 4, score2: 3, winner: 'club1', kicks: mockKicks() } },
    };
  }

  return {
    id: Number(matchId),
    name: 'Amistoso mock',
    status: 'started',
    club1: { id: 1, username: 'santi', name: 'FC Santi', avatar: 1 },
    club2: { id: 2, username: 'rival', name: 'Rival FC', avatar: 4 },
    scheduledAt: null,
    createdAt: '2026-10-25T18:00:00Z',
    result: null,
  };
}

// Ids "trampa": 4031 -> 403, 4041 -> 404, 0 -> amistoso sin rival (club2 null).
export async function getMatchLineupsMock(matchId) {
  await wait(300);

  if (matchId === '4031') throw httpError(403, { code: 'notAPlayerInMatch', message: 'No podés ver este partido.' });
  if (matchId === '4041') throw httpError(404, { message: 'El partido no existe.' });

  return {
    club1: [
      { playerId: 1, name: 'Lionel Messi', role: 'forward' },
      { playerId: 2, name: 'Julián Álvarez', role: 'midfield' },
      { playerId: 3, name: 'Rodrigo De Paul', role: 'defense' },
    ],
    club2:
      matchId === '0'
        ? null
        : [
            { playerId: 4, name: 'Lautaro Martínez', role: 'forward' },
            { playerId: 5, name: 'Enzo Fernández', role: 'midfield' },
            { playerId: 6, name: 'Cristian Romero', role: 'defense' },
          ],
  };
}
