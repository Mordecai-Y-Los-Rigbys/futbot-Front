const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const httpError = (status, data) => {
  const err = new Error(`Request failed with status code ${status}`);
  err.response = { status, data };
  return err;
};

export async function createMatchConnectionMock(matchId) {
  await wait(200);

  if (matchId === 'error401') {
    throw httpError(401, { message: 'Sesión expirada.' });
  }
  if (matchId === 'error409') {
    throw httpError(409, { message: 'El partido ya terminó o fue cancelado.' });
  }
  if (matchId === 'error500') {
    throw httpError(500, { message: 'Error interno al generar conexión.' });
  }

  return {
    tokenWs: `mock_ws_token_match_${matchId}_${Date.now()}`,
  };
}

// Socket falso para desarrollar sin backend: abre y queda en silencio,
// o sea, la pantalla muestra "Esperando al rival…".
export function createMatchSocketMock() {
  const timer = setTimeout(() => socket.onopen?.(), 100);
  const socket = {
    onopen: null,
    onmessage: null,
    onclose: null,
    close() {
      clearTimeout(timer);
    },
  };
  return socket;
}
