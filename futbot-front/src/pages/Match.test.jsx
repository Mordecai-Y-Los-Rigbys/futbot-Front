import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Match from './Match';
import { getMatch } from '../services/matchService';
import useMatchWebSocket, { INITIAL_META } from '../hooks/useMatchWebSocket';

vi.mock('../services/matchService', () => ({ getMatch: vi.fn() }));
vi.mock('../hooks/useMatchWebSocket', async (importOriginal) => ({
  ...(await importOriginal()),
  default: vi.fn(),
}));
// jsdom no implementa canvas.
vi.mock('../components/Pitch2DCanvas', () => ({ default: () => <div data-testid="pitch" />, TEAM_COLORS: { 1: '#d32f2f', 2: '#1976d2' } }));

const club1 = { id: 10, name: 'La Scaloneta FC', username: 'scaloni' };
const club2 = { id: 11, name: 'Manchester City', username: 'guardiola' };
const kicks = [
  { club: 'club1', kickerId: 1, kickerName: 'Messi', round: 1, scored: true },
  { club: 'club2', kickerId: 4, kickerName: 'Haaland', round: 1, scored: false },
];

const renderMatch = () =>
  render(
    <MemoryRouter initialEntries={['/matches/5']}>
      <Routes>
        <Route path="/matches/:id" element={<Match />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Match', () => {
  beforeEach(() => {
    getMatch.mockReset();
    useMatchWebSocket.mockReset();
    useMatchWebSocket.mockReturnValue({
      status: 'open',
      streamRef: { current: null },
      meta: { ...INITIAL_META },
      fatal: null,
    });
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
    useMatchWebSocket.mockReturnValue({
      status: 'open',
      streamRef: { current: null },
      meta: {
        ...INITIAL_META,
        phase: 'penalties',
        penaltyKicks: kicks,
        penaltyScore1: 1,
        penaltyCurrent: { club: 'club1', kickerId: 2, kickerName: 'Di María', defenderId: 11, defenderName: 'Foden' },
        penaltyRemainingSeconds: 7,
      },
      fatal: null,
    });

    renderMatch();

    expect(await screen.findByText('Penales 1 - 0')).toBeInTheDocument();
    expect(useMatchWebSocket).toHaveBeenCalledWith('5');
    expect(screen.getByRole('list', { name: 'Penales de La Scaloneta FC' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Penales de Manchester City' })).toBeInTheDocument();
  });

  it('si el GET falla igual se mira el partido por WebSocket, con “Club 1” / “Club 2”', async () => {
    getMatch.mockRejectedValue(new Error('boom'));
    useMatchWebSocket.mockReturnValue({
      status: 'open',
      streamRef: { current: null },
      meta: { ...INITIAL_META, phase: 'penalties', penaltyRemainingSeconds: 8 },
      fatal: null,
    });

    renderMatch();

    await waitFor(() => expect(useMatchWebSocket).toHaveBeenCalled());
    expect(await screen.findByRole('list', { name: 'Penales de Club 1' })).toBeInTheDocument();
  });
});
