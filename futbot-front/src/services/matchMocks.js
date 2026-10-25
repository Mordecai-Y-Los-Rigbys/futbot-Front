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

// Ids "trampa": 4031 -> 403, 4041 -> 404, 4091 -> 409, 0 -> ambos clubes sin cambios.
export async function getNextSubstitutionsMock(matchId) {
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
