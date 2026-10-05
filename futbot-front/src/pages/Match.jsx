import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useMatchWebSocket from '../hooks/useMatchWebSocket';
import Pitch2DCanvas from '../components/Pitch2DCanvas';
import ScoreboardOverlay from '../components/ScoreboardOverlay';
import './Match.css';

// (ROSTER y su TODO quedan igual)
const ROSTER = { clubs: [null, null], players: {} };

export default function Match() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { status, streamRef, meta, fatal } = useMatchWebSocket(id);

  // Cierre fatal (1008, 4xxx, waitExpired, 401...): sale del partido con un aviso.
  useEffect(() => {
    if (!fatal) return;
    navigate(fatal.to, { replace: true, state: { notice: fatal.message } });
  }, [fatal, navigate]);

  return (
    <main className="match">
      <div className="match__stage">
        <Pitch2DCanvas streamRef={streamRef} roster={ROSTER} />
        <ScoreboardOverlay
          meta={meta}
          roster={ROSTER}
          status={status}
          onExit={() => navigate('/', { replace: true })}
        />
      </div>
    </main>
  );
}