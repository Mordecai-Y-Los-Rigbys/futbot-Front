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
    `# ${name}`,
    'if i_have_ball():',
    '    kick_to(opponent_goal[0], opponent_goal[1])',
    'else:',
    '    go_to(ball_position()[0], ball_position()[1])',
  ].join('\n');

// 120 behaviors => 3 páginas de 50, así se prueba la paginación.
const BEHAVIORS = Array.from({ length: 120 }, (_, i) => {
  const name = `${ROLES[i % ROLES.length]} ${STYLES[Math.floor(i / ROLES.length) % STYLES.length]} #${i + 1}`;
  return { id: i + 1, name, type: 'playerBehavior', code: buildCode(name) };
});

const httpError = (status, data = {}) =>
  Object.assign(new Error(`HTTP ${status} (mock)`), { response: { status, data } });

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
export async function getBehaviorsMock(name, page = 1, { signal, type } = {}) {
  await wait(MOCK_DELAY_MS, signal);

  // La API responde 400 si page no es un entero >= 1.
  if (!Number.isInteger(page) || page < 1) throw httpError(400);

  const term = (name || '').trim().toLowerCase();
  const filtered = type && type !== 'playerBehavior'
    ? []
    : BEHAVIORS.filter((behavior) => !term || behavior.name.toLowerCase().includes(term));

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

let nextBehaviorId = BEHAVIORS.length + 1;

// POST /behaviors. Nombres "trampa" para probar cada error desde el formulario:
//   mock-400, mock-401, mock-409-nombre, mock-409-codigo, mock-409-largo
export async function createBehaviorMock({ name, code, type } = {}) {
  await wait(MOCK_DELAY_MS);

  const key = (name || '').trim().toLowerCase();
  if (key === 'mock-400') {
    throw httpError(400, {
      code: 'invalidFields',
      message: 'Revisá los campos marcados.',
      errors: [{ field: 'name', reason: 'tooLong' }],
    });
  }
  if (key === 'mock-401') throw httpError(401, { code: null, message: 'Sin sesión.' });
  if (key === 'mock-409-nombre' || BEHAVIORS.some((b) => b.name.toLowerCase() === key)) {
    throw httpError(409, { code: 'duplicateName', message: 'Nombre repetido.', codeError: null });
  }
  if (key === 'mock-409-largo') {
    throw httpError(409, { code: 'codeTooLong', message: 'Código demasiado largo.', codeError: null });
  }
  if (key === 'mock-409-codigo') {
    throw httpError(409, {
      code: 'invalidCode',
      message: 'El código no respeta la API.',
      codeError: {
        rule: 'primitiveAssignmentNotAllowed',
        line: Math.max(1, String(code).split('\n').length),
        column: 1,
        message: 'No se puede asignar a una primitiva del sistema.',
      },
    });
  }

  const behavior = { id: nextBehaviorId, name: name.trim(), type, code };
  nextBehaviorId += 1;
  BEHAVIORS.push(behavior);
  return { ...behavior };
}

// PUT /behaviors/{id}. Nombres "trampa": mock-400, mock-401, mock-403, mock-409-nombre,
// mock-409-codigo, mock-409-largo. Un id inexistente responde 404.
export async function updateBehaviorMock(id, { name, code } = {}) {
  await wait(MOCK_DELAY_MS);

  const found = BEHAVIORS.find((b) => b.id === Number(id));
  if (!found) throw httpError(404);

  const key = (name || '').trim().toLowerCase();
  if (key === 'mock-400') {
    throw httpError(400, {
      code: 'invalidFields',
      message: 'Revisá los campos marcados.',
      errors: [{ field: 'name', reason: 'tooLong' }],
    });
  }
  if (key === 'mock-401') throw httpError(401, { code: null, message: 'Sin sesión.' });
  if (key === 'mock-403') throw httpError(403, { code: null, message: 'No es tuyo.' });
  if (key === 'mock-409-nombre' || BEHAVIORS.some((b) => b.id !== found.id && b.name.toLowerCase() === key)) {
    throw httpError(409, { code: 'duplicateName', message: 'Nombre repetido.', codeError: null });
  }
  if (key === 'mock-409-largo') {
    throw httpError(409, { code: 'codeTooLong', message: 'Código demasiado largo.', codeError: null });
  }
  if (key === 'mock-409-codigo') {
    throw httpError(409, {
      code: 'invalidCode',
      message: 'El código no respeta la API.',
      codeError: {
        rule: 'primitiveAssignmentNotAllowed',
        line: Math.max(1, String(code).split('\n').length),
        column: 1,
        message: 'No se puede asignar a una primitiva del sistema.',
      },
    });
  }

  found.name = name.trim();
  found.code = code;
  return { ...found };
}