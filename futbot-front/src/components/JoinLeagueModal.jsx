import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import TeamForm from './TeamForm';
import useTeamOptions from '../hooks/useTeamOptions';
import { joinLeague } from '../services/leagueService';

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

// Modal para inscribirse en una liga: se arma el equipo con el mismo TeamForm que usan las demás
// pantallas y recién al confirmar se hace el POST. Se monta solo cuando está abierto.
//
// La contraseña de una liga privada se pide siempre acá: POST /participants la valida por sí mismo
// (no consulta el desbloqueo de la sesión) y el front no la guarda en ningún lado.
export default function JoinLeagueModal({ league, onClose, onJoined }) {
  const navigate = useNavigate();
  const { players, behaviors, isLoading, error: loadError } = useTeamOptions();

  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (members) => {
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

  return (
    <Modal title={`Unirse a ${league.name}`} onClose={onClose} isBusy={isSubmitting}>
      <TeamForm
        layout="modal"
        players={players}
        behaviors={behaviors}
        isLoading={isLoading}
        loadError={loadError}
        loadingMessage="Cargando tus jugadores y comportamientos…"
        loadErrorMessage="No pudimos cargar tus jugadores o tus comportamientos."
        onSubmit={handleSubmit}
        canSubmit={!league.private || password.length > 0}
        isSubmitting={isSubmitting}
        submitLabel="Confirmar inscripción"
        submittingLabel="Inscribiendo…"
        error={error}
        onCancel={onClose}
      >
        {league.private && (
          <label className="team-form__field">
            Contraseña de la liga
            <input
              type="password"
              value={password}
              maxLength={72}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}
      </TeamForm>
    </Modal>
  );
}
