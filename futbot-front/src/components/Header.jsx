import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Header.module.css';
import NotificationsBell from './NotificationsBell';

const LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/leagues', label: 'Ligas' },
  { to: '/friendlies', label: 'Amistosos' },
  { to: '/players', label: 'Mis jugadores' },
  { to: '/behaviors', label: 'Mis comportamientos' },
  { to: '/ranking', label: 'Ranking Global' },
];

function Header() {
  const { user } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <NavLink to="/" className={styles.brand}>
          ⚽ FutBot
        </NavLink>
                {user && (
          <div className={styles.topRight}>
            <NotificationsBell />
            <span className={styles.username}>@{user.username}</span>
          </div>
        )}

      </div>

      <nav className={styles.nav} aria-label="Navegación principal">
        <div className={styles.links}>
          {LINKS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}>
              {label}
            </NavLink>
          ))}
        </div>

      </nav>
    </header>
  );
}

export default Header;