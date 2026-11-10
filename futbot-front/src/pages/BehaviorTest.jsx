import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import useBehaviorTestSocket from '../hooks/useBehaviorTestSocket';
import { TEST_TOKEN_TTL_MS, createBehaviorTestConnection } from '../services/behaviorTestService';
import Pitch2DCanvas from '../components/Pitch2DCanvas';
import ScoreboardOverlay from '../components/ScoreboardOverlay';
import './Match.css';
import '../components/TestBehavior.css';

// Margen para no reconectar con un token que está por vencer.
const TOKEN_MARGIN_MS = 5000;

/**
 * Pantalla de la prueba (/behaviors/test). Reutiliza el campo y el marcador del partido normal.
 * La sesión (tokenWs + alineación) llega por el state del router: sin ella no hay nada que probar.
 */
export default function BehaviorTest() {
  const { state } = useLocation();
  if (!state?.session) return <Navigate to="/behaviors" replace />;
  return <BehaviorTestScreen initialSession={state.session} />;
}

function BehaviorTestScreen({ initialSession }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(initialSession);
  const [attempt, setAttempt] = useState(0);
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewError, setRenewError] = useState('');
  const autoRenewsRef = useRef(0);

  const { status, streamRef, meta, closure } = useBehaviorTestSocket({
    behaviorId: session.behaviorId,
    tokenWs: session.tokenWs,
    members: session.members,
    attempt,
  });

  // Club y nombre de cada jugador salen de la alineación del formulario (el tick no los trae).
  const roster = useMemo(
    () => ({
      clubs: [{ name: 'Aliados' }, { name: 'Rivales' }],
      players: Object.fromEntries(
        session.members.map((m) => [
          m.playerId,
          { name: session.playerNames[m.playerId], club: m.club === 'club1' ? 1 : 2 },
        ]),
      ),
    }),
    [session],
  );

  const backToForm = useCallback(
    (notice) => navigate('/behaviors', { replace: true, state: { testForm: { notice } } }),
    [navigate],
  );

  // Repite el POST con la misma alineación (que se conserva en memoria) y reconecta con el token nuevo.
  const renewToken = useCallback(async () => {
    setIsRenewing(true);
    setRenewError('');
    try {
      const { tokenWs } = await createBehaviorTestConnection(session.behaviorId, session.members);
      setSession((prev) => ({ ...prev, tokenWs, tokenAt: Date.now() }));
      setAttempt((n) => n + 1);
    } catch (err) {
      const status = err.response?.status;
      const code = err.response?.data?.code;
      if (status === 401) return; // lo maneja el mecanismo global de autenticación
      if (status === 404 || (status === 409 && code === 'playerOrBehaviorNotOwned')) {
        backToForm('Un comportamiento o jugador de la alineación ya no está disponible. Revisá la alineación.');
        return;
      }
      setRenewError('No pudimos preparar una nueva prueba. Volvé a comportamientos e intentá de nuevo.');
    } finally {
      setIsRenewing(false);
    }
  }, [session.behaviorId, session.members, backToForm]);

  // Cierres del WS que mandan al usuario a otro lado o requieren un token nuevo.
  useEffect(() => {
    if (!closure) return;
    if (closure.kind === 'unexpected' || closure.kind === 'notFound') {
      backToForm(closure.message); // 4403 / 4404: volver al formulario (y refrescar selectores)
    } else if (closure.kind === 'tokenExpired' && autoRenewsRef.current < 1) {
      autoRenewsRef.current += 1; // 4401: repetir el POST y reconectar, una sola vez seguida
      renewToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona a un cierre nuevo
  }, [closure]);

  // Llegó un tick: la conexión funciona, se vuelve a permitir el auto-renovado.
  useEffect(() => {
    if (meta.phase !== null) autoRenewsRef.current = 0;
  }, [meta.phase]);

  const retry = () => {
    if (isRenewing) return;
    autoRenewsRef.current = 0;
    if (Date.now() - session.tokenAt >= TEST_TOKEN_TTL_MS - TOKEN_MARGIN_MS) {
      renewToken(); // el token venció: nuevo POST
    } else {
      setAttempt((n) => n + 1); // mismo token: reconectar inicia una prueba nueva desde cero
    }
  };

  const exit = () => navigate('/behaviors', { replace: true });

  const finished = meta.phase === 'finished';
  const interrupted =
    closure && !finished && !['ended', 'tokenExpired', 'unexpected', 'notFound'].includes(closure.kind);
  // No hay "esperando al rival" en una prueba: entre open y el primer tick se sigue mostrando "conectando".
  const overlayStatus = status === 'open' && meta.phase === null ? 'connecting' : status;

  return (
    <main className="match">
      <div className="match__stage">
        <Pitch2DCanvas streamRef={streamRef} roster={roster} />
        <ScoreboardOverlay
          meta={meta}
          roster={roster}
          status={overlayStatus}
          onExit={retry}
          finishedTitle="Prueba terminada"
          exitLabel="Volver a probar"
        />
      </div>

      <div className="behavior-test__bar">
        <button type="button" onClick={exit}>
          Volver a comportamientos
        </button>
        {(finished || interrupted) && (
          <button type="button" onClick={retry} disabled={isRenewing}>
            {isRenewing ? 'Preparando…' : 'Volver a probar'}
          </button>
        )}
      </div>

      {interrupted && (
        <p className="behavior-test__message" role="alert">
          {closure.message}
        </p>
      )}
      {renewError && (
        <p className="behavior-test__message" role="alert">
          {renewError}
        </p>
      )}
    </main>
  );
}
