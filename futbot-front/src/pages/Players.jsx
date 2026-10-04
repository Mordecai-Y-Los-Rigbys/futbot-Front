import { Link } from 'react-router-dom';
import './Players.css';

export default function PlayersPage() {
  return (
    <main className="players-page">
      <h1>Jugadores</h1>
      <p>El listado de jugadores estará disponible próximamente.</p>
      <Link className="players-page__create-button" to="/players/new">
        Crear jugador
      </Link>
    </main>
  );
}
