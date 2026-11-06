import axios from 'axios';

// Datos falsos para el ranking global sin backend (VITE_USE_MOCKS=true).
// Imita GET /ranking: mismo shape, 50 por página, `position` calculada sobre el ranking completo.

const MOCK_PAGE_SIZE = 50;
const MOCK_DELAY_MS = 400;

const NAMES = ['FC Santi', 'Boca Juniors', 'River Plate', 'Racing Club', 'Independiente', 'San Lorenzo', 'Estudiantes', 'Vélez', 'Talleres', 'Belgrano'];

const TOTAL_CLUBS = 120;

// Los primeros 10 son los de siempre; el resto se genera como "Club N".
const clubName = (i) => NAMES[i] ?? `Club ${i + 1}`;

const RANKING = Array.from({ length: TOTAL_CLUBS }, (_, i) => ({
  // Empates de ejemplo: cada 4 clubes comparten puesto, como haría el back (1, 1, 1, 1, 5, 5, ...).
  position: Math.floor(i / 4) * 4 + 1,
  name: clubName(i),
  avatar: (i % 4) + 1,
  score: Math.max(0, 120 - i),
  goalDifference: 40 - i,
  goals: Math.max(0, 80 - i),
  wonRegular: Math.max(0, 30 - Math.floor(i / 4)),
  wonPenalties: i % 3,
  lost: 1 + Math.floor(i / 3),
}));

const httpError = (status) =>
  Object.assign(new Error(`HTTP ${status} (mock)`), { response: { status } });

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

// GET /ranking
export async function getGlobalRankingMock(name, page = 1, { signal } = {}) {
  await wait(MOCK_DELAY_MS, signal);

  if (!Number.isInteger(page) || page < 1) throw httpError(400);

  const term = (name || '').trim().toLowerCase();
  const filtered = term ? RANKING.filter((e) => e.name.toLowerCase().includes(term)) : RANKING;

  const start = (page - 1) * MOCK_PAGE_SIZE;
  return {
    items: filtered.slice(start, start + MOCK_PAGE_SIZE),
    page,
    pageSize: MOCK_PAGE_SIZE,
    total: filtered.length,
  };
}
