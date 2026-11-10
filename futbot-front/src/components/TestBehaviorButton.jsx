import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import TestBehaviorModal from './TestBehaviorModal';
import { getBehaviors } from '../services/behaviorService';
import { getPlayersPage } from '../services/playerService';
import './TestBehavior.css';

const MIN_PLAYERS = 6;

/**
 * Único botón "Probar comportamiento" de la página de comportamientos (no va por fila ni en el detalle).
 * Se habilita con al menos 1 playerBehavior y al menos 6 jugadores; si no, muestra el motivo.
 */
export default function TestBehaviorButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const [counts, setCounts] = useState(null); // { behaviors, players } | { error: true } | null (cargando)
  const [isOpen, setIsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [recheck, setRecheck] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    Promise.all([
      getBehaviors('', 1, { signal, type: 'playerBehavior' }),
      getPlayersPage('', 1, { signal }),
    ])
      .then(([behaviors, players]) => {
        if (signal.aborted) return;
        setCounts({
          behaviors: behaviors.total ?? behaviors.items.length,
          players: players.total ?? players.items.length,
        });
      })
      .catch(() => {
        if (!signal.aborted) setCounts({ error: true });
      });
    return () => controller.abort();
  }, [recheck]);

  // Si la pantalla de prueba nos devuelve "al formulario" (4403/4404), se reabre con el aviso.
  useEffect(() => {
    const request = location.state?.testForm;
    if (!request) return;
    setNotice(request.notice ?? '');
    setIsOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const close = () => {
    setIsOpen(false);
    setNotice('');
    setRecheck((n) => n + 1); // los totales pudieron cambiar
  };

  let reason = '';
  let missingPlayers = false;
  if (counts === null) reason = 'Verificando si podés armar una prueba…';
  else if (counts.error) reason = 'No pudimos verificar tus jugadores y comportamientos.';
  else if (counts.behaviors < 1) reason = 'Necesitás al menos un comportamiento de jugador.';
  else if (counts.players < MIN_PLAYERS) {
    reason = `Necesitás al menos ${MIN_PLAYERS} jugadores (tenés ${counts.players}).`;
    missingPlayers = true;
  }
  const disabled = reason !== '';

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        title={reason || undefined}
        aria-describedby={reason ? 'test-behavior-reason' : undefined}
      >
        Probar comportamientos
      </button>
      {reason && counts !== null && (
        <p id="test-behavior-reason" className="test-behavior__reason">
          {reason} {missingPlayers && <Link to="/players/new">Crear jugadores</Link>}
        </p>
      )}
      {isOpen && <TestBehaviorModal onClose={close} initialNotice={notice} />}
    </>
  );
}
