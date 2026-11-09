import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { unlockLeague } from '../services/leagueService';
import './LeaguePasswordForm.css';

// Formulario para desbloquear una liga privada. Se muestra en lugar del contenido de la pantalla
// cuando el servidor dice que falta acceso (403 leagueAccessRequired).
//
// La contraseña se envía una sola vez a POST /leagues/{id}/access. Si es correcta, el servidor
// recuerda el desbloqueo en la sesión (la cookie que ya existe): el front no guarda la contraseña
// en ningún lado (ni estado compartido, ni localStorage, ni sessionStorage) y limpia el campo al
// terminar cada envío.
//
// Props: `leagueId` y `leagueName` (el nombre sale de GET /leagues/{id}, que no pide contraseña),
// `onSuccess()` (el desbloqueo salió bien: la pantalla repite lo que había fallado) y `onBack()`.
export default function LeaguePasswordForm({ leagueId, leagueName, onSuccess, onBack }) {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!password || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await unlockLeague(leagueId, { password });
      onSuccess();
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        navigate('/login', { replace: true });
      } else if (status === 404) {
        navigate('/leagues', { replace: true });
      } else if (status === 403) {
        setError('Contraseña incorrecta');
      } else {
        setError('No pudimos verificar la contraseña. Intentá nuevamente.');
      }
    } finally {
      setPassword('');
      setIsSubmitting(false);
    }
  };

  return (
    <form className="league-password" onSubmit={handleSubmit}>
      <h1>{leagueName}</h1>
      <p>Esta liga es privada. Ingresá la contraseña para entrar.</p>

      <label className="league-password__field">
        Contraseña de la liga
        <input
          type="password"
          required
          maxLength={72}
          autoComplete="off"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}

      <div className="league-password__actions">
        <button type="button" onClick={onBack}>Volver</button>
        <button className="league-password__submit" type="submit" disabled={!password || isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </form>
  );
}
