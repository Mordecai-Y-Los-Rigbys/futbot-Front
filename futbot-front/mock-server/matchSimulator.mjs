// Simulador de partido para probar el front sin backend. Sin dependencias.
// Genera ticks con la forma del AsyncAPI v0.6: players, ballPosition, score1, score2,
// penaltyScore1/2, penaltyKicks, penaltyCurrent, penaltyCountdownSeconds,
// penaltyRemainingSeconds, elapsedTime, pauseRemainingSeconds, phase y
// event (goal | periodStart | pause | penaltiesStart | penaltyKick | matchEnd | null).
//
// Flujo: countdown -> P1 -> pausa (hydration) -> countdown -> P2 -> pausa (halftime)
//        -> countdown -> P3 -> pausa (hydration) -> countdown -> P4 -> fin
//        (o tanda de penales si allowDraws es false y el juego terminó empatado).

export const TICK_MS = 50; // 20 ticks por segundo
const TPS = 1000 / TICK_MS;

// [playerId, x, y]: ids 1-3 = club1 (ataca hacia x=100), ids 4-6 = club2.
const HOME = [
  [1, 20, 30], [2, 32, 14], [3, 32, 46],
  [4, 80, 30], [5, 68, 14], [6, 68, 46],
];

// Titulares de cada club, en orden forward, midfield, defense.
const CLUB_IDS = [[1, 2, 3], [4, 5, 6]];
const ROLES = ['forward', 'midfield', 'defense'];
export const PLAYER_NAMES = {
  1: 'Lionel Messi', 2: 'Rodrigo De Paul', 3: 'Cristian Romero',
  4: 'Lautaro Martínez', 5: 'Enzo Fernández', 6: 'Nicolás Otamendi',
};

// Titulares de un club (0 = club1, 1 = club2), para GET /matches/{id}/lineups.
export const lineups = (club) =>
  CLUB_IDS[club].map((playerId, i) => ({ playerId, name: PLAYER_NAMES[playerId], role: ROLES[i] }));

const PAUSE_REASONS = { 1: 'hydration', 2: 'halftime', 3: 'hydration' };

const round = (n) => Math.round(n * 100) / 100;
const lerp = (a, b, t) => a + (b - a) * t;
const roundPos = (p) => ({ x: round(p.x), y: round(p.y) });

export function createSimulator(options = {}) {
  const cfg = {
    periodSeconds: 20, // duración de cada cuarto (corta, para ver todo rápido)
    firstCountdown: 5,
    nextCountdown: 5,
    pauseSeconds: 15,
    secondsBetweenGoals: 8,
    clubNames: ['Club Azul', 'Club Rojo'],
    allowDraws: true, // false: si el juego termina empatado, hay tanda de penales
    forceDraw: false, // true: los goles se arman en pares para que el juego termine empatado
    penaltyCountdownSeconds: 3,
    penaltySeconds: 8,
    penaltyGoalChance: 0.55, // resto: 'own' (gol en contra) o 'miss' (se acaba el tiempo)
    penaltyOwnGoalChance: 0.1,
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
  let shootout = null;
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

  const initialView = () => ({ players: playersAt(0), ball: { x: 50, y: 30 } });
  // Última posición mostrada: durante una pausa los ticks repiten exactamente esto.
  let view = initialView();

  const periodStart = (n, seconds) => ({ type: 'periodStart', periodNumber: n, countdownSeconds: seconds });

  // Con forceDraw, los goles van de a pares dentro del mismo cuarto: si va
  // empatado, el club1 solo patea si queda tiempo para la respuesta del club2.
  function pickScorer() {
    if (!cfg.forceDraw) {
      const s = nextScorer;
      nextScorer = 1 - nextScorer;
      return s;
    }
    if (score[0] !== score[1]) return score[0] < score[1] ? 0 : 1;
    const periodLeft = cfg.periodSeconds - periodTicks / TPS;
    return periodLeft > cfg.secondsBetweenGoals + 5 ? 0 : null;
  }

  // -------------------------------------------------------------- penales
  function planPenalty() {
    const s = shootout;
    const { club, round: r } = s.order[s.idx];
    const roll = Math.random();
    const outcome =
      roll < cfg.penaltyGoalChance ? 'goal'
        : roll < cfg.penaltyGoalChance + cfg.penaltyOwnGoalChance ? 'own'
          : 'miss';
    s.cur = {
      club,
      round: r,
      kickerId: CLUB_IDS[club][(r - 1) % 3], // los tres titulares patean en ciclo
      defenderId: CLUB_IDS[1 - club][2], // el defensor del rival
      outcome,
      dur: 1.5 + Math.random() * (cfg.penaltySeconds - 3), // cuándo termina si hay gol / gol en contra
      endY: 30 + Math.random() * 8 - 4,
    };
    s.stage = 'countdown';
    s.cdLeft = Math.round(cfg.penaltyCountdownSeconds * TPS);
    s.t = 0;
  }

  function startShootout() {
    const order = [];
    for (let r = 1; r <= 5; r += 1) for (const club of [0, 1]) order.push({ club, round: r });
    shootout = { order, idx: 0, kicks: [], score: [0, 0], stage: 'countdown', cdLeft: 0, remTicks: 0, t: 0, cur: null };
    planPenalty();
  }

  const currentInfo = () => {
    const c = shootout.cur;
    return {
      club: c.club === 0 ? 'club1' : 'club2',
      kickerId: c.kickerId,
      kickerName: PLAYER_NAMES[c.kickerId],
      defenderId: c.defenderId,
      defenderName: PLAYER_NAMES[c.defenderId],
    };
  };

  // Posiciones de pateador, defensor y pelota a los `t` segundos de empezado el penal.
  function penaltyView(t) {
    const { club, kickerId, defenderId, outcome, dur, endY } = shootout.cur;
    const dir = club === 0 ? 1 : -1; // hacia dónde ataca el pateador
    const start = { x: 50 - dir * 1.5, y: 30 };
    const [, hx, hy] = HOME.find((h) => h[0] === defenderId);
    let kicker = start;
    let ball = { x: 50, y: 30 };
    let defender = { x: hx, y: hy };

    if (t > 0 && outcome === 'miss') {
      // Driblea sin llegar al arco hasta que se acaba el tiempo.
      kicker = { x: 50 + dir * 8 * Math.sin(t * 0.8), y: 30 + 10 * Math.sin(t * 1.3) };
      ball = { x: kicker.x + dir * 1.8, y: kicker.y };
      defender = { x: kicker.x + dir * 6, y: kicker.y + 3 * Math.cos(t * 3) };
    } else if (t > 0) {
      // 'goal' va al arco rival; 'own' va al propio (gol en contra: no cuenta).
      const out = outcome === 'goal' ? dir : -dir;
      const goalX = out === 1 ? 100 : 0;
      const k = Math.min(1, t / dur);
      kicker = { x: lerp(start.x, goalX - out * 6, k), y: 30 + 4 * Math.sin(t * 2.2) * (1 - k) };
      ball = k >= 1 ? { x: goalX + out * 0.6, y: endY } : { x: kicker.x + out * 1.8, y: kicker.y };
      defender = { x: hx + 2 * Math.sin(t), y: hy + (30 - hy) * Math.min(1, t / 3) };
    }

    return {
      players: [
        { playerId: kickerId, position: roundPos(kicker) },
        { playerId: defenderId, position: roundPos(defender) },
      ],
      ball: roundPos(ball),
    };
  }

  // Tick de la tanda. Devuelve la vista y los campos de penal; `end` = terminó el partido.
  function shootoutTick() {
    const s = shootout;
    if (s.stage === 'countdown' && s.cdLeft <= 0) {
      s.stage = 'playing';
      s.remTicks = Math.round(cfg.penaltySeconds * TPS);
      s.t = 0;
    }

    // Cuenta previa: todos quietos en sus posiciones iniciales.
    if (s.stage === 'countdown') {
      const shown = Math.ceil(s.cdLeft / TPS);
      s.cdLeft -= 1;
      return { ...penaltyView(0), event: null, current: currentInfo(), countdown: shown, remaining: cfg.penaltySeconds, end: false };
    }

    s.remTicks -= 1;
    s.t += dt;
    const c = s.cur;
    let scored = null; // null = el penal sigue
    if (c.outcome !== 'miss' && s.t >= c.dur) scored = c.outcome === 'goal';
    else if (s.remTicks <= 0) scored = false;

    const out = {
      ...penaltyView(s.t),
      event: null,
      current: currentInfo(), // antes de pasar al penal siguiente
      countdown: null,
      remaining: Math.max(0, Math.ceil(s.remTicks / TPS)),
      end: false,
    };
    if (scored === null) return out;

    const record = {
      club: c.club === 0 ? 'club1' : 'club2',
      kickerId: c.kickerId,
      kickerName: PLAYER_NAMES[c.kickerId],
      round: c.round,
      scored,
    };
    s.kicks.push(record);
    if (scored) s.score[c.club] += 1;
    out.event = { type: 'penaltyKick', ...record };

    // La tanda termina antes si un club ya no puede ser alcanzado.
    const done = [0, 0];
    s.kicks.forEach((k) => { done[k.club === 'club1' ? 0 : 1] += 1; });
    const decided =
      s.score[0] > s.score[1] + (5 - done[1]) || s.score[1] > s.score[0] + (5 - done[0]);

    if (decided || s.idx === s.order.length - 1) {
      const winner =
        s.score[0] > s.score[1] ? 'club1' : s.score[1] > s.score[0] ? 'club2' : Math.random() < 0.5 ? 'club1' : 'club2';
      // matchEnd tiene prioridad sobre penaltyKick; el penal igual figura en `kicks`.
      out.event = {
        type: 'matchEnd',
        result: {
          score1: score[0],
          score2: score[1],
          penalties: { score1: s.score[0], score2: s.score[1], winner, kicks: [...s.kicks] },
        },
      };
      out.end = true;
    } else {
      s.idx += 1;
      planPenalty();
    }
    return out;
  }

  // ----------------------------------------------------------------- tick
  function step() {
    let event = null;
    let list = view.players;
    let ball = view.ball;
    let pen = null;

    if (first) {
      first = false;
      event = periodStart(1, cfg.firstCountdown);
      ({ players: list, ball } = initialView());
    } else if (phase === 'countdown') {
      ({ players: list, ball } = initialView());
      left -= 1;
      if (left <= 0) {
        phase = 'playing';
        periodTicks = 0;
        swayOrigin = elapsed;
        sinceGoal = 0;
        resetPending = false;
      }
    } else if (phase === 'paused') {
      // Mismas posiciones y mismo elapsedTime durante toda la pausa.
      left -= 1;
      if (left <= 0) {
        period += 1;
        phase = 'countdown';
        left = Math.round(cfg.nextCountdown * TPS);
        event = periodStart(period, cfg.nextCountdown);
        ({ players: list, ball } = initialView());
      }
    } else if (phase === 'playing') {
      ({ players: list, ball } = initialView());
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
            event = {
              type: 'goal',
              club: shot.scorer === 0 ? 'club1' : 'club2',
              scoringClub: cfg.clubNames[shot.scorer],
            };
            shot = null;
            resetPending = true;
          }
        } else {
          const carrier = list[Math.floor(st / 2.5) % list.length].position;
          ball = { x: carrier.x + 1.8, y: carrier.y };
          sinceGoal += dt;
          if (sinceGoal >= cfg.secondsBetweenGoals) {
            const scorer = pickScorer();
            if (scorer !== null) {
              // club1 mete el gol en el arco de x=100; club2, en el de x=0 (la pelota entra un poco).
              const to = { x: scorer === 0 ? 100.6 : -0.6, y: 30 + (Math.random() * 8 - 4) };
              shot = { from: { ...ball }, to, progress: 0, speed: 70, len: Math.hypot(to.x - ball.x, to.y - ball.y), scorer };
            }
          }
        }
      }

      // Fin de cuarto. Cualquier evento de este tick se pisa con el de fin/pausa.
      if (periodTicks >= cfg.periodSeconds * TPS) {
        shot = null;
        resetPending = false;
        if (period === 4) {
          if (!cfg.allowDraws && score[0] === score[1]) {
            // Empate sin empates permitidos: arranca la tanda (el partido sigue `started`).
            startShootout();
            phase = 'penalties';
            event = { type: 'penaltiesStart' };
            pen = shootoutTick(); // primer tick de la cuenta previa del primer penal
            list = pen.players;
            ball = pen.ball;
          } else {
            phase = 'finished';
            finished = true;
            event = { type: 'matchEnd', result: { score1: score[0], score2: score[1], penalties: null } };
          }
        } else {
          // Pausas a 1/4, 1/2 y 3/4: hydration, halftime, hydration. Las posiciones quedan como están.
          phase = 'paused';
          left = Math.round(cfg.pauseSeconds * TPS);
          event = { type: 'pause', reason: PAUSE_REASONS[period], durationSeconds: cfg.pauseSeconds };
        }
      }
    } else if (phase === 'penalties') {
      pen = shootoutTick();
      list = pen.players;
      ball = pen.ball;
      event = pen.event;
      if (pen.end) {
        phase = 'finished';
        finished = true;
      }
    }

    view = { players: list, ball };
    const inShootout = phase === 'penalties' && pen !== null;

    return {
      type: 'tick',
      players: list,
      ballPosition: { x: round(ball.x), y: round(ball.y) },
      score1: score[0],
      score2: score[1],
      penaltyScore1: shootout?.score[0] ?? 0,
      penaltyScore2: shootout?.score[1] ?? 0,
      penaltyKicks: shootout ? [...shootout.kicks] : [],
      penaltyCurrent: inShootout ? pen.current : null,
      penaltyCountdownSeconds: inShootout ? pen.countdown : null,
      penaltyRemainingSeconds: inShootout ? pen.remaining : null,
      elapsedTime: Math.floor(elapsed),
      pauseRemainingSeconds: phase === 'paused' ? Math.ceil(left / TPS) : null,
      // Pausas que todavía no empezaron (no cuenta la que está en curso): 3, 2, 1, 0.
      pausesLeft: 3 - (phase === 'paused' ? period : period - 1),
      phase,
      event,
    };
  }

  return { step, isFinished: () => finished };
}