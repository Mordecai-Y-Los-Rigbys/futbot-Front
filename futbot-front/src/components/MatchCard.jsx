import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAvatarSrc } from '../utils/avatars';
import './MatchCard.css';

function formatScheduledAt(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function minutesUntil(isoString) {
  const diff = new Date(isoString) - Date.now();
  return Math.max(0, Math.ceil(diff / 60000));
}

function ClubAvatar({ club }) {
  const src = getAvatarSrc(club.avatar);
  return (
    <span className="match-card__club">
      {src ? (
        <img className="match-card__avatar" src={src} alt={club.name} />
      ) : (
        <span className="match-card__avatar match-card__avatar--initial" aria-hidden>
          {club.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="match-card__club-name">{club.name}</span>
    </span>
  );
}

export default function MatchCard({ match }) {
  const { user } = useAuth();
  const [minsLeft, setMinsLeft] = useState(() => minutesUntil(match.scheduledAt));

  useEffect(() => {
    if (match.status !== 'scheduled') return;

    setMinsLeft(minutesUntil(match.scheduledAt));
    const id = setInterval(() => setMinsLeft(minutesUntil(match.scheduledAt)), 60_000);
    return () => clearInterval(id);
  }, [match.status, match.scheduledAt]);

  const isParticipant =
    user && (user.id === match.club1.id || user.id === match.club2.id);

  return (
    <div className="match-card">
      <div className="match-card__clubs">
        <ClubAvatar club={match.club1} />
        <span className="match-card__vs">vs</span>
        <ClubAvatar club={match.club2} />
      </div>

      <p className="match-card__datetime">{formatScheduledAt(match.scheduledAt)}</p>

      {match.status === 'scheduled' && (
        <p className="match-card__countdown">
          {minsLeft === 0 ? 'Empieza ahora' : `Empieza en ${minsLeft} min`}
        </p>
      )}

      {match.status === 'started' && (
        <div className="match-card__live">
          <span className="match-card__live-badge">En juego</span>
          <Link className="match-card__play-btn" to={`/matches/${match.id}`}>
            {isParticipant ? 'Jugar partido' : 'Ver partido'}
          </Link>
        </div>
      )}
    </div>
  );
}
