import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPlayer } from '../services/playerService';
import './CreatePlayerPage.css';

// Estadisticas iniciales para los sliders.
const INITIAL_STATS = {
  power: 20,
  agility: 20,
  control: 20,
  speed: 20,
  strength: 20,
};

const MAX_POINTS = 300;
const MIN_STAT = 20;
const MAX_STAT = 100;

// Claves del payload y sus etiquetas correspondientes.
const STAT_LABELS = {
  power: 'Power',
  agility: 'Agility',
  control: 'Control',
  speed: 'Speed',
  strength: 'Strength',
};

export default function CreatePlayerPage() {
  const navigate = useNavigate();
  // Estado local de los datos editables y del feedback de la petición.
  const [name, setName] = useState('');
  const [stats, setStats] = useState(INITIAL_STATS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // El total y los errores se derivan del formulario para mantenerse sincronizados con cada cambio.
  const pointsUsed = Object.values(stats).reduce((total, value) => total + value, 0);
  const pointsRemaining = MAX_POINTS - pointsUsed;
  const validationErrors = [];

  // Comprueba nombre y estadísticas.
  if (!name.trim()) {
    validationErrors.push('Ingresá el nombre del jugador.');
  } else if (name.length > 20) {
    validationErrors.push('El nombre no puede superar los 20 caracteres.');
  }

  // Comprueba el rango individual de cada estadística.
  Object.entries(stats).forEach(([stat, value]) => {
    if (!Number.isInteger(value) || value < MIN_STAT || value > MAX_STAT) {
      validationErrors.push(`${STAT_LABELS[stat]} debe estar entre ${MIN_STAT} y ${MAX_STAT}.`);
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

  // Actualiza solo la estadística cuyo slider cambió. El total nunca pasa de MAX_POINTS:
  // si el slider quiere subir más de lo que queda, se frena en el tope.
  const handleStatChange = (event) => {
    const { name: stat, value } = event.target;
    setSuccessMessage('');
    setStats((currentStats) => {
      const usedByOthers = Object.entries(currentStats)
        .reduce((total, [key, current]) => (key === stat ? total : total + current), 0);
      const highestAllowed = Math.min(MAX_STAT, MAX_POINTS - usedByOthers);
      const next = Math.max(MIN_STAT, Math.min(Number(value), highestAllowed));
      return { ...currentStats, [stat]: next };
    });
  };

  // Envía únicamente formularios válidos y administra los estados de carga, éxito y error.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Solo se envian los datos del nuevo jugador, el id lo saca el back.
      await createPlayer({
        name: name.trim(),
        ...stats,
      });
      // No se redirige: se avisa y se deja el formulario limpio para crear otro jugador.
      setName('');
      setStats(INITIAL_STATS);
      setSuccessMessage('¡Jugador creado correctamente!');
    } catch (error) {
      const responseData = error.response?.data;
      setErrorMessage(
        responseData?.message
          || (Array.isArray(responseData?.errors) ? responseData.errors.join(' ') : '')
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
      {/* noValidate es para mostrar validaciones propias y tambien el contador de puntos. */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="create-player-page__field">
          <label htmlFor="player-name">Nombre</label>
          <input
            id="player-name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSuccessMessage('');
            }}
            maxLength={20}
            autoComplete="off"
            disabled={isSubmitting}
          />
        </div>
        <fieldset className="create-player-page__stats">
          <legend>Estadísticas</legend>
          {/* Los sliders usan los nombres del payload y muestran su valor actual. */}
          {Object.entries(STAT_LABELS).map(([stat, label]) => (
            <div className="create-player-page__stat" key={stat}>
              <label htmlFor={`player-${stat}`}>{label}</label>
              <output htmlFor={`player-${stat}`}>{stats[stat]}</output>
              <input
                id={`player-${stat}`}
                name={stat}
                type="range"
                min={MIN_STAT}
                max={MAX_STAT}
                step="1"
                value={stats[stat]}
                onChange={handleStatChange}
                disabled={isSubmitting}
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
        <div className="create-player-page__actions">
          <button
            className="create-player-page__cancel"
            type="button"
            onClick={() => navigate('/')}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            className="create-player-page__submit"
            type="submit"
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? 'Creando jugador…' : 'Crear jugador'}
          </button>
        </div>
      </form>
    </main>
  );
}
