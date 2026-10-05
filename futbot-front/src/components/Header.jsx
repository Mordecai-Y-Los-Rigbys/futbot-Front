import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Header.module.css';

const LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/leagues', label: 'Ligas' },
  { to: '/friendlies', label: 'Amistosos' },
  { to: '/players', label: 'Mis jugadores' },
];

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <NavLink to="/" className={styles.brand}>
          ⚽ FutBot
        </NavLink>
        {user && <span className={styles.username}>@{user.username}</span>}
      </div>

      <nav className={styles.nav} aria-label="Navegación principal">
        <div className={styles.links}>
          {LINKS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}>
              {label}
            </NavLink>
          ))}
        </div>
        <button type="button" className={styles.logout} onClick={handleLogout}>
          Logout
        </button>
      </nav>
    </header>
  );
}

export default Header;