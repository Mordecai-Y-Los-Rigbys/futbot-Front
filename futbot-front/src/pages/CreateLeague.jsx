import { useEffect, useState } from 'react';
import { getBehaviors } from '../services/behaviorService';
import { getPlayers } from '../services/playerService';
import TeamBuilderForm from '../components/TeamBuilderForm';
import './CreateLeague.css';

export default function CreateLeague() {
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
  const [errorMessage, setErrorMessage] = useState(null);

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
        setErrorMessage('No pudimos cargar tus jugadores o comportamientos.');
        setIsLoadingData(false);
      });

    return () => controller.abort();
  }, []);

  if (isLoadingData) {
    return <p role="status">Cargando jugadores y comportamientos…</p>;
  }

  return (
    <main className="create-league">
      <h1>Crear Liga</h1>
      {errorMessage ? (
        <p role="alert">{errorMessage}</p>
      ) : (
        <>
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
        </>
      )}
    </main>
  );
}
