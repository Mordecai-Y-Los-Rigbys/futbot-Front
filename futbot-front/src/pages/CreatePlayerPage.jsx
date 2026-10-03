import { useState } from 'react';
import './CreatePlayerPage.css';

const INITIAL_STATS = {
  power: 20,
  agility: 20,
  control: 20,
  speed: 20,
  strength: 20,
};

const STAT_LABELS = {
  power: 'Power',
  agility: 'Agility',
  control: 'Control',
  speed: 'Speed',
  strength: 'Strength',
};

export default function CreatePlayerPage() {
  const [name, setName] = useState('');
  const [stats, setStats] = useState(INITIAL_STATS);
  const pointsUsed = Object.values(stats).reduce((total, value) => total + value, 0);
  const pointsRemaining = 300 - pointsUsed;
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

  if (pointsUsed !== 300) {
    validationErrors.push(
      pointsRemaining > 0
        ? `Asigná los ${pointsRemaining} puntos restantes.`
        : `Sobran ${Math.abs(pointsRemaining)} puntos.`,
    );
  }

  const handleStatChange = (event) => {
    const { name: stat, value } = event.target;
    setStats((currentStats) => ({ ...currentStats, [stat]: Number(value) }));
  };

  return (
    <main className="create-player-page">
      <h1>Crear jugador</h1>
      <p>Creá un nuevo jugador para tu club.</p>
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
        Puntos usados: <strong>{pointsUsed} / {300}</strong>
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
    </main>
  );
}