import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { lineupsToPlayers } from '../utils/lineups';
import axios from 'axios';
import useMatchWebSocket, { INITIAL_META } from '../hooks/useMatchWebSocket';
import { getMatch, getMatchLineups } from '../services/matchService';
import Pitch2DCanvas from '../components/Pitch2DCanvas';
import ScoreboardOverlay from '../components/ScoreboardOverlay';
import './Match.css';

// `players` (nombre, rol y club de cada titular) sale de GET /matches/{id}/lineups.
// TODO: atributos y behavior por jugador siguen sin contrato.
const EMPTY_PLAYERS = {};
const rosterFor = (match, players = EMPTY_PLAYERS) => ({
  clubs: [match?.club1 ?? null, match?.club2 ?? null],
  players,
});

// Cancha sin ticks: solo dibuja el campo (para la pantalla final de un partido ya terminado).
const EMPTY_STREAM = { current: { prev: null, curr: null, currAt: 0, intervalMs: 50, snapNext: false } };

// Meta de un partido ya terminado, armada con `result` de GET /matches/{id} (sin ticks).
const metaFromResult = (result) => ({
  ...INITIAL_META,
  score1: result.score1,
  score2: result.score2,
  elapsedTime: null,
  phase: 'finished',
  result,
});

// Partido en curso (o que todavía no empezó): se mira por WebSocket.
function LiveMatch({ id, initialMatch }) {
  const navigate = useNavigate();
  const { status, streamRef, meta, fatal } = useMatchWebSocket(id);
  const [match, setMatch] = useState(initialMatch);
  const [players, setPlayers] = useState(EMPTY_PLAYERS);
  const roster = useMemo(() => rosterFor(match, players), [match, players]);

  // true cuando llegó el primer tick: en un amistoso, el rival ya se unió.
  const started = meta.phase !== null;

  // Clubes del partido (GET /matches/{id}). Ya se pidió al abrir la página; se vuelve a pedir
  // al llegar el primer tick, porque en un amistoso club2 es null hasta que el rival se une.
  useEffect(() => {
    if (!started) return undefined;
    const controller = new AbortController();
    getMatch(id, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setMatch(data);
      })
      .catch(() => {
        // Sin datos de clubes el marcador usa "Club 1" / "Club 2". La salida del
        // partido la decide solo el WebSocket (fatal).
      });
    return () => controller.abort();
  }, [id, started]);

    const paused = meta.phase === 'paused';

  // Nombres de los titulares (GET /matches/{id}/lineups). Se pide:
  //  - al montar;
  //  - al llegar el primer tick (`started`): en un amistoso club2 es null hasta que el rival se une;
  //  - al terminar cada pausa: las sustituciones se aplican en las pausas y el suplente que
  //    entra toma el rol de titular. Durante la pausa no se pide (el efecto sale antes).
  // Cualquier error (401, 403, 404, red) solo deja la cancha sin nombres: la salida del
  // partido la decide únicamente el WebSocket (fatal). Se conserva el último roster válido.
  useEffect(() => {
    if (paused) return undefined;
    const controller = new AbortController();
    getMatchLineups(id, { signal: controller.signal })
      .then((lineups) => {
        if (controller.signal.aborted) return;
        setPlayers(lineupsToPlayers(lineups));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [id, started, paused]);

  // Cierre fatal (1008, 4xxx, waitExpired, 401...): sale del partido con un aviso.
  useEffect(() => {
    if (!fatal) return;
    navigate(fatal.to, { replace: true, state: { notice: fatal.message } });
  }, [fatal, navigate]);

  return (
    <main className="match">
      <div className="match__stage">
        <Pitch2DCanvas streamRef={streamRef} roster={roster} />
        <ScoreboardOverlay
          meta={meta}
          roster={roster}
          status={status}
          onExit={() => navigate('/', { replace: true })}
        />
      </div>
    </main>
  );
}

// Partido terminado que se abre de nuevo (por ejemplo, al recargar la página después del
// final): el WebSocket ya no lo acepta, así que el resultado sale del GET.
function FinishedMatch({ match }) {
  const navigate = useNavigate();
  const roster = useMemo(() => rosterFor(match), [match]);
  const meta = useMemo(() => metaFromResult(match.result), [match]);

  return (
    <main className="match">
      <div className="match__stage">
        <Pitch2DCanvas streamRef={EMPTY_STREAM} roster={roster} />
        <ScoreboardOverlay
          meta={meta}
          roster={roster}
          status="closed"
          onExit={() => navigate('/', { replace: true })}
        />
      </div>
    </main>
  );
}

export default function Match() {
  const { id } = useParams();

  // Resultado de la última request terminada, con el id al que corresponde: mientras no sea
  // el del partido actual, estamos cargando (mismo criterio que BehaviorDetail).
  const [loaded, setLoaded] = useState({ id: null, match: null });
  const current = loaded.id === id ? loaded : null;

  useEffect(() => {
    const controller = new AbortController();

    getMatch(id, { signal: controller.signal })
      .then((data) => setLoaded({ id, match: data }))
      .catch((err) => {
        if (axios.isCancel(err) || controller.signal.aborted) return;
        // Sin los datos del partido igual se puede mirar: se muestra "Club 1" / "Club 2" y,
        // si el partido no existe o no hay acceso, el WebSocket informa el motivo.
        setLoaded({ id, match: null });
      });

    return () => controller.abort();
  }, [id]);

  if (!current) {
    return (
      <main className="match">
        <p className="match__status" role="status">Cargando partido…</p>
      </main>
    );
  }

  const { match } = current;
  if (match?.status === 'finished' && match.result) return <FinishedMatch match={match} />;
  return <LiveMatch id={id} initialMatch={match} />;
}
