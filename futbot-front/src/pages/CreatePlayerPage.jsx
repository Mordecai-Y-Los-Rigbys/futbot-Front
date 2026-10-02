import { useState } from 'react';
import './CreatePlayerPage.css';

export default function CreatePlayerPage() {
  const [name, setName] = useState('');

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
    </main>
  );
}
