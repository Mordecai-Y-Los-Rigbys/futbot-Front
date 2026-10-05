// Servidor de prueba para la pantalla del partido. Imita:
//   POST /matches/{id}/connections   -> { tokenWs }
//   WS   /ws/matches/{id}?token=...  -> ticks a 20/seg
//
// Uso:  npm i -D ws   &&   node mock-server/mockMatchServer.mjs
// Después abrí  http://localhost:5173/matches/1
//
// Variables: PORT (8000), MOCK_WAIT_SECONDS (3: "esperando rival" antes de arrancar),
//            MOCK_PERIOD_SECONDS (20: duración de cada cuarto en la simulación).
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
import { createSimulator, TICK_MS } from './matchSimulator.mjs';

const PORT = Number(process.env.PORT ?? 8001);
const WAIT_SECONDS = Number(process.env.MOCK_WAIT_SECONDS ?? 3);
const PERIOD_SECONDS = Number(process.env.MOCK_PERIOD_SECONDS ?? 20);

const tokens = new Map(); // tokenWs -> matchId
const matches = new Map(); // matchId -> { clients: Set<WebSocket>, started: boolean }
const finished = new Set();

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);

// ---------------------------------------------------------------- REST
const server = http.createServer((req, res) => {
  // CORS con credenciales (el front usa withCredentials).
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  const route = req.url.match(/^\/matches\/(\w+)\/connections$/);
  if (req.method === 'POST' && route) {
    const id = route[1];
    const status = { 403: 403, 409: 409 }[id];
    res.setHeader('Content-Type', 'application/json');
    if (status) {
      res.writeHead(status).end(JSON.stringify({ message: `mock ${status}` }));
      log(`POST /matches/${id}/connections -> ${status}`);
      return;
    }
    const tokenWs = randomBytes(12).toString('hex');
    tokens.set(tokenWs, id);
    res.writeHead(201).end(JSON.stringify({ tokenWs }));
    log(`POST /matches/${id}/connections -> 201`);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: 'mock: ruta no implementada' }));
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
  if (id === '999' || finished.has(id)) return reject(4409, 'matchFinished');

  let match = matches.get(id);
  if (!match) {
    match = { clients: new Set(), started: false };
    matches.set(id, match);
  }
  match.clients.add(ws);
  log(`WS match ${id}: conectado (${match.clients.size} cliente/s)`);
  ws.on('close', () => match.clients.delete(ws));
  ws.on('message', () => {}); // el cliente no manda nada: se ignora

  if (!match.started) {
    match.started = true;
    if (id === '777') {
      setTimeout(() => {
        finished.add(id);
        matches.delete(id);
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
  const sim = createSimulator({ periodSeconds: PERIOD_SECONDS });
  log(`match ${id}: simulación arrancada`);
  const timer = setInterval(() => {
    const tick = sim.step();
    const payload = JSON.stringify(tick);
    match.clients.forEach((c) => c.readyState === 1 && c.send(payload));
    if (tick.event) log(`match ${id}: evento ${tick.event.type}`);
    if (sim.isFinished()) {
      clearInterval(timer);
      finished.add(id);
      matches.delete(id);
      match.clients.forEach((c) => c.close(1000, 'matchEnd'));
      log(`match ${id}: terminado`);
    }
  }, TICK_MS);
}

server.listen(PORT, () => log(`Mock de partidos en http://localhost:${PORT} (ws://localhost:${PORT})`));