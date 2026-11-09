import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LeagueWaitingRoom from '../components/LeagueWaitingRoom';
import { getLeague } from '../services/leagueService';

const LOAD_ERROR_MESSAGE = 'No pudimos cargar la liga. Revisá tu conexión e intentá de nuevo.';

// Pantalla de una liga. Pide la liga y elige la vista según su `status`:
// - preparation: sala de espera (con la lista de participantes en tiempo real).
// - started y finished: vista de liga en curso (ticket aparte; por ahora un aviso).
// - cancelled: aviso de liga cancelada.
// Sirve para las dos entradas que ya existen: /leagues/:id (desde el listado) y
// /leagues/:id/lobby (después de crear la liga).
export default function LeagueLobby() {
  const { id } = useParams();
  const navigate = useNavigate();

  // 'loading' | 'ready' | 'error'
  const [screen, setScreen] = useState('loading');
  const [league, setLeague] = useState(null);
  // Se incrementa para volver a pedir la liga (Reintentar, o cuando la sala de espera avisa que cambió).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    getLeague(id, { signal })
      .then((leagueData) => {
        setLeague(leagueData);
        setScreen('ready');
      })
      .catch((err) => {
        if (signal.aborted) return;
        const status = err.response?.status;
        if (status === 401) {
          navigate('/login', { replace: true });
        } else if (status === 404) {
          navigate('/leagues', { replace: true });
        } else {
          setScreen('error');
        }
      });

    return () => controller.abort();
  }, [id, reloadKey, navigate]);

  const reload = useCallback(() => {
    setScreen('loading');
    setReloadKey((key) => key + 1);
  }, []);

  if (screen === 'loading') {
    return <p role="status">Cargando liga…</p>;
  }

  if (screen === 'error') {
    return (
      <main className="league-lobby">
        <p role="alert">{LOAD_ERROR_MESSAGE}</p>
        <button type="button" onClick={reload}>Reintentar</button>
      </main>
    );
  }

  if (league.status === 'preparation') {
    return <LeagueWaitingRoom league={league} onLeagueChanged={reload} />;
  }

  return (
    <main className="league-lobby">
      <h1>{league.name}</h1>
      <p>
        {league.status === 'cancelled'
          ? 'La liga fue cancelada.'
          : 'Esta liga ya no está en preparación.'}
      </p>
      <Link to="/leagues">Volver a ligas</Link>
    </main>
  );
}
