import axios from 'axios';

const MOCK_DELAY_MS = 400;

const httpError = (status, data = {}) =>
  Object.assign(new Error(`HTTP ${status} (mock)`), { response: { status, data } });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function joinFriendlyMatchMock(friendlyId, members) {
  await wait(MOCK_DELAY_MS);
  const numericId = Number(friendlyId);

  // Errores controlados por ID en la URL
  if (numericId === 4091) throw httpError(409, { code: 'notWaiting', message: 'El partido ya inició o fue cancelado.' });
  if (numericId === 4092) throw httpError(409, { code: 'isOwnMatch', message: 'No puedes unirte a tu propio partido.' });
  if (numericId === 4093) throw httpError(409, { code: 'alreadyPlaying', message: 'Ya tienes un partido activo.' });
  if (numericId === 4094) throw httpError(409, { code: 'playerOrBehaviorNotOwned', message: 'Jugador o comportamiento ajeno.' });
  if (numericId === 400) throw httpError(400, { message: 'Alineación inválida. Faltan datos.' });
  if (numericId === 404) throw httpError(404, { message: 'El partido no existe.' });

  // Éxito: retorna 200 OK con matchId
  return {
    id: numericId,
    matchId: 99,
    status: 'started',
    members,
  };
}
