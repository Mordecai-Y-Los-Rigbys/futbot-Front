import { useEffect, useRef, useState } from 'react';
import { createMatchConnection, openMatchSocket } from '../services/matchService';
import { EMPTY_KICKS, sameCurrent, sameKicks } from '../utils/penalties';

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
  waitExpired: 'Nadie se unió a tu amistoso en 15 minutos y el partido fue cancelado.',
  leagueAccessRequired: 'Este partido es de una liga privada: necesitás acceso a la liga para verlo.',
  notAPlayerInMatch: 'Este amistoso no se puede ver: solo lo juegan sus dos clubes.',
};

// Respaldo por código cuando el cierre no trae un `reason` conocido.
const CLOSE_CODE_MESSAGES = {
  4401: 'Error de validación al conectar con el partido.',
  4403: 'Error de validación al conectar con el partido.',
  4404: 'El partido no existe.',
  4409: 'El partido ya no está disponible (finalizado o cancelado).',
  4429: 'Error de conexión: ya tenés demasiadas pestañas abiertas con este partido.',
};

const VALID_ROLES = ['player', 'spectator'];

const REST_ERROR_MESSAGES = {
  401: 'Tu sesión expiró. Iniciá sesión de nuevo.',
  403: 'No participás en este partido.',
  404: 'El partido no existe.',
  409: 'Partido finalizado o cancelado.',
};

// Un 403 puede ser de una liga privada (espectador sin acceso) o de un amistoso ajeno.
const REST_403_MESSAGES = {
  leagueAccessRequired: 'Este partido es de una liga privada: necesitás acceso a la liga para verlo.',
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const INITIAL_META = {
  score1: 0,
  score2: 0,
  elapsedTime: 0,
  phase: null, // null = todavía no llegó ningún tick (esperando rival)
  periodNumber: null,
  countdown: null, // { seconds, startedAt } del último periodStart
  goal: null, // { id, scoringClub } del último gol
  result: null, // { score1, score2, penalties } al terminar (penalties es null si no hubo tanda)
  // Tanda de penales. Cada tick trae el estado completo, así que todo se pisa con el último tick.
  penaltyScore1: 0,
  penaltyScore2: 0,
  penaltyKicks: EMPTY_KICKS, // penales ya ejecutados, en orden
  penaltyCurrent: null, // { club, kickerId, kickerName, defenderId, defenderName }
  penaltyCountdownSeconds: null, // cuenta previa de 3 a 1 (null con el penal en juego)
  penaltyRemainingSeconds: null, // tiempo del penal en curso, de 8 a 0
  penaltiesBanner: null, // { id } del último evento penaltiesStart (para el cartel)
  pauseReason: null, // 'hydration' | 'halftime' | null (null también si nos perdimos el evento pause)
  pauseRemaining: null, // segundos que faltan, de pauseRemainingSeconds
  pauseCount: 0, // cuántas pausas vio esta conexión; sirve de key para remontar el panel
  pausesLeft: null, // pausas que todavía no empezaron (3 a 0); null = todavía no llegó ningún tick
  teamVersion: 0, // sube con cada `pause` y cada `periodStart` ≥ 2: ahí cambia el equipo (se aplicó una sustitución)
};

/**
 * Se conecta al WebSocket del partido (pide el tokenWs por REST y abre el socket).
 *
 * Devuelve:
 * - status: 'connecting' | 'open' | 'reconnecting' | 'closed'
 * - role: 'player' | 'spectator' | null (null hasta que responde POST /matches/{id}/connections)
 * - streamRef: ref MUTABLE con los últimos ticks para el canvas (no provoca re-render).
 *   { prev, curr, currAt, intervalMs, snapNext }
 * - meta: marcador, reloj, fase, etc. Solo cambia cuando cambia algo visible (≈1/seg),
 *   así React no re-renderiza 20 veces por segundo.
 * - fatal: { message, to } si hay que sacar al usuario del partido (la página redirige a `to`).
 */
export default function useMatchWebSocket(matchId) {
  const streamRef = useRef({ prev: null, curr: null, currAt: 0, intervalMs: DEFAULT_TICK_MS, snapNext: false });
  const metaRef = useRef(INITIAL_META);
  const [meta, setMeta] = useState(INITIAL_META);
  const [status, setStatus] = useState('connecting');
  const [fatal, setFatal] = useState(null);
  const [role, setRole] = useState(null);

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
    setRole(null);

    const fail = (message, to = '/') => {
      if (disposed) return;
      setStatus('closed');
      setFatal({ message, to });
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
      // Después de un gol (o de un penal) el back reubica a todos: se muestra directo, sin deslizar.
      s.prev = s.snapNext || !s.curr ? tick : s.curr;
      s.snapNext = tick.event?.type === 'goal' || tick.event?.type === 'penaltyKick';
      s.curr = tick;
      s.currAt = now;

      // Estado visible. Solo se hace setState si algo cambió.
      const prev = metaRef.current;
      // Cada tick llega como JSON nuevo: la lista y el penal en curso se comparan por contenido
      // y se conserva la referencia anterior si no cambiaron (si no, habría un re-render por tick).
      const kicks = tick.penaltyKicks ?? EMPTY_KICKS;
      const current = tick.penaltyCurrent ?? null;
      const next = {
        ...prev,
        score1: tick.score1,
        score2: tick.score2,
        elapsedTime: tick.elapsedTime,
        phase: tick.phase,
        penaltyScore1: tick.penaltyScore1 ?? 0,
        penaltyScore2: tick.penaltyScore2 ?? 0,
        penaltyKicks: sameKicks(prev.penaltyKicks, kicks) ? prev.penaltyKicks : kicks,
        penaltyCurrent: sameCurrent(prev.penaltyCurrent, current) ? prev.penaltyCurrent : current,
        penaltyCountdownSeconds: tick.penaltyCountdownSeconds ?? null,
        penaltyRemainingSeconds: tick.penaltyRemainingSeconds ?? null,
        pausesLeft: Number.isInteger(tick.pausesLeft) ? tick.pausesLeft : null,
      };
      const e = tick.event;
      if (e?.type === 'penaltiesStart') next.penaltiesBanner = { id: (prev.penaltiesBanner?.id ?? 0) + 1 };
      if (e?.type === 'periodStart') {
        next.periodNumber = e.periodNumber;
        next.countdown = { seconds: e.countdownSeconds, startedAt: Date.now() };
        // Al terminar cada pausa (períodos 2 a 4) el equipo ya refleja la sustitución aplicada.
        if (e.periodNumber >= 2) next.teamVersion = prev.teamVersion + 1;
      }
      // Al empezar la pausa se aplica la sustitución pendiente.
      if (e?.type === 'pause') next.teamVersion = prev.teamVersion + 1;
      if (e?.type === 'goal') next.goal = { id: (prev.goal?.id ?? 0) + 1, scoringClub: e.scoringClub };
      if (e?.type === 'matchEnd') {
        next.result = e.result;
        finished = true;
      }
      // Pausa: el motivo viaja solo en el evento `pause` (primer tick de la pausa);
      // el tiempo restante viaja en todos los ticks.
      if (tick.phase === 'paused') {
        if (e?.type === 'pause') next.pauseReason = e.reason ?? null;
        next.pauseRemaining = tick.pauseRemainingSeconds ?? null;
        if (prev.phase !== 'paused') next.pauseCount = prev.pauseCount + 1;
      } else {
        next.pauseReason = null;
        next.pauseRemaining = null;
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
        fail(CLOSE_MESSAGES[reason] ?? CLOSE_CODE_MESSAGES[code] ?? 'Error de conexión con el partido.');
        return;
      }
      // Caída de red (1006, etc.): el token es reutilizable, se reintenta.
      scheduleRetry();
    };

    async function connect() {
      try {
        const { tokenWs, role: connectionRole } = await createMatchConnection(matchId);
        if (disposed) return;
        // Un rol desconocido queda en null: nunca se interpreta como jugador.
        setRole(VALID_ROLES.includes(connectionRole) ? connectionRole : null);

        socket = openMatchSocket(matchId, tokenWs);
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
        const httpStatus = err.response?.status;
        const message =
          (httpStatus === 403 && REST_403_MESSAGES[err.response?.data?.code]) ||
          REST_ERROR_MESSAGES[httpStatus];
        if (message) fail(message, httpStatus === 401 ? '/login' : '/');
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

  return { status, streamRef, meta, fatal, role };
}
