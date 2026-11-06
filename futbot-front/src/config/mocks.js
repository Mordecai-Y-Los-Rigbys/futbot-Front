// Única fuente de verdad del "modo sin backend".
//
// Se activa con VITE_USE_MOCKS=true en futbot-front/.env.local (reiniciar Vite después).
// El valor no distingue mayúsculas: `true`, `TRUE` y `True` activan el modo.
// Nunca se activa en los tests (MODE === 'test'), que mockean `api` o el servicio por su cuenta.
export const shouldUseMocks = (value, mode) =>
  String(value ?? '').trim().toLowerCase() === 'true' && mode !== 'test';

export const USE_MOCKS = shouldUseMocks(import.meta.env.VITE_USE_MOCKS, import.meta.env.MODE);
