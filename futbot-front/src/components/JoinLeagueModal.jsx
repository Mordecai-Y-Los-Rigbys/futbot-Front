import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import TeamBuilderForm from './TeamBuilderForm';
import { getBehaviors } from '../services/behaviorService';
import { joinLeague } from '../services/leagueService';
import { getPlayers } from '../services/playerService';
import './JoinLeagueModal.css';

const TEAM_SIZE = 6;

const CONFLICT_MESSAGES = {
  notInPreparation: 'La liga ya no admite inscripciones.',
  leagueFull: 'La liga completó su cupo máximo.',
  alreadyParticipating: 'Ya participás en esta liga.',
};
const INVALID_SELECTION_MESSAGE =
  'Alguna de las selecciones no es válida. Revisá tus jugadores y comportamientos.';

// Devuelve { message, details? } para mostrar en pantalla. El 404 no pasa por acá (se redirige).
function describeJoinError(err) {
  if (!err.response) return { message: 'No se pudo conectar con el servidor.' };

  const { status, data } = err.response;
  if (status === 400) {
    return {
      message: 'Revisá los datos de la inscripción.',
      // Un renglón por campo que falló: `members[0].playerId: invalidType`, `members: invalidTeam`, etc.
      details: (data?.errors ?? []).map((item) => `${item.field}: ${item.reason}`),
    };
  }
  if (status === 401) return { message: 'Tu sesión venció. Iniciá sesión nuevamente.' };
  if (status === 403) return { message: 'Contraseña incorrecta.' };
  if (status === 409) {
    const code = data?.code;
    if (CONFLICT_MESSAGES[code]) return { message: CONFLICT_MESSAGES[code] };
    if (code === 'playerOrBehaviorNotOwned' || code === 'behaviorTypeMismatch') {
      return { message: INVALID_SELECTION_MESSAGE };
    }
    return { message: 'No se pudo completar la inscripción.' };
  }
  return { message: 'Ocurrió un error en el servidor. Intentá nuevamente.' };
}

// Modal para inscribirse en una liga: se arma el equipo (6 jugadores distintos, cada uno con su
// behavior) y recién al confirmar se hace el POST. Se monta solo cuando está abierto: al montarse
// carga los jugadores y behaviors del usuario.
//
// La contraseña de una liga privada se pide siempre acá: POST /participants la valida por sí mismo
// (no consulta el desbloqueo de la sesión) y el front no la guarda en ningún lado.
export default function JoinLeagueModal({ league, onClose, onJoined }) {
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);
  const [behaviors, setBehaviors] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // `members` es null hasta que el equipo está completo (lo informa TeamBuilderForm).
  const [members, setMembers] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    Promise.all([
      getPlayers(1, { signal }),
      // El filtro por tipo lo hace el servidor: acá solo van los behaviors de jugador.
      getBehaviors('', 1, { signal, type: 'playerBehavior' }),
    ])
      .then(([playersData, behaviorsPage]) => {
        setPlayers(playersData);
        setBehaviors(behaviorsPage.items);
        setIsLoadingData(false);
      })
      .catch(() => {
        if (signal.aborted) return;
        setLoadError('No pudimos cargar tus jugadores o tus comportamientos.');
        setIsLoadingData(false);
      });

    return () => controller.abort();
  }, []);

  const canSubmit = members !== null && (!league.private || password.length > 0) && !isSubmitting;

  // Bloqueo previo: sin 6 jugadores o sin ningún behavior de jugador no se puede armar el equipo.
  const missing = [];
  if (players.length < TEAM_SIZE) {
    missing.push(`Necesitás al menos ${TEAM_SIZE} jugadores y tenés ${players.length}.`);
  }
  if (behaviors.length === 0) {
    missing.push('Necesitás al menos un comportamiento de jugador y no tenés ninguno.');
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await joinLeague(league.id, {
        // Solo las ligas privadas necesitan contraseña; con `undefined` no viaja.
        password: league.private ? password : undefined,
        members,
      });
      onJoined();
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/leagues'); // la liga ya no existe: volvemos al listado
        return;
      }
      // Contraseña rechazada: se limpia el campo para escribirla de nuevo. El equipo armado no se toca.
      if (err.response?.status === 403) setPassword('');
      setError(describeJoinError(err));
      setIsSubmitting(false);
    }
  };

  let content;
  if (isLoadingData) {
    content = <p role="status">Cargando tus jugadores y comportamientos…</p>;
  } else if (loadError) {
    content = (
      <>
        <p role="alert">{loadError}</p>
        <div className="modal__actions">
          <button type="button" onClick={onClose}>Cerrar</button>
        </div>
      </>
    );
  } else if (missing.length > 0) {
    content = (
      <>
        <div role="alert">
          <p>Todavía no podés inscribirte:</p>
          <ul>
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="modal__actions">
          <button type="button" onClick={onClose}>Cerrar</button>
        </div>
      </>
    );
  } else {
    content = (
      <form onSubmit={handleSubmit}>
        {error && (
          <div role="alert">
            <p>{error.message}</p>
            {error.details?.length > 0 && (
              <ul>
                {error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {league.private && (
          <label className="join-league__field">
            Contraseña de la liga
            <input
              type="password"
              value={password}
              maxLength={72}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}

        <TeamBuilderForm
          players={players}
          behaviors={behaviors}
          value={members}
          onChange={setMembers}
        />

        <div className="modal__actions">
          <button type="button" onClick={onClose} disabled={isSubmitting}>Cancelar</button>
          <button className="join-league__submit" type="submit" disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <span className="modal__spinner" aria-hidden="true" />
                Inscribiendo…
              </>
            ) : 'Confirmar inscripción'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <Modal title={`Unirse a ${league.name}`} onClose={onClose} isBusy={isSubmitting}>
      {content}
    </Modal>
  );
}
