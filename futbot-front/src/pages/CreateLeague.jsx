import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createLeague } from '../services/leagueService';
import TeamForm from '../components/TeamForm';
import useTeamOptions from '../hooks/useTeamOptions';

// Modo de la liga. `normal` permite empates (allowDraws: true); `penalties` los define por penales.
const MODE_OPTIONS = [
  { value: 'normal', label: 'Normal (puede haber empates)' },
  { value: 'penalties', label: 'Penales (los empates se definen por penales)' },
];
const DEFAULT_MODE = 'normal';

const toNumberOrEmpty = (value) => (value === '' ? '' : Number(value));

export default function CreateLeague() {
  const navigate = useNavigate();
  const { players, behaviors, isLoading, error: loadError } = useTeamOptions();

  const [name, setName] = useState('');
  const [minParticipants, setMinParticipants] = useState(3);
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [matchDuration, setMatchDuration] = useState(10);
  const [isPrivate, setIsPrivate] = useState(false);
  const [mode, setMode] = useState(DEFAULT_MODE);
  const [password, setPassword] = useState('');
  const [submitErrorMessage, setSubmitErrorMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validez de los datos de la liga. El equipo (6 miembros) lo valida TeamForm.
  const detailsValid =
    name.trim().length > 0 &&
    name.length <= 20 &&
    Number(minParticipants) >= 3 &&
    Number(maxParticipants) >= Number(minParticipants) &&
    Number(matchDuration) >= 1 &&
    Number(matchDuration) <= 10 &&
    (!isPrivate || (password.length > 0 && password.length <= 72));

  const handleSubmit = async (members) => {
    setIsSubmitting(true);
    setSubmitErrorMessage(null);

    try {
      const league = await createLeague({
        name: name.trim(),
        minParticipants: Number(minParticipants),
        maxParticipants: Number(maxParticipants),
        matchDuration: Number(matchDuration),
        private: isPrivate,
        password: isPrivate ? password : null,
        allowDraws: mode === 'normal',
        members,
      });
      navigate(`/leagues/${league.id}/lobby`);
    } catch (error) {
      const { status, data } = error?.response ?? {};
      if (status === 400) {
        setSubmitErrorMessage(data?.message || 'Los datos enviados no son válidos. Revisá el formulario.');
      } else if (status === 401) {
        setSubmitErrorMessage(data?.message || 'Tu sesión venció o no es válida. Iniciá sesión nuevamente.');
      } else if (status === 409 && data?.code === 'playerOrBehaviorNotOwned') {
        setSubmitErrorMessage(
          data?.message || 'Alguno de los jugadores o comportamientos seleccionados no te pertenece.',
        );
      } else {
        setSubmitErrorMessage(data?.message || 'No se pudo crear la liga. Intentá nuevamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TeamForm
      title="Crear Liga"
      players={players}
      behaviors={behaviors}
      isLoading={isLoading}
      loadError={loadError}
      onSubmit={handleSubmit}
      canSubmit={detailsValid}
      isSubmitting={isSubmitting}
      submitLabel="Crear Liga"
      submittingLabel="Creando Liga…"
      error={submitErrorMessage}
      onCancel={() => navigate('/leagues')}
    >
      <label className="team-form__field">
        Nombre de la liga
        <input
          type="text"
          name="name"
          value={name}
          maxLength={20}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <div className="team-form__grid">
        <label className="team-form__field">
          Mínimo de participantes
          <input
            type="number"
            name="minParticipants"
            min="3"
            value={minParticipants}
            onChange={(event) => setMinParticipants(toNumberOrEmpty(event.target.value))}
          />
        </label>
        <label className="team-form__field">
          Máximo de participantes
          <input
            type="number"
            name="maxParticipants"
            min="3"
            value={maxParticipants}
            onChange={(event) => setMaxParticipants(toNumberOrEmpty(event.target.value))}
          />
        </label>
        <label className="team-form__field">
          Duración del partido (minutos)
          <input
            type="number"
            name="matchDuration"
            min="1"
            max="10"
            value={matchDuration}
            onChange={(event) => setMatchDuration(toNumberOrEmpty(event.target.value))}
          />
        </label>
      </div>

      <label className="team-form__check">
        <input
          type="checkbox"
          name="private"
          checked={isPrivate}
          onChange={(event) => {
            const { checked } = event.target;
            setIsPrivate(checked);
            if (!checked) setPassword('');
          }}
        />
        Privada
      </label>

      <div className="team-form__field">
        <label htmlFor="create-league-mode">Modo de la liga</label>
        <select
          id="create-league-mode"
          name="mode"
          value={mode}
          aria-describedby="create-league-mode-help"
          onChange={(event) => setMode(event.target.value)}
          required
        >
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <small id="create-league-mode-help" className="team-form__hint">
          Si la tanda de penales queda empatada, el ganador se define por sorteo.
        </small>
      </div>

      {isPrivate && (
        <label className="team-form__field">
          Contraseña
          <input
            type="password"
            name="password"
            value={password}
            maxLength={72}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
      )}
    </TeamForm>
  );
}
