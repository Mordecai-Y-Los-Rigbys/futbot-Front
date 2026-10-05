import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useMatchWebSocket from '../hooks/useMatchWebSocket';
import Pitch2DCanvas from '../components/Pitch2DCanvas';
import ScoreboardOverlay from '../components/ScoreboardOverlay';
import './Match.css';

// TODO: completar con los datos del partido cuando exista el endpoint REST.
// Forma que ya consumen el canvas y el marcador:
// {
//   clubs: [{ name, username, avatar }, { name, username, avatar }],   // club1, club2
//   players: { [playerId]: { name, club: 1 | 2, own: boolean, attributes: {..}, behavior: string | null } },
// }
// Sin esto: el marcador dice "Club 1" / "Club 2" y los jugadores no llevan etiqueta.
// El color de cada jugador se asume por orden del tick (3 primeros = club 1, 3 últimos = club 2).
const ROSTER = { clubs: [null, null], players: {} };

export default function Match() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { status, streamRef, meta, fatal } = useMatchWebSocket(id);

  const goHome = (notice) => navigate('/', { replace: true, state: notice ? { notice } : undefined });

  // Cierre fatal (1008, 4xxx, waitExpired...): vuelve al inicio con un mensaje.
  useEffect(() => {
    if (fatal) goHome(fatal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fatal]);

  return (
    <main className="match">
      <div className="match__stage">
        <Pitch2DCanvas streamRef={streamRef} roster={ROSTER} />
        <ScoreboardOverlay meta={meta} roster={ROSTER} status={status} onExit={() => goHome()} />
      </div>
    </main>
  );
}