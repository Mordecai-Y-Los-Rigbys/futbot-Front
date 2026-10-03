import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPlayer } from '../services/playerService';
import './CreatePlayerPage.css';

const INITIAL_STATS = {
  power: 20,
  agility: 20,
  control: 20,
  speed: 20,
  strength: 20,
};

const MAX_POINTS = 300;

const STAT_LABELS = {
  power: 'Power',
  agility: 'Agility',
  control: 'Control',
  speed: 'Speed',
  strength: 'Strength',
};

export default function CreatePlayerPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [stats, setStats] = useState(INITIAL_STATS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const redirectTimer = useRef(null);
  const pointsUsed = Object.values(stats).reduce((total, value) => total + value, 0);
  const pointsRemaining = MAX_POINTS - pointsUsed;
  const validationErrors = [];

  if (!name.trim()) {
    validationErrors.push('Ingresá el nombre del jugador.');
  } else if (name.length > 20) {
    validationErrors.push('El nombre no puede superar los 20 caracteres.');
  }

  Object.entries(stats).forEach(([stat, value]) => {
    if (!Number.isInteger(value) || value < 20 || value > 100) {
      validationErrors.push(`${STAT_LABELS[stat]} debe estar entre 20 y 100.`);
    }
  });

  if (pointsUsed !== MAX_POINTS) {
    validationErrors.push(
      pointsRemaining > 0
        ? `Asigná los ${pointsRemaining} puntos restantes.`
        : `Sobran ${Math.abs(pointsRemaining)} puntos.`,
    );
  }

  const isFormValid = validationErrors.length === 0;

  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

  const handleStatChange = (event) => {
    const { name: stat, value } = event.target;
    setStats((currentStats) => ({ ...currentStats, [stat]: Number(value) }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createPlayer({
        name: name.trim(),
        ...stats,
      });
      setSuccessMessage('¡Jugador creado correctamente! Redirigiendo al listado…');
      redirectTimer.current = window.setTimeout(() => navigate('/players'), 1200);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message
          || 'No se pudo crear el jugador. Revisá los datos e intentá nuevamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="create-player-page">
      <h1>Crear jugador</h1>
      <p>Creá un nuevo jugador para tu club.</p>
      {errorMessage && <p className="create-player-page__error" role="alert">{errorMessage}</p>}
      {successMessage && <p className="create-player-page__toast" role="status">{successMessage}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="create-player-page__field">
          <label htmlFor="player-name">Nombre</label>
          <input
            id="player-name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={20}
            autoComplete="off"
          />
        </div>
        <fieldset className="create-player-page__stats">
          <legend>Estadísticas</legend>
          {Object.entries(STAT_LABELS).map(([stat, label]) => (
            <div className="create-player-page__stat" key={stat}>
              <label htmlFor={`player-${stat}`}>{label}</label>
              <output htmlFor={`player-${stat}`}>{stats[stat]}</output>
              <input
                id={`player-${stat}`}
                name={stat}
                type="range"
                min="20"
                max="100"
                step="1"
                value={stats[stat]}
                onChange={handleStatChange}
              />
            </div>
          ))}
        </fieldset>
        <p className="create-player-page__points" aria-live="polite">
          Puntos usados: <strong>{pointsUsed} / {MAX_POINTS}</strong>
          {' — '}
          {pointsRemaining > 0
            ? `Faltan ${pointsRemaining} puntos`
            : pointsRemaining < 0
              ? `Sobran ${Math.abs(pointsRemaining)} puntos`
              : 'Total exacto'}
        </p>
        {validationErrors.length > 0 && (
          <ul className="create-player-page__validation" aria-label="Validaciones pendientes">
            {validationErrors.map((message) => <li key={message}>{message}</li>)}
          </ul>
        )}
        <button
          className="create-player-page__submit"
          type="submit"
          disabled={!isFormValid || isSubmitting || Boolean(successMessage)}
        >
          {isSubmitting ? 'Creando jugador…' : 'Crear jugador'}
        </button>
      </form>
    </main>
  );
}