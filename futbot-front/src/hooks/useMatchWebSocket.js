import { useEffect, useRef, useState } from 'react';
import { buildWsUrl, createMatchConnection } from '../services/matchService';

const MAX_RETRIES = 3;
const DEFAULT_TICK_MS = 50; // 20 ticks por segundo

// Mensajes según el `reason` con el que el back cierra (ver AsyncAPI).
const CLOSE_MESSAGES = {
  tokenInvalid: 'Error de conexión: tu acceso al partido no es válido.',
  tokenExpired: 'Error de conexión: tu acceso al partido expiró.',
  tokenMatchMismatch: 'Error de conexión: el acceso no corresponde a este partido.',
  matchNotFound: 'El partido no existe.',
  matchFinished: 'Partido finalizado.',
  matchCancelled: 'El partido fue cancelado.',
  tooManyConnections: 'Error de conexión: ya tenés demasiadas pestañas abiertas con este partido.',
  waitExpired: 'Nadie se unió a tu amistoso y el partido fue cancelado.',
};

const REST_ERROR_MESSAGES = {
  401: 'Tu sesión expiró. Iniciá sesión de nuevo.',
  403: 'No participás en este partido.',
  404: 'El partido no existe.',
  409: 'Partido finalizado o cancelado.',
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const INITIAL_META = {
  score1: 0,
  score2: 0,
  elapsedTime: 0,
  phase: null, // null = todavía no llegó ningún tick (esperando rival)
  periodNumber: null,
  countdown: null, // { seconds, startedAt } del último periodStart
  goal: null, // { id, scoringClub } del último gol
  result: null, // { score1, score2 } al terminar
};

/**
 * Se conecta al WebSocket del partido.
 *
 * Devuelve:
 * - status: 'connecting' | 'open' | 'reconnecting' | 'closed'
 * - streamRef: ref MUTABLE con los últimos ticks para el canvas (no provoca re-render).
 *   { prev, curr, currAt, intervalMs, snapNext }
 * - meta: marcador, reloj, fase, etc. Solo cambia cuando cambia algo visible (≈1/seg),
 *   así React no re-renderiza 20 veces por segundo.
 * - fatal: mensaje si hay que sacar al usuario del partido (la página redirige).
 */
export default function useMatchWebSocket(matchId) {
  const streamRef = useRef({ prev: null, curr: null, currAt: 0, intervalMs: DEFAULT_TICK_MS, snapNext: false });
  const metaRef = useRef(INITIAL_META);
  const [meta, setMeta] = useState(INITIAL_META);
  const [status, setStatus] = useState('connecting');
  const [fatal, setFatal] = useState(null);

  useEffect(() => {
    let disposed = false;
    let socket = null;
    let retryTimer = null;
    let attempts = 0;
    let finished = false; // llegó matchEnd: el cierre posterior es normal

    streamRef.current = { prev: null, curr: null, currAt: 0, intervalMs: DEFAULT_TICK_MS, snapNext: false };
    metaRef.current = INITIAL_META;
    setMeta(INITIAL_META);
    setStatus('connecting');
    setFatal(null);

    const fail = (message) => {
      if (disposed) return;
      setStatus('closed');
      setFatal(message);
    };

    const scheduleRetry = () => {
      if (disposed) return;
      if (attempts >= MAX_RETRIES) {
        fail('Error de conexión con el partido.');
        return;
      }
      attempts += 1;
      setStatus('reconnecting');
      retryTimer = setTimeout(connect, 1000 * attempts);
    };

    const handleTick = (tick) => {
      const now = performance.now();
      const s = streamRef.current;

      // Intervalo entre ticks (promedio móvil) para interpolar en el canvas.
      if (s.curr) s.intervalMs = clamp(0.8 * s.intervalMs + 0.2 * (now - s.currAt), 30, 250);
      // Después de un gol el back reubica a todos: se muestra directo, sin deslizar.
      s.prev = s.snapNext || !s.curr ? tick : s.curr;
      s.snapNext = tick.event?.type === 'goal';
      s.curr = tick;
      s.currAt = now;

      // Estado visible. Solo se hace setState si algo cambió.
      const prev = metaRef.current;
      const next = {
        ...prev,
        score1: tick.score1,
        score2: tick.score2,
        elapsedTime: tick.elapsedTime,
        phase: tick.phase,
      };
      const e = tick.event;
      if (e?.type === 'periodStart') {
        next.periodNumber = e.periodNumber;
        next.countdown = { seconds: e.countdownSeconds, startedAt: Date.now() };
      }
      if (e?.type === 'goal') next.goal = { id: (prev.goal?.id ?? 0) + 1, scoringClub: e.scoringClub };
      if (e?.type === 'matchEnd') {
        next.result = e.result;
        finished = true;
      }
      if (tick.phase !== 'countdown') next.countdown = null;

      const changed = Object.keys(next).some((k) => next[k] !== prev[k]);
      if (changed) {
        metaRef.current = next;
        setMeta(next);
      }
    };

    const handleClose = (event) => {
      if (disposed) return;
      const { code, reason } = event;

      // Fin normal del partido: se queda en pantalla viendo el resultado final.
      if (finished || reason === 'matchEnd') {
        setStatus('closed');
        return;
      }
      // 1008, 4xxx (handshake rechazado) o 1000/waitExpired: no se reconecta.
      if (code === 1008 || (code >= 4000 && code < 5000) || code === 1000) {
        fail(CLOSE_MESSAGES[reason] ?? 'Error de conexión con el partido.');
        return;
      }
      // Caída de red (1006, etc.): el token es reutilizable, se reintenta.
      scheduleRetry();
    };

    async function connect() {
      try {
        const { tokenWs } = await createMatchConnection(matchId);
        if (disposed) return;

        socket = new WebSocket(buildWsUrl(matchId, tokenWs));
        socket.onopen = () => {
          attempts = 0;
          setStatus('open');
        };
        socket.onmessage = (event) => {
          let msg;
          try {
            msg = JSON.parse(event.data);
          } catch {
            return;
          }
          if (msg?.type === 'tick') handleTick(msg);
        };
        socket.onclose = handleClose;
      } catch (err) {
        if (disposed) return;
        const message = REST_ERROR_MESSAGES[err.response?.status];
        if (message) fail(message);
        else scheduleRetry(); // sin respuesta o 5xx
      }
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [matchId]);

  return { status, streamRef, meta, fatal };
}