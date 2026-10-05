import axios from 'axios';

// Datos falsos para desarrollar sin backend. Se activan con VITE_USE_MOCKS=true
// (ver leagueService.js). Imitan el contrato de la API y la forma de error de axios.

// Mismo tamaño de página que el backend (se repite acá para no importar de leagueService
// y evitar una dependencia circular).
const MOCK_PAGE_SIZE = 50;
const MOCK_DELAY_MS = 600; // lo bastante largo para ver el estado de carga

// Búsquedas "trampa" para probar errores desde el input:
//   "error"  -> responde 500
//   "sesion" -> responde 401
const MOCK_ERROR_SEARCH = 'error';
const MOCK_UNAUTHORIZED_SEARCH = 'sesion';

const THEMES = ['Liga de campeones', 'Copa del barrio', 'Torneo relámpago', 'Liga amateur', 'Súper liga', 'Liga de verano'];
const CLUBS = ['Boca Juniors FC', 'River Plate FC', 'Racing Club', 'Independiente', 'San Lorenzo', 'Estudiantes', 'Vélez Sarsfield', 'Lanús'];
const USERNAMES = ['pepe', 'luli', 'nico', 'sofi', 'tomi', 'cami'];
const STATUSES = ['preparation'];
const MAX_PARTICIPANTS = [8, 12, 16];

// 120 ligas => 3 páginas de 50, así se prueba la paginación.
const LEAGUES = Array.from({ length: 5 }, (_, i) => {
  const status = STATUSES[i % STATUSES.length];
  const maxParticipants = MAX_PARTICIPANTS[i % MAX_PARTICIPANTS.length];
  const participantsCount =
    status === 'preparation' ? Math.min(maxParticipants, 0) : maxParticipants;

  return {
    id: i + 1,
    name: `${THEMES[i % THEMES.length]} #${i + 1}`,
    creator: { id: (i % CLUBS.length) + 1, username: USERNAMES[i % USERNAMES.length], name: CLUBS[i % CLUBS.length] },
    status,
    participantsCount,
    maxParticipants,
    private: i % 3 === 0,
    createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
  };
});

const httpError = (status, data = {}) =>
  Object.assign(new Error(`HTTP ${status} (mock)`), { response: { status, data } });

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

let nextLeagueId = LEAGUES.length + 1;

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

// GET /leagues
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

// POST /leagues. Usá mock-400, mock-401 o mock-409 como nombre para probar errores.
export async function createLeagueMock(leagueData) {
  await wait(MOCK_DELAY_MS);

  const error = MOCK_CREATE_ERRORS[leagueData.name.trim().toLowerCase()];
  if (error) throw httpError(error.status, error.data);

  const league = {
    id: nextLeagueId,
    name: leagueData.name,
    creator: { id: 1, username: 'vos', name: 'Tu equipo' },
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