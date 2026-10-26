import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import JoinLeagueModal from '../components/JoinLeagueModal';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getLeague,
  getLeagueParticipants,
  unlockLeague,
} from '../services/leagueService';
import './LeagueLobby.css';

// Mismo mapa que Leagues.jsx: si hace falta en una tercera pantalla, conviene moverlo a un módulo común.
const STATUS_LABELS = {
  preparation: 'En preparación',
  started: 'En curso',
  cancelled: 'Cancelada',
  finished: 'Finalizada',
};

const SESSION_MESSAGE = 'Tu sesión venció. Iniciá sesión nuevamente.';
const LOAD_ERROR_MESSAGE = 'No pudimos cargar la liga. Revisá tu conexión e intentá de nuevo.';

// Cuánto se muestra el aviso de éxito antes de volver al listado (mismo criterio que Register).
const REDIRECT_DELAY_MS = 1500;

// Lobby de una liga en preparación. Sirve para las dos entradas que ya existen:
// /leagues/:id (desde el listado) y /leagues/:id/lobby (después de crear la liga).
// Unirse y abandonar son modales de esta misma pantalla.
export default function LeagueLobby() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // 'loading' | 'ready' | 'needsPassword' | 'notFound' | 'error'
  const [screen, setScreen] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [league, setLeague] = useState(null);
  const [participants, setParticipants] = useState([]);
  // Se incrementa para volver a cargar la pantalla (Reintentar, o después de unirse o de un 409).
  const [reloadKey, setReloadKey] = useState(0);

  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  // La contraseña que el usuario escribió para desbloquear la liga. Solo en memoria (nunca en storage):
  // se le pasa al modal de inscripción para no pedírsela de nuevo, y se pierde al salir de la pantalla.
  const [unlockedPassword, setUnlockedPassword] = useState('');

  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  // Carga la liga y sus participantes. Se cancela si el usuario se va antes de que respondan.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      try {
        const leagueData = await getLeague(id, { signal });
        setLeague(leagueData);

        try {
          const list = await getLeagueParticipants(id, { signal });
          setParticipants(list);
          setScreen('ready');
        } catch (err) {
          if (err.response?.status !== 403) throw err;
          // 403 leagueAccessRequired: liga privada y la sesión todavía no la desbloqueó.
          // Se pide la contraseña una sola vez; el servidor recuerda el desbloqueo en la sesión.
          setScreen('needsPassword');
        }
      } catch (err) {
        if (signal.aborted) return;
        if (err.response?.status === 404) {
          setScreen('notFound');
        } else {
          setLoadError(err.response?.status === 401 ? SESSION_MESSAGE : LOAD_ERROR_MESSAGE);
          setScreen('error');
        }
      }
    })();

    return () => controller.abort();
  }, [id, reloadKey]);

  const reload = () => {
    setScreen('loading');
    setReloadKey((key) => key + 1);
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (!passwordInput || isCheckingPassword) return;

    setIsCheckingPassword(true);
    setPasswordError(null);
    try {
      // La contraseña se envía una sola vez. Si es correcta, el servidor desbloquea la liga en la
      // sesión (cookie que ya existe): el front no guarda ni la contraseña ni ningún token.
      await unlockLeague(id, { password: passwordInput });
      const list = await getLeagueParticipants(id);
      setUnlockedPassword(passwordInput);
      setParticipants(list);
      setScreen('ready');
      setPasswordInput('');
    } catch (err) {
      setPasswordError(
        err.response?.status === 403
          ? 'Contraseña incorrecta.'
          : 'No pudimos verificar la contraseña. Intentá de nuevo.',
      );
    } finally {
      setIsCheckingPassword(false);
    }
  }

  if (screen === 'loading') {
    return <p role="status">Cargando liga…</p>;
  }

  if (screen === 'notFound') {
    return (
      <main className="league-lobby">
        <p role="alert">La liga no existe.</p>
        <Link to="/leagues">Volver a ligas</Link>
      </main>
    );
  }

  if (screen === 'error') {
    return (
      <main className="league-lobby">
        <p role="alert">{loadError}</p>
        <button type="button" onClick={reload}>Reintentar</button>
      </main>
    );
  }

  // De acá en adelante hay liga cargada: 'ready' (se ven los participantes) o 'needsPassword'.
  const isReady = screen === 'ready';
  const isOpen = league.status === 'preparation';
  const isCreator = league.creator.id === user.id;
  // `joined` lo informa el servidor (el creador siempre participa).
  const isParticipant = league.joined;
  const isFull = league.participantsCount >= league.maxParticipants;

  const canJoin = isReady && isOpen && !isParticipant && !isFull;

  let note = null;
  if (isReady) {
    if (!isOpen) note = 'Esta liga ya no está en preparación.';
    else if (!isParticipant && isFull) note = 'La liga está llena.';
  }

  return (
    <main className="league-lobby">
      <header>
        <h1>{league.name}</h1>
        <p>{`Creada por ${league.creator.name} · @${league.creator.username}`}</p>
        <ul className="league-lobby__facts">
          <li>{STATUS_LABELS[league.status] ?? league.status}</li>
          <li>{`${league.participantsCount}/${league.maxParticipants} participantes`}</li>
          <li>{`Mínimo ${league.minParticipants}`}</li>
          <li>{league.private ? 'Privada' : 'Pública'}</li>
        </ul>
      </header>

      {notice && <p role="status">{notice}</p>}

      {isReady ? (
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
      ) : (
        <form className="league-lobby__password" onSubmit={handlePasswordSubmit}>
          <p>Esta liga es privada. Ingresá la contraseña para ver quién participa y poder unirte.</p>
          <label>
            Contraseña de la liga
            <input
              type="password"
              value={passwordInput}
              maxLength={72}
              onChange={(event) => setPasswordInput(event.target.value)}
            />
          </label>
          {passwordError && <p role="alert">{passwordError}</p>}
          <button type="submit" disabled={!passwordInput || isCheckingPassword}>
            {isCheckingPassword ? 'Verificando…' : 'Ver participantes'}
          </button>
        </form>
      )}

      {note && <p>{note}</p>}

      <div className="league-lobby__actions">
        <Link to="/leagues">Volver a ligas</Link>
      </div>

    </main>
  );
}
