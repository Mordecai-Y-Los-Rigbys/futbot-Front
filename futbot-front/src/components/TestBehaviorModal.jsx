import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TestLineupForm from './TestLineupForm';
import { getBehaviors } from '../services/behaviorService';
import { getPlayersPage } from '../services/playerService';
import {
  TEST_POST_ERROR_MESSAGES,
  createBehaviorTestConnection,
  mapTestFieldErrors,
} from '../services/behaviorTestService';
import './TestBehavior.css';

// Los 6 selectores de jugador piden la misma página: se comparte la promesa para hacer 1 request por lista.
const withSharedRequests = (fetcher) => {
  const cache = new Map();
  return (name, page) => {
    const key = `${name}|${page}`;
    if (!cache.has(key)) {
      cache.set(
        key,
        fetcher(name, page).catch((error) => {
          cache.delete(key);
          throw error;
        }),
      );
    }
    return cache.get(key);
  };
};

/**
 * Modal "Probar comportamiento": arma la alineación y pide el tokenWs.
 * Se monta nuevo en cada apertura, así que el formulario siempre arranca vacío.
 * Al confirmar navega a /behaviors/test con la sesión en el state (el token y la alineación
 * viven en memoria mientras dura la pantalla).
 */
export default function TestBehaviorModal({ onClose, initialNotice = '' }) {
  const navigate = useNavigate();
  const [lineup, setLineup] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(initialNotice);
  const [fieldErrors, setFieldErrors] = useState({});
  // Cambia tras un 404/409: renueva los fetchers y, con eso, recarga los selectores.
  const [reloadKey, setReloadKey] = useState(0);

  /* eslint-disable react-hooks/exhaustive-deps -- reloadKey es justamente lo que invalida los fetchers */
  const fetchPlayers = useMemo(() => withSharedRequests((name, page) => getPlayersPage(name, page)), [reloadKey]);
  // El filtro por tipo va al servidor (no en el cliente) para no romper la paginación.
  const fetchBehaviors = useMemo(
    () => withSharedRequests((name, page) => getBehaviors(name, page, { type: 'playerBehavior' })),
    [reloadKey],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSubmitting, onClose]);

  const refreshSelectors = () => setReloadKey((key) => key + 1);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!lineup || isSubmitting) return; // evita envíos dobles
    setIsSubmitting(true);
    setFormError('');
    setFieldErrors({});

    // La API usa el behavior del delantero de club1 (primera fila) como "el behavior que se prueba".
    const { members, playerNames } = lineup;
    const behaviorId = members[0].behaviorId;

    try {
      const { tokenWs } = await createBehaviorTestConnection(behaviorId, members);
      navigate('/behaviors/test', {
        state: { session: { behaviorId, tokenWs, tokenAt: Date.now(), members, playerNames } },
      });
    } catch (err) {
      setIsSubmitting(false);
      if (!err.response) {
        setFormError('No se pudo conectar con el servidor.');
        return;
      }
      const { status, data } = err.response;
      const code = data?.code;

      if (status === 401) return; // lo maneja el mecanismo global de autenticación
      if (status === 400 && code === 'invalidFields') {
        const mapped = mapTestFieldErrors(data.errors);
        setFieldErrors(mapped);
        if (mapped.members) setFormError(mapped.members);
        return;
      }
      if (status === 403) {
        setFormError('El comportamiento elegido para el delantero aliado no es tuyo.');
        return;
      }
      if (status === 404) {
        refreshSelectors();
        setFormError('El comportamiento ya no existe. Actualizamos las listas: revisá la alineación.');
        return;
      }
      if (status === 409) {
        if (code === 'playerOrBehaviorNotOwned') refreshSelectors();
        // El behavior de la ruta es el del delantero aliado (primera fila): se marca ahí.
        if (code === 'notPlayerBehavior') {
          setFieldErrors({ 'members.0.behaviorId': TEST_POST_ERROR_MESSAGES.notPlayerBehavior });
        }
        setFormError(TEST_POST_ERROR_MESSAGES[code] ?? 'Conflicto al armar la prueba.');
        return;
      }
      setFormError('Ocurrió un error en el servidor. Intentá de nuevo.');
    }
  };

  return (
    <div className="test-modal__backdrop">
      <div className="test-modal" role="dialog" aria-modal="true" aria-labelledby="test-modal-title">
        <h2 id="test-modal-title">Probar comportamientos</h2>
        <p className="test-modal__help">
          Armá un 3 contra 3 de 3 minutos.
        </p>

        {formError && (
          <div className="test-modal__error" role="alert">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <TestLineupForm
            fetchPlayers={fetchPlayers}
            fetchBehaviors={fetchBehaviors}
            errors={fieldErrors}
            onChange={setLineup}
          />
          <div className="test-modal__actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" disabled={!lineup || isSubmitting}>
              {isSubmitting ? 'Preparando prueba…' : 'Probar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
