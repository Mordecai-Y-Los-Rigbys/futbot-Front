import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAvatarSrc } from '../utils/avatars';
import './NextMatchBanner.css';

function ClubChip({ club }) {
  const src = getAvatarSrc(club.avatar);
  return (
    <span className="next-match-banner__club">
      {src
        ? <img className="next-match-banner__avatar" src={src} alt={club.name} />
        : <span className="next-match-banner__avatar next-match-banner__avatar--initial">{club.name.charAt(0)}</span>
      }
      <span>{club.name}</span>
    </span>
  );
}

export default function NextMatchBanner({ match }) {
  const { user } = useAuth();
  if (!match) return null;

  const isParticipant = user && (user.id === match.club1.id || user.id === match.club2.id);

  return (
    <div className={`next-match-banner${match.status === 'started' ? ' next-match-banner--live' : ''}`}>
      <div className="next-match-banner__clubs">
        <ClubChip club={match.club1} />
        <span className="next-match-banner__vs">vs</span>
        <ClubChip club={match.club2} />
      </div>

      {match.status === 'started' && (
        <Link className="next-match-banner__btn" to={`/matches/${match.id}`}>
          {isParticipant ? 'Jugar partido' : 'Ver partido'}
        </Link>
      )}

      {match.status === 'scheduled' && (
        <p className="next-match-banner__info">
          Próximo partido
        </p>
      )}
    </div>
  );
}
