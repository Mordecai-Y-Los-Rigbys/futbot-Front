import { useEffect, useState } from 'react';
import { getBehaviors } from '../services/behaviorService';
import { getPlayers } from '../services/playerService';
import TeamBuilderForm from '../components/TeamBuilderForm';

export default function CreateLeague() {
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
        <TeamBuilderForm
          players={players}
          behaviors={behaviors}
          value={members}
          onChange={setMembers}
        />
      )}
    </main>
  );
}
