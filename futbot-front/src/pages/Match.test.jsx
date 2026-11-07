import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Match from './Match';
import { getMatch, getMatchLineups } from '../services/matchService';
import useMatchWebSocket, { INITIAL_META } from '../hooks/useMatchWebSocket';

vi.mock('../services/matchService', () => ({ getMatch: vi.fn(), getMatchLineups: vi.fn() }));
vi.mock('../hooks/useMatchWebSocket', async (importOriginal) => ({
  ...(await importOriginal()),
  default: vi.fn(),
}));
// jsdom no implementa canvas. El mock expone roster.players para poder verificarlo.
vi.mock('../components/Pitch2DCanvas', () => ({
  default: ({ roster }) => <output data-testid="pitch">{JSON.stringify(roster?.players ?? {})}</output>,
  TEAM_COLORS: { 1: '#d32f2f', 2: '#1976d2' },
}));

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

const ui = (
  <MemoryRouter initialEntries={['/matches/5']}>
    <Routes>
      <Route path="/matches/:id" element={<Match />} />
    </Routes>
  </MemoryRouter>
);
const renderMatch = () => render(ui);

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

  describe('nombres de jugadores (lineups)', () => {
    beforeEach(() => {
      getMatch.mockResolvedValue({ id: 5, status: 'started', club1, club2, result: null });
    });

    it('pide los lineups al montar el partido en curso y arma roster.players', async () => {
      renderMatch();

      await waitFor(() =>
        expect(JSON.parse(screen.getByTestId('pitch').textContent)).toEqual({
          1: { name: 'Messi', role: 'forward', club: 1 },
        }),
      );
      expect(getMatchLineups).toHaveBeenCalledTimes(1);
      expect(getMatchLineups.mock.calls[0][0]).toBe('5');
    });

    it('vuelve a pedirlos al llegar el primer tick, y no en los ticks siguientes', async () => {
      const { rerender } = renderMatch();
      await waitFor(() => expect(getMatchLineups).toHaveBeenCalledTimes(1));

      mockWs({ phase: 'countdown' });
      rerender(ui);
      await waitFor(() => expect(getMatchLineups).toHaveBeenCalledTimes(2));

      mockWs({ phase: 'playing' });
      rerender(ui);
      rerender(ui);
      expect(getMatchLineups).toHaveBeenCalledTimes(2);
    });

    it('no pide durante la pausa y vuelve a pedir cuando termina', async () => {
      mockWs({ phase: 'playing' });
      const { rerender } = renderMatch();
      await waitFor(() => expect(getMatchLineups).toHaveBeenCalledTimes(1));

      mockWs({ phase: 'paused' });
      rerender(ui);
      expect(getMatchLineups).toHaveBeenCalledTimes(1);

      mockWs({ phase: 'countdown' });
      rerender(ui);
      await waitFor(() => expect(getMatchLineups).toHaveBeenCalledTimes(2));
    });

    it('cancela la request pendiente al desmontar', async () => {
      let signal;
      getMatchLineups.mockImplementation((id, options) => {
        signal = options.signal;
        return new Promise(() => {});
      });

      const { unmount } = renderMatch();
      await waitFor(() => expect(signal).toBeDefined());
      expect(signal.aborted).toBe(false);
      unmount();

      expect(signal.aborted).toBe(true);
    });

    it.each([401, 403, 404])('ante un %i la cancha queda sin nombres y el partido sigue', async (status) => {
      getMatchLineups.mockRejectedValue({ response: { status } });

      renderMatch();

      await waitFor(() => expect(getMatchLineups).toHaveBeenCalled());
      expect(screen.getByTestId('pitch')).toHaveTextContent('{}');
    });
  });
});