import axios from 'axios';

// Datos falsos para el ranking global sin backend (VITE_USE_MOCKS=true).
// Imita GET /ranking: mismo shape, 50 por página, `position` calculada sobre el ranking completo.

const MOCK_PAGE_SIZE = 50;
const MOCK_DELAY_MS = 400;

const NAMES = ['FC Santi', 'Boca Juniors', 'River Plate', 'Racing Club', 'Independiente', 'San Lorenzo', 'Estudiantes', 'Vélez', 'Talleres', 'Belgrano'];

const RANKING = NAMES.map((name, i) => ({
  position: i + 1,
  name,
  avatar: (i % 4) + 1,
  score: 30 - i * 2,
  goalDifference: 12 - i * 2,
  goals: 25 - i,
  wonRegular: 9 - Math.floor(i / 2),
  wonPenalties: i % 3,
  lost: 1 + Math.floor(i / 2),
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
