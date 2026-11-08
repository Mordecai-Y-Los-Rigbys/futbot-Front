import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getMatchTeam, getSubstitutions, setSubstitution } from '../services/matchService';
import { ROLE_LABELS, canRequestSubstitution, splitTeam } from '../utils/substitutions';
import './SubstitutionControl.css';

const EMPTY_TEAM = { starters: [], substitutes: [] };

const CONFLICT_MESSAGES = {
  matchNotStarted: 'El partido todavía no empezó: no se pueden pedir cambios.',
  matchInPenalties: 'No se pueden pedir cambios durante la tanda de penales.',
  noPausesLeft: 'Ya no quedan pausas para aplicar el cambio.',
};

const isStaleSelection = (error) =>
  error.response?.data?.errors?.some((e) => e.reason === 'notStarter' || e.reason === 'notSubstitute');

// Mensaje por status / code del PUT. El 401 además se trata de forma global (ver handleSubmit).
function getSubmitError(error) {
  const status = error.response?.status;
  const code = error.response?.data?.code;

  if (!status) return 'No se pudo conectar con el servidor. Intentá nuevamente.';
  if (status === 400 && isStaleSelection(error)) {
    return 'Tu selección quedó desactualizada. Actualizamos el equipo: elegí de nuevo.';
  }
  if (status === 400) return 'La solicitud no es válida. Revisá los jugadores elegidos.';
  if (status === 401) return 'Tu sesión expiró. Iniciá sesión de nuevo.';
  if (status === 403) return 'No sos jugador de este partido: no podés pedir cambios.';
  if (status === 404) return 'El partido no existe.';
  if (status === 409) return CONFLICT_MESSAGES[code] ?? 'No se pudo pedir el cambio porque el partido cambió de estado.';
  return 'No se pudo pedir el cambio. Intentá nuevamente.';
}

/**
 * Botón "Cambiar Jugador" (va por encima de la cancha) y formulario overlay para pedir una
 * sustitución: un suplente entra por un titular. El cambio queda pendiente y el servidor lo
 * aplica al empezar la próxima pausa.
 *
 * - Solo se muestra si `role === 'player'`: los espectadores no lo ven (recibirían 403).
 * - Se habilita con el último tick (`meta`): ver `canRequestSubstitution`.
 * - El equipo (GET /matches/{id}/team) se vuelve a pedir cuando sube `meta.teamVersion`
 *   (evento `pause` y `periodStart` con periodNumber ≥ 2) y los selectores se reinician.
 * - La pendiente se consulta con GET /matches/{id}/substitutions (fuera de una pausa, que es
 *   cuando ese endpoint devuelve la pendiente y no la aplicada).
 */
function SubstitutionPanel({ matchId, role, meta, roster }) {
  const enabled = canRequestSubstitution(role, meta);
  const isPaused = meta?.phase === 'paused';
  const teamVersion = meta?.teamVersion ?? 0;

  const { user, setUser } = useAuth();
  const ids = useId();
  const openButtonRef = useRef(null);
  const starterSelectRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState(EMPTY_TEAM);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [starterId, setStarterId] = useState('');
  const [substituteId, setSubstituteId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(null); // { starterName, substituteName } de mi equipo
  const [pendingReload, setPendingReload] = useState(0);

  // Equipo del usuario: al montar, con cada cambio de equipo (teamVersion) y al recargar por selección vieja.
  useEffect(() => {
    const controller = new AbortController();
    setTeamError('');

    getMatchTeam(matchId, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(data?.members)) throw new Error('formato');
        setTeam(splitTeam(data));
        setTeamLoaded(true);
        // El equipo cambió: las selecciones anteriores pueden ser viejas.
        setStarterId('');
        setSubstituteId('');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setTeamLoaded(false);
        setTeamError('No pudimos cargar tu equipo.');
      });

    return () => controller.abort();
  }, [matchId, teamVersion, reloadKey]);

  // Al aplicarse una sustitución (pause / periodStart ≥ 2) la pendiente deja de existir.
  useEffect(() => {
    setPending(null);
  }, [teamVersion]);

  // Pendiente de mi equipo. Durante una pausa el GET devuelve la APLICADA, no la pendiente: no se pide.
  useEffect(() => {
    if (!enabled || isPaused) return undefined;
    const controller = new AbortController();

    getSubstitutions(matchId, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const [club1, club2] = roster?.clubs ?? [];
        const mineIsClub2 = !!user && club2?.username === user.username && club1?.username !== user.username;
        setPending((mineIsClub2 ? data?.club2 : data?.club1) ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPending(null);
      });

    return () => controller.abort();
    // `user` y `roster` solo deciden de qué lado mirar; no hace falta volver a pedir si cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, enabled, isPaused, teamVersion, pendingReload]);

  const closeForm = useCallback(() => {
    setOpen(false);
    setSubmitError('');
    openButtonRef.current?.focus();
  }, []);

  // Foco en el primer selector al abrir.
  useEffect(() => {
    if (open) starterSelectRef.current?.focus();
  }, [open]);

  const canSubmit = enabled && teamLoaded && starterId !== '' && substituteId !== '' && !submitting;

  const handleOpen = () => {
    if (!enabled) return;
    setNotice('');
    setSubmitError('');
    setOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    const starter = team.starters.find((m) => String(m.playerId) === starterId);
    const substitute = team.substitutes.find((m) => String(m.playerId) === substituteId);

    setSubmitting(true);
    setSubmitError('');
    try {
      await setSubstitution(matchId, { starterId: Number(starterId), substituteId: Number(substituteId) });
      // 204: queda pendiente hasta la próxima pausa; reemplaza a la anterior, si había.
      if (starter && substitute) setPending({ starterName: starter.name, substituteName: substitute.name });
      setPendingReload((n) => n + 1);
      setStarterId('');
      setSubstituteId('');
      setNotice('Cambio registrado: queda pendiente hasta la próxima pausa.');
      setOpen(false);
      openButtonRef.current?.focus();
    } catch (error) {
      setSubmitError(getSubmitError(error));
      if (error.response?.status === 400 && isStaleSelection(error)) setReloadKey((n) => n + 1);
      if (error.response?.status === 401) setUser?.(null); // tratamiento global: vuelve a /login
    } finally {
      setSubmitting(false);
    }
  };

  const hintId = `${ids}-hint`;

  return (
    <div className="substitution">
      <div className="substitution__bar">
        <button
          ref={openButtonRef}
          type="button"
          className="substitution__open"
          disabled={!enabled}
          aria-describedby={enabled ? undefined : hintId}
          onClick={handleOpen}
        >
          Cambiar Jugador
        </button>

        {!enabled && (
          <span id={hintId} className="substitution__hint">
            Disponible durante el partido, hasta que empiece la última pausa.
          </span>
        )}
        {pending && (
          <p className="substitution__pending" role="status">
            Cambio pendiente: sale <strong>{pending.starterName}</strong>, entra <strong>{pending.substituteName}</strong>
          </p>
        )}
        {notice && <p className="substitution__notice" role="status">{notice}</p>}
      </div>

      {open && (
        <div
          className="substitution__backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <div
            className="substitution__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${ids}-title`}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeForm();
            }}
          >
            <h2 id={`${ids}-title`} className="substitution__title">Cambiar jugador</h2>
            <p className="substitution__help">
              El cambio queda pendiente y se aplica al empezar la próxima pausa. Si pedís otro antes, reemplaza a este.
            </p>

            {teamError && (
              <div className="substitution__error" role="alert">
                <p>{teamError}</p>
                <button type="button" onClick={() => setReloadKey((n) => n + 1)}>Reintentar</button>
              </div>
            )}
            {!teamLoaded && !teamError && <p role="status">Cargando equipo…</p>}

            {teamLoaded && (
              <form className="substitution__form" onSubmit={handleSubmit}>
                <label htmlFor={`${ids}-starter`}>Titular que sale</label>
                <select
                  id={`${ids}-starter`}
                  ref={starterSelectRef}
                  value={starterId}
                  onChange={(event) => {
                    setStarterId(event.target.value);
                    setSubmitError('');
                  }}
                >
                  <option value="">Elegí un titular</option>
                  {team.starters.map((member) => (
                    <option key={member.playerId} value={member.playerId}>
                      {`${member.name} (${ROLE_LABELS[member.role] ?? member.role})`}
                    </option>
                  ))}
                </select>

                <label htmlFor={`${ids}-substitute`}>Suplente que entra</label>
                <select
                  id={`${ids}-substitute`}
                  value={substituteId}
                  onChange={(event) => {
                    setSubstituteId(event.target.value);
                    setSubmitError('');
                  }}
                >
                  <option value="">Elegí un suplente</option>
                  {team.substitutes.map((member) => (
                    <option key={member.playerId} value={member.playerId}>{member.name}</option>
                  ))}
                </select>

                {!enabled && (
                  <p className="substitution__hint" role="status">Ya no se pueden pedir cambios en este momento.</p>
                )}
                {submitError && <p className="substitution__error-text" role="alert">{submitError}</p>}

                <div className="substitution__actions">
                  <button type="button" className="substitution__cancel" onClick={closeForm}>Cancelar</button>
                  <button type="submit" className="substitution__submit" disabled={!canSubmit}>
                    {submitting ? 'Enviando…' : 'Confirmar cambio'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Los espectadores (y mientras no se sabe el rol) no ven nada: tampoco piden el equipo (recibirían 403).
export default function SubstitutionControl(props) {
  if (props.role !== 'player') return null;
  return <SubstitutionPanel {...props} />;
}
