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
    </main>
  );
}
