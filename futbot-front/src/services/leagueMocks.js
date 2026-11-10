import axios from 'axios';

// Datos falsos para desarrollar sin backend. Se activan con VITE_USE_MOCKS=true
// (ver leagueService.js). Imitan el contrato de la API y la forma de error de axios.
//
// Para probar a mano (usuario mock = id 1):
//   - Liga 1: la creaste vos (id 1) -> no podés abandonar.
//   - Liga 2: pública, creada por otro -> podés unirte.
//   - Liga 4: privada, creada por otro -> la contraseña es 1234.
// El desbloqueo de una liga privada se recuerda mientras no recargues la página
// (acá vive en memoria; en el servidor vive en la sesión). El WebSocket simulado manda
// el estado al conectar y uno nuevo cada vez que alguien se une.

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

// Mismo tamaño de página que el backend (se repite acá para no importar de leagueService
// y evitar una dependencia circular).
const MOCK_PAGE_SIZE = 50;
const MOCK_DELAY_MS = 600; // lo bastante largo para ver el estado de carga
const MOCK_LEAGUES_COUNT = 120; // subir a 120 para probar la paginación (3 páginas de 50)

const MOCK_CURRENT_USER = { id: 1, username: 'santi', name: 'FC Santi', avatar: 1 };
const MOCK_LEAGUE_PASSWORD = '1234';
const MOCK_MIN_PARTICIPANTS = 3;

// Búsquedas "trampa" para probar errores desde el input:
//   "error"  -> responde 500
//   "sesion" -> responde 401
const MOCK_ERROR_SEARCH = 'error';
const MOCK_UNAUTHORIZED_SEARCH = 'sesion';

// Nombres de liga "trampa" para probar errores al crear.
const MOCK_CREATE_ERRORS = {
  'mock-400': { status: 400, data: { code: 'invalidFieldType', message: 'Datos de prueba inválidos.' } },
  'mock-401': { status: 401, data: { message: 'La sesión mock expiró.' } },
  'mock-409': {
    status: 409,
    data: {
      code: 'playerOrBehaviorNotOwned',
      message: 'Alguno de los jugadores o comportamientos seleccionados no te pertenece (mock).',
    },
  },
};

const THEMES = ['Liga de campeones', 'Copa del barrio', 'Torneo relámpago', 'Liga amateur', 'Súper liga', 'Liga de verano'];
const CLUBS = ['Boca Juniors FC', 'River Plate FC', 'Racing Club', 'Independiente', 'San Lorenzo', 'Estudiantes', 'Vélez Sarsfield', 'Lanús'];
const USERNAMES = ['pepe', 'luli', 'nico', 'sofi', 'tomi', 'cami'];
const STATUSES = ['preparation', 'started', 'finished', 'cancelled', 'preparation'];
const MAX_PARTICIPANTS = [8, 12, 16];

// ---------------------------------------------------------------------------
// Datos y estado en memoria (se pierde al recargar la página)
// ---------------------------------------------------------------------------

const LEAGUES = Array.from({ length: MOCK_LEAGUES_COUNT }, (_, i) => {
  const status = STATUSES[i % STATUSES.length];
  const maxParticipants = MAX_PARTICIPANTS[i % MAX_PARTICIPANTS.length];

  return {
    id: i + 1,
    name: `${THEMES[i % THEMES.length]} #${i + 1}`,
    creator: { id: (i % CLUBS.length) + 1, username: USERNAMES[i % USERNAMES.length], name: CLUBS[i % CLUBS.length] },
    status,
    participantsCount: status === 'preparation' ? 0 : maxParticipants,
    maxParticipants,
    private: i % 3 === 0,
    createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
  };
});

let nextLeagueId = LEAGUES.length + 1;

const participantsByLeague = new Map(); // leagueId -> participantes
const unlockedLeagues = new Set(); // ids de ligas privadas desbloqueadas en la "sesión"
const socketListeners = new Set(); // sockets simulados abiertos

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Error con la forma que arma axios.
const httpError = (status, data = {}) =>
  Object.assign(new Error(`HTTP ${status} (mock)`), { response: { status, data } });

// Igual, pero incluyendo el `code` del body de error del contrato.
const codedError = (status, code) => httpError(status, { code, message: code });

// Espera `ms`, pero se corta con un error de cancelación si se aborta el signal
// (igual que haría axios), para que el AbortController de la pantalla funcione.
const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new axios.CanceledError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new axios.CanceledError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
// ---------------------------------------------------------------------------
// Fixture de partidos (usado por getLeagueFixtureMock y el WS de fixture)
// ---------------------------------------------------------------------------
const MOCK_FIXTURE = [
  {
    id: 101,
    leagueId: 2,
    name: null,
    status: 'finished',
    club1: { id: 1, username: 'pepe', name: 'Boca Juniors FC', avatar: 1 },
    club2: { id: 2, username: 'luli', name: 'River Plate FC',  avatar: 2 },
    scheduledAt: new Date(Date.UTC(2026, 0, 10, 20, 0)).toISOString(),
    createdAt:   new Date(Date.UTC(2026, 0,  8,  9, 0)).toISOString(),
    result: { score1: 2, score2: 1, penalties: null },
  },
  {
    id: 102,
    leagueId: 2,
    name: null,
    status: 'finished',
    club1: { id: 3, username: 'nico', name: 'Racing Club',   avatar: 3 },
    club2: { id: 4, username: 'sofi', name: 'Independiente', avatar: 4 },
    scheduledAt: new Date(Date.UTC(2026, 0, 11, 20, 0)).toISOString(),
    createdAt:   new Date(Date.UTC(2026, 0,  8,  9, 0)).toISOString(),
    result: { score1: 0, score2: 0, penalties: { score1: 4, score2: 3, winner: 'club1' } },
  },
  {
    id: 103,
    leagueId: 2,
    name: null,
    status: 'started',
    club1: { id: 5, username: 'tomi', name: 'San Lorenzo', avatar: 5 },
    club2: { id: 6, username: 'cami', name: 'Estudiantes',  avatar: 1 },
    scheduledAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    createdAt:   new Date(Date.UTC(2026, 0,  8,  9, 0)).toISOString(),
    result: null,
  },
  {
    id: 104,
    leagueId: 2,
    name: null,
    status: 'scheduled',
    club1: { id: 7, username: 'mari', name: 'Vélez Sarsfield', avatar: 2 },
    club2: { id: 8, username: 'juli', name: 'Lanús',           avatar: 3 },
    scheduledAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    createdAt:   new Date(Date.UTC(2026, 0,  8,  9, 0)).toISOString(),
    result: null,
  },
  {
    id: 105,
    leagueId: 2,
    name: null,
    status: 'scheduled',
    club1: { id: 1, username: 'pepe', name: 'Boca Juniors FC', avatar: 1 },
    club2: { id: 3, username: 'nico', name: 'Racing Club',     avatar: 3 },
    scheduledAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    createdAt:   new Date(Date.UTC(2026, 0,  8,  9, 0)).toISOString(),
    result: null,
  },
];

function findLeague(id) {
  const league = LEAGUES.find((item) => item.id === Number(id));
  if (!league) throw codedError(404, 'notFound');
  return league;
}

function participantsOf(league) {
  if (!participantsByLeague.has(league.id)) {
    participantsByLeague.set(league.id, [{ ...league.creator, avatar: 1 }]);
    if(league.id === 2) {
      participantsByLeague.get(league.id).push({ ...MOCK_CURRENT_USER });
    }
  }
  return participantsByLeague.get(league.id);
}

const isMemberOf = (league) =>
  participantsOf(league).some((participant) => participant.id === MOCK_CURRENT_USER.id);

const hasAccessTo = (league) =>
  !league.private || isMemberOf(league) || unlockedLeagues.has(league.id);

// Avisa a los sockets simulados abiertos que cambió una liga.
const notifyLeagueChange = (league) => socketListeners.forEach((listener) => listener(league));

// ---------------------------------------------------------------------------
// GET /leagues
// ---------------------------------------------------------------------------
export async function getLeaguesMock(name, page = 1, { signal } = {}) {
  await wait(MOCK_DELAY_MS, signal);

  const term = (name || '').trim().toLowerCase();
  if (term === MOCK_UNAUTHORIZED_SEARCH) throw httpError(401);
  if (term === MOCK_ERROR_SEARCH) throw httpError(500);

  // La API responde 400 si page no es un entero >= 1.
  if (!Number.isInteger(page) || page < 1) throw httpError(400);

  const filtered = term ? LEAGUES.filter((l) => l.name.toLowerCase().includes(term)) : LEAGUES;
  const start = (page - 1) * MOCK_PAGE_SIZE;

  // Una página válida pero fuera de rango NO es error: 200 con items vacíos.
  return {
    items: filtered.slice(start, start + MOCK_PAGE_SIZE).map((l) => ({ ...l, creator: { ...l.creator } })),
    page,
    pageSize: MOCK_PAGE_SIZE,
    total: filtered.length,
  };
}

// ---------------------------------------------------------------------------
// POST /leagues. Usá mock-400, mock-401 o mock-409 como nombre para probar errores.
// ---------------------------------------------------------------------------
export async function createLeagueMock(leagueData) {
  await wait(MOCK_DELAY_MS);

  const error = MOCK_CREATE_ERRORS[leagueData.name.trim().toLowerCase()];
  if (error) throw httpError(error.status, error.data);

  const league = {
    id: nextLeagueId,
    name: leagueData.name,
    creator: { id: MOCK_CURRENT_USER.id, username: MOCK_CURRENT_USER.username, name: MOCK_CURRENT_USER.name },
    status: 'preparation',
    participantsCount: 1,
    maxParticipants: leagueData.maxParticipants,
    private: leagueData.private,
    createdAt: new Date().toISOString(),
  };
  nextLeagueId += 1;
  LEAGUES.unshift(league);

  return { ...league, creator: { ...league.creator } };
}

// ---------------------------------------------------------------------------
// GET /leagues/{id}
// ---------------------------------------------------------------------------
export async function getLeagueMock(id, { signal } = {}) {
  await wait(MOCK_DELAY_MS, signal);
  const league = findLeague(id);
  return {
    ...league,
    creator: { ...league.creator },
    participantsCount: participantsOf(league).length,
    minParticipants: MOCK_MIN_PARTICIPANTS,
    joined: isMemberOf(league),
  };
}

// ---------------------------------------------------------------------------
// GET /leagues/{id}/participants
// ---------------------------------------------------------------------------
export async function getLeagueParticipantsMock(id, { signal } = {}) {
  await wait(MOCK_DELAY_MS, signal);
  const league = findLeague(id);

  if (!hasAccessTo(league)) throw codedError(403, 'leagueAccessRequired');
  return participantsOf(league).map((participant) => ({ ...participant }));
}

// ---------------------------------------------------------------------------
// POST /leagues/{id}/access
// ---------------------------------------------------------------------------
export async function unlockLeagueMock(id, { password } = {}) {
  await wait(MOCK_DELAY_MS);
  const league = findLeague(id);

  // Pública, creador o participante: no se evalúa la contraseña (igual que el servidor).
  if (!league.private || isMemberOf(league)) {
    if (league.private) unlockedLeagues.add(league.id);
    return;
  }
  if (password !== MOCK_LEAGUE_PASSWORD) throw codedError(403, 'invalidLeaguePassword');
  unlockedLeagues.add(league.id);
}

// ---------------------------------------------------------------------------
// POST /leagues/{id}/participants
// ---------------------------------------------------------------------------
export async function joinLeagueMock(id, { password } = {}) {
  await wait(MOCK_DELAY_MS);
  const league = findLeague(id);
  const participants = participantsOf(league);

  if (league.status !== 'preparation') throw codedError(409, 'notInPreparation');
  if (isMemberOf(league)) throw codedError(409, 'alreadyParticipating');
  if (participants.length >= league.maxParticipants) throw codedError(409, 'leagueFull');
  if (league.private && password !== MOCK_LEAGUE_PASSWORD) throw codedError(403, 'invalidLeaguePassword');

  participants.push({ ...MOCK_CURRENT_USER });
  if (league.private) unlockedLeagues.add(league.id); // unirse también desbloquea
  notifyLeagueChange(league);
}

// ---------------------------------------------------------------------------
// WebSocket /ws/leagues/{id}/participants: mismo contrato que el real (handshake con
// cierres 4xxx, estado completo al conectar y un mensaje nuevo con cada cambio).
// ---------------------------------------------------------------------------
export function createLeagueSocketMock(id, channel) {

  const socket = { onopen: null, onmessage: null, onclose: null, close: () => teardown() };
  let timer = null;
  let listener = null;

  const send = (league) =>
    socket.onmessage?.({
      data: JSON.stringify({
        type: 'leagueParticipants',
        leagueStatus: league.status,
        participants: participantsOf(league).map((participant) => ({ ...participant })),
      }),
    });

  const reject = (code, reason) => {
    socket.onopen?.();
    socket.onclose?.({ code, reason });
  };

  function teardown() {
    clearTimeout(timer);
    if (listener) socketListeners.delete(listener);
    listener = null;
  }

  timer = setTimeout(() => {
    if (channel === 'fixture') {
      socket.onopen?.();
      setTimeout(() => {
        socket.onmessage?.({
          data: JSON.stringify({ type: 'leagueFixture', fixture: MOCK_FIXTURE.map((m) => ({ ...m })) }),
        });
      }, 200);
      return;
    }

    const league = LEAGUES.find((item) => item.id === Number(id));
    if (!league) return reject(4404, 'leagueNotFound');
    if (!hasAccessTo(league)) return reject(4403, 'leagueAccessRequired');
    if (league.status !== 'preparation') return reject(4409, 'leagueNotInPreparation');

    socket.onopen?.();
    send(league);
    listener = (changed) => {
      if (changed.id === league.id) send(league);
    };
    socketListeners.add(listener);
  }, MOCK_DELAY_MS);

  return socket;
}
// Avisa a los sockets simulados que cambió la lista de participantes de una liga.
const emitParticipants = (league) => socketListeners.forEach((listener) => listener(league));

// DELETE /leagues/{id}/participants/me (no revoca el desbloqueo, como el servidor)
export async function leaveLeagueMock(id) {
  await wait(MOCK_DELAY_MS);
  const league = findLeague(id);
  const participants = participantsOf(league);

  if (league.status !== 'preparation') throw codedError(409, 'notInPreparation');
  if (league.creator.id === MOCK_CURRENT_USER.id) throw codedError(409, 'isCreator');

  const index = participants.findIndex((participant) => participant.id === MOCK_CURRENT_USER.id);
  if (index === -1) throw codedError(409, 'notParticipating');
  participants.splice(index, 1);
  emitParticipants(league);
}

// ---------------------------------------------------------------------------
// GET /leagues/{id}/fixture
// ---------------------------------------------------------------------------
export async function getLeagueFixtureMock(id, { signal } = {}) {
  await wait(MOCK_DELAY_MS, signal);
  const league = findLeague(id);
  if (league.status === 'preparation') throw codedError(409, 'leagueNotStarted');
  return MOCK_FIXTURE.map((m) => ({ ...m }));
}

// ---------------------------------------------------------------------------
// WS /ws/leagues/{id}/fixture — manda el fixture completo al conectar
// ---------------------------------------------------------------------------
export function createLeagueFixtureSocketMock() {
  const socket = { onopen: null, onmessage: null, onclose: null, close: () => clearTimeout(timer) };
  let timer;

  timer = setTimeout(() => {
    socket.onopen?.();
    setTimeout(() => {
      socket.onmessage?.({
        data: JSON.stringify({ type: 'leagueFixture', fixture: MOCK_FIXTURE.map((m) => ({ ...m })) }),
      });
    }, 200);
  }, MOCK_DELAY_MS);

  return socket;
}
export async function startLeagueMock(id) {
  await wait(MOCK_DELAY_MS);
  const league = findLeague(id);
  if (league.status !== 'preparation') throw codedError(409, 'notInPreparation');
  const participants = participantsOf(league);
  if (participants.length < MOCK_MIN_PARTICIPANTS) throw codedError(409, 'notEnoughParticipants');
  league.status = 'started';
  notifyLeagueChange(league);
}
