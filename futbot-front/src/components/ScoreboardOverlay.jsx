import { useEffect, useState } from 'react';
import { getAvatarSrc } from '../utils/avatars';
import { TEAM_COLORS } from './Pitch2DCanvas';
import PausePanel from './PausePanel';
import PenaltyBoard from './PenaltyBoard';
import { EMPTY_KICKS, shootoutLabel, sideNumber, winnerLabel } from '../utils/penalties';

const GOAL_BANNER_MS = 3000;
const PENALTIES_BANNER_MS = 3000;

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

// Quién patea y quién defiende en el penal en curso, con su cuenta (previa o de juego).
function PenaltyDuel({ current, countdown, remaining }) {
  return (
    <p className="shootout__duel">
      <span>
        Patea: <strong>{current.kickerName}</strong>
      </span>
      <span>
        Defiende: <strong>{current.defenderName}</strong>
      </span>
      {countdown === null && remaining !== null && (
        <span className="shootout__timer" role="timer" aria-label="Tiempo restante del penal">
          {`${remaining} s`}
        </span>
      )}
    </p>
  );
}

export default function ScoreboardOverlay({ meta, roster, status, onExit }) {
  const {
    score1,
    score2,
    elapsedTime,
    phase,
    periodNumber,
    countdown,
    goal,
    result,
    pauseReason,
    pauseRemaining,
    pauseCount,
    penaltyScore1 = 0,
    penaltyScore2 = 0,
    penaltyKicks = EMPTY_KICKS,
    penaltyCurrent = null,
    penaltyCountdownSeconds = null,
    penaltyRemainingSeconds = null,
    penaltiesBanner = null,
  } = meta;
  const [club1, club2] = roster?.clubs ?? [];
  const clubs = [club1, club2];
  // Los clubes se identifican por lado; el nombre sale del Match (GET /matches/{id}).
  const clubNameOf = (side) => clubs[sideNumber(side) - 1]?.name ?? `Club ${sideNumber(side)}`;
  const inShootout = phase === 'penalties';

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

  // El cartel “Tanda de penales” se muestra unos segundos con cada penaltiesStart.
  const [visibleBannerId, setVisibleBannerId] = useState(null);
  useEffect(() => {
    if (!penaltiesBanner) return undefined;
    setVisibleBannerId(penaltiesBanner.id);
    const timer = setTimeout(() => setVisibleBannerId(null), PENALTIES_BANNER_MS);
    return () => clearTimeout(timer);
  }, [penaltiesBanner]);

  // Reloj: se muestra tal cual lo manda el back (`elapsedTime`, en segundos).
  // TODO: confirmar con el back si es el tiempo transcurrido o el restante del cuarto.
  // Durante la tanda el reloj queda congelado: se muestra “Penales” en su lugar.
  // Sin `elapsedTime` (partido ya terminado, armado desde GET /matches/{id}) se muestra “Final”.
  let clock = '--:--';
  if (inShootout) clock = 'Penales';
  else if (phase && elapsedTime == null) clock = 'Final';
  else if (phase) clock = `${periodNumber ? `${periodNumber}.º cuarto · ` : ''}${formatClock(elapsedTime)}`;

  const finalResult = result ?? { score1, score2 };
  const penalties = finalResult.penalties ?? null;

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

      {inShootout && (
        <section className="shootout" aria-label="Tanda de penales">
          <p className="shootout__score" aria-live="polite">
            {`Penales ${penaltyScore1} - ${penaltyScore2}`}
          </p>
          <PenaltyBoard kicks={penaltyKicks} clubs={clubs} />
          {penaltyCurrent && (
            <PenaltyDuel
              current={penaltyCurrent}
              countdown={penaltyCountdownSeconds}
              remaining={penaltyRemainingSeconds}
            />
          )}
        </section>
      )}

      <div className="overlay__stage">
        {connecting && <p className="banner">{status === 'reconnecting' ? 'Reconectando…' : 'Conectando con el partido…'}</p>}
        {waiting && <p className="banner">Esperando al rival…</p>}

        {phase === 'countdown' && (
          <div className="countdown" role="status">
            {countdown ? (
              <>
                <span className="countdown__label">{periodNumber ? `Empieza el ${periodNumber}.º cuarto` : 'Empieza el partido'}</span>
                {countdownLeft !== null && <span className="countdown__number" key={countdownLeft}>{countdownLeft}</span>}
              </>
            ) : (
              // Conexión en medio de la cuenta: no llegó periodStart, no se sabe cuánto falta.
              <span className="countdown__label">Reanudando…</span>
            )}
          </div>
        )}

        {phase === 'paused' && (
          <PausePanel key={pauseCount} reason={pauseReason} remainingSeconds={pauseRemaining} roster={roster} />
        )}

        {inShootout && penaltyCountdownSeconds !== null && (
          <div className="countdown" role="timer" aria-label="Cuenta previa del penal">
            <span className="countdown__label">Empieza el penal</span>
            <span className="countdown__number" key={penaltyCountdownSeconds}>
              {penaltyCountdownSeconds}
            </span>
          </div>
        )}

        {visibleBannerId !== null && (
          <div className="shootout-banner" key={visibleBannerId} role="status">
            <span className="shootout-banner__word">Tanda de penales</span>
          </div>
        )}

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
              {finalResult.score1} : {finalResult.score2}
              {penalties && ` (${shootoutLabel(penalties)})`}
            </span>
            {penalties && <span className="final__winner">{winnerLabel(penalties, clubNameOf(penalties.winner))}</span>}
            {penalties && <PenaltyBoard kicks={penalties.kicks} clubs={clubs} />}
            <button type="button" onClick={onExit}>Volver al inicio</button>
          </div>
        )}
      </div>
    </div>
  );
}
