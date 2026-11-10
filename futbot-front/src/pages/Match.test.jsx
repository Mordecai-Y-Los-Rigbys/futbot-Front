import { AuthContext } from '../context/AuthContext.jsx';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Match from './Match';
import { getMatch, getMatchLineups, getMatchTeam, getSubstitutions, setSubstitution } from '../services/matchService';
import useMatchWebSocket, { INITIAL_META } from '../hooks/useMatchWebSocket';

vi.mock('../services/matchService', () => ({
  getMatch: vi.fn(),
  getMatchLineups: vi.fn(),
  getMatchTeam: vi.fn(),
  getSubstitutions: vi.fn(),
  setSubstitution: vi.fn(),
}));
// Tiene sus propios tests y también pide el equipo: contaría de más en getMatchTeam.
vi.mock('../components/MatchBehaviorPanel', () => ({ default: () => null }));
vi.mock('../hooks/useMatchWebSocket', async (importOriginal) => ({
  ...(await importOriginal()),
  default: vi.fn(),
}));
// jsdom no implementa canvas. El mock expone roster.players para poder verificarlo.
vi.mock('../components/Pitch2DCanvas', () => ({
  default: ({ roster }) => <output data-testid="pitch">{JSON.stringify(roster?.players ?? {})}</output>,
  TEAM_COLORS: { 1: '#d32f2f', 2: '#1976d2' },
}));
// El panel de pausa usa useAuth y pide las sustituciones: acá no se prueba.
vi.mock('../components/PausePanel', () => ({ default: () => <div>pausa</div> }));

const club1 = { id: 10, name: 'La Scaloneta FC', username: 'scaloni' };
const club2 = { id: 11, name: 'Manchester City', username: 'guardiola' };
const kicks = [
  { club: 'club1', kickerId: 1, kickerName: 'Messi', round: 1, scored: true },
  { club: 'club2', kickerId: 4, kickerName: 'Haaland', round: 1, scored: false },
];
const LINEUPS = {
  club1: [{ playerId: 1, name: 'Messi', role: 'forward' }],
  club2: null,
};

const authValue = { user: { id: 1, username: 'santi' }, setUser: vi.fn(), isCheckingSession: false };

const ui = () => (
  <AuthContext.Provider value={authValue}>
    <MemoryRouter initialEntries={['/matches/5']}>
      <Routes>
        <Route path="/matches/:id" element={<Match />} />
      </Routes>
    </MemoryRouter>
  </AuthContext.Provider>
);
const renderMatch = () => {
  const view = render(ui());
  return { ...view, refresh: () => view.rerender(ui()) };
};

const mockWs = (meta = {}) =>
  useMatchWebSocket.mockReturnValue({
    status: 'open',
    streamRef: { current: null },
    meta: { ...INITIAL_META, ...meta },
    fatal: null,
  });

describe('Match', () => {
  beforeEach(() => {
    getMatch.mockReset();
    getMatchLineups.mockReset();
    // Sin este default, LiveMatch haría .then sobre undefined.
    getMatchLineups.mockResolvedValue(LINEUPS);
    useMatchWebSocket.mockReset();
    mockWs();
  });

  it('muestra “Cargando partido…” hasta que llega el GET', async () => {
    getMatch.mockReturnValue(new Promise(() => {}));

    renderMatch();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando partido');
    expect(useMatchWebSocket).not.toHaveBeenCalled();
  });

  it('partido terminado por penales (recarga después del final): pantalla final desde el GET, sin abrir el WebSocket', async () => {
    getMatch.mockResolvedValue({
      id: 5,
      status: 'finished',
      club1,
      club2,
      result: { score1: 1, score2: 1, penalties: { score1: 4, score2: 3, winner: 'club1', kicks } },
    });

    renderMatch();

    expect(await screen.findByText('Partido finalizado')).toBeInTheDocument();
    expect(screen.getByText(/1 : 1 \(pen\. 4 - 3\)/)).toBeInTheDocument();
    expect(screen.getByText('Gana La Scaloneta FC')).toBeInTheDocument();
    expect(screen.getByLabelText('Penal 1: gol, Messi')).toBeInTheDocument();
    expect(screen.getByLabelText('Penal 1: no convertido, Haaland')).toBeInTheDocument();
    expect(useMatchWebSocket).not.toHaveBeenCalled();
    expect(getMatchLineups).not.toHaveBeenCalled();
  });

  it('partido terminado sin tanda: resultado sin penales', async () => {
    getMatch.mockResolvedValue({
      id: 5,
      status: 'finished',
      club1,
      club2,
      result: { score1: 3, score2: 0, penalties: null },
    });

    renderMatch();

    expect(await screen.findByText('Partido finalizado')).toBeInTheDocument();
    expect(screen.getByText('3 : 0')).toBeInTheDocument();
    expect(screen.queryByText(/pen\./)).toBeNull();
  });

  it('partido en curso: abre el WebSocket y usa los nombres del GET', async () => {
    getMatch.mockResolvedValue({ id: 5, status: 'started', club1, club2, result: null });
    mockWs({
      phase: 'penalties',
      penaltyKicks: kicks,
      penaltyScore1: 1,
      penaltyCurrent: { club: 'club1', kickerId: 2, kickerName: 'Di María', defenderId: 11, defenderName: 'Foden' },
      penaltyRemainingSeconds: 7,
    });

    renderMatch();

    expect(await screen.findByText('Penales 1 - 0')).toBeInTheDocument();
    expect(useMatchWebSocket).toHaveBeenCalledWith('5');
    expect(screen.getByRole('list', { name: 'Penales de La Scaloneta FC' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Penales de Manchester City' })).toBeInTheDocument();
  });

  it('si el GET falla igual se mira el partido por WebSocket, con “Club 1” / “Club 2”', async () => {
    getMatch.mockRejectedValue(new Error('boom'));
    mockWs({ phase: 'penalties', penaltyRemainingSeconds: 8 });

    renderMatch();

    await waitFor(() => expect(useMatchWebSocket).toHaveBeenCalled());
    expect(await screen.findByRole('list', { name: 'Penales de Club 1' })).toBeInTheDocument();
  });

  describe('cambio de jugador', () => {
    const team = (starterName = 'Messi') => ({
      members: [
        { playerId: 1, name: starterName, role: 'forward' },
        { playerId: 2, name: 'De Paul', role: 'midfield' },
        { playerId: 3, name: 'Romero', role: 'defense' },
        { playerId: 7, name: 'Di María', role: 'substitute' },
        { playerId: 8, name: 'Álvarez', role: 'substitute' },
        { playerId: 9, name: 'Dibu', role: 'substitute' },
      ],
      coachBehavior: null,
    });
    const hookReturn = (role, meta) => ({
      status: 'open',
      streamRef: { current: null },
      meta: { ...INITIAL_META, ...meta },
      fatal: null,
      role,
    });
    const BUTTON = { name: 'Cambiar Jugador' };

    beforeEach(() => {
      getMatch.mockResolvedValue({ id: 5, status: 'started', club1, club2, result: null });
      getMatchTeam.mockReset();
      getSubstitutions.mockReset();
      setSubstitution.mockReset();
      getMatchTeam.mockResolvedValue(team());
      getSubstitutions.mockResolvedValue({ club1: null, club2: null });
      setSubstitution.mockResolvedValue(undefined);
    });

    it('espectador de un partido de liga: no ve el botón y no se piden el equipo ni la pendiente', async () => {
      useMatchWebSocket.mockReturnValue(hookReturn('spectator', { phase: 'playing', pausesLeft: 3 }));

      renderMatch();

      await screen.findByRole('main');
      await waitFor(() => expect(useMatchWebSocket).toHaveBeenCalled());
      expect(screen.queryByRole('button', BUTTON)).toBeNull();
      expect(getMatchTeam).not.toHaveBeenCalled();
      expect(getSubstitutions).not.toHaveBeenCalled();
    });

    it('jugador en juego: el botón está por encima de la cancha y habilitado', async () => {
      useMatchWebSocket.mockReturnValue(hookReturn('player', { phase: 'playing', pausesLeft: 3 }));

      renderMatch();

      const button = await screen.findByRole('button', BUTTON);
      expect(button).toBeEnabled();
      const stage = screen.getByTestId('pitch').closest('.match__stage');
      expect(button.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(stage.contains(button)).toBe(false);
    });

    it('espera de rival (sin ticks): el botón está deshabilitado', async () => {
      useMatchWebSocket.mockReturnValue(hookReturn('player', {}));

      renderMatch();

      expect(await screen.findByRole('button', BUTTON)).toBeDisabled();
    });

    it('cuenta regresiva inicial: el botón está deshabilitado', async () => {
      useMatchWebSocket.mockReturnValue(hookReturn('player', { phase: 'countdown', pausesLeft: 3 }));

      renderMatch();

      expect(await screen.findByRole('button', BUTTON)).toBeDisabled();
    });

    it('conexión tardía con pausesLeft en 0: el botón está deshabilitado', async () => {
      useMatchWebSocket.mockReturnValue(hookReturn('player', { phase: 'playing', pausesLeft: 0 }));

      renderMatch();

      expect(await screen.findByRole('button', BUTTON)).toBeDisabled();
    });

    it('reconexión a mitad de partido (período 3, pausesLeft 1): el botón está habilitado', async () => {
      useMatchWebSocket.mockReturnValue(hookReturn('player', { phase: 'playing', pausesLeft: 1, periodNumber: 3 }));

      renderMatch();

      expect(await screen.findByRole('button', BUTTON)).toBeEnabled();
    });

    it('flujo completo: abre el formulario, elige y envía; informa que queda pendiente', async () => {
      useMatchWebSocket.mockReturnValue(hookReturn('player', { phase: 'playing', pausesLeft: 3 }));
      renderMatch();

      fireEvent.click(await screen.findByRole('button', BUTTON));
      await screen.findByLabelText('Titular que sale');
      fireEvent.change(screen.getByLabelText('Titular que sale'), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText('Suplente que entra'), { target: { value: '7' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));

      await waitFor(() => expect(setSubstitution).toHaveBeenCalledWith('5', { starterId: 1, substituteId: 7 }));
      expect(await screen.findByText('Cambio registrado: queda pendiente hasta la próxima pausa.')).toBeInTheDocument();
    });

    it('al llegar el evento pause (teamVersion) se vuelve a pedir el equipo y el formulario lo refleja', async () => {
      useMatchWebSocket.mockReturnValue(hookReturn('player', { phase: 'playing', pausesLeft: 3, teamVersion: 0 }));
      const { refresh } = renderMatch();
      fireEvent.click(await screen.findByRole('button', BUTTON));
      await screen.findByLabelText('Titular que sale');
      expect(getMatchTeam).toHaveBeenCalledTimes(1);

      getMatchTeam.mockResolvedValue(team('Di María'));
      useMatchWebSocket.mockReturnValue(
        hookReturn('player', { phase: 'paused', pausesLeft: 2, teamVersion: 1, pauseRemaining: 15, pauseReason: 'hydration', pauseCount: 1 }),
      );
      refresh();

      await waitFor(() => expect(getMatchTeam).toHaveBeenCalledTimes(2));
      expect(await screen.findByRole('option', { name: 'Di María (Delantero)' })).toBeInTheDocument();
    });
  });
});
