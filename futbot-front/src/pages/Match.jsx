import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useMatchWebSocket from '../hooks/useMatchWebSocket';
import { getMatch } from '../services/matchService';
import Pitch2DCanvas from '../components/Pitch2DCanvas';
import ScoreboardOverlay from '../components/ScoreboardOverlay';
import MatchBehaviorPanel from '../components/MatchBehaviorPanel';
import './Match.css';

// TODO: `players` (nombre, atributos y behavior por jugador) sigue sin contrato:
// GET /matches/{id} solo trae los clubes.
const INITIAL_ROSTER = { clubs: [null, null], players: {} };

export default function Match() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { status, streamRef, meta, fatal, role } = useMatchWebSocket(id);

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
        <MatchBehaviorPanel matchId={id} canManage={status === 'open' && role === 'player'} />
      </div>
    </main>
  );
}