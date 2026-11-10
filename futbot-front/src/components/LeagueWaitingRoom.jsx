import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JoinLeagueModal from './JoinLeagueModal';
import LeaguePasswordForm from './LeaguePasswordForm';
import { Link } from "react-router";
import Modal from './Modal';
import { useAuth } from '../context/AuthContext.jsx';
import useLeagueSocket from '../hooks/useLeagueSocket';
import { leaveLeague } from '../services/leagueService';
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
const SESSION_MESSAGE = 'Tu sesión venció. Iniciá sesión nuevamente.';

const LEAVE_CONFLICT_MESSAGES = {
  notInPreparation: 'La liga ya no está en preparación: no se puede abandonar.',
  notParticipating: 'Ya no participás en esta liga.',
  isCreator: 'El creador no puede abandonar la liga.',
};

// Cuánto se muestra el aviso de éxito antes de volver al listado (mismo criterio que Register).
const REDIRECT_DELAY_MS = 1500;

// Sala de espera de una liga en preparación. La lista de participantes llega por el WebSocket
// `/ws/leagues/{id}/participants`: cada mensaje trae la lista completa y reemplaza a la anterior.
// Los datos de la liga (`league`) vienen de GET /leagues/{id} y no cambian mientras se está acá.
//
// `onLeagueChanged()` avisa a la pantalla contenedora que la liga dejó de estar en preparación
// (la inició el creador, la cancelaron, etc.) para que vuelva a pedirla y elija la vista.
export default function LeagueWaitingRoom({ league, onLeagueChanged }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { message, status, closeInfo, retry } = useLeagueSocket(league.id, 'participants');

  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState(null);
  const [hasLeft, setHasLeft] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  // Cierres definitivos del canal que sacan al usuario de esta vista.
  useEffect(() => {
    if (!closeInfo) return;
    if (closeInfo.code === 4401) navigate('/login', { replace: true });
    else if (closeInfo.code === 4404) navigate('/leagues', { replace: true });
    else if (closeInfo.code === 1000 || closeInfo.code === 4409) onLeagueChanged();
  }, [closeInfo, navigate, onLeagueChanged]);

  // Después de abandonar con éxito: se muestra el aviso un momento y se vuelve al listado.
  useEffect(() => {
    if (!hasLeft) return undefined;
    const timer = setTimeout(() => navigate('/leagues'), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasLeft, navigate]);

  const handleLeave = async () => {
    setIsLeaving(true);
    setLeaveError(null);
    try {
      await leaveLeague(league.id);
      setIsLeaveOpen(false);
      setHasLeft(true);
    } catch (err) {
      setIsLeaveOpen(false);
      const { status: httpStatus, data } = err.response ?? {};
      if (httpStatus === 409) {
        // La liga cambió: el motivo se muestra y el canal avisa del cambio de estado si corresponde.
        setLeaveError(LEAVE_CONFLICT_MESSAGES[data?.code] ?? 'No se pudo abandonar la liga.');
      } else if (httpStatus === 401) {
        setLeaveError(SESSION_MESSAGE);
      } else if (httpStatus === 404) {
        setLeaveError('La liga ya no existe.');
      } else {
        setLeaveError('No pudimos abandonar la liga. Intentá nuevamente.');
      }
    } finally {
      setIsLeaving(false);
    }
  };

  // No hace falta volver a pedir nada: el canal manda la lista nueva con el club ya inscripto.
  const handleJoined = () => {
    setIsJoinOpen(false);
    setNotice('¡Te uniste a la liga!');
  };

  // 4403 leagueAccessRequired: liga privada sin acceso. Otros 4403 (por ejemplo originNotAllowed)
  // no son este caso. Se muestra el formulario en lugar de la sala.
  if (closeInfo?.code === 4403 && closeInfo.reason === 'leagueAccessRequired') {
    return (
      <main className="league-lobby">
        <LeaguePasswordForm
          leagueId={league.id}
          leagueName={league.name}
          onSuccess={retry}
          onBack={() => navigate('/leagues')}
        />
      </main>
    );
  }

  // Hasta tener el primer mensaje (o un cierre que cambie la pantalla) se muestra la carga.
  const isLeavingView = closeInfo !== null && LEAVING_CLOSE_CODES.includes(closeInfo.code);
  if (message === null && (closeInfo === null || isLeavingView)) {
    return <p role="status">Cargando liga…</p>;
  }

  const participants = message ? message.participants : [];
  // El cupo restante sale de la lista del canal, así cambia junto con ella.
  const spotsLeft = Math.max(0, league.maxParticipants - participants.length);
  const lostLive = closeInfo !== null && !isLeavingView;
  
  const isCreator = league.creator.id === user.id;
  const isParticipant = participants.some((participant) => participant.id === user.id);
  const canLeave = isParticipant && !isCreator && !hasLeft;
  const isFull = spotsLeft === 0;
  const canJoin = !isParticipant && !isFull;
  
  return (
    <main className="league-lobby">
      <header>
        <div className="league-lobby__title">
          <h1>{league.name}</h1>
          {league.private && <span className="league-lobby__badge">🔒 Privada</span>}
        </div>
        <p>{`Creada por ${league.creator.name} · @${league.creator.username}`}</p>
        <ul className="league-lobby__facts">
          <li>{STATUS_LABELS[league.status] || league.status}</li>
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

      {notice && <p role="status">{notice}</p>}
      {hasLeft && <p role="status">Abandonaste la liga. Te llevamos al listado…</p>}
      {leaveError && <p role="alert">{leaveError}</p>}

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
  
      {isCreator && <p>Sos el creador de la liga: no podés abandonarla.</p>}
      {!isParticipant && isFull && <p>La liga está llena.</p>}

      <div className="league-lobby__actions">
                {canLeave && (
          <button
            type="button"
            className="league-lobby__danger"
            onClick={() => setIsLeaveOpen(true)}
          >
            Abandonar liga
          </button>
        )}
        {canJoin && (
          <button
            type="button"
            className="league-lobby__primary"
            onClick={() => setIsJoinOpen(true)}
          >
            Unirse a la liga
          </button>
        )}

        <Link to="/leagues">Volver a ligas</Link>
      </div>
      
      {isLeaveOpen && (
        <Modal title="Abandonar liga" onClose={() => setIsLeaveOpen(false)} isBusy={isLeaving}>
          <p>¿Estás seguro que deseas abandonar esta liga?</p>
          <div className="modal__actions">
            <button type="button" onClick={() => setIsLeaveOpen(false)} disabled={isLeaving}>
              Cancelar
            </button>
            <button
              type="button"
              className="league-lobby__danger"
              onClick={handleLeave}
              disabled={isLeaving}
            >
              {isLeaving ? (
                <>
                  <span className="modal__spinner" aria-hidden="true" />
                  Abandonando…
                </>
              ) : 'Sí, abandonar'}
            </button>
          </div>
        </Modal>
      )}
      
      {isJoinOpen && (
        <JoinLeagueModal
          league={league}
          onClose={() => setIsJoinOpen(false)}
          onJoined={handleJoined}
        />
      )}


    </main>
  );
}
