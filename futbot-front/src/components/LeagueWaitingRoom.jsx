import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useLeagueSocket from '../hooks/useLeagueSocket';
import './LeagueWaitingRoom.css';

// Mismo mapa que Leagues.jsx: si hace falta en una tercera pantalla, conviene moverlo a un módulo común.
const STATUS_LABELS = {
  preparation: 'En preparación',
  started: 'En curso',
  cancelled: 'Cancelada',
  finished: 'Finalizada',
};

// Cierres del canal que no son un error: la pantalla se va o se vuelve a pedir la liga.
const LEAVING_CLOSE_CODES = [1000, 4401, 4404, 4409];

// Sala de espera de una liga en preparación. La lista de participantes llega por el WebSocket
// `/ws/leagues/{id}/participants`: cada mensaje trae la lista completa y reemplaza a la anterior.
// Los datos de la liga (`league`) vienen de GET /leagues/{id} y no cambian mientras se está acá.
//
// `onLeagueChanged()` avisa a la pantalla contenedora que la liga dejó de estar en preparación
// (la inició el creador, la cancelaron, etc.) para que vuelva a pedirla y elija la vista.
export default function LeagueWaitingRoom({ league, onLeagueChanged }) {
  const navigate = useNavigate();
  const { message, status, closeInfo, retry } = useLeagueSocket(league.id, 'participants');

  // Cierres definitivos del canal que sacan al usuario de esta vista.
  useEffect(() => {
    if (!closeInfo) return;
    if (closeInfo.code === 4401) navigate('/login', { replace: true });
    else if (closeInfo.code === 4404) navigate('/leagues', { replace: true });
    else if (closeInfo.code === 1000 || closeInfo.code === 4409) onLeagueChanged();
  }, [closeInfo, navigate, onLeagueChanged]);

  // Hasta tener el primer mensaje (o un cierre que cambie la pantalla) se muestra la carga.
  const isLeavingView = closeInfo !== null && LEAVING_CLOSE_CODES.includes(closeInfo.code);
  if (message === null && (closeInfo === null || isLeavingView)) {
    return <p role="status">Cargando liga…</p>;
  }

  const participants = message ? message.participants : [];
  // El cupo restante sale de la lista del canal, así cambia junto con ella.
  const spotsLeft = Math.max(0, league.maxParticipants - participants.length);
  const lostLive = closeInfo !== null && !isLeavingView;

  return (
    <main className="league-lobby">
      <header>
        <div className="league-lobby__title">
          <h1>{league.name}</h1>
          {league.private && <span className="league-lobby__badge">🔒 Privada</span>}
        </div>
        <p>{`Creada por ${league.creator.name} · @${league.creator.username}`}</p>
        <ul className="league-lobby__facts">
          <li>{league.status}</li>
          <li>{spotsLeft === 0 ? 'Cupo completo' : `Faltan ${spotsLeft} para completar el cupo`}</li>
          <li>{`Mínimo ${league.minParticipants}`}</li>
        </ul>
      </header>

      {status === 'reconnecting' && <p role="status">Reconectando…</p>}
      {lostLive && (
        <div role="alert">
          <p>Sin actualización en vivo</p>
          <button type="button" onClick={retry}>Reintentar</button>
        </div>
      )}

      <section aria-label="Participantes">
        <h2>Participantes</h2>
        <ul className="league-lobby__participants">
          {participants.map((participant) => (
            <li key={participant.id}>
              {`${participant.name} · @${participant.username}`}
              {participant.id === league.creator.id && ' (creador)'}
            </li>
          ))}
        </ul>
      </section>

      <div className="league-lobby__actions">
        <Link to="/leagues">Volver a ligas</Link>
      </div>
    </main>
  );
}
