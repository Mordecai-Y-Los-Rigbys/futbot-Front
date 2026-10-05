import { useEffect, useState } from 'react';
import { getAvatarSrc } from '../utils/avatars';
import { TEAM_COLORS } from './Pitch2DCanvas';

const GOAL_BANNER_MS = 3000;

const pad = (n) => String(n).padStart(2, '0');
const formatClock = (seconds) => `${pad(Math.floor(seconds / 60))}:${pad(Math.floor(seconds % 60))}`;

function ClubBadge({ club, fallbackName, number }) {
  const name = club?.name ?? fallbackName;
  const src = getAvatarSrc(club?.avatar);
  return (
    <div className="scoreboard__club" style={{ '--team': TEAM_COLORS[number] }}>
      {src ? (
        <img className="scoreboard__avatar" src={src} alt="" width={40} height={40} />
      ) : (
        <span className="scoreboard__avatar scoreboard__avatar--fallback" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="scoreboard__names">
        <strong>{name}</strong>
        {club?.username && <span>{club.username}</span>}
      </div>
    </div>
  );
}

export default function ScoreboardOverlay({ meta, roster, status, onExit }) {
  const { score1, score2, elapsedTime, phase, periodNumber, countdown, goal, result } = meta;
  const [club1, club2] = roster?.clubs ?? [];

  // Segundos de cuenta regresiva que quedan (local, a partir del evento periodStart).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [phase]);
  const countdownLeft = countdown ? Math.max(0, Math.ceil(countdown.seconds - (now - countdown.startedAt) / 1000)) : null;

  // La animación de gol dura unos segundos y se dispara con cada gol nuevo.
  const [visibleGoalId, setVisibleGoalId] = useState(null);
  useEffect(() => {
    if (!goal) return undefined;
    setVisibleGoalId(goal.id);
    const timer = setTimeout(() => setVisibleGoalId(null), GOAL_BANNER_MS);
    return () => clearTimeout(timer);
  }, [goal]);

  // Reloj: se muestra tal cual lo manda el back (`elapsedTime`, en segundos).
  // TODO: confirmar con el back si es el tiempo transcurrido o el restante del cuarto.
  const clock = phase ? `${periodNumber ? `${periodNumber}.º cuarto · ` : ''}${formatClock(elapsedTime)}` : '--:--';

  const waiting = phase === null && status === 'open';
  const connecting = phase === null && status !== 'open' && status !== 'closed';

  return (
    <div className="overlay">
      <header className="scoreboard" aria-label="Marcador">
        <ClubBadge club={club1} fallbackName="Club 1" number={1} />
        <div className="scoreboard__center">
          <div className="scoreboard__score" aria-live="polite">
            <span>{score1}</span>
            <span aria-hidden="true">:</span>
            <span>{score2}</span>
          </div>
          <div className="scoreboard__clock">
            {clock}
          </div>
        </div>
        <ClubBadge club={club2} fallbackName="Club 2" number={2} />
      </header>

      <div className="overlay__stage">
        {connecting && <p className="banner">{status === 'reconnecting' ? 'Reconectando…' : 'Conectando con el partido…'}</p>}
        {waiting && <p className="banner">Esperando al rival…</p>}

        {phase === 'countdown' && (
          <div className="countdown" role="status">
            <span className="countdown__label">{periodNumber ? `Empieza el ${periodNumber}.º cuarto` : 'Empieza el partido'}</span>
            {countdownLeft !== null && <span className="countdown__number" key={countdownLeft}>{countdownLeft}</span>}
          </div>
        )}

        {phase === 'paused' && <p className="banner">Partido en pausa</p>}

        {visibleGoalId !== null && goal && (
          <div className="goal" key={visibleGoalId} role="status">
            <span className="goal__word">¡GOL!</span>
            <span className="goal__club">{goal.scoringClub}</span>
          </div>
        )}

        {phase === 'finished' && (
          <div className="final" role="status">
            <span className="final__title">Partido finalizado</span>
            <span className="final__score">
              {(result ?? { score1, score2 }).score1} : {(result ?? { score1, score2 }).score2}
            </span>
            <button type="button" onClick={onExit}>Volver al inicio</button>
          </div>
        )}
      </div>
    </div>
  );
}