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

export async function getPlayersMock() {
  await wait(MOCK_DELAY_MS);
  return [
    { id: 1, name: 'Lionel Messi', defaultBehaviorId: 10 },
    { id: 2, name: 'Rodrigo De Paul', defaultBehaviorId: 11 },
    { id: 3, name: 'Cristian Romero', defaultBehaviorId: 12 },
    { id: 4, name: 'Emiliano Martínez', defaultBehaviorId: 13 },
    { id: 5, name: 'Ángel Di María', defaultBehaviorId: 14 },
    { id: 6, name: 'Julián Álvarez', defaultBehaviorId: 15 },
    { id: 7, name: 'Alexis Mac Allister', defaultBehaviorId: 16 },
  ];
}

export async function createFriendlyMatchMock(data) {
  await wait(MOCK_DELAY_MS);

  if (data.name === 'error400') {
    throw httpError(400, { code: 'invalidTeam', message: 'Alineación o formato inválido.' });
  }
  if (data.name === 'error409') {
    throw httpError(409, { code: 'alreadyPlaying', message: 'Ya tienes un partido activo.' });
  }

  return {
    id: 100,
    name: data.name,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
  };
}