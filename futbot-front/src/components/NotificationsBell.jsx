import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAvatarSrc } from '../utils/avatars';
import useNotificationsWebSocket from '../hooks/useNotificationsWebSocket';
import './NotificationsBell.css';

function NotificationItem({ notification }) {
  const { kind, leagueId, leagueName, club1, club2, result } = notification;

  if (kind === 'matchFinished') {
    return (
      <Link to={`/leagues/${leagueId}/ranking`} className="notifications-bell__item">
        <div className="notifications-bell__avatars">
          {getAvatarSrc(club1.avatar) && (
            <img src={getAvatarSrc(club1.avatar)} alt={club1.name} className="notifications-bell__avatar" />
          )}
          {getAvatarSrc(club2.avatar) && (
            <img src={getAvatarSrc(club2.avatar)} alt={club2.name} className="notifications-bell__avatar" />
          )}
        </div>
        <span className="notifications-bell__text">
          <strong>{club1.name}</strong> {result.score1} – {result.score2} <strong>{club2.name}</strong>
        </span>
      </Link>
    );
  }

  if (kind === 'leagueFinished') {
    return (
      <Link to={`/leagues/${leagueId}/ranking`} className="notifications-bell__item">
        <span className="notifications-bell__text">
          La liga <strong>{leagueName}</strong> terminó.
        </span>
      </Link>
    );
  }

  return null;
}

export default function NotificationsBell() {
  const { user } = useAuth();
  const { notifications, hasUnread, markAsSeen } = useNotificationsWebSocket(!!user);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const toggle = () => {
    if (!open && notifications.length > 0) {
      markAsSeen(notifications[0].id);
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!user) return null;

  return (
    <div className="notifications-bell" ref={panelRef}>
      <button
        className={`notifications-bell__btn${hasUnread ? ' notifications-bell__btn--unread' : ''}`}
        onClick={toggle}
        aria-label="Notificaciones"
      >
        🔔
        {hasUnread && <span className="notifications-bell__dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="notifications-bell__panel">
          {notifications.length === 0 ? (
            <p className="notifications-bell__empty">Sin notificaciones.</p>
          ) : (
            notifications.map((n) => <NotificationItem key={n.id} notification={n} />)
          )}
        </div>
      )}
    </div>
  );
}
