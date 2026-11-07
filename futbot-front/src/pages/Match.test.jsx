import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Match from './Match';
import useMatchWebSocket from '../hooks/useMatchWebSocket';
import { getMatch, getMatchLineups } from '../services/matchService';

vi.mock('../hooks/useMatchWebSocket', () => ({ default: vi.fn() }));
vi.mock('../services/matchService', () => ({ getMatch: vi.fn(), getMatchLineups: vi.fn() }));
vi.mock('../components/Pitch2DCanvas', () => ({
  default: ({ roster }) => <output data-testid="players">{JSON.stringify(roster.players)}</output>,
}));
vi.mock('../components/ScoreboardOverlay', () => ({ default: () => null }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

const LINEUPS = {
  club1: [{ playerId: 1, name: 'Messi', role: 'forward' }],
  club2: null,
};

const setPhase = (phase) =>
  useMatchWebSocket.mockReturnValue({
    status: 'open',
    streamRef: { current: {} },
    meta: { phase, pauseCount: 0 },
    fatal: null,
  });

const ui = (
  <MemoryRouter initialEntries={['/matches/5']}>
    <Routes>
      <Route path="/matches/:id" element={<Match />} />
    </Routes>
  </MemoryRouter>
);

describe('Match: nombres de jugadores (lineups)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMatch.mockResolvedValue({ club1: null, club2: null });
    getMatchLineups.mockResolvedValue(LINEUPS);
    setPhase(null);
  });

  it('pide los lineups al montar y arma roster.players', async () => {
    render(ui);

    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('players').textContent)).toEqual({
        1: { name: 'Messi', role: 'forward', club: 1 },
      }),
    );
    expect(getMatchLineups).toHaveBeenCalledTimes(1);
    expect(getMatchLineups.mock.calls[0][0]).toBe('5');
  });

  it('vuelve a pedirlos al llegar el primer tick, y no en los ticks siguientes', async () => {
    const { rerender } = render(ui);
    await waitFor(() => expect(getMatchLineups).toHaveBeenCalledTimes(1));

    setPhase('countdown');
    rerender(ui);
    await waitFor(() => expect(getMatchLineups).toHaveBeenCalledTimes(2));

    setPhase('playing');
    rerender(ui);
    rerender(ui);
    expect(getMatchLineups).toHaveBeenCalledTimes(2);
  });

  it('no pide durante la pausa y vuelve a pedir cuando termina', async () => {
    setPhase('playing');
    const { rerender } = render(ui);
    await waitFor(() => expect(getMatchLineups).toHaveBeenCalledTimes(1));

    setPhase('paused');
    rerender(ui);
    expect(getMatchLineups).toHaveBeenCalledTimes(1);

    setPhase('countdown');
    rerender(ui);
    await waitFor(() => expect(getMatchLineups).toHaveBeenCalledTimes(2));
  });

  it('cancela la request pendiente al desmontar', () => {
    let signal;
    getMatchLineups.mockImplementation((id, options) => {
      signal = options.signal;
      return new Promise(() => {});
    });

    const { unmount } = render(ui);
    expect(signal.aborted).toBe(false);
    unmount();

    expect(signal.aborted).toBe(true);
  });

  it.each([401, 403, 404])('ante un %i no navega y la cancha queda sin nombres', async (status) => {
    getMatchLineups.mockRejectedValue({ response: { status } });
    render(ui);

    await waitFor(() => expect(getMatchLineups).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('players')).toHaveTextContent('{}');
  });
});