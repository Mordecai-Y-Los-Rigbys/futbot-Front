import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBehaviors } from '../services/behaviorService';
import { getPlayers } from '../services/playerService';
import { createLeague } from '../services/leagueService';
import TeamBuilderForm from '../components/TeamBuilderForm';
import './CreateLeague.css';

export default function CreateLeague() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [minParticipants, setMinParticipants] = useState(3);
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [matchDuration, setMatchDuration] = useState(10);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [players, setPlayers] = useState([]);
  const [behaviors, setBehaviors] = useState([]);
  const [members, setMembers] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataErrorMessage, setDataErrorMessage] = useState(null);
  const [submitErrorMessage, setSubmitErrorMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getPlayers(1, { signal: controller.signal }),
      getBehaviors('', 1, { signal: controller.signal }),
    ])
      .then(([playersData, behaviorsData]) => {
        setPlayers(playersData);
        setBehaviors(
          Array.isArray(behaviorsData) ? behaviorsData : (behaviorsData?.items ?? []),
        );
        setIsLoadingData(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setDataErrorMessage('No pudimos cargar tus jugadores o comportamientos.');
        setIsLoadingData(false);
      });

    return () => controller.abort();
  }, []);

  if (isLoadingData) {
    return <p role="status">Cargando jugadores y comportamientos…</p>;
  }

  if (dataErrorMessage) {
    return (
      <main className="create-league">
        <h1>Crear Liga</h1>
        <p role="alert">{dataErrorMessage}</p>
      </main>
    );
  }

  const isFormValid =
    name.trim().length > 0 &&
    name.length <= 20 &&
    Number(minParticipants) >= 3 &&
    Number(maxParticipants) >= Number(minParticipants) &&
    Number(matchDuration) >= 1 &&
    Number(matchDuration) <= 10 &&
    (!isPrivate || (password.length > 0 && password.length <= 72)) &&
    Array.isArray(members) &&
    members.length === 6;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isFormValid || isSubmitting) return;

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
    <main className="create-league">
      <h1>Crear Liga</h1>
      <form onSubmit={handleSubmit}>
        {submitErrorMessage && <p role="alert">{submitErrorMessage}</p>}
        <section className="create-league__details" aria-label="Datos de la liga">
          <label className="create-league__field">
            Nombre de la liga
            <input
              type="text"
              name="name"
              value={name}
              maxLength={20}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="create-league__number-fields">
            <label className="create-league__field">
              Mínimo de participantes
              <input
                type="number"
                name="minParticipants"
                min="3"
                value={minParticipants}
                onChange={(event) =>
                  setMinParticipants(event.target.value === '' ? '' : Number(event.target.value))
                }
              />
            </label>
            <label className="create-league__field">
              Máximo de participantes
              <input
                type="number"
                name="maxParticipants"
                min="3"
                value={maxParticipants}
                onChange={(event) =>
                  setMaxParticipants(event.target.value === '' ? '' : Number(event.target.value))
                }
              />
            </label>
            <label className="create-league__field">
              Duración del partido (minutos)
              <input
                type="number"
                name="matchDuration"
                min="1"
                max="10"
                value={matchDuration}
                onChange={(event) =>
                  setMatchDuration(event.target.value === '' ? '' : Number(event.target.value))
                }
              />
            </label>
          </div>
          <label className="create-league__privacy">
            <input
              type="checkbox"
              name="private"
              checked={isPrivate}
              onChange={(event) => {
                const checked = event.target.checked;
                setIsPrivate(checked);
                if (!checked) setPassword('');
              }}
            />
            Privada
          </label>
          {isPrivate && (
            <label className="create-league__field">
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
        </section>
        <TeamBuilderForm
          players={players}
          behaviors={behaviors}
          value={members}
          onChange={setMembers}
        />
        <button
          className="create-league__submit"
          type="submit"
          disabled={!isFormValid || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="create-league__spinner" aria-hidden="true" />
              Creando Liga…
            </>
          ) : 'Crear Liga'}
        </button>
      </form>
    </main>
  );
}
