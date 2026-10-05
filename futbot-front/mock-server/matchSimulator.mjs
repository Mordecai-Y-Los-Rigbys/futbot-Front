// Simulador de partido para probar el front sin backend. Sin dependencias.
// Genera ticks con la forma del AsyncAPI: players, ballPosition, score1, score2,
// elapsedTime, phase y event (goal | periodStart | pause | matchEnd | null).

export const TICK_MS = 50; // 20 ticks por segundo
const TPS = 1000 / TICK_MS;

// [playerId, x, y]: ids 1-3 = club1 (ataca hacia x=100), ids 4-6 = club2.
const HOME = [
  [1, 20, 30], [2, 32, 14], [3, 32, 46],
  [4, 80, 30], [5, 68, 14], [6, 68, 46],
];

const round = (n) => Math.round(n * 100) / 100;
const lerp = (a, b, t) => a + (b - a) * t;

export function createSimulator(options = {}) {
  const cfg = {
    periodSeconds: 20, // duración de cada cuarto (corta, para ver todo rápido)
    firstCountdown: 10, // como el amistoso real
    nextCountdown: 3,
    pauseSeconds: 4,
    secondsBetweenGoals: 8,
    clubNames: ['Club Azul', 'Club Rojo'],
    ...options,
  };
  const dt = TICK_MS / 1000;

  let phase = 'countdown';
  let period = 1;
  let left = Math.round(cfg.firstCountdown * TPS); // ticks que faltan en countdown/paused
  let periodTicks = 0;
  let elapsed = 0;
  let swayOrigin = 0;
  let sinceGoal = 0;
  let nextScorer = 0;
  let shot = null;
  let resetPending = false;
  let first = true;
  let finished = false;
  let ball = { x: 50, y: 30 };
  const score = [0, 0];

  // Los jugadores "pasean" alrededor de su posición inicial. `st` = segundos desde
  // el último saque; arranca en 0 (posición inicial exacta) y se abre de a poco.
  const playersAt = (st) =>
    HOME.map(([playerId, hx, hy]) => {
      const k = Math.min(1, st / 1.5);
      return {
        playerId,
        position: {
          x: round(hx + k * 5 * Math.sin(st * 0.9 + playerId)),
          y: round(hy + k * 4 * Math.cos(st * 0.7 + playerId * 2)),
        },
      };
    });

  const periodStart = (n, seconds) => ({ type: 'periodStart', periodNumber: n, countdownSeconds: seconds });

  function step() {
    let event = null;
    let list = playersAt(0);
    ball = { x: 50, y: 30 };

    if (first) {
      first = false;
      event = periodStart(1, cfg.firstCountdown);
    } else if (phase === 'countdown') {
      left -= 1;
      if (left <= 0) {
        phase = 'playing';
        periodTicks = 0;
        swayOrigin = elapsed;
        sinceGoal = 0;
        resetPending = false;
      }
    } else if (phase === 'paused') {
      left -= 1;
      if (left <= 0) {
        period += 1;
        phase = 'countdown';
        left = Math.round(cfg.nextCountdown * TPS);
        event = periodStart(period, cfg.nextCountdown);
      }
    } else if (phase === 'playing') {
      elapsed += dt;
      periodTicks += 1;

      if (resetPending) {
        // Tick posterior a un gol: todos en su posición inicial y pelota al medio.
        resetPending = false;
        swayOrigin = elapsed;
        sinceGoal = 0;
        shot = null;
      } else {
        const st = elapsed - swayOrigin;
        list = playersAt(st);
        if (shot) {
          shot.progress = Math.min(1, shot.progress + (shot.speed * dt) / shot.len);
          ball = { x: lerp(shot.from.x, shot.to.x, shot.progress), y: lerp(shot.from.y, shot.to.y, shot.progress) };
          if (shot.progress >= 1) {
            score[shot.scorer] += 1;
            event = { type: 'goal', scoringClub: cfg.clubNames[shot.scorer] };
            shot = null;
            resetPending = true;
          }
        } else {
          const carrier = list[Math.floor(st / 2.5) % list.length].position;
          ball = { x: carrier.x + 1.8, y: carrier.y };
          sinceGoal += dt;
          if (sinceGoal >= cfg.secondsBetweenGoals) {
            const scorer = nextScorer;
            nextScorer = 1 - nextScorer;
            // club1 mete el gol en el arco de x=100; club2, en el de x=0 (la pelota entra un poco).
            const to = { x: scorer === 0 ? 100.6 : -0.6, y: 30 + (Math.random() * 8 - 4) };
            shot = { from: { ...ball }, to, progress: 0, speed: 70, len: Math.hypot(to.x - ball.x, to.y - ball.y), scorer };
          }
        }
      }

      // Fin de cuarto. matchEnd tiene prioridad sobre un gol del mismo tick.
      if (periodTicks >= cfg.periodSeconds * TPS) {
        shot = null;
        resetPending = false;
        if (period === 4) {
          phase = 'finished';
          finished = true;
          event = { type: 'matchEnd', result: { score1: score[0], score2: score[1] } };
        } else if (period === 2) {
          phase = 'paused';
          left = Math.round(cfg.pauseSeconds * TPS);
          event = { type: 'pause', reason: 'halftime' };
        } else {
          period += 1;
          phase = 'countdown';
          left = Math.round(cfg.nextCountdown * TPS);
          event = periodStart(period, cfg.nextCountdown);
        }
      }
    }

    return {
      type: 'tick',
      players: list,
      ballPosition: { x: round(ball.x), y: round(ball.y) },
      score1: score[0],
      score2: score[1],
      elapsedTime: Math.floor(elapsed),
      phase,
      event,
    };
  }

  return { step, isFinished: () => finished };
}