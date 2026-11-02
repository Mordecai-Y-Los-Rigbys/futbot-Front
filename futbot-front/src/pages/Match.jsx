import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useMatchWebSocket from '../hooks/useMatchWebSocket';
import { getMatch } from '../services/matchService';
import Pitch2DCanvas from '../components/Pitch2DCanvas';
import ScoreboardOverlay from '../components/ScoreboardOverlay';
import './Match.css';

// TODO: `players` (nombre, atributos y behavior por jugador) sigue sin contrato:
// GET /matches/{id} solo trae los clubes.
const INITIAL_ROSTER = { clubs: [null, null], players: {} };

export default function Match() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { status, streamRef, meta, fatal } = useMatchWebSocket(id);
  const [roster, setRoster] = useState(INITIAL_ROSTER);

  // true cuando llegó el primer tick: en un amistoso, el rival ya se unió.
  const started = meta.phase !== null;

  // Clubes del partido (GET /matches/{id}). Se pide al montar y de nuevo al llegar
  // el primer tick, porque en un amistoso club2 es null hasta que el rival se une.
  useEffect(() => {
    const controller = new AbortController();
    getMatch(id, { signal: controller.signal })
      .then((match) => {
        if (controller.signal.aborted) return;
        setRoster((prev) => ({ ...prev, clubs: [match.club1 ?? null, match.club2 ?? null] }));
      })
      .catch(() => {
        // Sin datos de clubes el marcador usa "Club 1" / "Club 2". La salida del
        // partido la decide solo el WebSocket (fatal).
      });
    return () => controller.abort();
  }, [id, started]);

  // Cierre fatal (1008, 4xxx, waitExpired, 401...): sale del partido con un aviso.
  useEffect(() => {
    if (!fatal) return;
    navigate(fatal.to, { replace: true, state: { notice: fatal.message } });
  }, [fatal, navigate]);

  return (
    <main className="match">
      <div className="match__stage">
        <Pitch2DCanvas streamRef={streamRef} roster={roster} />
        <ScoreboardOverlay
          meta={meta}
          roster={roster}
          status={status}
          onExit={() => navigate('/', { replace: true })}
        />
      </div>
    </main>
  );
}