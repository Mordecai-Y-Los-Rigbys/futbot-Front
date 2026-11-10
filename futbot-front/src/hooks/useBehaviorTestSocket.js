import { useEffect, useRef, useState } from 'react';
import { openTestSocket } from '../services/behaviorTestService';

const DEFAULT_TICK_MS = 50; // 20 ticks por segundo
const CLUB_LABELS = { club1: 'Aliados', club2: 'Rivales' };

const CLOSURE_MESSAGES = {
  ended: 'Prueba terminada.',
  tooManyConnections: 'Ya hay una prueba en curso para tu usuario (por ejemplo, en otra pestaña). Cerrala y volvé a probar.',
  dropped: 'Se cortó la conexión y la prueba terminó.',
  unexpected: 'Ocurrió un error inesperado. Armá la prueba de nuevo.',
  notFound: 'Un comportamiento o jugador de la alineación fue eliminado. Revisá la alineación.',
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const INITIAL_META = {
  score1: 0,
  score2: 0,
  elapsedTime: 0,
  phase: null,
  periodNumber: null, // la prueba tiene un solo período: el marcador no muestra "n.º cuarto"
  countdown: null, // { seconds, startedAt } de testStart
  goal: null, // { id, scoringClub } del último gol
  result: null, // { score1, score2 } al terminar
  pauseReason: null, // sin pausas: se mantienen para que ScoreboardOverlay funcione igual
  pauseRemaining: null,
  pauseCount: 0,
};

/**
 * Se conecta al WebSocket de la prueba (/ws/behaviors/{id}/test?token=...).
 * La conexión ES la prueba: si se cierra, la prueba termina. No reconecta sola,
 * se cierra al desmontar, y cambiar `attempt` o `tokenWs` inicia una prueba nueva.
 *
 * Devuelve la misma forma que useMatchWebSocket ({ status, streamRef, meta }) más:
 * - closure: null mientras corre; al cerrarse, { kind, message } con kind en
 *   'ended' | 'tokenExpired' | 'unexpected' | 'notFound' | 'tooManyConnections' | 'dropped'.
 */
export default function useBehaviorTestSocket({ behaviorId, tokenWs, members, attempt = 0 }) {
  const streamRef = useRef({ prev: null, curr: null, currAt: 0, intervalMs: DEFAULT_TICK_MS, snapNext: false });
  const metaRef = useRef(INITIAL_META);
  const membersRef = useRef(members);
  membersRef.current = members;
  const [meta, setMeta] = useState(INITIAL_META);
  const [status, setStatus] = useState('connecting');
  const [closure, setClosure] = useState(null);

  useEffect(() => {
    let disposed = false;
    let finished = false; // llegó testEnd o un tick con phase finished

    streamRef.current = { prev: null, curr: null, currAt: 0, intervalMs: DEFAULT_TICK_MS, snapNext: false };
    metaRef.current = INITIAL_META;
    setMeta(INITIAL_META);
    setStatus('connecting');
    setClosure(null);

    const handleTick = (tick) => {
      const now = performance.now();
      const s = streamRef.current;

      if (s.curr) s.intervalMs = clamp(0.8 * s.intervalMs + 0.2 * (now - s.currAt), 30, 250);
      // Tras un gol, el tick siguiente ya trae a todos en sus posiciones iniciales: sin deslizar.
      s.prev = s.snapNext || !s.curr ? tick : s.curr;
      s.snapNext = tick.event?.type === 'goal';
      s.curr = tick;
      s.currAt = now;

      const prev = metaRef.current;
      const next = {
        ...prev,
        score1: tick.score1,
        score2: tick.score2,
        elapsedTime: tick.elapsedTime,
        phase: tick.phase,
      };
      const e = tick.event;
      if (e?.type === 'testStart') next.countdown = { seconds: e.countdownSeconds, startedAt: Date.now() };
      // El gol trae solo `club` (no hay scoringClub).
      if (e?.type === 'goal') next.goal = { id: (prev.goal?.id ?? 0) + 1, scoringClub: CLUB_LABELS[e.club] ?? '' };
      if (e?.type === 'testEnd' || tick.phase === 'finished') {
        next.result = { score1: tick.score1, score2: tick.score2 };
        finished = true;
      }
      if (tick.phase !== 'countdown') next.countdown = null;

      if (Object.keys(next).some((k) => next[k] !== prev[k])) {
        metaRef.current = next;
        setMeta(next);
      }
    };

    const handleClose = ({ code, reason }) => {
      if (disposed) return;
      setStatus('closed');
      const done = (kind, message) => setClosure({ kind, message: message ?? CLOSURE_MESSAGES[kind] });

      if (finished || (code === 1000 && reason === 'testEnd')) return done('ended');
      if (code === 4401) return done('tokenExpired'); // tokenInvalid / tokenExpired
      if (code === 4403) return done('unexpected'); // tokenBehaviorMismatch
      if (code === 4404) return done('notFound'); // behaviorNotFound
      if (code === 4429) return done('tooManyConnections');
      return done('dropped'); // la conexión es la prueba: no se reconecta
    };

    // Se abre en el próximo turno y no en el mismo efecto: si el efecto se desmonta enseguida
    // (doble montaje de StrictMode en desarrollo, o salir de la pantalla), nunca llega a abrirse.
    // Importa porque el servidor permite UNA sola prueba a la vez por usuario: abrir y cerrar
    // dos sockets seguidos podría cerrar el segundo con 4429 / tooManyConnections.
    let socket = null;
    const connectTimer = setTimeout(() => {
      socket = openTestSocket(behaviorId, tokenWs, membersRef.current);
      socket.onopen = () => setStatus('open');
      socket.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg?.type === 'testTick') handleTick(msg);
      };
      socket.onclose = handleClose;
    }, 0);

    return () => {
      disposed = true;
      clearTimeout(connectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close(); // al salir de la pantalla se cierra el WebSocket
      }
    };
  }, [behaviorId, tokenWs, attempt]);

  return { status, streamRef, meta, closure };
}
