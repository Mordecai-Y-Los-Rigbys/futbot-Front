import { useEffect, useId, useState } from 'react';
import { getBehaviors } from '../services/behaviorService';
import { getMatchBehavior, getMatchTeam, reassignBehavior } from '../services/matchService';
import { splitTeam } from '../utils/substitutions';
import './MatchBehaviorPanel.css';

// El backend responde de a 50. Se repite acá (y no se importa de behaviorService)
// para tolerar respuestas sin `pageSize`.
const DEFAULT_PAGE_SIZE = 50;

const INVALID_FORMAT = 'La respuesta de comportamientos no tiene el formato esperado.';

async function getAllPlayerBehaviors(signal) {
  const firstPage = await getBehaviors('', 1, { signal, type: 'playerBehavior' });
  if (!Array.isArray(firstPage?.items) || !Number.isInteger(firstPage.total)) {
    throw new Error(INVALID_FORMAT);
  }

  const pageSize = Number.isInteger(firstPage.pageSize) && firstPage.pageSize > 0
    ? firstPage.pageSize
    : DEFAULT_PAGE_SIZE;
  const behaviors = [...firstPage.items];
  const pageCount = Math.ceil(firstPage.total / pageSize);

  for (let page = 2; page <= pageCount; page += 1) {
    const result = await getBehaviors('', page, { signal, type: 'playerBehavior' });
    if (!Array.isArray(result?.items)) throw new Error(INVALID_FORMAT);
    behaviors.push(...result.items);
  }

  return behaviors;
}

function getErrorMessage(error) {
  const status = error.response?.status;
  const code = error.response?.data?.code;

  if (!status) {
    return error.message && error.message !== 'Network Error'
      ? error.message
      : 'No se pudo conectar con el servidor. Intentá nuevamente.';
  }
  if (status === 400) return 'La solicitud no es válida. Revisá los datos e intentá nuevamente.';
  if (status === 401) return 'Tu sesión expiró. Iniciá sesión de nuevo.';
  if (status === 403 && code === 'playerNotStarter') return 'Ese jugador ya no es titular de tu equipo.';
  if (status === 403) return 'No podés cambiar el comportamiento de este jugador.';
  if (status === 404) return 'No encontramos el partido o el jugador seleccionado.';
  if (status === 409 && code === 'matchNotInProgress') return 'El partido no está en curso.';
  if (status === 409 && code === 'playerOrBehaviorNotOwned') return 'El comportamiento seleccionado no te pertenece.';
  if (status === 409 && code === 'behaviorTypeMismatch') return 'El comportamiento no es válido para un jugador.';
  if (status === 409) return 'No se pudo aplicar el cambio porque el partido cambió de estado.';
  return error.response?.data?.message || 'No se pudo completar la solicitud. Intentá nuevamente.';
}

// `teamVersion` sube cuando cambia el equipo (se aplicó una sustitución): se recargan los titulares.
export default function MatchBehaviorPanel({ matchId, canManage, teamVersion = 0 }) {
  const [loadedPanel, setLoadedPanel] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedBehaviorId, setSelectedBehaviorId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  // Plegado por defecto: el panel no tapa la cancha hasta que el usuario lo abre.
  const [isOpen, setIsOpen] = useState(false);
  const bodyId = useId();
  const requestKey = JSON.stringify([matchId, reloadKey, teamVersion]);
  const isCurrentPanel = loadedPanel?.key === requestKey;
  const starters = isCurrentPanel ? loadedPanel.starters : [];
  const behaviors = isCurrentPanel ? loadedPanel.behaviors : [];
  const isLoading = canManage && !isCurrentPanel;
  const isForbidden = isCurrentPanel && loadedPanel.forbidden;
  const loadError = isCurrentPanel ? loadedPanel.errorMessage : '';
  const errorMessage = actionError || loadError;

  useEffect(() => {
    if (!canManage) return undefined;

    const controller = new AbortController();

    async function loadPanel() {
      try {
        const team = await getMatchTeam(matchId, { signal: controller.signal });
        if (!Array.isArray(team?.members)) {
          throw new Error('La respuesta del equipo no tiene el formato esperado.');
        }
        const teamStarters = splitTeam(team).starters.map((member) => ({
          playerId: member.playerId,
          playerName: member.name,
          role: member.role,
        }));
        if (teamStarters.some((starter) => !Number.isInteger(starter.playerId) || !starter.playerName)) {
          throw new Error('La respuesta del equipo no tiene el formato esperado.');
        }

        const [playerBehaviors, startersWithBehavior] = await Promise.all([
          getAllPlayerBehaviors(controller.signal),
          Promise.all(teamStarters.map(async (starter) => {
            const currentBehavior = await getMatchBehavior(matchId, starter.playerId, { signal: controller.signal });
            if (!currentBehavior?.name) throw new Error('No se pudo identificar el comportamiento actual.');
            return { ...starter, currentBehavior };
          })),
        ]);

        if (controller.signal.aborted) return;
        setLoadedPanel({
          key: requestKey,
          starters: startersWithBehavior,
          behaviors: playerBehaviors,
          errorMessage: '',
          forbidden: false,
        });
        setSelectedPlayerId(String(startersWithBehavior[0]?.playerId ?? ''));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('MatchBehaviorPanel: no se pudo cargar el panel', error, error.response?.status, error.response?.data);
        const forbidden = error.response?.status === 403;
        setLoadedPanel({
          key: requestKey,
          starters: [],
          behaviors: [],
          errorMessage: forbidden ? '' : `No pudimos cargar el panel: ${getErrorMessage(error)}`,
          forbidden,
        });
      }
    }

    loadPanel();
    return () => controller.abort();
  }, [canManage, matchId, requestKey]);

  if (!canManage || isForbidden) return null;

  const selectedStarter = starters.find((starter) => String(starter.playerId) === selectedPlayerId);
  const availableBehaviors = behaviors.filter(
    (behavior) => behavior.name !== selectedStarter?.currentBehavior.name,
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const behaviorId = Number(selectedBehaviorId);
    const behavior = behaviors.find((item) => item.id === behaviorId);
    if (!selectedStarter || !behavior || isSubmitting) return;

    const confirmed = window.confirm(
      `¿Cambiar el comportamiento de ${selectedStarter.playerName} a "${behavior.name}"?`,
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setActionError('');
    setSuccessMessage('');
    try {
      await reassignBehavior(matchId, { playerId: selectedStarter.playerId, behaviorId });
      // El back lo aplica desde el siguiente tick: se refleja ya como comportamiento actual.
      setLoadedPanel((current) => (
        current?.key === requestKey
          ? {
            ...current,
            starters: current.starters.map((starter) => (
              starter.playerId === selectedStarter.playerId
                ? { ...starter, currentBehavior: { ...starter.currentBehavior, name: behavior.name } }
                : starter
            )),
          }
          : current
      ));
      setSelectedBehaviorId('');
      setSuccessMessage('Cambio confirmado. Se aplicará desde el siguiente tick.');
    } catch (error) {
      console.error('MatchBehaviorPanel: no se pudo cambiar el comportamiento', error, error.response?.status, error.response?.data);
      setActionError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <aside
      className={`match-behavior-panel${isOpen ? ' match-behavior-panel--open' : ''}`}
      aria-label="Cambio de comportamiento"
      aria-busy={isLoading || isSubmitting}
    >
      <button
        type="button"
        className={`match-behavior-panel__toggle${errorMessage && !isOpen ? ' match-behavior-panel__toggle--alert' : ''}`}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>Comportamientos</span>
        {errorMessage && !isOpen && <span aria-label="con errores">!</span>}
        <span className="match-behavior-panel__chevron" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
      </button>

      {/* Siempre montado (hidden): al plegar no se pierde lo elegido ni se vuelve a cargar. */}
      <div id={bodyId} className="match-behavior-panel__body" hidden={!isOpen}>
        {isLoading && <p role="status">Cargando titulares y comportamientos…</p>}
        {errorMessage && (
          <div className="match-behavior-panel__error" role="alert">
            <p>{errorMessage}</p>
            {!starters.length && (
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
                Reintentar
              </button>
            )}
          </div>
        )}

        {!isLoading && starters.length > 0 && (
          <>
            <ul className="match-behavior-panel__starters">
              {starters.map((starter) => (
                <li key={starter.playerId}>
                  <span>{starter.playerName}</span>
                  <span>{starter.currentBehavior.name}</span>
                </li>
              ))}
            </ul>

            {behaviors.length === 0 ? (
              <p role="status">No tenés comportamientos de jugador disponibles.</p>
            ) : (
              <form className="match-behavior-panel__form" onSubmit={handleSubmit}>
                <label htmlFor="match-behavior-player">Titular</label>
                <select
                  id="match-behavior-player"
                  value={selectedPlayerId}
                  onChange={(event) => {
                    setSelectedPlayerId(event.target.value);
                    setSelectedBehaviorId('');
                    setActionError('');
                    setSuccessMessage('');
                  }}
                >
                  {starters.map((starter) => (
                    <option key={starter.playerId} value={starter.playerId}>{starter.playerName}</option>
                  ))}
                </select>

                <label htmlFor="match-new-behavior">Nuevo comportamiento</label>
                <select
                  id="match-new-behavior"
                  value={selectedBehaviorId}
                  onChange={(event) => {
                    setSelectedBehaviorId(event.target.value);
                    setActionError('');
                    setSuccessMessage('');
                  }}
                  required
                >
                  <option value="">Seleccioná un comportamiento</option>
                  {availableBehaviors.map((behavior) => (
                    <option key={behavior.id} value={behavior.id}>{behavior.name}</option>
                  ))}
                </select>

                <button type="submit" disabled={!selectedBehaviorId || isSubmitting}>
                  {isSubmitting ? 'Confirmando…' : 'Confirmar cambio'}
                </button>
              </form>
            )}
          </>
        )}
        {!isLoading && !errorMessage && starters.length === 0 && (
          <p role="status">No hay titulares disponibles para cambiar.</p>
        )}

        {successMessage && <p className="match-behavior-panel__success" role="status">{successMessage}</p>}
      </div>
    </aside>
  );
}
