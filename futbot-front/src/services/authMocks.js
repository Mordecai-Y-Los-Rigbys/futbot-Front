// services/authMocks.js

// Datos falsos para desarrollar el login sin backend. Se activan con VITE_USE_MOCKS=true
// (ver authService.js). Imitan el contrato de POST /auth/log-in: la respuesta tiene la
// forma del schema User, los mismos status de error y la forma de error que arma axios
// (`err.response.status`).

const MOCK_DELAY_MS = 600; // lo bastante largo para ver el estado "Ingresando..."

// LogInRequest.password.maxLength en API_REST.md
const MAX_PASSWORD_LENGTH = 72;

// Cuentas "trampa" para probar cada caso desde el formulario:
//   test@mail.com + 1234 -> entra
//   caido@mail.com       -> simula fallo de red (sin respuesta del servidor)
//   error@mail.com       -> responde 500
//   cualquier otra       -> 401 (credenciales inválidas)
// Además, un email o password que no sea string, o un password de más de 72
// caracteres, responden 400 (body inválido), como indica el contrato.
const MOCK_VALID_EMAIL = 'test@mail.com';
const MOCK_VALID_PASSWORD = '1234';
const MOCK_NETWORK_ERROR_EMAIL = 'caido@mail.com';
const MOCK_SERVER_ERROR_EMAIL = 'error@mail.com';

const MOCK_USER = { id: 1, username: 'santi', clubName: 'FC Santi' };

const httpError = (status) =>
  Object.assign(new Error(`HTTP ${status} (mock)`), { response: { status } });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// POST /auth/log-in
export async function loginMock({ email, password } = {}) {
  await wait(MOCK_DELAY_MS);

  // 400: body incompleto o con campos de tipo inválido.
  if (typeof email !== 'string' || typeof password !== 'string') throw httpError(400);
  if (password.length > MAX_PASSWORD_LENGTH) throw httpError(400);

  const normalizedEmail = email.trim().toLowerCase();

  // Fallo de red: el error de axios no trae `response` cuando no hay conexión.
  if (normalizedEmail === MOCK_NETWORK_ERROR_EMAIL) throw new Error('Network Error (mock)');
  if (normalizedEmail === MOCK_SERVER_ERROR_EMAIL) throw httpError(500);

  if (normalizedEmail === MOCK_VALID_EMAIL && password === MOCK_VALID_PASSWORD) {
    return { ...MOCK_USER };
  }

  throw httpError(401);
}