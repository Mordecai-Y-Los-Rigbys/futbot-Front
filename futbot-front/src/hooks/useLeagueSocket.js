import { useCallback, useEffect, useState } from 'react';
import { openLeagueSocket } from '../services/leagueSocket';

const MAX_RETRIES = 3;

// Tipo de mensaje de cada canal de liga. Un mensaje con otro `type` se ignora.
const MESSAGE_TYPES = {
  participants: 'leagueParticipants',
  'matches/next': 'leagueNextMatch',
  fixture: 'leagueFixture',
};

/**
 * Se conecta a un canal de liga (`/ws/leagues/{id}/{channel}`) con la cookie de sesión.
 * Pensado para reutilizarse en el lobby, el fixture, el ranking y el partido siguiente.
 *
 * Devuelve:
 * - message: el último mensaje válido del canal (`null` hasta que llega el primero). Cada mensaje
 *   trae el estado completo y reemplaza al anterior: no hay deltas.
 * - status: 'connecting' | 'open' | 'reconnecting' | 'closed'
 * - closeInfo: `{ code, reason }` cuando la conexión se cerró de forma definitiva (si no, `null`).
 *   Cierre 1000 (la liga cambió de estado) o 4xxx (handshake rechazado o sesión terminada): no se
 *   reconecta. Una caída de red (1006 u otro código) se reintenta 3 veces con esperas de 1, 2 y 3 s;
 *   si fallan los 3 intentos también termina acá.
 * - retry(): vuelve a conectar después de un cierre definitivo.
 *
 * El servidor acepta el upgrade y recién después puede cerrar con 4xxx, así que `onopen` no alcanza
 * para dar la conexión por buena: el contador de reintentos se reinicia con el primer mensaje.
 */
export default function useLeagueSocket(leagueId, channel) {
  const [message, setMessage] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [closeInfo, setCloseInfo] = useState(null);
  // Se incrementa para volver a conectar desde `retry`.
  const [attemptKey, setAttemptKey] = useState(0);

  useEffect(() => {
    let disposed = false;
    let socket = null;
    let retryTimer = null;
    let attempts = 0;
    const expectedType = MESSAGE_TYPES[channel];

    const handleClose = ({ code, reason }) => {
      if (disposed) return;

      // Cierre definitivo: 1000 (la liga cambió de estado) o 4xxx (handshake rechazado / sesión terminada).
      if (code === 1000 || (code >= 4000 && code < 5000)) {
        setStatus('closed');
        setCloseInfo({ code, reason });
        return;
      }
      // Caída de red: se reintenta; el primer mensaje de cada conexión ya trae el estado actual.
      if (attempts >= MAX_RETRIES) {
        setStatus('closed');
        setCloseInfo({ code, reason });
        return;
      }
      attempts += 1;
      setStatus('reconnecting');
      retryTimer = setTimeout(connect, 1000 * attempts);
    };

    function connect() {
      socket = openLeagueSocket(leagueId, channel);
      socket.onopen = () => setStatus('open');
      socket.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return; // no es JSON: se ignora
        }
        if (data?.type !== expectedType) return;
        attempts = 0;
        setStatus('open');
        setMessage(data);
      };
      socket.onclose = handleClose;
    }

    connect();

    // Al salir se cierra la conexión y se cancelan los reintentos pendientes.
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [leagueId, channel, attemptKey]);

  const retry = useCallback(() => {
    setCloseInfo(null);
    setStatus('connecting');
    setAttemptKey((key) => key + 1);
  }, []);

  return { message, status, closeInfo, retry };
}
