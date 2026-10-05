import axios from 'axios';

// Datos falsos para desarrollar sin backend. Se activan con VITE_USE_MOCKS=true
// (ver behaviorService.js). Imitan el contrato de la API: mismos campos, mismos
// status de error y la misma forma de error que arma axios (`err.response.status`).

// Mismo tamaño de página que el backend (se repite acá para no importar de behaviorService
// y evitar una dependencia circular).
const MOCK_PAGE_SIZE = 50;
const MOCK_DELAY_MS = 600; // lo bastante largo para ver el skeleton y el estado de carga

// Ids "trampa" para probar errores entrando directo a /behaviors/:id
export const MOCK_FORBIDDEN_ID = 403; // responde 403
export const MOCK_SERVER_ERROR_ID = 500; // responde 500
// Cualquier id que no exista (ej: 9999) o inválido (ej: abc, 0, -1) responde 404.

const ROLES = ['Defensor', 'Atacante', 'Mediocampista', 'Arquero', 'Líbero'];
const STYLES = ['agresivo', 'pasivo', 'equilibrado', 'veloz', 'paciente', 'presionante'];

const buildCode = (name) =>
  [
    `// ${name}`,
    '  if (player.hasBall) {',
    '    return match.canShoot(player) ? shoot() : pass(nearestMate(player));',
    '  }',
    '  return moveTo(ball.position);',
  ].join('\n');

// 120 behaviors => 3 páginas de 50, así se prueba la paginación.
const BEHAVIORS = Array.from({ length: 3 }, (_, i) => {
  const name = `${ROLES[i % ROLES.length]} ${STYLES[Math.floor(i / ROLES.length) % STYLES.length]} #${i + 1}`;
  return { id: i + 1, name, code: buildCode(name) };
});

const httpError = (status) =>
  Object.assign(new Error(`HTTP ${status} (mock)`), { response: { status } });

// Espera `ms`, pero se corta con un error de cancelación si se aborta el signal
// (igual que haría axios), para que el AbortController de las pantallas funcione.
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

// GET /behaviors/me
export async function getBehaviorsMock(name, page = 1, { signal } = {}) {
  await wait(MOCK_DELAY_MS, signal);

  // La API responde 400 si page no es un entero >= 1.
  if (!Number.isInteger(page) || page < 1) throw httpError(400);

  const term = (name || '').trim().toLowerCase();
  const filtered = term
    ? BEHAVIORS.filter((b) => b.name.toLowerCase().includes(term))
    : BEHAVIORS;

  const start = (page - 1) * MOCK_PAGE_SIZE;
  const items = filtered.slice(start, start + MOCK_PAGE_SIZE).map(({ id, name: n }) => ({ id, name: n }));

  // Una página válida pero fuera de rango NO es error: 200 con items vacíos.
  return { items, page, pageSize: MOCK_PAGE_SIZE, total: filtered.length };
}

// GET /behaviors/{id}
export async function getBehaviorByIdMock(id, { signal } = {}) {
  await wait(MOCK_DELAY_MS, signal);

  const numericId = Number(id);
  const isValidId = /^\d+$/.test(String(id)) && numericId >= 1 && numericId <= 2147483647;

  if (!isValidId) throw httpError(404); // id inválido = recurso inexistente (convención 4)
  if (numericId === MOCK_FORBIDDEN_ID) throw httpError(403);
  if (numericId === MOCK_SERVER_ERROR_ID) throw httpError(500);

  const found = BEHAVIORS.find((b) => b.id === numericId);
  if (!found) throw httpError(404);

  return { ...found };
}