// Modo sin backend para la prueba de comportamientos (VITE_USE_MOCKS=true).
// El socket falso hace la cuenta regresiva de 3 s y simula una prueba corta (20 s) para no esperar 3 minutos.

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const httpError = (status, data) =>
  Object.assign(new Error(`HTTP ${status} (mock)`), { response: { status, data } });

const MOCK_TEST_SECONDS = 20;
const TICK_MS = 50;

export async function createTestConnectionMock(behaviorId) {
  await wait(300);
  if (behaviorId === 403) throw httpError(403, {});
  if (behaviorId === 404) throw httpError(404, {});
  if (behaviorId === 409) throw httpError(409, { code: 'playerOrBehaviorNotOwned' });
  return { tokenWs: `mock_test_token_${behaviorId}_${Date.now()}` };
}

// Posiciones iniciales: club1 ataca hacia x = 100, club2 hacia x = 0.
const START = { forward: 55, midfield: 38, defense: 15 };

export function createTestSocketMock(members = []) {
  const timers = [];
  const socket = {
    onopen: null,
    onmessage: null,
    onclose: null,
    close() {
      timers.forEach(clearInterval);
      timers.length = 0;
    },
  };

  const base = members.map((m, i) => ({
    playerId: m.playerId,
    x: m.club === 'club1' ? START[m.role] : 100 - START[m.role],
    y: 15 + (i % 3) * 15,
  }));

  const send = (phase, elapsedTime, event, t = 0, score = [0, 0]) =>
    socket.onmessage?.({
      data: JSON.stringify({
        type: 'testTick',
        players: base.map((p, i) => ({
          playerId: p.playerId,
          position: { x: p.x + Math.sin(t + i) * 4, y: p.y + Math.cos(t * 0.7 + i) * 3 },
        })),
        ballPosition: { x: 50 + Math.sin(t) * 20, y: 30 + Math.cos(t * 1.3) * 10 },
        score1: score[0],
        score2: score[1],
        elapsedTime,
        phase,
        event,
      }),
    });

  const start = setTimeout(() => {
    socket.onopen?.();
    let ticks = 0;
    const loop = setInterval(() => {
      const elapsed = ticks * (TICK_MS / 1000);
      if (ticks === 0) send('countdown', 0, { type: 'testStart', countdownSeconds: 3 });
      else if (elapsed < 3) send('countdown', 0, null);
      else if (elapsed - 3 >= MOCK_TEST_SECONDS) {
        send('finished', MOCK_TEST_SECONDS, { type: 'testEnd', reason: 'timeLimit' }, elapsed, [1, 0]);
        clearInterval(loop);
        socket.onclose?.({ code: 1000, reason: 'testEnd' });
      } else {
        const played = elapsed - 3;
        const goal = Math.abs(played - 10) < TICK_MS / 1000 / 2;
        send('playing', played, goal ? { type: 'goal', club: 'club1' } : null, elapsed, [played > 10 ? 1 : 0, 0]);
      }
      ticks += 1;
    }, TICK_MS);
    timers.push(loop);
  }, 100);
  timers.push(start);
  return socket;
}
