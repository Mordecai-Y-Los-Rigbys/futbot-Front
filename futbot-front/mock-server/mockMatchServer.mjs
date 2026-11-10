// Servidor de prueba para la pantalla del partido. Imita:
//   GET  /users/me, POST /auth/log-in        -> usuario fijo "santi" (para pasar RequireAuth)
//   POST /matches/{id}/connections           -> { tokenWs, role }
//   GET  /matches/{id}                       -> Match (club2 null hasta que arranca)
//   GET  /matches/{id}/lineups               -> titulares de ambos clubes
//   GET  /matches/{id}/team                  -> los 6 jugadores del club1 (members) con sus roles
//   GET  /matches/{id}/substitutions         -> pendiente (aplicada durante una pausa); 409 si no está en juego
//   PUT  /matches/{id}/substitutions         -> 204; queda pendiente y se aplica al empezar la próxima pausa
//   WS   /ws/matches/{id}?token=...          -> ticks a 20/seg
//
// Uso:  npm i -D ws   &&   node mock-server/mockMatchServer.mjs
// Después abrí  http://localhost:5173/matches/1   (sin VITE_USE_MOCKS=true)
//
// Variables:
//   PORT (8000)               puerto. El front usa VITE_API_URL o localhost:8000.
//   MOCK_WAIT_SECONDS (3)     "esperando rival" antes de arrancar.
//   MOCK_PERIOD_SECONDS (20)  duración de cada cuarto.
//   MOCK_PAUSE_SECONDS (15)   duración de cada pausa (el spec dice 15).
//   MOCK_PENALTIES (true)     true: el juego termina empatado y hay tanda de penales.
//                             false: termina directo (sin empates forzados).
//
// Ids especiales para probar errores:
//   /matches/403  -> el POST responde 403          (vuelve al inicio con aviso)
//   /matches/409  -> el POST responde 409
//   /matches/404  -> el WS cierra 4404 matchNotFound
//   /matches/999  -> el WS cierra 4409 matchFinished
//   /matches/777  -> espera 5 s sin rival y cierra 1000 waitExpired

import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { createSimulator, lineups, PLAYER_NAMES, TICK_MS } from './matchSimulator.mjs';

const PORT = Number(process.env.PORT ?? 8000);
const WAIT_SECONDS = Number(process.env.MOCK_WAIT_SECONDS ?? 3);
const PERIOD_SECONDS = Number(process.env.MOCK_PERIOD_SECONDS ?? 20);
const PAUSE_SECONDS = Number(process.env.MOCK_PAUSE_SECONDS ?? 15);
const PENALTIES = (process.env.MOCK_PENALTIES ?? 'true') !== 'false';

const USER = { id: 1, username: 'santi', clubName: 'FC Santi' };
const CLUB1 = { id: 1, username: 'santi', name: 'FC Santi', avatar: 1 };
const CLUB2 = { id: 2, username: 'rival', name: 'Rival FC', avatar: 2 };

const SUB_NAMES = { 7: 'Ángel Di María', 8: 'Julián Álvarez', 9: 'Emiliano Martínez' };
const NAME_OF = { ...PLAYER_NAMES, ...SUB_NAMES };
const initialTeam = () => [
  { playerId: 1, role: 'forward' },
  { playerId: 2, role: 'midfield' },
  { playerId: 3, role: 'defense' },
  { playerId: 7, role: 'substitute' },
  { playerId: 8, role: 'substitute' },
  { playerId: 9, role: 'substitute' },
];
const STARTER_ROLES = ['forward', 'midfield', 'defense'];

const tokens = new Map(); // tokenWs -> matchId
const matches = new Map(); // matchId -> estado del partido

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);

function getState(id) {
  let m = matches.get(id);
  if (!m) {
    m = {
      clients: new Set(),
      waiting: false, // ya se está esperando rival
      running: false, // la simulación arrancó (hay rival)
      status: id === '999' ? 'finished' : 'scheduled',
      createdAt: new Date().toISOString(),
      result: null,
      team: initialTeam(), // equipo de club1 (el usuario del mock)
      pending: null, // { starterId, substituteId } pedida y todavía no aplicada
      applied: null, // la aplicada al empezar la pausa en curso
      paused: false,
    };
    matches.set(id, m);
  }
  return m;
}

const matchBody = (id, m) => ({
  id: Number(id),
  leagueId: null,
  name: 'Amistoso mock',
  status: m.status,
  club1: CLUB1,
  club2: m.running || m.status === 'finished' ? CLUB2 : null,
  scheduledAt: null,
  createdAt: m.createdAt,
  result: m.result,
});

const subView = (m, sub) => ({
  starterName: NAME_OF[sub.starterId],
  substituteName: NAME_OF[sub.substituteId],
});

// Al empezar la pausa se aplica la pendiente: el suplente toma el rol del titular y viceversa.
function applyPending(m) {
  m.applied = null;
  if (m.pending) {
    const starter = m.team.find((p) => p.playerId === m.pending.starterId);
    const sub = m.team.find((p) => p.playerId === m.pending.substituteId);
    if (starter && sub) {
      [starter.role, sub.role] = [sub.role, starter.role];
      m.applied = m.pending;
    }
    m.pending = null;
  }
}

// ---------------------------------------------------------------- REST
const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(status).end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  // CORS con credenciales (el front usa withCredentials).
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  const path = req.url.split('?')[0];

  // Sesión: siempre hay usuario, así RequireAuth deja pasar.
  if (req.method === 'GET' && path === '/users/me') return send(res, 200, USER);
  if (req.method === 'POST' && path === '/auth/log-in') return send(res, 200, USER);

  let route = path.match(/^\/matches\/(\w+)\/connections$/);
  if (req.method === 'POST' && route) {
    const id = route[1];
    const status = { 403: 403, 409: 409 }[id];
    if (status) {
      send(res, status, { code: null, message: `mock ${status}` });
      log(`POST /matches/${id}/connections -> ${status}`);
      return;
    }
    const tokenWs = randomBytes(12).toString('hex');
    tokens.set(tokenWs, id);
    send(res, 201, { tokenWs, role: 'player' });
    log(`POST /matches/${id}/connections -> 201`);
    return;
  }

  route = path.match(/^\/matches\/(\w+)$/);
  if (req.method === 'GET' && route) {
    const id = route[1];
    if (id === '404') return send(res, 404, { code: null, message: 'mock: el partido no existe' });
    return send(res, 200, matchBody(id, getState(id)));
  }

  route = path.match(/^\/matches\/(\w+)\/lineups$/);
  if (req.method === 'GET' && route) {
    const m = getState(route[1]);
    const starters = m.team
      .filter((p) => STARTER_ROLES.includes(p.role))
      .map((p) => ({ playerId: p.playerId, name: NAME_OF[p.playerId], role: p.role }));
    return send(res, 200, { club1: starters, club2: m.running ? lineups(1) : null });
  }

  route = path.match(/^\/matches\/(\w+)\/team$/);
  if (req.method === 'GET' && route) {
    const m = getState(route[1]);
    return send(res, 200, {
      members: m.team.map((p) => ({
        playerId: p.playerId,
        name: NAME_OF[p.playerId],
        role: p.role,
        behavior: { id: p.playerId, name: 'Ofensivo', type: 'playerBehavior' },
      })),
      coachBehavior: null,
    });
  }

  route = path.match(/^\/matches\/(\w+)\/substitutions$/);
  if (route && (req.method === 'GET' || req.method === 'PUT')) {
    const m = getState(route[1]);
    if (m.status !== 'started') {
      return send(res, 409, { code: 'matchNotStarted', message: 'El partido no está en juego.' });
    }
    if (req.method === 'GET') {
      const shown = m.paused ? m.applied : m.pending;
      return send(res, 200, { club1: shown ? subView(m, shown) : null, club2: null });
    }
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      let body = {};
      try {
        body = JSON.parse(raw);
      } catch {
        // body ilegible: se trata como si faltaran los campos
      }
      const errors = [];
      for (const field of ['starterId', 'substituteId']) {
        if (body[field] === undefined) errors.push({ field, reason: 'required' });
        else if (!Number.isInteger(body[field])) errors.push({ field, reason: 'invalidType' });
      }
      if (!errors.length) {
        const starter = m.team.find((p) => p.playerId === body.starterId);
        const sub = m.team.find((p) => p.playerId === body.substituteId);
        if (!starter || !STARTER_ROLES.includes(starter.role)) errors.push({ field: 'starterId', reason: 'notStarter' });
        if (!sub || sub.role !== 'substitute') errors.push({ field: 'substituteId', reason: 'notSubstitute' });
      }
      if (errors.length) {
        return send(res, 400, { code: 'invalidFields', message: 'Revisá los campos marcados.', errors });
      }
      m.pending = { starterId: body.starterId, substituteId: body.substituteId }; // reemplaza a la anterior
      log(`PUT /matches/${route[1]}/substitutions -> 204 (pendiente)`);
      res.writeHead(204).end();
    });
    return;
  }

  send(res, 404, { code: null, message: 'mock: ruta no implementada' });
});

// ---------------------------------------------------------------- WebSocket
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, req));
});

function onConnection(ws, req) {
  const url = new URL(req.url, 'http://localhost');
  const id = url.pathname.match(/^\/ws\/matches\/(\w+)$/)?.[1];
  const token = url.searchParams.get('token');

  // Igual que el spec: se acepta el upgrade y se cierra con 4xxx si algo falla.
  const reject = (code, reason) => {
    log(`WS match ${id} rechazado: ${code} ${reason}`);
    ws.close(code, reason);
  };
  if (!token || !tokens.has(token)) return reject(4401, 'tokenInvalid');
  if (tokens.get(token) !== id) return reject(4403, 'tokenMatchMismatch');
  if (id === '404') return reject(4404, 'matchNotFound');

  const match = getState(id);
  if (match.status === 'finished') return reject(4409, 'matchFinished');
  if (match.status === 'cancelled') return reject(4409, 'matchCancelled');

  match.clients.add(ws);
  log(`WS match ${id}: conectado (${match.clients.size} cliente/s)`);
  ws.on('close', () => match.clients.delete(ws));
  ws.on('message', () => {}); // el cliente no manda nada: se ignora

  if (!match.waiting) {
    match.waiting = true;
    if (id === '777') {
      setTimeout(() => {
        match.status = 'cancelled';
        match.clients.forEach((c) => c.close(1000, 'waitExpired'));
        log('match 777: waitExpired');
      }, 5000);
    } else {
      log(`match ${id}: esperando rival ${WAIT_SECONDS}s (sin ticks)...`);
      setTimeout(() => startSimulation(id, match), WAIT_SECONDS * 1000);
    }
  }
}

function startSimulation(id, match) {
  const sim = createSimulator({
    periodSeconds: PERIOD_SECONDS,
    pauseSeconds: PAUSE_SECONDS,
    clubNames: [CLUB1.name, CLUB2.name],
    allowDraws: !PENALTIES,
    forceDraw: PENALTIES,
  });
  match.running = true; // a partir de acá GET /matches/{id} devuelve club2
  log(`match ${id}: simulación arrancada (penales: ${PENALTIES})`);

  const timer = setInterval(() => {
    const tick = sim.step();
    if (['playing', 'paused', 'penalties'].includes(tick.phase)) match.status = 'started';

    if (tick.event?.type === 'pause') {
      match.paused = true;
      applyPending(match);
    }
    if (tick.phase !== 'paused') match.paused = false;

    const payload = JSON.stringify(tick);
    match.clients.forEach((c) => c.readyState === 1 && c.send(payload));

    // Los penales son muchos eventos: se loguean cortos.
    if (tick.event) {
      const e = tick.event;
      const extra = e.type === 'penaltyKick' ? ` ${e.club} ronda ${e.round} ${e.scored ? 'GOL' : 'no'}` : '';
      log(`match ${id}: evento ${e.type}${extra}`);
    }

    if (sim.isFinished()) {
      clearInterval(timer);
      match.status = 'finished';
      match.result = tick.event?.result ?? null;
      match.clients.forEach((c) => c.close(1000, 'matchEnd'));
      log(`match ${id}: terminado`);
    }
  }, TICK_MS);
}

server.listen(PORT, () => log(`Mock de partidos en http://localhost:${PORT} (ws://localhost:${PORT})`));